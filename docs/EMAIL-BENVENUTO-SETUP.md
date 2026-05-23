# Email di benvenuto — come attivarla (5 minuti)

Il sistema è **già costruito e deployato**. Funziona così: appena un utente fa il primo
accesso (email, Google o Apple), l'app chiama la Edge Function `send-welcome-email`, che
invia una mail brandizzata "Benvenuto su CleanHome 👋" **una sola volta** per utente.

Finché manca la chiave del provider email, la funzione **non dà errori**: semplicemente
non invia (l'accesso funziona comunque). Per accenderla servono 3 passi, tutti con account
tuoi (io non posso crearli da qui).

## 1. Crea un account Resend (gratis fino a 3.000 email/mese)
- Vai su https://resend.com → registrati (è il provider email standard, lo usano tante app).

## 2. Verifica il dominio cleanhomeapp.com
- In Resend: **Domains → Add Domain → `cleanhomeapp.com`**.
- Resend ti dà 3 record DNS (SPF, DKIM, DMARC). Aggiungili dove gestisci il dominio
  (lo stesso posto dove punta il sito su Vercel). Dopo qualche minuto Resend mostra "Verified".
- Questo serve perché l'email parte da `info@cleanhomeapp.com`.

## 3. Metti la chiave API in Supabase
- In Resend: **API Keys → Create API Key** → copia la chiave (`re_...`).
- In Supabase: **Project Settings → Edge Functions → Secrets** (oppure
  `Configuration → Secrets`) → aggiungi:
  - Nome: `RESEND_API_KEY`
  - Valore: la chiave `re_...`

Fatto. Da quel momento ogni nuovo utente riceve la mail di benvenuto in automatico.

## Come testare
- Registra un nuovo account nell'app → controlla la casella → deve arrivare
  "Benvenuto su CleanHome 👋".
- Per ri-testare con lo stesso utente, azzera il flag:
  `update public.profiles set welcome_email_sent_at = null where id = '<user_id>';`

## Dettagli tecnici
- Function: `supabase/functions/send-welcome-email/index.ts` (verify_jwt = true; un utente
  può attivare solo la PROPRIA mail, quindi non è abusabile).
- Idempotenza: colonna `profiles.welcome_email_sent_at`.
- Trigger lato app: `sendWelcomeEmail()` in `lib/notifications.ts`, chiamata su `SIGNED_IN`
  in `app/_layout.tsx`.
- Le mail di Supabase Auth (conferma registrazione email/password) usano già i template
  brandizzati in `supabase/email-templates/` — quelli partono dal sistema email di Supabase
  e per volumi alti conviene puntarli allo stesso SMTP Resend (Auth → SMTP Settings).
