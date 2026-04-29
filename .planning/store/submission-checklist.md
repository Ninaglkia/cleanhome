# Store Submission Checklist — CleanHome v1.0

**Target:** App Store + Play Store launch
**Sblocca:** Phase 6 (iOS) + Phase 7 (Android) della milestone v1.0
**Pre-requisiti:** Phase 1–5 completati

---

## 0. Pre-flight (deve essere già fatto)

- [ ] Stripe LIVE attivo (Phase 5)
- [ ] Privacy/Terms/Refund su URL pubblico (Phase 4)
- [ ] Edge Functions hardened (Phase 1)
- [ ] Sentry production attivo
- [ ] `app.json` con bundle ID definitivo, version 1.0.0, privacy URL pubblico
- [ ] Tutti i test E2E manuali passati (vedi §5)

---

## 1. Asset visuali

### 1.1 Icona app
- [x] iOS 1024×1024 PNG opaca (no alpha) — già in `assets/cleanhome-icon-v2.png`?
- [ ] Android adaptive icon: foreground 1024×1024 + background colore — verificare `assets/android-icon-foreground.png`
- [ ] Notification icon Android (24×24 monochrome)
- [ ] Favicon web (32×32, 192×192)

### 1.2 Screenshot iOS (richiesti da App Store)
Risoluzioni richieste:
- **6.7"** (iPhone 16 Pro Max): 1290×2796 — 3 minimo, 10 massimo
- **6.5"** (iPhone 11 Pro Max): 1284×2778 — opzionale ma consigliato
- **5.5"** (iPhone 8 Plus): 1242×2208 — opzionale
- **iPad Pro 12.9"** (se supporti iPad): 2048×2732

Schermate da catturare (5 minimum):
1. **Onboarding hero** — "Pulizie a casa, in pochi tap"
2. **Mappa con cleaner vicini** — `app/(tabs)/home.tsx`
3. **Dettaglio listing cleaner** — recensioni + prezzo
4. **Booking + payment sheet** — Stripe in azione
5. **Chat cliente↔cleaner** — vita reale

### 1.3 Screenshot Android
- **Phone**: 1080×1920 minimum — 2 minimum, 8 massimo
- **Tablet 7"** (opzionale): 1024×1600
- **Tablet 10"** (opzionale): 1280×1920

Stesse 5 schermate dell'iOS.

### 1.4 Feature graphic Play Store
- 1024×500 PNG (banner orizzontale per pagina app)
- Testo consigliato: "CleanHome — Pulizie a casa in pochi tap"

### 1.5 App preview video (opzionale ma consigliato)
- iOS: 15–30s, .mov o .m4v, risoluzione del device target
- Android: link YouTube unlisted

---

## 2. Copy / metadata

### 2.1 Nome app
- **App Store name:** "CleanHome" (max 30 char)
- **Subtitle iOS:** "Pulizie a casa in pochi tap" (max 30 char)
- **Short description Android:** "Pulizie a casa: prenota cleaner verificati con P.IVA" (max 80 char)

### 2.2 Description (max 4000 char)

```
[NINO: revisionare]

CleanHome è il marketplace italiano per le pulizie domestiche. Trova cleaner verificati con P.IVA, prenota in pochi tap e paga in sicurezza tramite Stripe.

🧹 PER I CLIENTI
• Aggiungi le tue proprietà con foto e dettagli
• Trova cleaner vicini sulla mappa
• Scegli il preferito o lascia il dispatch automatico
• Paga in app: carta, Apple Pay, Google Pay
• Recensioni verificate e chat in-app

🛡️ PER I CLEANER
• Pubblica il tuo primo annuncio gratis
• Annunci aggiuntivi a €4,99/mese
• Ricevi pagamenti diretti su IBAN tramite Stripe Connect
• Gestisci la disponibilità dal tuo profilo
• Costruisci la tua reputazione con le recensioni dei clienti

💳 PAGAMENTI SICURI
Tutti i pagamenti sono processati da Stripe (PCI-DSS Level 1).
Escrow attivo: i fondi sono rilasciati al cleaner solo dopo conferma del servizio.

📍 ITALIA
Servizio attivo in tutta Italia. Geolocalizzazione tramite Google Places.

Termini: [URL terms]
Privacy: [URL privacy]
Supporto: support@cleanhome.it
```

