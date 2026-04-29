# Requirements: CleanHome v1.0 Pre-launch hardening

**Defined:** 2026-04-29
**Core Value:** Far arrivare il cliente a una pulizia confermata col cleaner giusto in pochi tap, garantendo che i soldi muovano correttamente in entrambe le direzioni con escrow e dispute chiare.

## v1 Requirements

Requisiti per chiudere la milestone "Pre-launch hardening" e arrivare alla submission store.

### Stripe Production

- [ ] **STRIPE-01**: Tutte le Edge Functions usano chiavi Stripe LIVE (`sk_live_*`) lette dai secrets Supabase
- [ ] **STRIPE-02**: App client usa publishable key LIVE (`pk_live_*`) in produzione
- [ ] **STRIPE-03**: `STRIPE_LISTING_PRICE_ID` punta a un price ricorrente €4,99/mese in modalità LIVE
- [ ] **STRIPE-04**: Webhook endpoint LIVE configurato con signing secret in `STRIPE_WEBHOOK_SECRET`
- [ ] **STRIPE-05**: Smoke test end-to-end (booking + payment + transfer + sub creation) verificato in LIVE con carta reale di prova

### Security Hardening

- [ ] **SEC-01**: Edge Function `stripe-subscription-create` non restituisce più `debug` né `env_check` al client (solo messaggio generico)
- [ ] **SEC-02**: Audit di tutte le Edge Functions per assicurarsi che nessun errore ritorni dettagli interni (raw error, key prefix, env mode)
- [ ] **SEC-03**: `.env.local` non committato e contenente chiavi LIVE solo localmente; `.gitignore` verificato
- [ ] **SEC-04**: Sentry attivo in produzione (build production) con DSN configurato e source maps caricate

### Escrow

- [ ] **ESCROW-01**: Decisione design escrow documentata in PROJECT.md (release immediato vs hold-until-confirm)
- [ ] **ESCROW-02**: Endpoint `confirm-completion` per il cliente (release del payout al cleaner) — se design è hold
- [ ] **ESCROW-03**: Cron job auto-conferma 48h dopo `work_done_at` se cliente non risponde
- [ ] **ESCROW-04**: UI cliente: bottoni "Conferma servizio completato" / "Apri contestazione" nella schermata booking
- [ ] **ESCROW-05**: `payout_blocked` flag coerente col design scelto (rimosso o usato correttamente)

### Chat Anti-Bypass

- [ ] **CHAT-01**: Edge Function `validate-message` che blocca messaggi contenenti numeri di telefono, email, menzioni di app esterne (WhatsApp, Telegram, etc.)
- [ ] **CHAT-02**: Tabella `contact_violations` per loggare tentativi bloccati
- [ ] **CHAT-03**: Risposta utente friendly al blocco: "Non puoi condividere contatti diretti per garantire un'esperienza sicura"
- [ ] **CHAT-04**: Policy di moderazione documentata nei Terms of Service

### Legal Documents

- [ ] **LEGAL-01**: Privacy Policy pubblicata online (es. `https://cleanhome.it/privacy`)
- [ ] **LEGAL-02**: Terms of Service pubblicata online
- [ ] **LEGAL-03**: Refund Policy pubblicata online
- [ ] **LEGAL-04**: URL legali referenziati in `app.json` (Privacy Policy URL per stores)
- [ ] **LEGAL-05**: Schermate in-app `app/legal/*.tsx` linkano agli URL pubblici per coerenza
- [ ] **LEGAL-06**: Placeholder ([Nome Azienda], [P.IVA o CF], [Email]) compilati con dati reali

### App Store Submission (iOS)

- [ ] **STORE-01**: Apple Developer Program acquistato e identità verificata
- [ ] **STORE-02**: Build production iOS via `eas build --platform ios --profile production`
- [ ] **STORE-03**: Screenshot iPhone 6.7" e 5.5" generati (almeno 3-5 per device)
- [ ] **STORE-04**: App description IT/EN scritta (max 4000 char) + keywords (max 100 char)
- [ ] **STORE-05**: Categoria store + età minima settati in App Store Connect
- [ ] **STORE-06**: TestFlight Internal Testing attivo — 5+ amici inviati come tester
- [ ] **STORE-07**: 48h di soak in TestFlight senza crash bloccanti
- [ ] **STORE-08**: Submission a App Store Review

### Play Store Submission (Android)

- [ ] **STORE-09**: Google Play Console acquistato e identità verificata
- [ ] **STORE-10**: Build production Android via `eas build --platform android --profile production` (.aab)
- [ ] **STORE-11**: Screenshot Android phone (almeno 3-5)
- [ ] **STORE-12**: Internal Testing attivo — 5+ tester invitati via link
- [ ] **STORE-13**: Submission a Play Store Review

## v2 Requirements

Deferred a milestone successiva.

### Testing & Quality

- **TEST-01**: Jest/Vitest configurato per Edge Functions (target 80% coverage critical paths)
- **TEST-02**: Test E2E con Maestro o Detox per flow auth + booking + payment

### Performance & Monitoring

- **MON-01**: Endpoint `/health` con check su DB + Stripe + Edge Functions
- **MON-02**: UptimeRobot o Checkly su endpoint health
- **MON-03**: Alert Slack/email per Edge Function failures

### Code Quality

- **REFACTOR-01**: Spezzare file >1500 righe (`app/listing/index.tsx`, `app/properties/new.tsx`, `app/booking/new.tsx`)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend AI matching | Algoritmo dispatch attuale (geolocation + preferiti) sufficiente |
| Web app cliente | Mobile-first, web non priorità v1 |
| Pagamenti non-Stripe | Stripe sufficiente |
| Localizzazione EN/altre lingue | Italiano-only per launch Italia |
| Test framework | Spostato a v2 milestone — non bloccante per launch |
| Refactoring file enormi | Spostato a v2 milestone — funzionante anche se non ideale |
| Health check endpoint | v2, non bloccante per launch su mercato piccolo |

## Traceability

Da popolare durante creazione roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (popolato dal roadmapper) | — | Pending |

**Coverage:**
- v1 requirements: 35 totali
- Mapped to phases: 0 (in attesa di roadmap)
- Unmapped: 35

---
*Requirements defined: 2026-04-29*
*Last updated: 2026-04-29 after initial definition*
