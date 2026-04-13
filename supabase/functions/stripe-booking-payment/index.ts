// ============================================================================
// Edge Function: stripe-booking-payment
// ----------------------------------------------------------------------------
// Called by the client (customer) when they confirm a booking in the
// new.tsx screen. Creates a PaymentIntent with a destination charge
// so that:
//   - Platform (CleanHome) is the merchant of record
//   - application_fee_amount goes to the platform account
//   - transfer_data.destination = cleaner's connected account
//
// The client then presents the Stripe Payment Sheet with the returned
// client_secret. On success, the webhook creates the booking row (we
// only insert the booking row AFTER payment succeeds, to avoid
// orphaned bookings).
//
// Request body:
//   {
//     cleaner_id: UUID,
//     listing_id: UUID (optional, for analytics),
//     service_type: string,
//     date: YYYY-MM-DD,
//     time_slot: string,
//     num_rooms: int,
//     estimated_hours: number,
//     base_price: number (EUR),
//     address: string,
//     notes: string (optional),
//   }
//
// Response: { customer, ephemeralKey, paymentIntent }  (Payment Sheet params)
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_API_VERSION = "2023-10-16";

// Platform fee: 9% added to the customer + 9% withheld from the cleaner.
// So the platform earns 18% of the basePrice and the cleaner receives
// basePrice × 0.91. Payment processing fees come out of the platform cut.
const FEE_RATE = 0.09;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function stripeFetch(
  path: string,
  body?: Record<string, string | number | boolean | string[]>
) {
  const params = new URLSearchParams();
  if (body) {
    for (const [key, value] of Object.entries(body)) {
      if (Array.isArray(value)) {
        for (const v of value) params.append(`${key}[]`, String(v));
      } else {
        params.append(key, String(value));
      }
    }
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION,
    },
    body: body ? params.toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg =
      (data as any)?.error?.message ||
      `Stripe ${path} failed (${res.status})`;
    throw new Error(msg);
  }
  return data as any;
}

// Round to 2 decimals → cents, preventing floating-point drift.
const toCents = (eur: number) => Math.round(eur * 100);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // ── Auth ────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header" }, 401);
    }
    const userToken = authHeader.slice("Bearer ".length).trim();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const {
      data: { user: client },
      error: userErr,
    } = await supabase.auth.getUser(userToken);
    if (userErr || !client) {
      return json({ error: "Invalid session" }, 401);
    }

    // ── Body validation ─────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as {
      cleaner_id?: string;
      listing_id?: string;
      service_type?: string;
      date?: string;
      time_slot?: string;
      num_rooms?: number;
      estimated_hours?: number;
      base_price?: number;
      address?: string;
      notes?: string;
    };

    if (!body.cleaner_id || !UUID_RE.test(body.cleaner_id)) {
      return json({ error: "Invalid cleaner_id" }, 400);
    }
    if (!body.service_type || !body.date || !body.time_slot) {
      return json(
        { error: "service_type, date e time_slot sono obbligatori" },
        400
      );
    }
    if (
      typeof body.base_price !== "number" ||
      body.base_price <= 0 ||
      body.base_price > 10000
    ) {
      return json({ error: "Prezzo base non valido" }, 400);
    }
    if (
      typeof body.num_rooms !== "number" ||
      body.num_rooms < 1 ||
      body.num_rooms > 50
    ) {
      return json({ error: "Numero stanze non valido" }, 400);
    }

    // Prevent clients booking themselves.
    if (body.cleaner_id === client.id) {
      return json({ error: "Non puoi prenotare te stesso" }, 400);
    }

    // ── Load cleaner profile + verify KYC completed ─────────────
    const { data: cleanerProfile, error: cpErr } = await supabase
      .from("cleaner_profiles")
      .select(
        "id, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled"
      )
      .eq("id", body.cleaner_id)
      .maybeSingle();

    if (cpErr || !cleanerProfile) {
      return json({ error: "Professionista non trovato" }, 404);
    }
    if (
      !cleanerProfile.stripe_account_id ||
      !cleanerProfile.stripe_onboarding_complete ||
      !cleanerProfile.stripe_charges_enabled
    ) {
      return json(
        {
          error:
            "Il professionista non ha ancora completato la verifica e non può ricevere pagamenti",
        },
        409
      );
    }

    // ── Compute fees authoritatively server-side ────────────────
    // NEVER trust the client's fee calculation. Recompute.
    const basePrice = Number(body.base_price);
    const clientFee = Math.round(basePrice * FEE_RATE * 100) / 100;
    const cleanerFee = Math.round(basePrice * FEE_RATE * 100) / 100;
    const totalPrice = basePrice + clientFee;
    const platformFee = clientFee + cleanerFee; // what the platform keeps

    // ── Get or create Stripe Customer for the client ────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, stripe_customer_id")
      .eq("id", client.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripeFetch("customers", {
        email: client.email ?? "",
        name: profile?.full_name ?? "",
        "metadata[supabase_user_id]": client.id,
      });
      customerId = customer.id as string;
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", client.id);
    }

    // ── Create PaymentIntent with destination charge ────────────
    // Important:
    //   - amount is the total paid by the client (basePrice + fee)
    //   - application_fee_amount is the platform's cut
    //   - transfer_data.destination = cleaner's connected account
    // Stripe will automatically split the funds and the cleaner
    // sees `totalPrice - application_fee` on their connected account.
    const paymentIntent = await stripeFetch("payment_intents", {
      amount: String(toCents(totalPrice)),
      currency: "eur",
      customer: customerId,
      "automatic_payment_methods[enabled]": "true",
      // Authorize only — the funds are placed on hold on the client's
      // card but not transferred to the cleaner until a capture call.
      // We capture when the cleaner accepts the booking, and we void
      // (cancel) the PaymentIntent when the cleaner declines or when
      // the cleaner_deadline elapses without action.
      capture_method: "manual",
      application_fee_amount: String(toCents(platformFee)),
      "transfer_data[destination]": cleanerProfile.stripe_account_id,
      // Keep all the booking data in metadata so the webhook can
      // insert the booking row only after payment succeeds.
      "metadata[booking_type]": "cleaning",
      "metadata[client_id]": client.id,
      "metadata[cleaner_id]": body.cleaner_id,
      "metadata[listing_id]": body.listing_id ?? "",
      "metadata[service_type]": body.service_type,
      "metadata[date]": body.date,
      "metadata[time_slot]": body.time_slot,
      "metadata[num_rooms]": String(body.num_rooms),
      "metadata[estimated_hours]": String(body.estimated_hours ?? 1),
      "metadata[base_price]": String(basePrice),
      "metadata[client_fee]": String(clientFee),
      "metadata[cleaner_fee]": String(cleanerFee),
      "metadata[total_price]": String(totalPrice),
      "metadata[address]": (body.address ?? "").slice(0, 450),
      "metadata[notes]": (body.notes ?? "").slice(0, 450),
    });

    // Ephemeral key for Payment Sheet — lets the sheet attach the
    // card to the Customer server-side.
    const ephemeralKey = await stripeFetch("ephemeral_keys", {
      customer: customerId,
    });

    return json({
      customer: customerId,
      ephemeralKey: ephemeralKey.secret,
      paymentIntent: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      totals: {
        base_price: basePrice,
        client_fee: clientFee,
        cleaner_fee: cleanerFee,
        total_price: totalPrice,
        platform_fee: platformFee,
      },
    });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[stripe-booking-payment]", msg);
    return json(
      { error: "Impossibile avviare il pagamento. Riprova più tardi." },
      500
    );
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
