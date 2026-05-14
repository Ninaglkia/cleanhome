// ============================================================================
// Edge Function: stripe-booking-payment  (v3 — escrow hold-until-confirm)
// ----------------------------------------------------------------------------
// ESCROW MODEL (Airbnb-style):
//   - Customer pays the full amount at booking time (capture immediate)
//   - Funds land on the PLATFORM Stripe balance, NOT on cleaner's Connect
//   - No transfer_data.destination, no application_fee_amount on the PI
//   - Transfer to cleaner happens later in booking-confirm-completion,
//     either via client confirmation or 48h auto-confirm cron
//
// Two dispatch modes (winner determined at accept time):
//   A) Legacy single-cleaner: body contains cleaner_id
//   B) Multi-dispatch: preferred_cleaner_ids[] OR search_lat+search_lng
//
// Request body:
//   {
//     // --- MODE A (legacy) ---
//     cleaner_id?: UUID,
//
//     // --- MODE B (multi-dispatch) ---
//     preferred_cleaner_ids?: UUID[],   // max 6; if omitted → broadcast
//     search_lat?: number,              // required for broadcast
//     search_lng?: number,              // required for broadcast
//
//     // --- common fields ---
//     service_type: string,
//     date: YYYY-MM-DD,
//     time_slot: string,
//     num_rooms: number,
//     estimated_hours: number,
//     base_price: number,
//     address?: string,
//     notes?: string,
//     listing_id?: UUID,
//     property_id?: UUID,
//   }
//
// Response: { customer, ephemeralKey, paymentIntent, paymentIntentId, totals, dispatch_mode }
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_API_VERSION = "2023-10-16";
const FEE_RATE = 0.09;
const MAX_CLEANERS = 6;

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

