// ============================================================================
// Edge Function: cancel-listing-subscription
// ----------------------------------------------------------------------------
// Allows a cleaner to cancel the Stripe subscription tied to one of their
// paid listings. The listing remains visible until the end of the current
// billing period; the stripe-webhook handler will deactivate it when
// customer.subscription.deleted fires.
//
// Request body: { listing_id: string }
// Response:     { success: true, ends_at: string }  (ISO 8601)
//
// Deploy with: supabase functions deploy cancel-listing-subscription
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // ── Authentication ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header" }, 401);
    }
    const userToken = authHeader.slice("Bearer ".length).trim();
    if (!userToken) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    // Service-role client: used for getUser() token validation and DB writes
    // that bypass RLS. We never send this key to the client.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(userToken);

    if (userErr || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // ── Input validation ────────────────────────────────────────────────────
    let body: { listing_id?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { listing_id } = body;
    if (!listing_id || !UUID_RE.test(listing_id)) {
      return json({ error: "listing_id must be a valid UUID" }, 400);
    }

    // ── Ownership check ─────────────────────────────────────────────────────
    // Return 404 for both "not found" and "not owner" to avoid leaking
    // whether a listing exists to third parties.
    const { data: listing, error: listingErr } = await supabase
      .from("cleaner_listings")
      .select(
        "id, cleaner_id, stripe_subscription_id, subscription_status, is_first_listing"
      )
      .eq("id", listing_id)
      .maybeSingle();

    if (listingErr || !listing) {
      return json({ error: "Listing not found" }, 404);
    }
    if (listing.cleaner_id !== user.id) {
      return json({ error: "Listing not found" }, 404);
    }

    // ── Business rules ──────────────────────────────────────────────────────
    if (listing.is_first_listing) {
      return json(
        { error: "The first listing is free and has no subscription to cancel" },
        400
      );
    }

    if (!listing.stripe_subscription_id) {
      return json({ error: "No active subscription found for this listing" }, 400);
    }

    // Idempotency: if already canceled, return the existing end date.
    if (listing.subscription_status === "canceled") {
      return json({
        success: true,
        ends_at: null,
        message: "Subscription was already canceled",
      });
    }

    // ── Cancel on Stripe ────────────────────────────────────────────────────
    // cancel_at_period_end=true: the listing stays active until the period
    // ends, then stripe-webhook fires customer.subscription.deleted and
    // we set is_active=false. prorate=false is the default for
    // cancel_at_period_end; if we want to refund the unused days we can
    // add prorate:true, but that requires a credit note flow — keep it
    // simple for now.
    let canceledSubscription: Stripe.Subscription;
    try {
      canceledSubscription = await stripe.subscriptions.update(
        listing.stripe_subscription_id,
        { cancel_at_period_end: true }
      );
    } catch (stripeErr: any) {
      console.error(
        "[cancel-listing-subscription] Stripe error:",
        stripeErr?.message
      );
      return json(
        { error: "Could not cancel subscription on Stripe. Try again later." },
        502
      );
    }

    // current_period_end is a Unix timestamp
    const endsAt = new Date(
      canceledSubscription.current_period_end * 1000
    ).toISOString();

    // ── Update DB (with retry) ──────────────────────────────────────────────
    // Stripe cancellation succeeded above. Now persist the state in DB.
    // If this fails, Stripe and DB are out of sync — the client MUST be
    // informed so they can retry. We attempt up to 3 times (initial + 2
    // retries) with 500 ms backoff before giving up.
    const MAX_RETRIES = 2;
    let updateErr: { message: string } | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const result = await supabase
        .from("cleaner_listings")
        .update({
          subscription_status: "canceled",
          subscription_canceled_at: new Date().toISOString(),
          // listing stays is_active=true until current_period_end;
          // the webhook will flip it to false when the sub expires
        })
        .eq("id", listing_id);

      updateErr = result.error ?? null;
      if (!updateErr) break;

      console.error(
        `[cancel-listing-subscription] DB update failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
        updateErr.message
      );
    }

    if (updateErr) {
      // Stripe was updated but DB is still stale. Return 500 so the
      // client knows the state is inconsistent and can retry the call.
      // The stripe-webhook customer.subscription.deleted event will
      // eventually self-heal the DB when the period ends.
      console.error(
        "[cancel-listing-subscription] DB update failed after all retries — DB/Stripe state is inconsistent. Client should retry.",
        updateErr.message
      );
      return json(
        {
          error:
            "Subscription was canceled on Stripe but the database could not be updated. Please retry this request.",
        },
        500
      );
    }

    return json({ success: true, ends_at: endsAt });
  } catch (err: any) {
    console.error("[cancel-listing-subscription] unhandled error:", err?.message ?? err);
    return json({ error: "Internal server error" }, 500);
  }
});