### 2.3 Keywords iOS (100 char totali, separati da virgola, no spazi)
```
pulizie,casa,cleaning,colf,domestica,marketplace,booking,cleaner,impresa,domicilio,prenotazione
```

### 2.4 Categoria
- **Primaria:** Lifestyle
- **Secondaria iOS:** Productivity
- **Secondaria Android:** House & Home

### 2.5 Age rating
- **iOS:** 4+ (no contenuti violenti, no gambling)
- **Android:** PEGI 3 / Everyone

### 2.6 Pricing
- App **gratuita**
- In-app purchase: abbonamento listings cleaner €4,99/mese
  → ATTENZIONE: questo è un servizio fisico (pubblicazione listing per attività fisica) → **NON va come IAP Apple, ma come pagamento esterno via Stripe** (consentito da Apple guideline 3.1.3 — "Reader" / "Multiplatform Services" / **gestione marketplace fisico**)

---

## 3. Privacy questionnaire (App Privacy / Data Safety)

### 3.1 iOS App Store — Privacy Nutrition Label

| Categoria | Raccolto? | Linkato all'utente? | Usato per tracking? |
|---|---|---|---|
| Email | Sì | Sì | No |
| Nome | Sì | Sì | No |
| Foto profilo (opzionale) | Sì | Sì | No |
| Indirizzo (proprietà) | Sì | Sì | No |
| Geolocalizzazione (precisa) | Sì | Sì | No |
| Identificatori dispositivo (push token) | Sì | Sì | No |
| Crash data (Sentry) | Sì | No | No |
| Usage data | No | — | — |
| Pagamenti (gestiti da Stripe) | No (non sui nostri server) | — | — |

### 3.2 Play Store — Data Safety form
Stessa logica. Dichiarare:
- Dati crittografati in transito (TLS): **Sì**
- Possibilità di richiedere cancellazione dati: **Sì** (in app)
- Audit di sicurezza indipendente: [NINO: scegliere — no per v1, oppure indicare se fatto]

---

## 4. Account e configurazione store

### 4.1 Apple Developer
- [ ] Account attivo ($99/anno) — [NINO: verificare scadenza]
- [ ] Bundle ID: `com.cleanhome.app` (verificato in `app.json`)
- [ ] App ID registrato in App Store Connect
- [ ] Tester TestFlight (almeno 1 demo cliente + 1 demo cleaner)
- [ ] Demo account credentials per il review (Apple lo richiede!)

### 4.2 Google Play Console
- [ ] Account attivo ($25 one-time)
- [ ] Package name: `com.cleanhome.app`
- [ ] Internal testing track configurato
- [ ] Closed testing → Open testing prima del rollout produzione
- [ ] Demo account credentials per il review

### 4.3 Demo account per review (CRITICO)
Apple e Google testano l'app con account dummy. Servono:
- 1 account cliente con almeno 1 proprietà già creata
- 1 account cleaner con onboarding Stripe Connect completo (in test mode è OK per il review!)
- Le credentials vanno scritte nelle note al review

---

## 5. Smoke test Stripe LIVE end-to-end

Da eseguire **dopo** lo switch alle chiavi LIVE (Phase 5) e **prima** di submit store.

### 5.1 Test cleaner onboarding LIVE
- [ ] Crea account cleaner nuovo
- [ ] Avvia onboarding Stripe Connect → completa con dati reali (P.IVA Nino)
- [ ] Verifica `cleaner_stripe_account` salvato in DB
- [ ] Verifica `details_submitted = true` su Stripe Dashboard LIVE

