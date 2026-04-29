# CleanHome

## What This Is

Marketplace mobile (iOS + Android) per servizi di pulizia domestica. I clienti pubblicano case, scelgono cleaner preferiti o lasciano dispatch automatico, pagano via Stripe; i cleaner gestiscono i propri annunci (primo gratis, successivi €4,99/mese) e ricevono i pagamenti via Stripe Connect. Pre-lancio.

## Core Value

Far arrivare il cliente a una pulizia confermata col cleaner giusto in pochi tap, garantendo che i soldi muovano correttamente in entrambe le direzioni con escrow e dispute chiare.

## Requirements

### Validated

<!-- Shipped e confermati funzionanti su build dev / produzione -->

- ✓ Auth Supabase (email + Apple Sign In) — Milestone v0.x
- ✓ Schema property + cleaner_listings + bookings + booking_offers + reviews — v0.x
- ✓ Multi-step wizard "Nuova proprietà" + Google Places autocomplete — v0.x
- ✓ Multi-dispatch booking (race-safe via RPC `dispatch_accept_offer`) — v0.x
- ✓ Stripe payment booking + Stripe Connect onboarding cleaner — v0.x (test mode)
- ✓ Stripe subscription €4,99/mese per annunci aggiuntivi — v0.x (test mode)
- ✓ Realtime tracking booking + push notifications + email transazionali — v0.x
- ✓ Chat 1:1 cliente↔cleaner — v0.x (no anti-bypass yet)
- ✓ Cron auto-cancel booking expired ogni 5 min (pg_cron) — v0.x

### Active

<!-- Milestone corrente: Pre-launch hardening -->

Vedi sezione "Current Milestone" sotto.

### Out of Scope

- **Web app cliente / cleaner** — mobile-first, web non è priorità
- **Pagamenti via PayPal/altri** — Stripe è sufficiente per v1
- **Chat di gruppo / forum** — non core
- **Rating bidirezionale anonimo** — già implementato cleaner→cliente e cliente→cleaner pubblici
- **AI matching avanzato** — algoritmo dispatch attuale (geolocation + preferiti) è sufficiente per launch

## Current Milestone: v1.0 Pre-launch hardening

**Goal:** Portare l'app dallo stato pre-launch attuale alla pubblicazione su App Store + Play Store con Stripe LIVE, escrow funzionante, anti-bypass chat e documenti legali pubblicati.

**Target areas:**
- Stripe production switch (test → live)
- Sicurezza Edge Functions (rimuovere debug leak)
- Escrow vero (release post-conferma cliente)
- Chat anti-bypass (filtro contatti)
- Pubblicazione documenti legali online
- Submission App Store + Play Store

## Context

**Tech stack:**
- Mobile: Expo 53 + React Native + Expo Router + NativeWind
- Backend: Supabase (Postgres + Auth + Edge Functions Deno + Storage + Realtime + pg_cron + pg_net)
- Pagamenti: Stripe + Stripe Connect (account `acct_1TFBaIBjhO7cremS`)
- Notifiche: Expo push + email transazionali via Resend (in `send-push-notification`)
- Maps: Google Places autocomplete

**Modello economico:**
- Cliente paga +9% sopra il prezzo base
- Cleaner riceve −9% sotto il prezzo base
- Platform fee totale: 18% (FEE_RATE in `stripe-booking-payment`)
- Pricing: €1,30/mq, minimo €50

**Stato attuale (2026-04-29):**
- 0 customer in Stripe live (KYC completato in passato per Apple, da riverificare)
- 0 utenti in produzione
- Test in dev build su iPhone Nino (cert Apple gratuito, scade ogni 7gg)

## Constraints

- **Budget:** indie/solo dev — €99/anno Apple + $25 una tantum Google + ~€10/anno dominio
- **Timeline:** target launch entro 4-6 settimane
- **Compliance:** GDPR (utenti italiani) — privacy/terms/refund obbligatori online prima di submission store
- **Tech:** mantenere expo-managed workflow (no eject); EAS Build per submission
- **Sicurezza:** chiavi Stripe LIVE mai in repo; SecureStore per session token su client

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multi-dispatch via Postgres RPC race-safe | Atomic via MVCC, no lock tables | ✓ Good (testato in prod) |
| Subscription per annunci aggiuntivi | Monetizza cleaner attivi senza barriere | — Pending validation |
| FEE_RATE 18% spalmato 9+9 | Più sostenibile percepito vs 18% tutto su una parte | — Pending validation |
| SecureStore con fallback AsyncStorage | Sicurezza prod + dev build resilience | ✓ Good |
| Italiano-first | Mercato target Italia | ✓ Good |
| Stripe TEST in dev, LIVE in prod | Standard | — Pending switch |

---
*Last updated: 2026-04-29 after milestone v1.0 init*
