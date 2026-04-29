---
phase: 01-sicurezza
plan: 02
subsystem: infra
tags: [sentry, environment, gitignore, security, expo]

# Dependency graph
requires: []
provides:
  - .gitignore verified blocking .env.local (pattern `.env*.local` line 34)
  - Sentry environment-aware config distinguishing local/staging/production
  - EXPO_PUBLIC_ENV documented in .env.example
affects: [05-stripe-live, 06-ios-store]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EXPO_PUBLIC_ENV=local in .env.local disables Sentry locally; staging/production always send"
    - "Sentry tracesSampleRate: 1.0 in production, 0.1 in staging"

key-files:
  created: []
  modified:
    - .env.example
    - app/_layout.tsx

key-decisions:
  - "Replaced `enabled: !__DEV__` with `enabled: ENV !== 'local'` — decouples Sentry activation from React Native dev flag, so EAS staging/production builds always report errors"
  - "tracesSampleRate: 1.0 in production for full trace coverage during launch period"

patterns-established:
  - "ENV pattern: const ENV = process.env.EXPO_PUBLIC_ENV ?? 'local' used at module top-level before Sentry.init"
  - "Three-tier env: local (disabled), staging (enabled, 0.1 sample), production (enabled, 1.0 sample)"

requirements-completed: [SEC-03, SEC-04]

# Metrics
duration: 2min
completed: 2026-04-29
---

# Phase 1 Plan 02: Sicurezza — Gitignore e Sentry Environment-Aware Config Summary

**Sentry attivato per staging/production via EXPO_PUBLIC_ENV, rimosso dipendenza da `!__DEV__` che disabilitava Sentry negli EAS build staging**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-29T08:38:45Z
- **Completed:** 2026-04-29T08:40:11Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Verificato che `.gitignore` copre `.env.local` con pattern `.env*.local` (line 34) — confermato con `git check-ignore`
- Scansionato tutta la storia git: zero chiavi `sk_live_`/`pk_live_` trovate (il conteggio "1" rilevato era il testo del commit message stesso, non una chiave reale)
- Aggiornato `app/_layout.tsx`: Sentry ora usa `EXPO_PUBLIC_ENV` per decidere se inviare errori, non `!__DEV__`
- Documentato `EXPO_PUBLIC_ENV` in `.env.example` con valore di default "local"

## Task Commits

1. **Task 1: Verificare .gitignore e assenza chiavi LIVE** - `768eaaf` (chore)
2. **Task 2: Aggiornare Sentry con environment-aware config** - `c074e4c` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `.env.example` - Added `EXPO_PUBLIC_ENV=local` after EXPO_PUBLIC_SENTRY_DSN with documentation comment
- `app/_layout.tsx` - Replaced `enabled: !__DEV__` with ENV-based config; added `environment: ENV` and dynamic `tracesSampleRate`

## Decisions Made

- **`ENV !== "local"` instead of `!__DEV__`:** `__DEV__` is `false` even in EAS `profile: development` builds, meaning Sentry would have been disabled in staging. The new pattern explicitly ties Sentry activation to the env var value, not the React Native dev flag.
- **tracesSampleRate 1.0 in production:** Captures 100% of traces during the launch period for maximum observability. Can be reduced later.
- **`?? "local"` as fallback:** If EXPO_PUBLIC_ENV is not set (e.g., CI without secrets), defaults to "local" (safe — no noise sent to Sentry).

## Deviations from Plan

None - plan executed exactly as written.

**Note on LIVE key scan false positive:** The `git log` scan returned count "1" because the Task 1 commit message text contained the phrases `sk_live_` and `pk_live_` in the phrase "zero sk_live_/pk_live_ keys found in repo". No actual credential values are present in the git history.

## Issues Encountered

None.

## User Setup Required

Nino deve aggiungere `EXPO_PUBLIC_ENV` nei secrets EAS per staging e production:

```bash
# Per staging
eas secret:create --scope project --name EXPO_PUBLIC_ENV --value staging --environment preview

# Per production
eas secret:create --scope project --name EXPO_PUBLIC_ENV --value production --environment production
```

E nel file `.env.local` locale (NON committato, gestito manualmente):
```
EXPO_PUBLIC_ENV=local
```

Questo assicura che in locale Sentry sia disabilitato, mentre negli EAS build staging e production Sentry sia attivo con le rispettive configurazioni.

## Next Phase Readiness

- Sicurezza infrastrutturale del progetto verificata: nessuna chiave LIVE nel repo, .gitignore corretto
- Sentry pronto per ricevere errori da EAS build staging e production non appena le variabili EAS sono configurate
- Phase 1 Plan 02 completata — Phase 1 (Sicurezza) completata

---
*Phase: 01-sicurezza*
*Completed: 2026-04-29*

## Self-Check: PASSED

- `.env.example` modified: PASS (line 15 contains EXPO_PUBLIC_ENV=local)
- `app/_layout.tsx` modified: PASS (lines 11, 15, 17, 18 contain new Sentry config)
- Commit `768eaaf` exists: PASS
- Commit `c074e4c` exists: PASS
- No duplicate Sentry.init blocks: PASS (grep count = 1)
- No `enabled: !__DEV__` remaining: PASS
