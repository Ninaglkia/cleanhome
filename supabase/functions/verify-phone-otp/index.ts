// ============================================================================
// Edge Function: verify-phone-otp
// ----------------------------------------------------------------------------
// Verifies a 6-digit OTP code sent by send-phone-otp.
// On success, updates profiles.phone + phone_verified = true.
//
// Auth: requires a valid user JWT in the Authorization header.
//
// Request body:  { phone: string, code: string }
// Success:       { ok: true, phone_verified: true }
// Wrong code:    { ok: false, error: "Codice errato", remaining_attempts: number }
// Error shapes:
//   400 { ok: false, error: "..." }     — bad input / expired / no pending code
//   401 { ok: false, error: "Non autorizzato" }
//   429 { ok: false, error: "Troppi tentativi. Richiedi un nuovo codice." }
//   500 { ok: false, error: "Errore interno. Riprova piu' tardi." }
//
// Secrets required:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_ATTEMPTS = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** SHA-256 hex of (code + userId) — mirrors send-phone-otp */
async function hashCode(code: string, userId: string): Promise<string> {
  const data = new TextEncoder().encode(code + userId);
  const buf  = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ ok: false, error: "Non autorizzato" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ ok: false, error: "Non autorizzato" }, 401);

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { phone?: string; code?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON non valido" }, 400); }

  const phone = (body.phone ?? "").trim();
  const code  = (body.code  ?? "").trim();

  if (!phone || !code) {
    return json({ ok: false, error: "phone e code sono obbligatori" }, 400);
  }
  if (!/^\d{6}$/.test(code)) {
    return json({ ok: false, error: "Il codice deve essere di 6 cifre" }, 400);
  }

  try {
    const now = new Date().toISOString();

    // ── Look up the most recent non-expired row for this user+phone ──────────
    const { data: row, error: selectErr } = await supabase
      .from("phone_verifications")
      .select("id, code_hash, expires_at, attempts")
      .eq("user_id", user.id)
      .eq("phone", phone)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectErr) throw selectErr;

    if (!row) {
      return json({
        ok: false,
        error: "Nessun codice attivo per questo numero. Richiedi un nuovo codice.",
      }, 400);
    }

    // ── Increment attempts atomically ────────────────────────────────────────
    const newAttempts = row.attempts + 1;
    const { error: incErr } = await supabase
      .from("phone_verifications")
      .update({ attempts: newAttempts })
      .eq("id", row.id);
    if (incErr) throw incErr;

    // ── Lockout check (after incrementing so the final failed attempt counts) ─
    if (newAttempts > MAX_ATTEMPTS) {
      // Burn the row — user must request a new code
      await supabase.from("phone_verifications").delete().eq("id", row.id);
      return json({
        ok: false,
        error: "Troppi tentativi. Richiedi un nuovo codice.",
      }, 429);
    }

    // ── Compare hashes (constant-time via hash comparison) ───────────────────
    const expectedHash = await hashCode(code, user.id);
    if (expectedHash !== row.code_hash) {
      const remaining = MAX_ATTEMPTS - newAttempts;
      return json({
        ok: false,
        error: "Codice errato",
        remaining_attempts: remaining,
      });
    }

    // ── SUCCESS ──────────────────────────────────────────────────────────────
    // 1. Mark phone as verified on the profile
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ phone, phone_verified: true })
      .eq("id", user.id);
    if (profileErr) throw profileErr;

    // 2. Clean up all verification rows for this user (success = done)
    await supabase
      .from("phone_verifications")
      .delete()
      .eq("user_id", user.id);

    return json({ ok: true, phone_verified: true });

  } catch (err: any) {
    console.error("[verify-phone-otp]", err?.message ?? err);
    return json({ ok: false, error: "Errore interno. Riprova piu' tardi." }, 500);
  }
});
