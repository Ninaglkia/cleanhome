// HTTPS bridge for Stripe Connect onboarding return/refresh URLs.
// Stripe rejects custom URL schemes (cleanhome://) on account_links so
// we hand Stripe a public HTTPS URL here, and this function answers
// the user's browser with a tiny HTML page that bounces them back into
// the app via the cleanhome:// deep link.
//
//   GET /functions/v1/stripe-connect-redirect?to=return
//   GET /functions/v1/stripe-connect-redirect?to=refresh
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const APP_SCHEME = "cleanhome";

serve((req: Request) => {
  const url = new URL(req.url);
  const to = url.searchParams.get("to") === "refresh" ? "refresh" : "return";
  const deepLink = `${APP_SCHEME}://stripe-connect/${to}`;

  const labelTitle =
    to === "return" ? "Verifica completata" : "Riprova la verifica";
  const labelBody =
    to === "return"
      ? "Stiamo riportando alla tua app CleanHome…"
      : "Riapri CleanHome per riprendere da dove avevi lasciato…";

  const html = `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0;url=${deepLink}" />
  <title>${labelTitle} — CleanHome</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif;
      background: #f6faf9; color: #022420; margin: 0;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px; text-align: center; }
    .card { max-width: 360px; }
    h1 { font-size: 22px; margin-bottom: 8px; color: #022420; }
    p { color: #5b6e6a; font-size: 15px; line-height: 1.4; }
    a.btn { display: inline-block; margin-top: 20px;
      background: #006b55; color: #fff; padding: 14px 22px;
      border-radius: 12px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${labelTitle}</h1>
    <p>${labelBody}</p>
    <a class="btn" href="${deepLink}">Apri CleanHome</a>
  </div>
  <script>window.location.href = ${JSON.stringify(deepLink)};</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
