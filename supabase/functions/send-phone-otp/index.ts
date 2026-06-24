// ============================================================================
// Edge Function: send-phone-otp
// ----------------------------------------------------------------------------
// Generates a 6-digit SMS OTP for phone number verification.
//
// Auth: requires a valid user JWT in the Authorization header.
//
// Request body:  { phone: string }   — must be E.164 (e.g. +39...)
// Success:       { ok: true }
// Error shapes:
//   400 { ok: false, error: "Numero di telefono non valido. Usa il formato +39..." }
//   401 { ok: false, error: "Non autorizzato" }
//   429 { ok: false, error: "Troppi codici inviati. Attendi un'ora e riprova." }
//   500 { ok: false, error: "Errore interno. Riprova piu' tardi." }
//
// Secrets required (same as send-sms):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID       = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN        = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_FROM              = Deno.env.get("TWILIO_FROM") ?? "";

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

// E.164: + followed by 8–15 digits
const E164_RE = /^\+\d{8,15}$/;

/** SHA-256 hex of (code + userId) — never store the plaintext code */
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

  // ── Auth: extract user from JWT ─────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ ok: false, error: "Non autorizzato" }, 401);

  // Service-role client for DB writes (bypasses RLS on phone_verifications)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ ok: false, error: "Non autorizzato" }, 401);

  // ── Parse + validate body ───────────────────────────────────────────────────
  let body: { phone?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON non valido" }, 400); }

  const phone = (body.phone ?? "").trim();
  if (!phone || !E164_RE.test(phone)) {
    return json({
      ok: false,
      error: "Numero di telefono non valido. Usa il formato internazionale (es. +393331234567).",
    }, 400);
  }

  try {
    // ── Rate-limit: max 3 codes sent in the last 60 minutes ─────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount, error: countErr } = await supabase
      .from("phone_verifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);

    if (countErr) throw countErr;
    if ((recentCount ?? 0) >= 3) {
      return json({
        ok: false,
        error: "Troppi codici inviati. Attendi un'ora e riprova.",
      }, 429);
    }

    // ── Generate 6-digit code + hash ────────────────────────────────────────
    // Use crypto.getRandomValues for a uniform random integer in [0, 999999]
    const arr   = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const code  = String(arr[0] % 1_000_000).padStart(6, "0");
    const hash  = await hashCode(code, user.id);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // +5 min

    // ── Delete any prior unexpired rows for this user+phone (replace flow) ──
    await supabase
      .from("phone_verifications")
      .delete()
      .eq("user_id", user.id)
      .eq("phone", phone)
      .gt("expires_at", new Date().toISOString());

    // ── Insert new verification row ──────────────────────────────────────────
    const { error: insertErr } = await supabase
      .from("phone_verifications")
      .insert({
        user_id:    user.id,
        phone,
        code_hash:  hash,
        expires_at: expiresAt,
        attempts:   0,
      });
    if (insertErr) throw insertErr;

    // ── Send SMS via Twilio directly ─────────────────────────────────────────
    // We call Twilio directly (not send-sms) because send-sms looks up the
    // phone from profiles.phone — but the OTP phone may not yet be on the
    // profile (that's exactly what we're verifying). We need to send to the
    // phone the user provided, not the one already saved.
    //
    // GSM-7 safe message ("e" not "è", ASCII only) to stay within 1 segment.
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
      console.warn("[send-phone-otp] Twilio not configured — OTP code for dev:", code);
      // In dev/test with no Twilio, still return ok so the flow can be tested
      return json({ ok: true });
    }

    const smsBody = `CleanHome: il tuo codice di verifica e ${code}. Scade tra 5 minuti.`;
    const params = new URLSearchParams({ To: phone, Body: smsBody });
    if (TWILIO_FROM.startsWith("MG")) {
      params.set("MessagingServiceSid", TWILIO_FROM);
    } else {
      params.set("From", TWILIO_FROM);
    }

    const auth    = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (!twilioRes.ok) {
      const td: any = await twilioRes.json().catch(() => ({}));
      console.error("[send-phone-otp] Twilio error", twilioRes.status, td?.message ?? "");
      // Clean up the just-inserted row so the user can retry immediately
      await supabase
        .from("phone_verifications")
        .delete()
        .eq("user_id", user.id)
        .eq("phone", phone)
        .eq("code_hash", hash);
      return json({ ok: false, error: "Invio SMS fallito. Riprova piu' tardi." }, 502);
    }

    return json({ ok: true });

  } catch (err: any) {
    console.error("[send-phone-otp]", err?.message ?? err);
    return json({ ok: false, error: "Errore interno. Riprova piu' tardi." }, 500);
  }
});
