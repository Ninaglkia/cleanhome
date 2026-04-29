// ============================================================================
// Edge Function: stripe-subscription-create
// ----------------------------------------------------------------------------
// Called by the RN client when a cleaner taps "+ Nuovo annuncio" after
// already owning a free listing. Creates (or reuses) a Stripe Customer
// tied to the cleaner's user id, starts a €4.99/month subscription with
// an incomplete PaymentIntent, and returns the Payment Sheet params.
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_LISTING_PRICE_ID = Deno.env.get("STRIPE_LISTING_PRICE_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Pin a stable Stripe API version where `latest_invoice.payment_intent`
// is still expanded inline on subscription create. Newer API versions
// (2024-11-20+) removed that field, which would break the Payment Sheet
// flow because we would not receive a client_secret.
const STRIPE_API_VERSION = "2023-10-16";

// Tiny helper — calls the Stripe REST API directly with fetch so we
// don't rely on any third-party SDK that may misbehave on Deno edge.
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

// UUID v4 shape check — cheap defense against weird inputs.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // ── Auth ────────────────────────────────────────────────────
    // The Supabase gateway is configured with --no-verify-jwt so
    // we MUST authenticate the user ourselves. We never expose or
    // accept the service role key from the client; we only use it
    // server-side to validate the user token via getUser().
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header" }, 401);
    }
    const userToken = authHeader.slice("Bearer ".length).trim();
    if (!userToken) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(userToken);

    if (userErr || !user) {
      return json({ error: "Invalid session" }, 401);
    }

    // ── Input validation ────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as {
      listing_id?: string;
    };
    const listingId = body.listing_id;
    if (!listingId || typeof listingId !== "string" || !UUID_RE.test(listingId)) {
      return json({ error: "Invalid listing_id" }, 400);
    }

    // ── Ownership check (RLS-grade) ─────────────────────────────
    const { data: listing, error: listingErr } = await supabase
      .from("cleaner_listings")
      .select(
        "id, cleaner_id, stripe_subscription_id, subscription_status, is_first_listing"
      )
      .eq("id", listingId)
      .maybeSingle();

    if (listingErr || !listing) {
      return json({ error: "Listing not found" }, 404);
    }
    if (listing.cleaner_id !== user.id) {
      // Don't leak whether the listing exists to third parties.
      return json({ error: "Listing not found" }, 404);
    }

    // ── Business rule: first listing is free, no subscription ──
    if (listing.is_first_listing) {
      return json(
        { error: "First listing does not require a subscription" },
        400
      );
    }

    // ── Idempotency: refuse to create a second subscription for
    // a listing that already has an active/trialing one. We still
    // allow retrying when the previous attempt is in a failed state
    // (canceled, incomplete, unpaid, past_due).
    const blocking = ["active", "trialing"];
    if (
      listing.stripe_subscription_id &&
      blocking.includes(listing.subscription_status || "")
    ) {
      return json(
        { error: "Listing already has an active subscription" },
        409
      );
    }

    // Get or create Stripe Customer for this user.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | null;

    // Validate the cached customer still exists in the current Stripe
    // account/mode. A stale id would happen if the project's Stripe
    // keys are rotated or the test/live mode is swapped — the cus_xxx
    // we stored points to a customer that no longer exists from the
    // current key's perspective. We detect and self-heal.
    if (customerId) {
      try {
        await stripeFetch(`customers/${customerId}`);
      } catch (_e) {
        customerId = null;
        await supabase
          .from("profiles")
          .update({ stripe_customer_id: null })
          .eq("id", user.id);
      }
    }

    if (!customerId) {
      const customer = await stripeFetch("customers", {
        email: user.email ?? "",
        name: profile?.full_name ?? "",
        "metadata[supabase_user_id]": user.id,
      });
      customerId = customer.id as string;

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // Create subscription in "default_incomplete" so the client can
    // finish the payment via the Payment Sheet. We pin the Stripe API
    // version via header so `latest_invoice.payment_intent` is still
    // inline.
    const subscription = await stripeFetch("subscriptions", {
      customer: customerId,
      "items[0][price]": STRIPE_LISTING_PRICE_ID,
      payment_behavior: "default_incomplete",
      "payment_settings[save_default_payment_method]": "on_subscription",
      "expand[]": "latest_invoice.payment_intent",
      "metadata[supabase_user_id]": user.id,
      "metadata[listing_id]": listingId,
    });

    const paymentIntent = subscription?.latest_invoice?.payment_intent;
    const clientSecret = paymentIntent?.client_secret;
    if (!clientSecret) {
      console.error(
        "[no client secret]",
        JSON.stringify(subscription).slice(0, 500)
      );
      return json(
        { error: "Stripe did not return a payment intent client secret" },
        500
      );
    }

    // Persist the pending subscription on the listing.
    await supabase
      .from("cleaner_listings")
      .update({
        stripe_subscription_id: subscription.id,
        subscription_status: "incomplete",
      })
      .eq("id", listingId);

    // Ephemeral key so the Payment Sheet can attach the card to the
    // Customer. The Stripe-Version header is already set in stripeFetch,
    // but the ephemeral_keys endpoint also accepts a version hint in
    // the path — we don't need that since our helper pins the version.
    const ephemeralKey = await stripeFetch("ephemeral_keys", {
      customer: customerId,
    });

    return json({
      customer: customerId,
      ephemeralKey: ephemeralKey.secret,
      paymentIntent: clientSecret,
      subscriptionId: subscription.id,
    });
  } catch (err: any) {
    // Pre-launch: return the underlying error so the client can show it.
    // Once we go live we should switch back to a generic message.
    const msg = err?.message ?? String(err);
    console.error("[stripe-subscription-create error]", msg);
    return json(
      {
        error: "Impossibile creare l'abbonamento. Riprova più tardi.",
        debug: msg,
        env_check: {
          has_secret_key: !!STRIPE_SECRET_KEY,
          has_price_id: !!STRIPE_LISTING_PRICE_ID,
          price_id_prefix: STRIPE_LISTING_PRICE_ID?.slice(0, 12) ?? null,
          secret_key_mode: STRIPE_SECRET_KEY?.startsWith("sk_live_")
            ? "live"
            : STRIPE_SECRET_KEY?.startsWith("sk_test_")
            ? "test"
            : "unknown",
        },
      },
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
