---
phase: 01-sicurezza
plan: 01
subsystem: security/edge-functions
tags: [security, stripe, edge-functions, information-disclosure]
dependency_graph:
  requires: []
  provides: [hardened-error-responses]
  affects: [stripe-subscription-create, stripe-booking-action, stripe-webhook]
tech_stack:
  added: []
  patterns: [generic-error-messages, server-side-logging]
key_files:
  created: []
  modified:
    - supabase/functions/stripe-subscription-create/index.ts
    - supabase/functions/stripe-booking-action/index.ts
    - supabase/functions/stripe-webhook/index.ts
decisions:
  - "Mantenere console.error server-side con il messaggio reale per diagnostica; solo la risposta HTTP al client usa messaggi generici"
  - "stripe-booking-payment gia' clean — nessuna modifica necessaria"
  - "Aggiunto fix al booking insert catch in stripe-webhook (non nel piano originale, stessa categoria di leak)"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-28"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 01 Plan 01: Security — Edge Function Error Leak Removal Summary

**One-liner:** Rimossi debug/env_check/raw-error leaks da quattro Edge Functions Stripe; ogni catch ora restituisce solo messaggi generici al client mantenendo diagnostica server-side.

## Objective

Eliminare il rischio che un attaccante triggeri errori nelle Edge Functions e ottenga informazioni interne: modalita' environment (test/live), prefix delle chiavi Stripe, raw error messages di Stripe.

## Tasks Completed

| Task | Files | Status | Commit |
|------|-------|--------|--------|
| 1: Rimuovere debug/env_check da stripe-subscription-create | stripe-subscription-create/index.ts | Fixed | 0c47c82 |
| 2: Audit e fix catch block nelle altre Edge Functions | stripe-booking-action/index.ts, stripe-webhook/index.ts | Fixed | bca59e9 |

## Edge Function Status

| Function | Status | Issue Found | Fix Applied |
|----------|--------|-------------|-------------|
| stripe-subscription-create | Fixed | `debug: msg`, `env_check` block con key prefix e mode | Rimossi; solo messaggio generico |
| stripe-booking-action | Fixed | `error: err?.message ?? "Errore interno"` espone raw error | Sostituito con stringa fissa |
| stripe-webhook (signature catch) | Fixed | `Webhook Error: ${err?.message}` con interpolazione | Stringa fissa senza interpolazione |
| stripe-webhook (handler catch) | Fixed | `Handler Error: ${err?.message}` con interpolazione | Stringa fissa senza interpolazione |
| stripe-webhook (booking insert) | Fixed | `Booking insert failed: ${insertErr?.message}` (non nel piano) | Stringa fissa [Rule 2 auto-fix] |
| stripe-booking-payment | Clean | Gia' corretto — solo messaggio generico | Nessuna modifica |

## Campi Rimossi

**stripe-subscription-create:**
- `debug: msg` — il raw error message di Stripe
- `env_check.has_secret_key` — booleano presenza chiave
- `env_check.has_price_id` — booleano presenza price ID
- `env_check.price_id_prefix` — primi 12 caratteri del price ID
- `env_check.secret_key_mode` — "live" / "test" / "unknown"
- Commento `// Pre-launch: return the underlying error...`

## Deployments

Tutte le Edge Functions modificate ridistribuite su Supabase (project: tnuipmzksryfmhsctcud):

| Function | verify_jwt | Deploy Status |
|----------|------------|---------------|
| stripe-subscription-create | false | Deployed |
| stripe-booking-action | true | Deployed |
| stripe-webhook | false | Deployed |
| stripe-booking-payment | true | Non ridistribuita (invariata) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Fix] stripe-webhook booking insert catch espone raw error message**

- **Found during:** Task 2 (audit di stripe-webhook)
- **Issue:** Linea 315 originale: `return new Response(\`Booking insert failed: ${insertErr?.message}\`, { status: 500 })` — stesso pattern di information disclosure non coperto esplicitamente dal piano
- **Fix:** Sostituito con `return new Response("Internal server error", { status: 500 });`
- **Files modified:** supabase/functions/stripe-webhook/index.ts
- **Commit:** bca59e9

## Decisions Made

1. `console.error` server-side mantiene il messaggio reale per diagnostica — non e' un leak perche' non raggiunge il client
2. stripe-booking-payment era gia' conforme — solo verifica visiva, nessuna modifica
3. Il catch del booking insert in stripe-webhook (non nel piano) e' stato corretto inline come Rule 2 perche' e' dello stesso tipo di rischio

## Self-Check: PASSED

Files exist:
- supabase/functions/stripe-subscription-create/index.ts: FOUND
- supabase/functions/stripe-booking-action/index.ts: FOUND
- supabase/functions/stripe-webhook/index.ts: FOUND

Commits exist:
- 0c47c82: FOUND
- bca59e9: FOUND
