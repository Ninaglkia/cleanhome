// ============================================================================
// Edge Function: stripe-webhook
// ----------------------------------------------------------------------------
// Receives Stripe subscription events and keeps cleaner_listings in
// sync. Stripe sends events like:
//   - customer.subscription.created
//   - customer.subscription.updated
//   - customer.subscription.deleted
//   - invoice.payment_succeeded
//   - invoice.payment_failed
//
// The function verifies the Stripe signature, then flips the
// subscription_status on the listing row referenced by the event's
// metadata.listing_id.
//
// Deploy with:  supabase functions deploy stripe-webhook --no-verify-jwt
// (the --no-verify-jwt flag is crucial: Stripe doesn't know about
// Supabase auth, it just signs with its own webhook secret)
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

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  // Stripe requires the raw body to verify the signature — do NOT
  // parse JSON before constructEventAsync.
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
    return new Response(`Webhook Error: ${err?.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Multi-listing subscription events ────────────────────
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
          .update({
            subscription_status: "canceled",
            is_active: false,
          })
          .eq("stripe_subscription_id", sub.id);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as any).subscription as string | undefined;
        if (subId) {
          await supabase
            .from("cleaner_listings")
            .update({
              subscription_status: "active",
              is_active: true,
            })
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

      // ── Stripe Connect: cleaner KYC status ───────────────────
      // Fires whenever Stripe finishes a verification step on the
      // connected account. We flip the cleaner's onboarding flags
      // so the search RPC starts returning them immediately.
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

      // ── Booking payment authorized (manual capture) ──────────
      // With capture_method=manual the PaymentIntent reaches
      // `requires_capture` after the Payment Sheet completes. At
      // that point the funds are on hold but not yet transferred.
      // We create the booking row so the cleaner sees the request;
      // actual capture happens when the cleaner accepts.
      //
      // We also listen to payment_intent.succeeded for backwards
      // compatibility in case any older PaymentIntents made with
      // automatic capture are still in flight.
      case "payment_intent.amount_capturable_updated":
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const md = (pi.metadata || {}) as Record<string, string>;
        if (md.booking_type !== "cleaning") break;

        // Idempotency: if a booking with this payment intent
        // already exists, skip — Stripe may retry webhooks.
        const { data: existing } = await supabase
          .from("bookings")
          .select("id")
          .eq("stripe_payment_intent_id", pi.id)
          .maybeSingle();
        if (existing) break;

        const { error: insertErr } = await supabase.from("bookings").insert({
          client_id: md.client_id,
          cleaner_id: md.cleaner_id,
          service_type: md.service_type || "Pulizia",
          date: md.date,
          time_slot: md.time_slot,
          num_rooms: parseInt(md.num_rooms || "1", 10),
          estimated_hours: parseFloat(md.estimated_hours || "1"),
          base_price: parseFloat(md.base_price || "0"),
          client_fee: parseFloat(md.client_fee || "0"),
          cleaner_fee: parseFloat(md.cleaner_fee || "0"),
          total_price: parseFloat(md.total_price || "0"),
          address: md.address || null,
          notes: md.notes || null,
          status: "pending",
          stripe_payment_intent_id: pi.id,
          cleaner_deadline: new Date(
            Date.now() + 24 * 60 * 60 * 1000
          ).toISOString(),
        });
        if (insertErr) {
          console.error(
            "[webhook booking insert]",
            insertErr.message
          );
          // Return 500 so Stripe retries the webhook — better
          // than silently losing a booking.
          return new Response(
            `Booking insert failed: ${insertErr.message}`,
            { status: 500 }
          );
        }
        break;
      }

      default:
        // Ignore everything else
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[stripe-webhook] handler error:", err?.message ?? err);
    return new Response(`Handler Error: ${err?.message}`, { status: 500 });
  }
});

async function syncSubscription(sub: Stripe.Subscription) {
  // Map Stripe status → our enum values (same strings already).
  const status = sub.status as
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "incomplete";

  await supabase
    .from("cleaner_listings")
    .update({
      subscription_status: status,
      // Deactivate the listing whenever the subscription isn't paying.
      is_active: status === "active" || status === "trialing",
    })
    .eq("stripe_subscription_id", sub.id);
}
