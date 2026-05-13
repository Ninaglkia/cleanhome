// ============================================================================
// Edge Function: delete-account
// ----------------------------------------------------------------------------
// GDPR / Apple Review Guideline 5.1.1(v): every app that allows account
// creation must allow account deletion in-app. This function lets the
// authenticated user delete THEIR OWN auth.users row.
//
// auth.users can only be modified by the service-role key, so the call
// must go through this server-side function rather than the client.
//
// On deletion, every row in tables that reference auth.users(id) ON
// DELETE CASCADE is removed automatically (profiles, cleaner_profiles,
// bookings as client/cleaner, reviews, etc.). Pending bookings that are
// already paid should be cancelled by Stripe via webhook before calling
// this function — but for safety we don't refund here, just delete.
//
// Request body: {} (no params — the auth token identifies the user)
// Response: { ok: true }
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Authenticate the caller
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "Missing auth token" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  try {
    // Delete the auth user — all FK ON DELETE CASCADE rows go with it.
    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) throw delErr;
    return json({ ok: true });
  } catch (err: any) {
    console.error("[delete-account]", err?.message);
    return json({ error: "Impossibile eliminare l'account. Riprova più tardi." }, 500);
  }
});
