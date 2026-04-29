# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-29)

**Core value:** Far arrivare il cliente a una pulizia confermata col cleaner giusto in pochi tap, garantendo che i soldi muovano correttamente in entrambe le direzioni con escrow e dispute chiare.

**Current focus:** Milestone v1.0 — Pre-launch hardening (defining requirements)

## Current Position

- **Milestone:** v1.0 Pre-launch hardening
- **Phase:** Not started (defining requirements)
- **Plan:** —
- **Status:** Defining requirements
- **Last activity:** 2026-04-29 — Milestone v1.0 started

## Accumulated Context

- Codebase mappato: vedi `.planning/codebase/` (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS)
- 2 fix critici applicati il 2026-04-29:
  - `lib/supabase.ts`: lazy-require expo-secure-store con fallback AsyncStorage
  - `app/booking/new.tsx`: fix TDZ su totalDisplaySteps
  - `supabase/functions/stripe-subscription-create`: self-heal stale customer + debug payload (debug DA RIMUOVERE prima del live)
- Customer Stripe stale `cus_UIzRt0z8wNl7Zv` ripulito dal profilo utente Nino in DB

## Open Issues / Blockers

- Nino non ha ancora le chiavi Stripe LIVE (sk_live_/pk_live_) — bloccante per Phase "Stripe production"
- Apple Developer Program ($99) non ancora acquistato — bloccante per Phase "Store submission"
- Google Play Console ($25) non ancora acquistato — idem
- Dominio `cleanhome.it` (o equivalente) non ancora registrato — bloccante per Phase "Legal docs publish"

---
*Last updated: 2026-04-29*
