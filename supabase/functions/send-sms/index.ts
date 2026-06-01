// ============================================================================
// Edge Function: send-sms
// ----------------------------------------------------------------------------
// Sends a transactional SMS via Twilio. Called server-to-server by the
// notify_sms_on_notification() DB trigger (NOT by app clients), authenticated
// with the shared x-cron-secret header (same secret the crons use).
//
// No-op (never errors) when Twilio is not configured or the user has no phone,
// so SMS is a best-effort add-on that can never break the notification flow.
//
// Request body: { user_id: UUID, message: string }
// Secrets required (Supabase Edge Function secrets):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, CRON_SECRET
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
// Either a Twilio phone number (+39...) or a Messaging Service SID (MG...).
const TWILIO_FROM = Deno.env.get("TWILIO_FROM") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Very light E.164 sanity check (+, then 8–15 digits).
const E164_RE = /^\+\d{8,15}$/;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Internal auth — same shared secret the crons use.
  const secret = req.headers.get("x-cron-secret") ?? "";
  if (!CRON_SECRET || !timingSafeEqual(secret, CRON_SECRET)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { user_id?: string; message?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { user_id, message } = body;
  if (!user_id || !message) return json({ error: "user_id and message are required" }, 400);

  // If Twilio isn't configured, no-op (mirrors the email helper's behaviour).
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    console.warn("[send-sms] Twilio not configured — skipping SMS for", user_id);
    return json({ sent: false, reason: "sms_not_configured" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Look up the recipient's phone (E.164, stored at registration as +<prefix><number>).
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", user_id)
    .maybeSingle();
  if (pErr) {
    console.error("[send-sms] profile lookup failed", pErr.message);
    return json({ sent: false, reason: "profile_lookup_failed" });
  }
  const phone = (profile?.phone ?? "").trim();
  if (!phone || !E164_RE.test(phone)) {
    return json({ sent: false, reason: "no_valid_phone" });
  }

  // Twilio REST API. TWILIO_FROM may be a number (From) or a Messaging Service SID (MessagingServiceSid).
  const params = new URLSearchParams({ To: phone, Body: message.slice(0, 600) });
  if (TWILIO_FROM.startsWith("MG")) params.set("MessagingServiceSid", TWILIO_FROM);
  else params.set("From", TWILIO_FROM);

  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  try {
    const res = await fetch(
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Log Twilio detail server-side, return a generic reason to the caller.
      console.error("[send-sms] Twilio error", res.status, (data as any)?.message ?? "");
      return json({ sent: false, reason: "provider_error" }, 502);
    }
    return json({ sent: true, sid: (data as any)?.sid ?? null });
  } catch (err: any) {
    console.error("[send-sms] fetch failed", err?.message ?? err);
    return json({ sent: false, reason: "network_error" }, 502);
  }
});
