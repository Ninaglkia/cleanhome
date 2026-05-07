// ============================================================================
// Edge Function: stripe-identity-sync-status
// ----------------------------------------------------------------------------
// Called by the cleaner client to pull the real-time status of their Stripe
// Identity VerificationSession directly from Stripe's API and persist it to
// cleaner_profiles. This resolves "stuck in processing" states when webhooks
// are delayed or when the user canceled the sheet without a webhook firing.
//
// Response: { status, verifiedAt, lastError }
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

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

// Maps Stripe VerificationSession status to the app's internal status.
// "requires_action" is treated as still in-progress (processing).
function mapStripeStatus(
  stripeStatus: string
): "verified" | "requires_input" | "canceled" | "processing" {
  switch (stripeStatus) {
    case "verified":
      return "verified";
    case "requires_input":
      return "requires_input";
    case "canceled":
      return "canceled";
    case "processing":
    case "requires_action":
    default:
      return "processing";
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // ── Step 1: Auth ─────────────────────────────────────────────────────────
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
      return json({ error: "Sessione non valida" }, 401);
    }

    // ── Step 2: Fetch session id from cleaner_profiles ────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from("cleaner_profiles")
      .select(
        "id, stripe_identity_session_id, stripe_identity_status, stripe_identity_verified_at"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return json({ error: "Profilo cleaner non trovato" }, 404);
    }

    const sessionId: string | null = profile.stripe_identity_session_id;

    // No session yet — nothing to sync
    if (!sessionId) {
      return json({ status: null, verifiedAt: null, lastError: null });
    }

    // ── Step 3: Retrieve session from Stripe ──────────────────────────────────
    const session = await stripe.identity.verificationSessions.retrieve(
      sessionId,
      { expand: ["verified_outputs", "last_error"] }
    );

    const appStatus = mapStripeStatus(session.status);
    const now = new Date().toISOString();

    // ── Step 4: Build DB update payload ──────────────────────────────────────
    type ProfileUpdate = {
      stripe_identity_status: string;
      stripe_identity_last_error: string | null;
      stripe_identity_verified_at?: string | null;
      stripe_identity_first_name?: string | null;
      stripe_identity_last_name?: string | null;
      stripe_identity_dob?: string | null;
    };

    const update: ProfileUpdate = {
      stripe_identity_status: appStatus,
      stripe_identity_last_error: null,
    };

    if (appStatus === "verified") {
      // Persist verified_at only when transitioning to verified
      if (profile.stripe_identity_verified_at == null) {
        update.stripe_identity_verified_at = now;
      }
      // Extract verified_outputs if present
      const outputs = (session as any).verified_outputs;
      if (outputs) {
        update.stripe_identity_first_name = outputs.first_name ?? null;
        update.stripe_identity_last_name = outputs.last_name ?? null;
        if (outputs.dob) {
          // Stripe dob: { day, month, year }
          const d = outputs.dob;
          update.stripe_identity_dob = d.year && d.month && d.day
            ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`
            : null;
        }
      }
    } else if (appStatus === "requires_input") {
      const lastError = (session as any).last_error;
      update.stripe_identity_last_error = lastError?.reason ?? null;
    }

    // ── Step 5: Persist to DB ─────────────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from("cleaner_profiles")
      .update(update)
      .eq("id", user.id);

    if (updateErr) {
      console.error(
        "[stripe-identity-sync-status] db update failed:",
        updateErr.message
      );
      return json({ error: "Impossibile aggiornare lo stato" }, 500);
    }

    console.log(
      `[stripe-identity-sync-status] user=${user.id} session=${sessionId} stripe=${session.status} app=${appStatus}`
    );

    return json({
      status: appStatus,
      verifiedAt: update.stripe_identity_verified_at ?? profile.stripe_identity_verified_at ?? null,
      lastError: update.stripe_identity_last_error ?? null,
    });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[stripe-identity-sync-status] FATAL:", msg);
    return json({ error: "Impossibile sincronizzare lo stato. Riprova più tardi." }, 500);
  }
});
