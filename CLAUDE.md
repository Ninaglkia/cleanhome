# CleanHome RN — Project Rules

> Read this file at the start of EVERY session. Don't skip sections.

---

## 1. Project Context

- **Stack:** Expo + React Native + TypeScript + NativeWind + Supabase + Stripe Connect
- **Working dir:** `/Users/ninomarianolai/CleanHomeRN`
- **Build:** Always use dev build (`com.cleanhome.app`), NEVER Expo Go
- **Branch:** `main`
- **Language:** Italian for conversation + UI text, English for code/comments/commits
- **Current goal:** Finish checkout UI polish + submit TestFlight. **No new features.**

**Fixed constants (do NOT ask):**
- Site: `cleanhomeapp.com` (`/privacy`, `/terms` live)
- Single user-facing email: `info@cleanhomeapp.com`
- Stripe owner: `ninaglia089@gmail.com`

---

## 2. Operating Rules — NON-NEGOTIABLE

### 2.1 Memory
Persistent facts (domains, emails, env vars, decisions) → **save immediately** before responding. Never "I'll remember later".
Before asking "what's X?": check this file → grep code → memory. Only if nothing, ask ONCE.

### 2.2 Sub-agents & Skills — CONDITIONAL, not automatic

**The previous rule "always use frontend-dev / always use superpowers skills" caused waste.** Reset:

**Invoke `frontend-dev` agent ONLY when:**
- New screen or new component (not edits)
- Layout/touch/gesture bug touching ≥3 files
- Reanimated / complex animation work
- Visual audit of an entire module
- Navigation flow restructure

**Do INLINE (no agent) when:**
- Find/replace (mailto, env name, copy text)
- Typo, rename, single-file fix < 30 lines
- Adding/removing a prop, a className, a color
- Backend edits (Edge Functions, RPCs, migrations) — use `backend-dev` only if ≥3 files or schema change
- TypeScript types, helpers in `lib/`
- Memory / CLAUDE.md / config edits
- Reading files for context

**Superpowers skills — invoke ONLY when:**
- `superpowers:brainstorming` → genuinely new feature with unclear scope
- `superpowers:systematic-debugging` → bug that survived 2 fix attempts
- `superpowers:test-driven-development` → critical path (payments, auth) needing tests
- `superpowers:writing-plans` → multi-day work spanning ≥5 files
- `superpowers:verification-before-completion` → before final commit of a milestone

For everything else: **just work**. One sentence rationale before invoking any skill/agent: *"Using X because Y."* If Y is weak, skip it.

### 2.3 Cache diagnosis BEFORE code
If user says "I don't see the changes" / "app didn't update" AND code on `main` is correct:
**First hypothesis = device/Metro cache.** NOT another code fix.

```bash
lsof -ti :8081 | xargs kill -9 2>/dev/null
rm -rf .expo/cache node_modules/.cache
npx expo start --dev-client --clear
```
Then force-quit app + reopen. Only if persists → look at code.

### 2.4 Response style
- No repeated "you're right", no multiple apologies.
- One correction + action. Stop.
- If user is angry: **fewer words, more tool calls**. Work, don't talk.
- Italian casual, direct. No corporate speak.

### 2.5 When to ask
Only if: irreversible product decision, ambiguity on which flow to touch, missing asset/credential.
Otherwise: pick the sensible option and state it. *"Going with X, tell me if you want Y instead."*

---

## 3. Development Workflow

### Before writing code
1. View relevant files (no blind grep)
2. Fix > 1 file → 3-line mini-plan FIRST
3. Ambiguous task → plan mode

### After writing code
1. `cd /Users/ninomarianolai/CleanHomeRN && npx tsc --noEmit` → 0 errors before saying "done"
2. Verify Metro bundle has no SyntaxError
3. If UI changed: tell user what to check + which screen
4. Commit: conventional commits in English, NO `Co-Authored-By` footer
5. **NEVER `git add -A` / `git add .`** — repo has pre-commit rules blocking secret files. Always `git add <specific-files>`
6. Push to `main`

### Auto-reload after edits
After every edit to runtime code (`app/`, `components/`, `lib/`):
```bash
curl -X POST http://localhost:8081/reload
```
Do this AFTER `tsc` passes, BEFORE commit. Skip only for config-only changes.
If Metro isn't running on 8081, tell user in one line — don't retry.

### "It doesn't work" diagnosis order
1. Cache (see 2.3)
2. Metro log: `tail /tmp/metro*.log`
3. Code

Never skip to step 3.

