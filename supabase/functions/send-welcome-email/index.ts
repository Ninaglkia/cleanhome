// ============================================================================
// send-welcome-email
// ----------------------------------------------------------------------------
// Sends a branded "Benvenuto su CleanHome" email the first time a user signs
// in — works for ALL auth methods (email/password, Google, Apple), because the
// client invokes it on SIGNED_IN and the function de-duplicates server-side via
// profiles.welcome_email_sent_at.
//
// Security: verify_jwt = true. A user can only ever trigger their OWN welcome
// email (we read the address from their JWT), so it can't be abused to spam.
//
// Activation: set the RESEND_API_KEY secret (and verify the sending domain in
// Resend). Until then the function is a graceful no-op — it never errors the
// client, it just reports { sent:false, reason:"email_not_configured" }.
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const FROM = "CleanHome <info@cleanhomeapp.com>";
const APP_NAME = "CleanHome";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function firstName(full?: string | null): string {
  const n = (full ?? "").trim().split(/\s+/)[0];
  return n && n.length > 0 ? n : "ciao";
}

function welcomeHtml(name: string): string {
  const greeting = name === "ciao" ? "Ciao 👋" : `Ciao ${name} 👋`;
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Benvenuto su ${APP_NAME}</title></head>
<body style="margin:0;padding:0;background-color:#f7faf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f7faf9;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(2,36,32,0.08);">
        <tr><td style="background:linear-gradient(135deg,#022420 0%,#006b55 100%);padding:48px 40px;text-align:center;">
          <div style="display:inline-block;width:64px;height:64px;background-color:rgba(130,244,209,0.15);border-radius:18px;line-height:64px;margin-bottom:16px;font-size:30px;">🏠</div>
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">${APP_NAME}</h1>
          <p style="margin:8px 0 0 0;color:#82f4d1;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">L'eccellenza nella cura domestica</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 16px 0;color:#0f1f1d;font-size:24px;font-weight:800;letter-spacing:-0.3px;">${greeting}</h2>
          <p style="margin:0 0 16px 0;color:#4a6660;font-size:16px;line-height:24px;">
            Benvenuto su ${APP_NAME}! Il tuo account è attivo. Da oggi prenotare un servizio di pulizia professionale è semplice: scegli la tua casa, indica cosa ti serve e ricevi un professionista verificato vicino a te.
          </p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 28px 0;">
            <tr><td style="padding:6px 0;color:#0f1f1d;font-size:15px;line-height:22px;">✅ &nbsp;Professionisti verificati e assicurati</td></tr>
            <tr><td style="padding:6px 0;color:#0f1f1d;font-size:15px;line-height:22px;">💳 &nbsp;Pagamenti sicuri, solo dentro l'app</td></tr>
            <tr><td style="padding:6px 0;color:#0f1f1d;font-size:15px;line-height:22px;">💬 &nbsp;Chat diretta per coordinare tutto</td></tr>
          </table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
            <tr><td style="background-color:#006b55;border-radius:14px;">
              <a href="https://cleanhomeapp.com" style="display:inline-block;padding:16px 40px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">Apri CleanHome</a>
            </td></tr>
          </table>
          <p style="margin:32px 0 0 0;color:#8aaca6;font-size:12px;line-height:18px;text-align:center;">
            Hai ricevuto questa email perché è stato creato un account ${APP_NAME} con questo indirizzo.<br>
            Hai bisogno di aiuto? Scrivici a <a href="mailto:info@cleanhomeapp.com" style="color:#006b55;">info@cleanhomeapp.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }
    const jwt = authHeader.slice(7);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json({ error: "server_misconfigured" }, 500);
    }

    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser(jwt);
    if (authErr || !user?.email) {
      return json({ error: "unauthorized" }, 401);
    }

    // Idempotency: only send once per user.
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, welcome_email_sent_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.welcome_email_sent_at) {
      return json({ sent: false, reason: "already_sent" }, 200);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      // Graceful no-op until email is configured — never breaks the client.
      return json({ sent: false, reason: "email_not_configured" }, 200);
    }

    const name = firstName(profile?.full_name);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [user.email],
        subject: `Benvenuto su ${APP_NAME} 👋`,
        html: welcomeHtml(name),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ sent: false, reason: "provider_error", detail }, 502);
    }

    // Mark as sent so we never email the same user twice.
    await admin
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", user.id);

    return json({ sent: true }, 200);
  } catch (_err) {
    return json({ error: "internal_error" }, 500);
  }
});
