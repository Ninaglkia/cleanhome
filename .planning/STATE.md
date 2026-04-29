# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-29)

**Core value:** Far arrivare il cliente a una pulizia confermata col cleaner giusto in pochi tap, garantendo che i soldi muovano correttamente in entrambe le direzioni con escrow e dispute chiare.
**Current focus:** Milestone v1.0 — Phase 1: Sicurezza

## Current Position

Phase: 1 of 7 (Sicurezza)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-04-29 — Completato 01-02: Gitignore verificato + Sentry environment-aware config

Progress: [██░░░░░░░░] 14%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: ~5 min
- Total execution time: ~10 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-sicurezza | 2 | ~10 min | ~5 min |

**Recent Trend:**
- Last 5 plans: 01-01 (~8 min), 01-02 (~2 min)
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Roadmap v1.0 — 7 fasi derivate da 35 requisiti. Ordine: SEC → ESCROW/CHAT/LEGAL (paralleli) → STRIPE LIVE → STORE iOS → STORE Android.
- 01-02: ENV !== "local" per Sentry invece di !__DEV__ — disaccoppia da RN dev flag, staging EAS invia sempre errori
- 01-02: tracesSampleRate 1.0 in production per massima osservabilita' durante lancio
- 01-01: console.error server-side mantiene msg reale per diagnostica; client riceve solo messaggi generici. stripe-booking-payment gia' clean. Booking insert catch in stripe-webhook corretto come Rule 2.

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 5 (Stripe LIVE):** Nino non ha ancora le chiavi sk_live_*/pk_live_*/webhook secret LIVE — fornirle prima di pianificare la fase
- **Phase 6 (iOS):** Apple Developer Program ($99/anno) non ancora acquistato
- **Phase 7 (Android):** Google Play Console ($25) non ancora acquistato
- **Phase 4 (Legali):** Dominio (cleanhome.it o equivalente) non ancora registrato

## Session Continuity

Last session: 2026-04-28
Stopped at: Completed 01-01-PLAN.md — pronto per 01-02 (prossimo piano fase Sicurezza)
Resume file: None
