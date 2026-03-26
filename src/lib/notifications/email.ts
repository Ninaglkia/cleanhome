import { Resend } from "resend";

/**
 * Resend client — lazily created so the missing env var only throws at
 * runtime (when actually sending) not at import time (module initialisation).
 */
let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }
  _resend = new Resend(apiKey);
  return _resend;
}

const FROM = "CleanHome <noreply@cleanhome.app>";

// ---------------------------------------------------------------------------
// Email template builders
// ---------------------------------------------------------------------------

export type EmailTemplate =
  | "booking_new"
  | "booking_accepted"
  | "booking_declined"
  | "auto_cancelled"
  | "job_completed"
  | "payout_sent"
  | "dispute_resolved";

interface TemplateData {
  recipientName: string;
  bookingDate?: string;
  bookingId?: string;
  cleanerName?: string;
  clientName?: string;
  amount?: string;
  weekStart?: string;
  weekEnd?: string;
  resolution?: string;
}

function buildEmailContent(
  template: EmailTemplate,
  data: TemplateData
): { subject: string; html: string } {
  const base = `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f0f4f3; padding: 24px; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-family: Georgia, serif; color: #1a3a35; font-size: 28px; margin: 0;">CleanHome</h1>
      </div>
      CONTENT
      <p style="color: #888; font-size: 12px; text-align: center; margin-top: 32px;">
        CleanHome · Marketplace per i servizi di pulizia<br/>
        Hai ricevuto questa email perché hai un account CleanHome.
      </p>
    </div>
  `;

  const card = (content: string) =>
    `<div style="background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 16px;">${content}</div>`;

  const heading = (text: string) =>
    `<h2 style="color: #1a3a35; margin: 0 0 12px;">${text}</h2>`;

  const para = (text: string) =>
    `<p style="color: #444; line-height: 1.6; margin: 0 0 8px;">${text}</p>`;

  const btn = (text: string, href: string) =>
    `<a href="${href}" style="display:inline-block;background:#4fc4a3;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">${text}</a>`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cleanhome.vercel.app";

  switch (template) {
    case "booking_new":
      return {
        subject: "Nuova prenotazione ricevuta — CleanHome",
        html: base.replace(
          "CONTENT",
          card(
            heading("Hai una nuova prenotazione!") +
              para(`Ciao ${data.recipientName},`) +
              para(
                `Il cliente <strong>${data.clientName}</strong> ha prenotato i tuoi servizi per il <strong>${data.bookingDate}</strong>.`
              ) +
              para("Accetta o declina entro 8 ore prima del servizio.") +
              btn("Vedi prenotazione", `${appUrl}/cleaner/bookings/${data.bookingId}`)
          )
        ),
      };

    case "booking_accepted":
      return {
        subject: "Prenotazione confermata! — CleanHome",
        html: base.replace(
          "CONTENT",
          card(
            heading("La tua prenotazione è confermata!") +
              para(`Ciao ${data.recipientName},`) +
              para(
                `<strong>${data.cleanerName}</strong> ha accettato la tua prenotazione per il <strong>${data.bookingDate}</strong>.`
              ) +
              para("Riceverai un promemoria prima del servizio.") +
              btn("Vedi prenotazione", `${appUrl}/client/bookings/${data.bookingId}`)
          )
        ),
      };

    case "booking_declined":
      return {
        subject: "Prenotazione non disponibile — CleanHome",
        html: base.replace(
          "CONTENT",
          card(
            heading("Prenotazione non accettata") +
              para(`Ciao ${data.recipientName},`) +
              para(
                `Purtroppo ${data.cleanerName} non è disponibile per il ${data.bookingDate}. Il rimborso è stato elaborato automaticamente.`
              ) +
              btn("Cerca un altro pulitore", `${appUrl}/client`)
          )
        ),
      };

    case "auto_cancelled":
      return {
        subject: "Prenotazione auto-cancellata — CleanHome",
        html: base.replace(
          "CONTENT",
          card(
            heading("Prenotazione cancellata automaticamente") +
              para(`Ciao ${data.recipientName},`) +
              para(
                `La prenotazione del <strong>${data.bookingDate}</strong> è stata cancellata automaticamente perché il pulitore non ha risposto entro la scadenza. Il rimborso è stato elaborato.`
              ) +
              btn("Prenota di nuovo", `${appUrl}/client`)
          )
        ),
      };

    case "job_completed":
      return {
        subject: "Lavoro completato — CleanHome",
        html: base.replace(
          "CONTENT",
          card(
            heading("Il tuo lavoro è stato completato") +
              para(`Ciao ${data.recipientName},`) +
              para(
                `Il servizio del <strong>${data.bookingDate}</strong> è stato marcato come completato. Il cliente deve confermare per procedere al pagamento.`
              ) +
              btn("Vedi stato", `${appUrl}/cleaner/bookings/${data.bookingId}`)
          )
        ),
      };

    case "payout_sent":
      return {
        subject: `Payout inviato: €${data.amount} — CleanHome`,
        html: base.replace(
          "CONTENT",
          card(
            heading("Il tuo pagamento è in arrivo!") +
              para(`Ciao ${data.recipientName},`) +
              para(
                `Abbiamo inviato un trasferimento di <strong>€${data.amount}</strong> per le prenotazioni completate dal <strong>${data.weekStart}</strong> al <strong>${data.weekEnd}</strong>.`
              ) +
              para("Il denaro apparirà sul tuo conto entro 1-2 giorni lavorativi.") +
              btn("Vedi storico payout", `${appUrl}/cleaner/payments`)
          )
        ),
      };

    case "dispute_resolved":
      return {
        subject: "Disputa risolta — CleanHome",
        html: base.replace(
          "CONTENT",
          card(
            heading("La disputa è stata risolta") +
              para(`Ciao ${data.recipientName},`) +
              para(
                `Il team CleanHome ha esaminato la disputa relativa alla prenotazione del <strong>${data.bookingDate}</strong> e ha preso una decisione.`
              ) +
              (data.resolution ? para(`Esito: ${data.resolution}`) : "") +
              btn("Vedi dettagli", `${appUrl}/client/bookings/${data.bookingId}`)
          )
        ),
      };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SendEmailParams {
  to: string;
  template: EmailTemplate;
  data: TemplateData;
}

/**
 * Send a transactional email via Resend.
 * Returns true on success, false on failure (non-throwing).
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  try {
    const resend = getResend();
    const { subject, html } = buildEmailContent(params.template, params.data);

    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject,
      html,
    });

    if (error) {
      console.error("[email] send error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] unexpected error:", err);
    return false;
  }
}
