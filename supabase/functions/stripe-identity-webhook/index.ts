// ============================================================================
// Edge Function: stripe-identity-webhook
// ----------------------------------------------------------------------------
// Dedicated webhook handler for Stripe Identity events. Uses a separate
// STRIPE_WEBHOOK_SECRET_IDENTITY env var so the signing secret is scoped only
// to this endpoint (registered in Stripe Dashboard as a separate webhook).
//
// Events handled:
//   identity.verification_session.verified        → status='verified'
//   identity.verification_session.requires_input  → status='requires_input'
//   identity.verification_session.canceled        → status='canceled'
//   identity.verification_session.processing      → status='processing'
//
// No JWT auth — Stripe webhooks are server-to-server. Signature is verified
// instead via constructEventAsync. Deploy with --no-verify-jwt.
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET_IDENTITY = Deno.env.get("STRIPE_WEBHOOK_SECRET_IDENTITY")!;
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

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET_IDENTITY,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err: any) {
    console.error("[stripe-identity-webhook] signature error:", err?.message);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  try {
    // All identity events carry a VerificationSession object
    const session = event.data.object as any;
    const sessionId: string = session.id;

    switch (event.type) {
      case "identity.verification_session.verified": {
        // Pull verified personal data from verified_outputs
        const outputs = session.verified_outputs ?? {};
        const dobRaw = outputs.dob as { day?: number; month?: number; year?: number } | null | undefined;
        let dob: string | null = null;
        if (dobRaw?.year && dobRaw?.month && dobRaw?.day) {
          const mm = String(dobRaw.month).padStart(2, "0");
          const dd = String(dobRaw.day).padStart(2, "0");
          dob = `${dobRaw.year}-${mm}-${dd}`;
        }

        const { error } = await supabase
          .from("cleaner_profiles")
          .update({
            stripe_identity_status: "verified",
            stripe_identity_verified_at: new Date().toISOString(),
            stripe_identity_first_name: outputs.first_name ?? null,
            stripe_identity_last_name: outputs.last_name ?? null,
            stripe_identity_dob: dob,
            stripe_identity_last_error: null,
          })
          .eq("stripe_identity_session_id", sessionId);

        if (error) {
          console.error("[stripe-identity-webhook] verified update error:", error.message);
        }
        break;
      }

      case "identity.verification_session.requires_input": {
        // Capture the reason for the failure so the client can surface it
        const lastError = session.last_error as { code?: string; reason?: string } | null | undefined;
        const errorMsg = lastError?.reason ?? lastError?.code ?? "Verifica non riuscita";

        const { error } = await supabase
          .from("cleaner_profiles")
          .update({
            stripe_identity_status: "requires_input",
            stripe_identity_last_error: errorMsg,
          })
          .eq("stripe_identity_session_id", sessionId);

        if (error) {
          console.error("[stripe-identity-webhook] requires_input update error:", error.message);
        }
        break;
      }

      case "identity.verification_session.canceled": {
        const { error } = await supabase
          .from("cleaner_profiles")
          .update({
            stripe_identity_status: "canceled",
          })
          .eq("stripe_identity_session_id", sessionId);

        if (error) {
          console.error("[stripe-identity-webhook] canceled update error:", error.message);
        }
        break;
      }

      case "identity.verification_session.processing": {
        const { error } = await supabase
          .from("cleaner_profiles")
          .update({
            stripe_identity_status: "processing",
          })
          .eq("stripe_identity_session_id", sessionId);

        if (error) {
          console.error("[stripe-identity-webhook] processing update error:", error.message);
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge and ignore
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[stripe-identity-webhook] handler error:", err?.message ?? err);
    return new Response("Internal server error", { status: 500 });
  }
});
