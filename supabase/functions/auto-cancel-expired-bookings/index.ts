// ============================================================================
// Edge Function: auto-cancel-expired-bookings
// ----------------------------------------------------------------------------
// Called by pg_cron every 5 minutes (via pg_net HTTP POST).
// Finds all 'open' bookings where every offer has expired and no one accepted.
// For each: cancels Stripe PI, marks booking auto_cancelled, notifies client.
//
// No JWT verification needed — called by cron with service-role Bearer.
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_API_VERSION = "2023-10-16";

// Refund the full payment intent amount.
// Under the escrow model the PI is auto-captured at booking time, so we refund
// the full amount when no cleaner accepts.
async function stripeRefundPI(piId: string) {
  const params = new URLSearchParams({
    payment_intent: piId,
    reason: "requested_by_customer",
  });
  const res = await fetch(`https://api.stripe.com/v1/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION,
      "Idempotency-Key": `refund_no_cleaner_${piId}`,
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data?.error?.message ?? `Stripe refund failed (${res.status})`);
  }
}

serve(async (req: Request) => {
  // Allow both GET (health check) and POST (cron trigger)
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, service: "auto-cancel-expired-bookings" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Find all 'open' bookings that have no pending offers remaining
  // (all offers are expired/declined/cancelled) OR cleaner_deadline has passed.
  const now = new Date().toISOString();

  const { data: expiredBookings, error: queryErr } = await supabase
    .from("bookings")
    .select("id, stripe_payment_intent_id, client_id, cleaner_deadline")
    .eq("status", "open")
    .or(`cleaner_deadline.lte.${now},cleaner_deadline.is.null`);

  if (queryErr) {
    console.error("[auto-cancel] query error:", queryErr.message);
    return new Response(JSON.stringify({ error: queryErr.message }), { status: 500 });
  }

  // For bookings not yet past deadline, also check if all offers are terminal
  const { data: noOfferBookings, error: offerQueryErr } = await supabase
    .from("bookings")
    .select("id, stripe_payment_intent_id, client_id, cleaner_deadline")
    .eq("status", "open")
    .gt("cleaner_deadline", now);

  if (offerQueryErr) {
    console.error("[auto-cancel] offer query error:", offerQueryErr.message);
  }

  // For "not yet deadline" bookings, check if all offers are non-pending
  const additionalCancels: typeof expiredBookings = [];
  if (noOfferBookings && noOfferBookings.length > 0) {
    for (const bk of noOfferBookings) {
      const { count } = await supabase
        .from("booking_offers")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", bk.id)
        .eq("status", "pending");
      if (count === 0) {
        additionalCancels.push(bk);
      }
    }
  }

  const toCancel = [...(expiredBookings ?? []), ...additionalCancels];
  const results: { booking_id: string; ok: boolean; error?: string }[] = [];

  for (const bk of toCancel) {
    try {
      // 1. Expire all pending offers for this booking
      await supabase
        .from("booking_offers")
        .update({ status: "expired" })
        .eq("booking_id", bk.id)
        .eq("status", "pending");

      // 2. Refund full amount (PI auto-captured at booking time under escrow)
      if (bk.stripe_payment_intent_id) {
        await stripeRefundPI(bk.stripe_payment_intent_id);
      }

      // 3. Mark booking auto_cancelled + refunded
      await supabase
        .from("bookings")
        .update({
          status: "auto_cancelled",
          payment_status: "refunded",
        })
        .eq("id", bk.id);

      // 4. Notify client
      if (bk.client_id) {
        await supabase.from("notifications").insert({
          user_id: bk.client_id,
          type: "booking_auto_cancelled",
          title: "Nessun cleaner disponibile",
          body: "Ti abbiamo rimborsato l'intero importo. L'accredito sulla carta arriva in 5-10 giorni lavorativi.",
          link_path: null,
          metadata: { booking_id: bk.id },
        });
      }

      results.push({ booking_id: bk.id, ok: true });
      console.log(`[auto-cancel] cancelled booking ${bk.id}`);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(`[auto-cancel] booking ${bk.id} failed:`, msg);
      results.push({ booking_id: bk.id, ok: false, error: msg });
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
