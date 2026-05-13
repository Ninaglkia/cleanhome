// ============================================================================
// Edge Function: auto-cancel-expired-bookings
// ----------------------------------------------------------------------------
// Called by pg_cron every 5 minutes (via pg_net HTTP POST).
//
// For each expired open booking with all offers terminated:
//   - broadcast_step = 0 → ESCALATE: rebroadcast to wider radius (15 km),
//     up to 12 new cleaners, set deadline +10 min, increment broadcast_step.
//   - broadcast_step ≥ 1 → REFUND: full refund to client, mark auto_cancelled.
//
// Under escrow model the PI is auto-captured at booking time, so refund (not
// cancel) is the right operation.
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const STRIPE_API_VERSION = "2023-10-16";

const ESCALATION_RADIUS_KM = 15;
const ESCALATION_MAX_CLEANERS = 12;
const ESCALATION_DEADLINE_MIN = 10;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

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
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, service: "auto-cancel-expired-bookings" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // ── Auth: only the cron job (with CRON_SECRET) may invoke ─────
  const cronSecret = req.headers.get("x-cron-secret") ?? "";
  if (!CRON_SECRET || !timingSafeEqual(cronSecret, CRON_SECRET)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date().toISOString();

  // Find all open bookings whose deadline expired
  const { data: candidates, error: queryErr } = await supabase
    .from("bookings")
    .select(`
      id, stripe_payment_intent_id, client_id, cleaner_deadline,
      base_price, cleaner_fee, search_lat, search_lng, broadcast_step
    `)
    .eq("status", "open")
    .lte("cleaner_deadline", now);

  if (queryErr) {
    console.error("[auto-cancel] query error:", queryErr.message);
    return new Response(JSON.stringify({ error: "query_failed" }), { status: 500 });
  }

  const results: Array<{ booking_id: string; action: string; ok: boolean; error?: string }> = [];

  for (const bk of candidates ?? []) {
    try {
      // Skip if any pending offer still alive
      const { count: pendingCount } = await supabase
        .from("booking_offers")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", bk.id)
        .eq("status", "pending");

      if ((pendingCount ?? 0) > 0) continue;

      // ── ESCALATE (step 0 → 1) ────────────────────────────────────
      if (
        bk.broadcast_step === 0 &&
        typeof bk.search_lat === "number" &&
        typeof bk.search_lng === "number"
      ) {
        // Find cleaners within 15km we haven't contacted yet
        const { data: nearby, error: rpcErr } = await supabase
          .rpc("search_listings_within_radius", {
            lat: bk.search_lat,
            lng: bk.search_lng,
            radius_km: ESCALATION_RADIUS_KM,
          });
        if (rpcErr) throw rpcErr;

        // Get cleaners that already received an offer (any status)
        const { data: alreadyOffered } = await supabase
          .from("booking_offers")
          .select("cleaner_id")
          .eq("booking_id", bk.id);
        const excluded = new Set((alreadyOffered ?? []).map((o: any) => o.cleaner_id));
        if (bk.client_id) excluded.add(bk.client_id);

        const newCleanerIds = (nearby ?? [])
          .map((r: any) => r.cleaner_id)
          .filter((id: string) => !excluded.has(id))
          .slice(0, ESCALATION_MAX_CLEANERS);

        if (newCleanerIds.length === 0) {
          // No new cleaners available — go straight to refund
          if (bk.stripe_payment_intent_id) {
            await stripeRefundPI(bk.stripe_payment_intent_id);
          }
          await supabase
            .from("bookings")
            .update({
              status: "auto_cancelled",
              payment_status: "refunded",
              broadcast_step: 2,
            })
            .eq("id", bk.id);

          if (bk.client_id) {
            await supabase.from("notifications").insert({
              user_id: bk.client_id,
              type: "booking_auto_cancelled",
              title: "Nessun cleaner disponibile",
              body: "Ti abbiamo rimborsato l'intero importo. L'accredito sulla carta dipende dalla tua banca, tipicamente 3-7 giorni lavorativi.",
              link_path: null,
              metadata: { booking_id: bk.id },
            });
          }
          results.push({ booking_id: bk.id, action: "refund_no_cleaners", ok: true });
          continue;
        }

        // Create new offers
        const newDeadline = new Date(Date.now() + ESCALATION_DEADLINE_MIN * 60 * 1000).toISOString();
        const offerRows = newCleanerIds.map((cid: string) => ({
          booking_id: bk.id,
          cleaner_id: cid,
          status: "pending",
          expires_at: newDeadline,
        }));
        const { error: offersErr } = await supabase.from("booking_offers").insert(offerRows);
        if (offersErr) throw offersErr;

        // Update booking
        await supabase
          .from("bookings")
          .update({
            cleaner_deadline: newDeadline,
            broadcast_step: 1,
            last_broadcast_at: now,
          })
          .eq("id", bk.id);

        // Notify new cleaners — show net earnings
        const cleanerNet =
          Number(bk.base_price ?? 0) - Number(bk.cleaner_fee ?? 0);
        const cleanerNotifs = newCleanerIds.map((cid: string) => ({
          user_id: cid,
          type: "new_booking_request",
          title: "Nuova richiesta di pulizia",
          body: `Guadagni netti: €${cleanerNet.toFixed(2)} — Accetta entro ${ESCALATION_DEADLINE_MIN} min`,
          link_path: `/booking/${bk.id}`,
          metadata: { booking_id: bk.id, escalated: true },
        }));
        await supabase.from("notifications").insert(cleanerNotifs);

        // Notify client — keep them informed
        if (bk.client_id) {
          await supabase.from("notifications").insert({
            user_id: bk.client_id,
            type: "booking_search_widening",
            title: "Stiamo allargando la ricerca",
            body: `Cerchiamo in un'area più ampia. Ti aggiorniamo entro ${ESCALATION_DEADLINE_MIN} minuti.`,
            link_path: `/booking/${bk.id}`,
            metadata: { booking_id: bk.id },
          });
        }

        results.push({
          booking_id: bk.id,
          action: `escalated_to_${newCleanerIds.length}_cleaners`,
          ok: true,
        });
        continue;
      }

      // ── REFUND (step ≥ 1 expired, no acceptance) ─────────────────
      // Expire any leftover offers
      await supabase
        .from("booking_offers")
        .update({ status: "expired" })
        .eq("booking_id", bk.id)
        .eq("status", "pending");

      if (bk.stripe_payment_intent_id) {
        await stripeRefundPI(bk.stripe_payment_intent_id);
      }

      await supabase
        .from("bookings")
        .update({
          status: "auto_cancelled",
          payment_status: "refunded",
          broadcast_step: 2,
        })
        .eq("id", bk.id);

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

      results.push({ booking_id: bk.id, action: "refunded", ok: true });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(`[auto-cancel] booking ${bk.id} failed:`, msg);
      results.push({ booking_id: bk.id, action: "error", ok: false, error: "internal_error" });
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
