# Roadmap: CleanHome v1.0 Pre-launch hardening

## Overview

Portare CleanHome dall'attuale stato pre-launch (tutto in test mode, nessun documento legale pubblicato, nessuna submission store) alla pubblicazione su App Store e Play Store con Stripe LIVE, escrow funzionante, chat anti-bypass e documenti legali online. Il percorso inizia rimuovendo la security issue critica (SEC-01) prima di toccare qualsiasi chiave LIVE, poi procede in parallelo su escrow e chat, pubblica i legali, switcha Stripe in produzione, e termina con le due submission store.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Sicurezza** - Rimuovere il debug leak nelle Edge Functions e verificare igiene secrets (completed 2026-04-29)
- [ ] **Phase 2: Escrow** - Implementare il flusso conferma-completamento con release payout al cleaner
- [ ] **Phase 3: Chat Anti-Bypass** - Bloccare condivisione contatti diretti nella chat
- [ ] **Phase 4: Documenti Legali** - Pubblicare Privacy, Terms, Refund Policy su URL pubblici
- [ ] **Phase 5: Stripe LIVE** - Switchare tutte le chiavi Stripe da test a produzione e verificare end-to-end
- [ ] **Phase 6: Submission iOS** - Costruire la build production e sottomettere all'App Store Review
- [ ] **Phase 7: Submission Android** - Costruire la build production e sottomettere al Play Store Review

## Phase Details

### Phase 1: Sicurezza
**Goal**: Le Edge Functions non espongono informazioni interne e i secrets sono gestiti correttamente
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. Una chiamata a `stripe-subscription-create` che genera un errore restituisce al client solo il messaggio generico, senza campi `debug` o `env_check`
  2. Tutte le Edge Functions non restituiscono raw error message, key prefix o env mode al client in nessun caso di errore
  3. Il file `.gitignore` blocca `.env.local`; nessuna chiave LIVE (sk_live_, pk_live_) appare nel repo git
  4. Sentry e' attivo sulla build production, riceve eventi e carica le source maps correttamente
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Rimuovere debug/env_check da stripe-subscription-create e audit di tutte le Edge Functions (SEC-01, SEC-02)
- [ ] 01-02-PLAN.md — Verificare .gitignore, .env.local e configurare Sentry production (SEC-03, SEC-04)

### Phase 2: Escrow
**Goal**: Il flusso di denaro dal cliente al cleaner passa per un gate di conferma — il payout e' rilasciato solo quando il cliente conferma il servizio (o dopo 48h di silenzio)
**Depends on**: Phase 1
**Requirements**: ESCROW-01, ESCROW-02, ESCROW-03, ESCROW-04, ESCROW-05
**Success Criteria** (what must be TRUE):
  1. Il design escrow (hold-until-confirm vs release-on-accept) e' documentato in PROJECT.md con decisione definitiva
  2. Il cliente vede nella schermata booking i bottoni "Conferma completamento" e "Apri contestazione" dopo che il servizio e' terminato
  3. Premendo "Conferma completamento" il payout viene rilasciato al cleaner (verificabile in Stripe Dashboard)
  4. Se il cliente non conferma entro 48h da `work_done_at`, il cron auto-conferma e rilascia il payout automaticamente
  5. Il flag `payout_blocked` e' coerente col design scelto (nessuna contraddizione logica nel codice)
**Plans**: TBD

Plans:
- [ ] 02-01: Documentare decisione design escrow e creare endpoint confirm-completion
- [ ] 02-02: Cron auto-conferma 48h + UI cliente bottoni conferma/contestazione + cleanup payout_blocked

### Phase 3: Chat Anti-Bypass
**Goal**: Gli utenti non possono condividere numeri di telefono, email o riferimenti ad app esterne nella chat senza che il messaggio venga bloccato
**Depends on**: Phase 1
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04
**Success Criteria** (what must be TRUE):
  1. Inviare "+39 333 1234567" nella chat produce un errore visibile all'utente con messaggio amichevole, il messaggio non appare nella conversazione
  2. Inviare "scrivimi su WhatsApp" viene bloccato con lo stesso messaggio
  3. I tentativi bloccati sono registrati nella tabella `contact_violations` con user_id, booking_id e testo oscurato
  4. La policy di moderazione e' referenziata nei Terms of Service pubblicati
**Plans**: TBD

Plans:
- [ ] 03-01: Edge Function validate-message + tabella contact_violations + risposta UI friendly

### Phase 4: Documenti Legali
**Goal**: Privacy Policy, Terms of Service e Refund Policy sono accessibili da URL pubblici su internet, referenziati in app.json e nelle schermate in-app
**Depends on**: Nothing (can run in parallel with Phase 1-3)
**Requirements**: LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, LEGAL-05, LEGAL-06
**External Blocker**: Dominio (cleanhome.it o equivalente) non ancora registrato — registrazione necessaria prima di poter pubblicare gli URL
**Success Criteria** (what must be TRUE):
  1. Aprendo `https://[dominio]/privacy` in un browser qualsiasi si carica la Privacy Policy con dati reali (nessun placeholder [Nome Azienda], [P.IVA])
  2. Stessa cosa per `/terms` e `/refund`
  3. Il campo Privacy Policy URL in `app.json` punta a un URL pubblico raggiungibile (non localhost)
  4. Le schermate `app/legal/*.tsx` aprono il browser esterno agli URL pubblici (non mostrano solo testo statico in-app)
