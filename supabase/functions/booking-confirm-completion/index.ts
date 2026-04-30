// ============================================================================
// Edge Function: booking-confirm-completion
// ----------------------------------------------------------------------------
// Releases the escrow: transfers the cleaner's net amount from the platform
// balance to the cleaner's Connect account.
//
// Auth modes:
//   - Client confirms manually: caller must be booking.client_id
//   - Cron auto-confirms (after 48h): caller must use SUPABASE_SERVICE_ROLE_KEY
//     and pass { source: "cron" } in the body
//
// Idempotent: re-running on an already-confirmed booking is a no-op.
//
// Request body: { booking_id: UUID, source?: "client" | "cron" }
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_API_VERSION = "2023-10-16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const toCents = (eur: number) => Math.round(eur * 100);

async function stripeFetch(path: string, body?: Record<string, string>) {
  const params = new URLSearchParams();
  if (body) for (const [k, v] of Object.entries(body)) params.append(k, v);
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
  if (!res.ok) throw new Error(data.error?.message ?? "Stripe API error");
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "Missing auth token" }, 401);

  let body: { booking_id?: string; source?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { booking_id, source } = body;
  if (!booking_id) return json({ error: "booking_id is required" }, 400);

  const isCron = source === "cron";
  const isCronAuthorized =
    isCron && token === SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let actorId: string | null = null;
  if (!isCron) {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);
    actorId = user.id;
  } else if (!isCronAuthorized) {
    return json({ error: "Unauthorized cron call" }, 401);
  }

  try {
    const { data: booking, error: loadErr } = await supabase
      .from("bookings")
      .select(`
        id, client_id, cleaner_id, status,
        base_price, client_fee, cleaner_fee, total_price,
        stripe_payment_intent_id, stripe_transfer_id,
        work_done_at, client_confirmed_at, client_dispute_opened_at,
        payout_blocked, payment_status
      `)
      .eq("id", booking_id)
      .maybeSingle();

    if (loadErr || !booking) return json({ error: "Booking not found" }, 404);

    // Authorization
    if (!isCron && booking.client_id !== actorId) {
      return json({ error: "Forbidden" }, 403);
    }

    // Idempotency
    if (booking.client_confirmed_at) {
      return json({ ok: true, status: "already_confirmed", transfer_id: booking.stripe_transfer_id });
    }

    // Preconditions
    if (booking.status !== "accepted") {
      return json({ error: `Booking is ${booking.status}` }, 409);
    }
    if (!booking.work_done_at) {
      return json({ error: "Cleaner has not marked work done yet" }, 409);
    }
    if (booking.client_dispute_opened_at) {
      return json({ error: "Booking is in dispute, manual review required" }, 409);
    }
    if (!booking.cleaner_id) {
      return json({ error: "Booking has no assigned cleaner" }, 409);
    }
    if (!booking.stripe_payment_intent_id) {
      return json({ error: "Booking has no payment intent" }, 409);
    }
    if (booking.payment_status === "refunded") {
      return json({ error: "Booking already refunded" }, 409);
    }

    // For cron: enforce 48h grace period
    if (isCron) {
      const workDone = new Date(booking.work_done_at).getTime();
      const elapsedHours = (Date.now() - workDone) / 36e5;
      if (elapsedHours < 48) {
        return json({ error: `Auto-confirm window not reached (${elapsedHours.toFixed(1)}h)` }, 409);
      }
    }

    // Load cleaner Stripe account
    const { data: cp } = await supabase
      .from("cleaner_profiles")
      .select("stripe_account_id, stripe_charges_enabled, stripe_onboarding_complete")
      .eq("id", booking.cleaner_id)
      .single();

    if (!cp?.stripe_account_id || !cp.stripe_charges_enabled || !cp.stripe_onboarding_complete) {
      return json({ error: "Cleaner Stripe Connect not ready" }, 500);
    }

    // Compute cleaner net: basePrice − cleanerFee (= 91% of basePrice with 9% rate)
    const cleanerNetEur =
      Number(booking.base_price ?? 0) - Number(booking.cleaner_fee ?? 0);
    const cleanerNetCents = toCents(cleanerNetEur);
    if (cleanerNetCents <= 0) {
      return json({ error: "Invalid transfer amount" }, 500);
    }

    // Idempotency key — Stripe will dedupe if cron retries
    const idempotencyKey = `transfer_${booking_id}`;

    const transferRes = await fetch("https://api.stripe.com/v1/transfers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": STRIPE_API_VERSION,
        "Idempotency-Key": idempotencyKey,
      },
      body: new URLSearchParams({
        amount: String(cleanerNetCents),
        currency: "eur",
        destination: cp.stripe_account_id,
        "metadata[booking_id]": booking_id,
        "metadata[source_pi]": booking.stripe_payment_intent_id,
        "metadata[trigger]": isCron ? "auto_confirm_48h" : "client_confirm",
      }).toString(),
    });
    const transferData = await transferRes.json();
    if (!transferRes.ok) {
      throw new Error(transferData.error?.message ?? "Transfer failed");
    }

    // Persist confirmation + transfer id, release payout
    await supabase
      .from("bookings")
      .update({
        client_confirmed_at: new Date().toISOString(),
        stripe_transfer_id: transferData.id,
        payout_blocked: false,
        status: "completed",
      })
      .eq("id", booking_id);

    // Notify cleaner
    await supabase.from("notifications").insert({
      user_id: booking.cleaner_id,
      type: "booking_payout_released",
      title: isCron ? "Pagamento rilasciato (auto-conferma)" : "Pagamento rilasciato",
      body: `Sono stati trasferiti €${cleanerNetEur.toFixed(2)} sul tuo conto Stripe.`,
      link_path: `/booking/${booking_id}`,
      metadata: { booking_id, amount: cleanerNetEur },
    });

    return json({
      ok: true,
      transfer_id: transferData.id,
      amount_eur: cleanerNetEur,
      trigger: isCron ? "auto_confirm" : "client_confirm",
    });
  } catch (err: any) {
    console.error("[booking-confirm-completion]", err?.message ?? err);
    return json({ error: "Errore interno del server" }, 500);
  }
});
