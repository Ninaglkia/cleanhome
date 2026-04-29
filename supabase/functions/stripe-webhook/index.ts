// ============================================================================
// Edge Function: stripe-webhook  (v2 — multi-dispatch)
// ----------------------------------------------------------------------------
// Handles Stripe events. Key change vs v1:
//   payment_intent.amount_capturable_updated for dispatch_mode != 'legacy':
//     - Creates booking with cleaner_id=NULL, status='open'
//     - Inserts N booking_offers (one per cleaner in metadata[cleaner_ids])
//     - Notifies each cleaner via insertNotification
//
// All other events are unchanged from v1.
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findBookingByPaymentIntent(
  paymentIntentId: string
): Promise<{ id: string; client_id: string; cleaner_id: string | null } | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, client_id, cleaner_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (error) {
    console.error("[findBookingByPaymentIntent]", error.message);
    return null;
  }
  return data ?? null;
}

async function insertNotification(
  userId: string,
  type: string,
  title: string,
  body: string | null,
  linkPath: string | null,
  metadata: Record<string, unknown> = {}
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body,
    link_path: linkPath,
    metadata,
  });
  if (error) {
    console.error("[insertNotification]", error.message);
  }
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err: any) {
    console.error("[stripe-webhook] signature error:", err?.message);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Subscription events ──────────────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await supabase
          .from("cleaner_listings")
          .update({ subscription_status: "canceled", is_active: false })
          .eq("stripe_subscription_id", sub.id);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as any).subscription as string | undefined;
        if (subId) {
          await supabase
            .from("cleaner_listings")
            .update({ subscription_status: "active", is_active: true })
            .eq("stripe_subscription_id", subId);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as any).subscription as string | undefined;
        if (subId) {
          await supabase
            .from("cleaner_listings")
            .update({ subscription_status: "past_due" })
            .eq("stripe_subscription_id", subId);
        }
        break;
      }

      // ── Connect KYC ──────────────────────────────────────────────
      case "account.updated": {
        const acc = event.data.object as Stripe.Account;
        await supabase
          .from("cleaner_profiles")
          .update({
            stripe_onboarding_complete: !!acc.details_submitted,
            stripe_charges_enabled: !!acc.charges_enabled,
            stripe_payouts_enabled: !!acc.payouts_enabled,
            stripe_details_submitted: !!acc.details_submitted,
          })
          .eq("stripe_account_id", acc.id);
        break;
      }

      // ── Refund ───────────────────────────────────────────────────
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const piId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : (charge.payment_intent as Stripe.PaymentIntent | null)?.id;
        if (!piId) break;
        const booking = await findBookingByPaymentIntent(piId);
        if (!booking) break;
        const refundAmount = charge.amount_refunded / 100;
        await supabase
          .from("bookings")
          .update({ payment_status: "refunded", refund_amount: refundAmount })
          .eq("id", booking.id);
        if (booking.cleaner_id) {
          await insertNotification(
            booking.cleaner_id,
            "payment_refunded",
            "Rimborso effettuato",
            `Una prenotazione è stata rimborsata di €${refundAmount.toFixed(2)}.`,
            `/booking/${booking.id}`,
            { booking_id: booking.id, refund_amount: refundAmount }
          );
        }
        break;
      }

      // ── Dispute opened ───────────────────────────────────────────
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const piId =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : (dispute.payment_intent as Stripe.PaymentIntent | null)?.id;
        if (!piId) break;
        const booking = await findBookingByPaymentIntent(piId);
        if (!booking) break;
        await supabase
          .from("bookings")
          .update({ status: "disputed", dispute_id: dispute.id, payout_blocked: true })
          .eq("id", booking.id);
        const disputePath = `/booking/${booking.id}`;
        const disputeMeta = { booking_id: booking.id, dispute_id: dispute.id };
        const disputeTitle = "Contestazione aperta";
        const disputeBody =
          "Una contestazione è stata aperta su questa prenotazione. Il nostro team la esaminerà.";
        const notifs = [
          insertNotification(booking.client_id, "booking_disputed", disputeTitle, disputeBody, disputePath, disputeMeta),
        ];
        if (booking.cleaner_id) {
          notifs.push(
            insertNotification(booking.cleaner_id, "booking_disputed", disputeTitle, disputeBody, disputePath, disputeMeta)
          );
        }
        await Promise.all(notifs);
        break;
      }

      // ── Dispute closed ───────────────────────────────────────────
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const piId =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : (dispute.payment_intent as Stripe.PaymentIntent | null)?.id;
        if (!piId) break;
        const booking = await findBookingByPaymentIntent(piId);
        if (!booking) break;
        const won = dispute.status === "won";
        await supabase
          .from("bookings")
          .update({
            status: won ? "completed" : "dispute_lost",
            payout_blocked: !won,
            dispute_outcome: dispute.status,
            ...(won ? {} : { payment_status: "refunded" }),
          })
          .eq("id", booking.id);
        const outcomeTitle = won ? "Contestazione risolta a tuo favore" : "Contestazione persa";
        const outcomeBody = won
          ? "La contestazione è stata chiusa a tuo favore."
          : "La contestazione è stata chiusa a sfavore. Il rimborso è stato inviato al cliente.";
        const outcomePath = `/booking/${booking.id}`;
        const outcomeMeta = { booking_id: booking.id, dispute_id: dispute.id, outcome: dispute.status };
        const notifs2 = [
          insertNotification(booking.client_id, "dispute_resolved", outcomeTitle, outcomeBody, outcomePath, outcomeMeta),
        ];
        if (booking.cleaner_id) {
          notifs2.push(
            insertNotification(booking.cleaner_id, "dispute_resolved", outcomeTitle, outcomeBody, outcomePath, outcomeMeta)
          );
        }
        await Promise.all(notifs2);
        break;
      }

      // ── PI canceled ──────────────────────────────────────────────
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const md = (pi.metadata || {}) as Record<string, string>;
        if (md.booking_type !== "cleaning") break;
        const booking = await findBookingByPaymentIntent(pi.id);
        if (!booking) break;
        await supabase
          .from("bookings")
          .update({ status: "auto_cancelled", payment_status: "failed" })
          .eq("id", booking.id);
        break;
      }

      // ── Payment authorized (manual capture) ──────────────────────
      // KEY CHANGE: multi-dispatch creates booking with cleaner_id=NULL, status='open'
      // and inserts N booking_offers, one per cleaner in metadata.
      case "payment_intent.amount_capturable_updated":
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const md = (pi.metadata || {}) as Record<string, string>;
        if (md.booking_type !== "cleaning") break;

        // Idempotency check
        const { data: existing } = await supabase
          .from("bookings")
          .select("id")
          .eq("stripe_payment_intent_id", pi.id)
          .maybeSingle();
        if (existing) break;

        const isLegacy = md.dispatch_mode === "legacy" || (!md.dispatch_mode && md.cleaner_id);
        const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        // Build booking insert payload
        const bookingInsert: Record<string, any> = {
          client_id: md.client_id,
          service_type: md.service_type || "Pulizia",
          booking_date: md.date,
          time_slot: md.time_slot,
          num_rooms: parseInt(md.num_rooms || "1", 10),
          estimated_hours: parseFloat(md.estimated_hours || "1"),
          base_price: parseFloat(md.base_price || "0"),
          client_fee: parseFloat(md.client_fee || "0"),
          cleaner_fee: parseFloat(md.cleaner_fee || "0"),
          total_price: parseFloat(md.total_price || "0"),
          address: md.address || null,
          notes: md.notes || null,
          stripe_payment_intent_id: pi.id,
          cleaner_deadline: deadline,
          payout_blocked: true, // always escrow until explicit release
        };

        if (isLegacy) {
          // Legacy: single cleaner already known, keep previous flow
          bookingInsert.cleaner_id = md.cleaner_id;
          bookingInsert.status = "pending";
        } else {
          // Multi-dispatch: no winner yet
          bookingInsert.cleaner_id = null;
          bookingInsert.status = "open";
        }

        const { data: newBooking, error: insertErr } = await supabase
          .from("bookings")
          .insert(bookingInsert)
          .select("id")
          .single();

        if (insertErr || !newBooking) {
          console.error("[webhook booking insert]", insertErr?.message);
          return new Response("Internal server error", { status: 500 });
        }

        // For multi-dispatch: create one offer per cleaner and notify each
        if (!isLegacy) {
          const cleanerIds = (md.cleaner_ids || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

          if (cleanerIds.length > 0) {
            const offerRows = cleanerIds.map((cid) => ({
              booking_id: newBooking.id,
              cleaner_id: cid,
              status: "pending",
              expires_at: deadline,
            }));

            const { error: offersErr } = await supabase
              .from("booking_offers")
              .insert(offerRows);

            if (offersErr) {
              console.error("[webhook offers insert]", offersErr.message);
            }

            // Notify each cleaner
            await Promise.all(
              cleanerIds.map((cid) =>
                insertNotification(
                  cid,
                  "new_booking_request",
                  "Nuova richiesta di pulizia",
                  "Hai ricevuto una nuova richiesta. Accetta entro 24h!",
                  `/booking/${newBooking.id}`,
                  { booking_id: newBooking.id }
                )
              )
            );
          }
        }
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[stripe-webhook] handler error:", err?.message ?? err);
    return new Response("Internal server error", { status: 500 });
  }
});

async function syncSubscription(sub: Stripe.Subscription) {
  const status = sub.status as
    | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete";
  await supabase
    .from("cleaner_listings")
    .update({
      subscription_status: status,
      is_active: status === "active" || status === "trialing",
    })
    .eq("stripe_subscription_id", sub.id);
}