**Plans**: TBD

Plans:
- [ ] 04-01: Registrare dominio, compilare placeholder legali con dati reali, deployare su hosting statico
- [ ] 04-02: Aggiornare app.json + schermate in-app per linkare agli URL pubblici

### Phase 5: Stripe LIVE
**Goal**: Tutte le transazioni usano chiavi Stripe di produzione; un booking completo con carta reale funziona end-to-end
**Depends on**: Phase 1 (security must be clean before inserting live keys), Phase 4 (legal docs required before store submission which follows)
**Requirements**: STRIPE-01, STRIPE-02, STRIPE-03, STRIPE-04, STRIPE-05
**External Blocker**: Chiavi Stripe LIVE (sk_live_*, pk_live_*, webhook signing secret LIVE) non ancora fornite da Nino — necessarie per procedere
**Success Criteria** (what must be TRUE):
  1. Le Edge Functions usano `sk_live_*` lette dai Supabase secrets (verificabile con Stripe Dashboard — nessuna transazione test appare)
  2. L'app client usa `pk_live_*` (nessun banner "test mode" nel payment sheet Stripe)
  3. Il Price ID abbonamento cleaner (`STRIPE_LISTING_PRICE_ID`) punta a un prodotto ricorrente €4,99/mese LIVE in Stripe
  4. Il webhook LIVE e' configurato con il signing secret corretto e riceve eventi reali da Stripe
  5. Uno smoke test completo (booking + pagamento + transfer cleaner + creazione abbonamento) con carta reale va a buon fine senza errori
**Plans**: TBD

Plans:
- [ ] 05-01: Configurare secrets LIVE in Supabase + EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY + webhook LIVE
- [ ] 05-02: Smoke test end-to-end con carta reale su ambiente production

### Phase 6: Submission iOS
**Goal**: L'app e' disponibile su TestFlight per i beta tester e sottomessa all'App Store Review
**Depends on**: Phase 4 (legal URLs required), Phase 5 (Stripe LIVE required for payment flows in review)
**Requirements**: STORE-01, STORE-02, STORE-03, STORE-04, STORE-05, STORE-06, STORE-07, STORE-08
**External Blocker**: Apple Developer Program ($99/anno) non ancora acquistato — necessario per build production e TestFlight
**Success Criteria** (what must be TRUE):
  1. La build production iOS e' compilata da EAS Build senza errori e installabile su un iPhone non collegato al Mac
  2. Almeno 5 tester hanno accettato l'invito TestFlight e l'app gira senza crash bloccanti per 48h
  3. App Store Connect mostra screenshot validi per iPhone 6.7" e 5.5", descrizione IT/EN, categoria e rating eta' settati
  4. La submission e' stata inviata all'App Store Review (status "In Review" o "Waiting for Review")
**Plans**: TBD

Plans:
- [ ] 06-01: Acquistare Apple Developer, generare build production iOS via EAS, caricare su TestFlight
- [ ] 06-02: Soak 48h TestFlight + preparare metadata store (screenshot, descrizione, keywords)
- [ ] 06-03: Submission finale a App Store Review

### Phase 7: Submission Android
**Goal**: L'app e' disponibile nel Google Play Internal Testing e sottomessa al Play Store Review
**Depends on**: Phase 4 (legal URLs required), Phase 5 (Stripe LIVE required)
**Requirements**: STORE-09, STORE-10, STORE-11, STORE-12, STORE-13
**External Blocker**: Google Play Console ($25 una tantum) non ancora acquistato — necessario per pubblicare
**Success Criteria** (what must be TRUE):
  1. La build production Android (.aab) e' compilata da EAS Build senza errori
  2. Almeno 5 tester hanno accettato l'invito Internal Testing e l'app gira senza crash bloccanti
  3. Play Console mostra screenshot Android validi e la submission e' stata inviata al Play Store Review
**Plans**: TBD

Plans:
- [ ] 07-01: Acquistare Play Console, generare build production Android via EAS, configurare Internal Testing
- [ ] 07-02: Soak tester + submission a Play Store Review

## Progress

**Execution Order:**
Phases 1-3 can partially overlap (Phase 3 and 4 independent of each other). Phase 5 requires Phase 1 complete. Phases 6-7 require Phases 4 and 5 complete.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Sicurezza | 2/2 | Complete   | 2026-04-29 |
| 2. Escrow | 0/2 | Not started | - |
| 3. Chat Anti-Bypass | 0/1 | Not started | - |
| 4. Documenti Legali | 0/2 | Not started | - |
| 5. Stripe LIVE | 0/2 | Not started | - |
| 6. Submission iOS | 0/3 | Not started | - |
| 7. Submission Android | 0/2 | Not started | - |