### 5.2 Test booking + payment LIVE
- [ ] Crea proprietà come cliente
- [ ] Cerca cleaner sulla mappa → trova quello onboardato sopra
- [ ] Crea booking → Payment Sheet con carta reale (importo minimo €50)
- [ ] Verifica PaymentIntent `succeeded` su Stripe Dashboard
- [ ] Verifica `application_fee_amount = 18% del totale`
- [ ] Verifica `transfer_data.destination = cleaner_stripe_account`
- [ ] Verifica notification push al cleaner

### 5.3 Test escrow (se Opzione A)
- [ ] Cleaner accetta + segna lavoro completato → `work_done_at`
- [ ] Cliente vede bottoni "Conferma" / "Contesta"
- [ ] Conferma → verifica transfer eseguito su Stripe Dashboard
- [ ] (Test alternativo) Apri contestazione → verifica `payout_blocked = true`
- [ ] (Test alternativo) Lascia 48h+ → cron auto-conferma → transfer eseguito

### 5.4 Test subscription cleaner LIVE
- [ ] Cleaner crea 2° listing → richiede subscription
- [ ] Payment Sheet €4,99/mese con carta reale
- [ ] Verifica subscription `active` su Stripe Dashboard
- [ ] Cancella subscription → verifica `cancel_at_period_end = true`

### 5.5 Test refund LIVE
- [ ] Cliente cancella booking >24h prima → rimborso 100%
- [ ] Verifica refund su Stripe Dashboard
- [ ] Verifica notifica al cliente

### 5.6 Test webhook LIVE
- [ ] Trigger `account.updated` da Stripe Dashboard → verifica DB aggiornato
- [ ] Trigger `payment_intent.succeeded` → verifica booking status
- [ ] Trigger `charge.dispute.created` → verifica notifica admin

---

## 6. Build & submission

### 6.1 EAS Build production
- [ ] `eas.json` profilo `production` configurato
- [ ] `app.json` versione 1.0.0, build number 1
- [ ] iOS provisioning profile valido
- [ ] Android keystore generato e backuppato (CRITICO: se perso, app non aggiornabile)
- [ ] `eas build --platform ios --profile production`
- [ ] `eas build --platform android --profile production`
- [ ] Test su device reali ENTRAMBI iOS e Android (no simulator)

### 6.2 iOS submission
- [ ] `eas submit --platform ios` o upload manuale via Transporter
- [ ] Compila App Store Connect:
  - [ ] Description, keywords, screenshot
  - [ ] Privacy Policy URL
  - [ ] Support URL
  - [ ] Demo account credentials nelle note al review
- [ ] "Submit for Review"
- [ ] Tempo review medio: 24–48h

### 6.3 Android submission
- [ ] `eas submit --platform android`
- [ ] Compila Play Console:
  - [ ] Description, screenshot, feature graphic
  - [ ] Privacy Policy URL
  - [ ] Data Safety form
  - [ ] Demo account credentials
- [ ] Production track → rollout 20% iniziale → poi 100%
- [ ] Tempo review medio: 7 giorni la prima volta, poi 1–2gg

---

## 7. Post-launch (settimana 1)

- [ ] Monitor Sentry per crash
- [ ] Monitor Stripe Dashboard per pagamenti
- [ ] Verificare email transazionali (Resend dashboard)
- [ ] Rispondere a recensioni store
- [ ] Bug fix critici → hotfix release con `eas update` (per OTA) o nuova build

---

## 8. Open question per Nino

Prima di sottomettere serve:
1. **Domain registrato** per pubblicare i legali (Phase 4 dependency)
2. **Stripe LIVE keys** (Phase 5 dependency)
3. **Apple Developer account valido** + cert distribution
4. **Google Play Console attivo** ($25 versato)
5. **Decisione escrow** (vedi `.planning/decisions/escrow-design.md`)
6. **Dati azienda** per compilare placeholder nei legali (vedi `legal/*.md`)
