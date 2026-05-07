// ============================================================================
// Edge Function: stripe-identity-create-session
// ----------------------------------------------------------------------------
// Called by the cleaner client to start a Stripe Identity verification flow.
// Creates a VerificationSession and an ephemeral key for the native SDK.
//
// Response: { sessionId: string, ephemeralKeySecret: string }
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Use the same apiVersion for the main Stripe client
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
    console.log("[stripe-identity-create-session] step=auth, hasHeader=", authHeader.startsWith("Bearer "));
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header" }, 401);
    }
    const userToken = authHeader.slice("Bearer ".length).trim();

    // Use service role to validate session (getUser with service role validates the JWT)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(userToken);
    console.log("[stripe-identity-create-session] step=getUser, userId=", user?.id ?? null, "err=", userErr?.message ?? null);
    if (userErr || !user) {
      return json({ error: "Sessione non valida" }, 401);
    }

    // ── Step 2: Check cleaner_profiles row ───────────────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from("cleaner_profiles")
      .select("id, stripe_identity_session_id, stripe_identity_status")
      .eq("id", user.id)
      .maybeSingle();

    console.log("[stripe-identity-create-session] step=profile, found=", !!profile, "err=", profileErr?.message ?? null);
    if (profileErr || !profile) {
      return json({ error: "Profilo cleaner non trovato" }, 404);
    }

    // ── Step 3: Create Stripe VerificationSession ────────────────────────────
    // Note: return_url is for web redirect flow; omit for native SDK mobile flow.
    console.log("[stripe-identity-create-session] step=createVerificationSession");
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      options: {
        document: {
          allowed_types: ["driving_license", "id_card", "passport"],
          require_id_number: false,
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
      metadata: {
        user_id: user.id,
        role: "cleaner",
      },
    } as any);
    console.log("[stripe-identity-create-session] step=verificationSession, id=", session.id);

    // ── Step 4: Create ephemeral key for the React Native SDK ────────────────
    // apiVersion must be the latest Stripe API version as required by the mobile SDK.
    // Using '2026-03-25.dahlia' per Stripe Identity docs for native SDK integration.
    console.log("[stripe-identity-create-session] step=createEphemeralKey");
    const ephemeralKey = await (stripe as any).ephemeralKeys.create(
      { verification_session: session.id },
      { apiVersion: "2026-03-25.dahlia" }
    );
    console.log("[stripe-identity-create-session] step=ephemeralKey, hasSecret=", !!ephemeralKey?.secret);

    // ── Step 5: Persist session id ───────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from("cleaner_profiles")
      .update({
        stripe_identity_session_id: session.id,
        stripe_identity_status: "processing",
        stripe_identity_last_error: null,
      })
      .eq("id", user.id);

    if (updateErr) {
      console.error("[stripe-identity-create-session] step=dbUpdate, err=", updateErr.message);
      return json({ error: "Impossibile salvare la sessione di verifica" }, 500);
    }
    console.log("[stripe-identity-create-session] step=dbUpdate, ok");

    return json({
      sessionId: session.id,
      ephemeralKeySecret: ephemeralKey.secret,
    });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[stripe-identity-create-session] FATAL:", msg, "stack=", err?.stack ?? "");
    return json({ error: "Impossibile avviare la verifica. Riprova più tardi." }, 500);
  }
});
