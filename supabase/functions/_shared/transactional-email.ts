// ============================================================================
// _shared/transactional-email.ts
// ----------------------------------------------------------------------------
// Reusable branded email helper for CleanHome transactional messages.
// Uses Resend (same credentials as send-welcome-email).
//
// Pattern:
//   - Same FROM, logo, colour palette, footer as send-welcome-email.
//   - If RESEND_API_KEY is not set: no-op (returns { sent:false, reason:"email_not_configured" })
//     without throwing — callers must be best-effort (try/catch anyway).
//   - HTML-escapes any user-provided strings before interpolation.
//
// Usage:
//   import { sendTransactionalEmail } from "../_shared/transactional-email.ts";
//   await sendTransactionalEmail({
//     to: "user@example.com",
//     subject: "La tua prenotazione è confermata",
//     heading: "Prenotazione confermata!",
//     bodyHtml: "<p>Grazie per aver prenotato...</p>",
//     ctaText: "Vedi prenotazione",
//     ctaUrl: "https://cleanhomeapp.com/booking/abc123",
//   });
// ============================================================================

const FROM = "CleanHome <info@cleanhomeapp.com>";
const APP_NAME = "CleanHome";
const LOGO_URL = "https://www.cleanhomeapp.com/icon.png";
const APP_URL = "https://cleanhomeapp.com";

export interface TransactionalEmailOptions {
  /** Recipient email address */
  to: string;
  subject: string;
  /** Large heading line inside the card — already HTML-safe or pre-escaped */
  heading: string;
  /** Main content area — arbitrary HTML, use escapeHtml() on dynamic values */
  bodyHtml: string;
  /** Optional CTA button label */
  ctaText?: string;
  /** Optional CTA button URL */
  ctaUrl?: string;
}

export interface SendEmailResult {
  sent: boolean;
  reason?: string;
}

/** HTML-escape a plain-text user value before injecting into templates. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(opts: TransactionalEmailOptions): string {
  const ctaBlock = opts.ctaText && opts.ctaUrl
    ? `<tr><td style="padding:24px 40px 8px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
          <td align="center" bgcolor="#006b55" style="background-color:#006b55;border-radius:14px;">
            <a href="${opts.ctaUrl}" style="display:block;padding:17px 24px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:0.2px;">${opts.ctaText} →</a>
          </td>
        </tr></table>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${opts.subject}</title></head>
<body style="margin:0;padding:0;background-color:#eef3f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.subject}</div>
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
          <h2 style="margin:0 0 12px 0;color:#0f1f1d;font-size:25px;font-weight:800;letter-spacing:-0.3px;">${opts.heading}</h2>
          <div style="color:#54716b;font-size:16px;line-height:25px;">${opts.bodyHtml}</div>
        </td></tr>
        ${ctaBlock}
        <tr><td style="padding:24px 40px 0;">
          <div style="height:1px;background-color:#eaf0ee;line-height:1px;font-size:1px;">&nbsp;</div>
          <p style="margin:22px 0 0;color:#9bb0ab;font-size:13px;line-height:20px;text-align:center;">
            Hai bisogno di aiuto? Scrivici a <a href="mailto:info@cleanhomeapp.com" style="color:#006b55;font-weight:600;text-decoration:none;">info@cleanhomeapp.com</a>
          </p>
        </td></tr>
        <tr><td style="padding:28px 40px 36px;text-align:center;">
          <p style="margin:0;color:#0f1f1d;font-size:14px;font-weight:800;letter-spacing:-0.2px;">${APP_NAME}</p>
          <p style="margin:8px 0 0;color:#b3c4c0;font-size:11px;line-height:17px;">
            Hai ricevuto questa email perché hai un account ${APP_NAME}.<br>
            © 2026 ${APP_NAME} · Tutti i diritti riservati · <a href="${APP_URL}/privacy" style="color:#9bb0ab;text-decoration:none;">Privacy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Send a branded transactional email via Resend.
 *
 * Best-effort: returns { sent:false } on misconfiguration / provider error
 * rather than throwing. Callers should wrap in try/catch and log, never
 * let email failures abort a webhook or booking flow.
 */
export async function sendTransactionalEmail(
  opts: TransactionalEmailOptions
): Promise<SendEmailResult> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.warn("[transactional-email] RESEND_API_KEY not set — skipping email to", opts.to);
    return { sent: false, reason: "email_not_configured" };
  }

  if (!opts.to || !opts.to.includes("@")) {
    console.warn("[transactional-email] invalid recipient address:", opts.to);
    return { sent: false, reason: "invalid_recipient" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [opts.to],
        subject: opts.subject,
        html: buildHtml(opts),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("[transactional-email] Resend error", res.status, detail);
      return { sent: false, reason: `provider_error_${res.status}` };
    }

    return { sent: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[transactional-email] fetch threw:", msg);
    return { sent: false, reason: "network_error" };
  }
}