const toCents = (eur: number) => Math.round(eur * 100);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // ── Auth ─────────────────────────────────────────────────────
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

    // ── Parse body ────────────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as {
      cleaner_id?: string;
      preferred_cleaner_ids?: string[];
      search_lat?: number;
      search_lng?: number;
      service_type?: string;
      date?: string;
      time_slot?: string;
      num_rooms?: number;
      estimated_hours?: number;
      base_price?: number;
      address?: string;
      notes?: string;
      listing_id?: string;
      property_id?: string;
    };

    // ── Common field validation ───────────────────────────────────
    if (!body.service_type || !body.date || !body.time_slot) {
      return json({ error: "service_type, date e time_slot sono obbligatori" }, 400);
    }
    // MIN_ORDER matches lib/pricing.ts — €50 is the platform minimum.
    // The upper cap of €10k is sanity (largest realistic clean is ~€800).
    const MIN_BASE = 50;
    if (typeof body.base_price !== "number" || body.base_price < MIN_BASE || body.base_price > 10000) {
      return json(
        { error: `Prezzo base non valido (min €${MIN_BASE})` },
        400
      );
    }
    if (typeof body.num_rooms !== "number" || body.num_rooms < 1 || body.num_rooms > 50) {
      return json({ error: "Numero stanze non valido" }, 400);
    }

    // ── Determine dispatch mode and cleaner list ──────────────────
    let dispatchMode: "legacy" | "preferred" | "broadcast";
    let cleanerIds: string[] = [];
    let legacyCleanerStripeAccount: string | null = null;

    // DEV ONLY: set ALLOW_SELF_BOOKING=true on the Supabase project to bypass
    // the anti-self-booking check. NEVER set this in production.
    const allowSelfBooking = Deno.env.get("ALLOW_SELF_BOOKING") === "true";

    if (body.cleaner_id && UUID_RE.test(body.cleaner_id)) {
      // MODE A: legacy single-cleaner
      if (body.cleaner_id === client.id) {
        if (!allowSelfBooking) {
          return json({ error: "Non puoi prenotare te stesso" }, 400);
        }
        console.warn(
          "[stripe-booking-payment] self-booking allowed by dev override (ALLOW_SELF_BOOKING=true)"
        );
      }
      dispatchMode = "legacy";
      cleanerIds = [body.cleaner_id];

      // Verify KYC for the single cleaner
      const { data: cp, error: cpErr } = await supabase
        .from("cleaner_profiles")
        .select("id, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled")
        .eq("id", body.cleaner_id)
        .maybeSingle();
      if (cpErr || !cp) return json({ error: "Professionista non trovato" }, 404);
      if (!cp.stripe_account_id || !cp.stripe_onboarding_complete || !cp.stripe_charges_enabled) {
        return json({ error: "Il professionista non ha ancora completato la verifica" }, 409);
      }
      legacyCleanerStripeAccount = cp.stripe_account_id;

    } else if (body.preferred_cleaner_ids && body.preferred_cleaner_ids.length > 0) {
      // MODE B1: preferred cleaner list
      // DEV ONLY: self-booking bypass — include self when ALLOW_SELF_BOOKING=true
      const ids = body.preferred_cleaner_ids.filter(
        (id) => UUID_RE.test(id) && (allowSelfBooking || id !== client.id)
      ).slice(0, MAX_CLEANERS);
      if (ids.length === 0) {
        return json({ error: "Nessun cleaner valido in preferred_cleaner_ids" }, 400);
      }
      // Verify all have Stripe enabled
      const { data: profiles } = await supabase
        .from("cleaner_profiles")
        .select("id")
        .in("id", ids)
        .eq("stripe_charges_enabled", true)
        .eq("stripe_onboarding_complete", true);
      const verified = (profiles ?? []).map((p: any) => p.id);
      if (verified.length === 0) {
        return json({ error: "Nessuno dei cleaner selezionati è verificato su Stripe" }, 409);
      }
      dispatchMode = "preferred";
      cleanerIds = verified;

    } else if (typeof body.search_lat === "number" && typeof body.search_lng === "number") {
      // MODE B2: broadcast to nearest cleaners
      const { data: listings } = await supabase
        .rpc("search_listings_by_point", {
          lat: body.search_lat,
          lng: body.search_lng,
        });
      // DEV ONLY: self-booking bypass — include self when ALLOW_SELF_BOOKING=true
      const nearby = (listings ?? [])
        .map((l: any) => l.cleaner_id)
        .filter((id: string) => allowSelfBooking || id !== client.id)
        .slice(0, MAX_CLEANERS);
      if (nearby.length === 0) {
        return json({ error: "Nessun professionista disponibile in questa zona" }, 404);
      }
      dispatchMode = "broadcast";
      cleanerIds = nearby;

    } else {
      return json(
        { error: "Specifica cleaner_id, preferred_cleaner_ids, oppure search_lat+search_lng" },
        400
      );
    }

    // ── Fee computation (always server-side) ──────────────────────
    const basePrice = Number(body.base_price);
    const clientFee = Math.round(basePrice * FEE_RATE * 100) / 100;
    const cleanerFee = Math.round(basePrice * FEE_RATE * 100) / 100;
    const totalPrice = basePrice + clientFee;
    const platformFee = clientFee + cleanerFee;

    // ── Get or create Stripe Customer ─────────────────────────────
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

    // ── Build PaymentIntent params (ESCROW model) ─────────────────
    // Funds go to PLATFORM balance — no transfer_data, no application_fee.
    // Capture is automatic: customer is charged immediately at confirmation.
    // Transfer to cleaner happens later (booking-confirm-completion).
    const piParams: Record<string, string | number | boolean | string[]> = {
      amount: String(toCents(totalPrice)),
      currency: "eur",
      customer: customerId,
      "automatic_payment_methods[enabled]": "true",
      "metadata[booking_type]": "cleaning",
      "metadata[client_id]": client.id,
      "metadata[dispatch_mode]": dispatchMode,
      "metadata[cleaner_ids]": cleanerIds.join(","),
      "metadata[service_type]": body.service_type,
      "metadata[date]": body.date,
      "metadata[time_slot]": body.time_slot,
      "metadata[num_rooms]": String(body.num_rooms),
      "metadata[estimated_hours]": String(body.estimated_hours ?? 1),
      "metadata[base_price]": String(basePrice),
      "metadata[client_fee]": String(clientFee),
      "metadata[cleaner_fee]": String(cleanerFee),
      "metadata[total_price]": String(totalPrice),
      "metadata[platform_fee]": String(platformFee),
      "metadata[address]": (body.address ?? "").slice(0, 450),
      "metadata[notes]": (body.notes ?? "").slice(0, 450),
      "metadata[listing_id]": body.listing_id ?? "",
      "metadata[property_id]": body.property_id ?? "",
      "metadata[search_lat]": String(body.search_lat ?? ""),
      "metadata[search_lng]": String(body.search_lng ?? ""),
    };

    if (dispatchMode === "legacy") {
      piParams["metadata[cleaner_id]"] = cleanerIds[0];
    }
    // legacyCleanerStripeAccount is referenced at booking-confirm-completion time.
    // Marker keeps the variable used (silences linter) and surfaces config errors early.
    if (dispatchMode === "legacy" && !legacyCleanerStripeAccount) {
      throw new Error("Legacy cleaner stripe account missing");
    }

    const paymentIntent = await stripeFetch("payment_intents", piParams);

    const ephemeralKey = await stripeFetch("ephemeral_keys", {
      customer: customerId,
    });

    return json({
      customer: customerId,
      ephemeralKey: ephemeralKey.secret,
      paymentIntent: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      dispatch_mode: dispatchMode,
      cleaner_count: cleanerIds.length,
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
    return json({ error: "Impossibile avviare il pagamento. Riprova più tardi." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