---

## 4. Architecture & Key Files

```
app/                  expo-router routes
components/           shared UI
lib/                  theme.ts, api.ts, types.ts, supabase, stripe
legal/                privacy.md, terms.md, refund.md
supabase/             functions/ (Edge), migrations/
```

**Conventions:**
- Styling: NativeWind only. No inline StyleSheet (except Reanimated style props).
- Tokens: `lib/theme.ts`. Never hardcoded colors.
- Routing: expo-router file-based.
- Payments: Stripe Payment Intents, escrow model (immediate auto-capture to platform balance, transfer to cleaner on client confirmation or 48h auto-confirm cron).

**Key files:**
- `app/listing/index.tsx` — main listing editor (large, refactor pending)
- `app/listings/index.tsx` — multi-listing list page
- `app/(tabs)/profile.tsx` — dual profile (CleanerView/ClientView)
- `app/(tabs)/home.tsx` — client map search with PostGIS
- `app/cleaner/[id].tsx` — cleaner public profile (in progress)
- `app/booking/new.tsx` — booking flow with Payment Sheet
- `lib/api.ts` — all Supabase API functions
- `lib/types.ts` — TypeScript types
- `supabase/functions/` — Edge Functions (stripe-*, etc.)

**Env (`.env.local`, never commit):**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY` (Edge Functions only)

---

## 5. Naming Convention (FIXED — do NOT "fix")

- `CleanerView` = shown to CLEANERS (green/blue theme)
- `ClientView` = shown to CLIENTS (orange/brown theme)
- Color constants are intentionally inverted in code; behavior is correct.

---

## 6. Current Focus: Checkout UI + TestFlight

### 6.1 Checkout UI — polish checklist
- [ ] Primary CTA: same color/height across all steps
- [ ] Visible loading state on "Paga" (prevent double tap)
- [ ] Stripe error state: user-friendly message, NOT raw `error.message`
- [ ] Spacing coherent (4px grid, container padding 16/20)
- [ ] KeyboardAvoidingView on email/notes inputs
- [ ] Back button handled (no crash if user exits mid-payment)
- [ ] Payment confirmation: success screen + "Torna home"
- [ ] Typography aligned with `lib/theme.ts` tokens
- [ ] Safe area top+bottom respected
- [ ] Dark mode coherent (if active)

### 6.2 TestFlight — submit checklist

**Pre-build:**
- [ ] `app.json`: `version` bumped, `ios.buildNumber` incremented
- [ ] `ios.bundleIdentifier` = `com.cleanhome.app` (don't change after first submit)
- [ ] Icon 1024x1024 PNG, no alpha
- [ ] Final splash screen
- [ ] `privacy` + `terms` URLs point to cleanhomeapp.com
- [ ] Permission strings (`NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryUsageDescription`) in Italian, clear
- [ ] Debug `console.log` with sensitive data removed
- [ ] `.env` with PRODUCTION Stripe + Supabase prod keys

**Build:**
- [ ] Apple Developer account active (€99/year)
- [ ] App Store Connect: app created, bundle id matched
- [ ] `eas build --platform ios --profile production`

**Submit:**
- [ ] `eas submit --platform ios --latest`
- [ ] TestFlight: internal testers added
- [ ] Test Information: contact email = `info@cleanhomeapp.com`, demo account credentials

### Versioning policy
- `version` (app.json) = user-facing semver, bump manually per release (1.0.0 → 1.0.1 …).
- iOS `buildNumber` + Android `versionCode` are **per-platform** build counters, auto-bumped by EAS (`autoIncrement: true` in eas.json production profile). They do NOT need to match each other — each only needs to be higher than the last build uploaded to its store. Don't hand-edit them.

### 6.3 Open items (update at end of every session)
- 2026-06-01: full production-readiness audit + fixes (commits `de45197`, `e758360`, `2e4f2d4`). booking_date column alignment, escrow payout precondition, error/loading/empty states, availability sync, app.json dedup, jest+pricing tests. tsc 0 / tests 7-7 / sims clean.
- Pending PROD rollout (needs go): OTA + deploy 7 edge fns (incl. escrow) + apply migrations (cron work_done, notifications RLS dedup).
- Open decisions: filter chip UI on home, cleaner availability toggle UX.

---

## 7. Do NOT do in this phase

- No new screens
- No architectural refactor
- No new libraries (every dependency = TestFlight build risk)
- No "improvements" not explicitly requested
- Only: checkout visual polish + what's needed to pass Apple review
