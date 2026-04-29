// ============================================================================
// Edge Function: stripe-booking-action  (v2 — multi-dispatch)
// ----------------------------------------------------------------------------
// action=accept: race-safe first-accept-wins via single CTE
// action=decline: marks own offer declined; triggers auto-cancel if all done
//
// Request body: { booking_id: UUID, action: "accept" | "decline" }
// Response:    { ok: true, status: string }
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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "Missing auth token" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  let body: { booking_id?: string; action?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const { booking_id, action } = body;
  if (!booking_id) return json({ error: "booking_id is required" }, 400);
  if (action !== "accept" && action !== "decline") {
    return json({ error: "action must be 'accept' or 'decline'" }, 400);
  }

  try {
    // Load booking to determine mode
    const { data: booking, error: loadErr } = await supabase
      .from("bookings")
      .select("id, cleaner_id, status, stripe_payment_intent_id")
      .eq("id", booking_id)
      .single();
    if (loadErr || !booking) return json({ error: "Booking not found" }, 404);
    if (!booking.stripe_payment_intent_id) return json({ error: "Booking has no payment intent" }, 400);

    const isDispatch = booking.status === "open";
    const isLegacy = booking.status === "pending";

    // ── LEGACY FLOW (backward compat) ─────────────────────────────
    if (isLegacy) {
      if (booking.cleaner_id !== user.id) return json({ error: "Not allowed" }, 403);
      if (action === "accept") {
        await stripeFetch(`payment_intents/${booking.stripe_payment_intent_id}/capture`, {});
        await supabase.from("bookings").update({ status: "accepted" }).eq("id", booking_id);
        return json({ ok: true, status: "accepted" });
      } else {
        await stripeFetch(`payment_intents/${booking.stripe_payment_intent_id}/cancel`, {
          cancellation_reason: "requested_by_customer",
        });
        await supabase.from("bookings").update({ status: "declined" }).eq("id", booking_id);
        return json({ ok: true, status: "declined" });
      }
    }

    // ── DISPATCH FLOW ─────────────────────────────────────────────
    if (!isDispatch) {
      return json({ error: `Booking is ${booking.status}, no action possible` }, 409);
    }

    // Verify this cleaner has a pending offer
    const { data: myOffer } = await supabase
      .from("booking_offers")
      .select("id, status")
      .eq("booking_id", booking_id)
      .eq("cleaner_id", user.id)
      .maybeSingle();
    if (!myOffer) return json({ error: "Nessuna offerta trovata per questo cleaner" }, 404);
    if (myOffer.status !== "pending") {
      return json({ error: `Offerta già ${myOffer.status}` }, 409);
    }

    if (action === "accept") {
      // ── Race-safe first-accept-wins via CTE ─────────────────────
      // Single atomic query:
      // 1. Win: UPDATE my offer to 'accepted' WHERE still pending → returns id if I won
      // 2. Close: cancel all other pending offers for this booking
      // 3. Claim: UPDATE booking cleaner_id+status WHERE still open (guards duplicate wins)
      const { data: raceResult, error: raceErr } = await supabase.rpc(
        "dispatch_accept_offer",
        { p_booking_id: booking_id, p_cleaner_id: user.id }
      );

      if (raceErr) {
        console.error("[dispatch_accept_offer rpc]", raceErr.message);
        // Fallback: inline CTE via execute_sql not possible from client; return 500
        throw raceErr;
      }

      // raceResult: { won: boolean, cancelled_count: number }
      if (!raceResult?.won) {
        return json({ error: "Richiesta già accettata da un altro professionista" }, 409);
      }

      // ── Load cleaner's Stripe account for transfer ───────────────
      const { data: cp } = await supabase
        .from("cleaner_profiles")
        .select("stripe_account_id")
        .eq("id", user.id)
        .single();

      if (!cp?.stripe_account_id) {
        throw new Error("Stripe account non trovato per il cleaner vincitore");
      }

      // ── Capture PaymentIntent ────────────────────────────────────
      // For multi-dispatch PIs there's no transfer_data yet.
      // We must: capture → then create a separate transfer to cleaner.
      const { data: bk } = await supabase
        .from("bookings")
        .select("base_price, client_fee, cleaner_fee, total_price")
        .eq("id", booking_id)
        .single();

      const toCents = (eur: number) => Math.round(eur * 100);
      const platformFee = toCents(
        (bk?.client_fee ?? 0) + (bk?.cleaner_fee ?? 0)
      );
      const cleanerAmount = toCents(
        (bk?.total_price ?? 0) - (bk?.client_fee ?? 0) - (bk?.cleaner_fee ?? 0)
      );

      // Capture
      await stripeFetch(`payment_intents/${booking.stripe_payment_intent_id}/capture`, {
        amount_to_capture: String(toCents(bk?.total_price ?? 0)),
      });

      // Transfer net amount to cleaner's Connect account
      if (cleanerAmount > 0) {
        await stripeFetch("transfers", {
          amount: String(cleanerAmount),
          currency: "eur",
          destination: cp.stripe_account_id,
          "metadata[booking_id]": booking_id,
          "metadata[source_pi]": booking.stripe_payment_intent_id,
        });
      }

      // Update booking: winner assigned, payout_blocked=true (escrow for review period)
      await supabase
        .from("bookings")
        .update({ status: "accepted", cleaner_id: user.id, payout_blocked: true })
        .eq("id", booking_id);

      // Notify cleaner winner
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "booking_accepted_by_self",
        title: "Hai accettato la prenotazione!",
        body: "Il cliente è stato notificato. Preparati per il servizio.",
        link_path: `/booking/${booking_id}`,
        metadata: { booking_id },
      });

      // Notify client
      const { data: clientData } = await supabase
        .from("bookings")
        .select("client_id")
        .eq("id", booking_id)
        .single();
      if (clientData?.client_id) {
        await supabase.from("notifications").insert({
          user_id: clientData.client_id,
          type: "booking_accepted",
          title: "Prenotazione confermata!",
          body: "Un professionista ha accettato la tua richiesta di pulizia.",
          link_path: `/booking/${booking_id}`,
          metadata: { booking_id },
        });
      }

      // Notify losers (cleaner_ids that got their offer cancelled)
      const { data: cancelledOffers } = await supabase
        .from("booking_offers")
        .select("cleaner_id")
        .eq("booking_id", booking_id)
        .eq("status", "cancelled");

      if (cancelledOffers && cancelledOffers.length > 0) {
        await supabase.from("notifications").insert(
          cancelledOffers.map((o: any) => ({
            user_id: o.cleaner_id,
            type: "booking_offer_cancelled",
            title: "Richiesta non disponibile",
            body: "Questa richiesta è stata presa da un altro professionista.",
            link_path: null,
            metadata: { booking_id },
          }))
        );
      }

      return json({ ok: true, status: "accepted" });

    } else {
      // action === "decline"
      await supabase
        .from("booking_offers")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("booking_id", booking_id)
        .eq("cleaner_id", user.id);

      // Check if ALL offers are now terminal (declined/cancelled/expired)
      const { count } = await supabase
        .from("booking_offers")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", booking_id)
        .eq("status", "pending");

      if (count === 0) {
        // All declined — auto-cancel
        await stripeFetch(`payment_intents/${booking.stripe_payment_intent_id}/cancel`, {
          cancellation_reason: "requested_by_customer",
        });
        await supabase
          .from("bookings")
          .update({ status: "auto_cancelled" })
          .eq("id", booking_id);

        const { data: bkClient } = await supabase
          .from("bookings").select("client_id").eq("id", booking_id).single();
        if (bkClient?.client_id) {
          await supabase.from("notifications").insert({
            user_id: bkClient.client_id,
            type: "booking_auto_cancelled",
            title: "Nessun cleaner disponibile",
            body: "Riprova selezionando più cleaner o un orario diverso.",
            link_path: null,
            metadata: { booking_id },
          });
        }
      }

      return json({ ok: true, status: "declined" });
    }
  } catch (err: any) {
    console.error("[stripe-booking-action]", err?.message ?? err);
    return json({ error: "Errore interno del server. Riprova piu' tardi." }, 500);
  }
});
