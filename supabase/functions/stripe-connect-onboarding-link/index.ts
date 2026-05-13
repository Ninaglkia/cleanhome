// ============================================================================
// Edge Function: stripe-connect-onboarding-link
// ----------------------------------------------------------------------------
// Called by the RN client when a cleaner taps "Verifica identità".
// Creates a Stripe Express Connected Account the first time, then
// generates an AccountLink the cleaner opens in an in-app browser to
// complete KYC (identity document + IBAN + phone).
//
// If the cleaner already has an account, we reuse it and just issue
// a fresh AccountLink. This handles the case where the user closed
// the browser mid-flow.
//
// Response shape: { url: string, account_id: string }
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Deep-link scheme the in-app browser should use to return to the app.
// The RN app registers "cleanhome" as a URL scheme in app.json.
const APP_SCHEME = "cleanhome";
const STRIPE_API_VERSION = "2023-10-16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(userToken);
    if (userErr || !user) {
      return json({ error: "Invalid session" }, 401);
    }

    // ── Load cleaner profile (must exist — the cleaner already
    //    has a row in cleaner_profiles after activating "Modalità
    //    Cleaner" during onboarding). ─────────────────────────────
    const { data: cleanerProfile, error: cpErr } = await supabase
      .from("cleaner_profiles")
      .select(
        "id, full_name, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (cpErr || !cleanerProfile) {
      return json(
        { error: "Profilo professionista non trovato" },
        404
      );
    }

    let accountId = cleanerProfile.stripe_account_id as string | null;

    // ── Create an Express account if this is the first call ────
    if (!accountId) {
      const created = await stripeFetch("accounts", {
        type: "express",
        country: "IT",
        email: user.email ?? "",
        "capabilities[card_payments][requested]": "true",
        "capabilities[transfers][requested]": "true",
        business_type: "individual",
        "business_profile[product_description]":
          "Servizi di pulizia professionale a domicilio",
        "metadata[supabase_user_id]": user.id,
      });
      accountId = created.id as string;

      // Persist immediately so a retry (user closes browser then
      // taps again) will reuse the same account.
      const { error: updErr } = await supabase
        .from("cleaner_profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", user.id);
      if (updErr) throw updErr;
    }

    // ── Decide which link to return ─────────────────────────────
    // We use cached flags from cleaner_profiles to avoid a Stripe GET
    // (the restricted live key doesn't have Connect: Read scope).
    //
    // The Express Dashboard `login_links` endpoint is NOT callable
    // with restricted keys at all (Stripe error: "required permissions
    // are not available for use by restricted keys"), so we never use
    // it. For an active account we mint an `account_update` link via
    // the `account_links` API — that opens the same KYC/bank-edit
    // surface the cleaner already knows, focused on the fields they
    // can change post-activation. Works with the rk_live_* key.
    //
    // For an account still in KYC we mint an `account_onboarding`
    // link — same as before.
    const isActive =
      !!cleanerProfile.stripe_onboarding_complete &&
      !!cleanerProfile.stripe_charges_enabled;

    const accountLink = await stripeFetch("account_links", {
      account: accountId,
      refresh_url: `${APP_SCHEME}://stripe-connect/refresh`,
      return_url: `${APP_SCHEME}://stripe-connect/return`,
      type: isActive ? "account_update" : "account_onboarding",
    });

    return json({
      url: accountLink.url as string,
      account_id: accountId,
      kind: isActive ? "update" : "onboarding",
    });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[stripe-connect-onboarding-link]", msg);
    return json(
      { error: "Impossibile avviare la verifica. Riprova più tardi." },
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
