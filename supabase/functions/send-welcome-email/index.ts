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
const LOGO_URL = "https://www.cleanhomeapp.com/icon.png";
const APP_URL = "https://cleanhomeapp.com";

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
  return n && n.length > 0 ? n : "";
}

function featureRow(emoji: string, title: string, desc: string): string {
  return `<tr><td style="padding:10px 0;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
      <td valign="top" width="52">
        <div style="width:44px;height:44px;background-color:#e8fdf7;border-radius:13px;text-align:center;"><span style="font-size:20px;line-height:44px;">${emoji}</span></div>
      </td>
      <td valign="top" style="padding-left:14px;">
        <p style="margin:0;color:#0f1f1d;font-size:15px;font-weight:700;line-height:20px;">${title}</p>
        <p style="margin:3px 0 0;color:#7a918c;font-size:13px;line-height:19px;">${desc}</p>
      </td>
    </tr></table>
  </td></tr>`;
}

function welcomeHtml(name: string): string {
  const greeting = name ? `Ciao ${name} 👋` : "Ciao 👋";
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Benvenuto su ${APP_NAME}</title></head>
<body style="margin:0;padding:0;background-color:#eef3f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Il tuo account è attivo. Prenota una pulizia professionale in pochi tocchi.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef3f1;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 40px rgba(2,36,32,0.10);">
        <tr><td bgcolor="#022420" style="background-color:#022420;background-image:linear-gradient(135deg,#022420 0%,#0a3f35 55%,#006b55 100%);padding:52px 40px 46px;text-align:center;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td align="center">
            <img src="${LOGO_URL}" width="86" height="86" alt="${APP_NAME}" style="display:block;border-radius:22px;border:1px solid rgba(255,255,255,0.12);box-shadow:0 6px 18px rgba(0,0,0,0.25);">
          </td></tr></table>
          <h1 style="margin:18px 0 0 0;color:#ffffff;font-size:27px;font-weight:800;letter-spacing:-0.4px;">${APP_NAME}</h1>
          <p style="margin:7px 0 0 0;color:#82f4d1;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;">L'eccellenza nella cura domestica</p>
        </td></tr>
        <tr><td style="padding:40px 40px 8px;">
          <h2 style="margin:0 0 12px 0;color:#0f1f1d;font-size:25px;font-weight:800;letter-spacing:-0.3px;">${greeting}</h2>
          <p style="margin:0;color:#54716b;font-size:16px;line-height:25px;">
            Benvenuto su <strong style="color:#0f1f1d;">${APP_NAME}</strong>. Il tuo account è attivo: da oggi prenotare una pulizia professionale è questione di pochi tocchi.
          </p>
        </td></tr>
        <tr><td style="padding:24px 40px 8px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${featureRow("🛡️", "Professionisti verificati", "Identità controllata e copertura assicurativa su ogni servizio.")}
            ${featureRow("💳", "Pagamenti sicuri", "Paghi solo dentro l'app, in modo protetto. Nessun contante.")}
            ${featureRow("💬", "Chat diretta", "Coordini orario e dettagli col professionista, in tempo reale.")}
          </table>
        </td></tr>
        <tr><td style="padding:24px 40px 8px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td align="center" bgcolor="#006b55" style="background-color:#006b55;border-radius:14px;">
              <a href="${APP_URL}" style="display:block;padding:17px 24px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:0.2px;">Apri ${APP_NAME} →</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:24px 40px 0;">
          <div style="height:1px;background-color:#eaf0ee;line-height:1px;font-size:1px;">&nbsp;</div>
          <p style="margin:22px 0 0;color:#9bb0ab;font-size:13px;line-height:20px;text-align:center;">
            Hai bisogno di aiuto? Scrivici a <a href="mailto:info@cleanhomeapp.com" style="color:#006b55;font-weight:600;text-decoration:none;">info@cleanhomeapp.com</a>
          </p>
        </td></tr>
        <tr><td style="padding:28px 40px 36px;text-align:center;">
          <p style="margin:0;color:#0f1f1d;font-size:14px;font-weight:800;letter-spacing:-0.2px;">${APP_NAME}</p>
          <p style="margin:8px 0 0;color:#b3c4c0;font-size:11px;line-height:17px;">
            Hai ricevuto questa email perché è stato creato un account con questo indirizzo.<br>
            © 2026 ${APP_NAME} · Tutti i diritti riservati
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
      console.error("[send-welcome-email] Resend error", res.status, detail);
      return json({ sent: false, reason: "provider_error" }, 502);
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
