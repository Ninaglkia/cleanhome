# CleanHome RN — Project Rules

> Read this file at the start of EVERY session. Don't skip sections.
>
> **Working with Codex (since 2026-11-01):** rules in @AGENTS.md, tasks and messages in `BACHECA.md` (outside git). Read the board at the start of every session and before merging/pushing.

---

## 1. Project Context

- **Stack:** Expo + React Native + TypeScript + NativeWind + Supabase + Stripe Connect
- **Working dir:** `/Users/ninomarianolai/CleanHomeRN`
- **Build:** Always use dev build (`com.cleanhome.app`), NEVER Expo Go
- **Branch:** `main`
- **Language:** Italian for conversation + UI text, English for code/comments/commits
- **Current goal (updated 2026-08-04):** two open tracks, **no new features** until both close:
  1. **Design sweep "Pulitori"** — converge UI onto the green identity (`lib/design/pulitori.ts`, `PColor`). Done so far: `app/(tabs)/home.tsx`, `app/properties/new.tsx`, `app/booking/[id]/match.tsx`, `app/booking/[id]/waiting.tsx`. Client profile converged 2026-07-03 (`9030d4a`).
  2. **Checkout polish + TestFlight submit** — see §6.

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

> **Precedence:** this section **overrides** the global memory rule *"Always use Superpowers — not optional"* **for this project only**. Elsewhere the global rule still applies. Don't try to reconcile them — here, conditional wins.

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
- **Pressable: ALWAYS import from `components/ui/AppPressable`, never from react-native.** NativeWind v4 silently drops function-style props (`style={({ pressed }) => ...}`) on the core Pressable — components render completely unstyled (nativewind#1105). The wrapper resolves the function before NativeWind sees it.
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

**Env (`.env.local`, never commit) — full list, verified 2026-08-04:**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_STRIPE_LISTING_PRICE_ID` (recurring €4.99/month "Annuncio aggiuntivo")
- `EXPO_PUBLIC_SENTRY_DSN`
- `STRIPE_SECRET_KEY` (Edge Functions only, no `EXPO_PUBLIC_` prefix — set via `supabase secrets set`)

⚠️ `.env.local` is currently on **Stripe TEST keys**. Swap to LIVE before the TestFlight/production build (§6.2).

---

## 5. Naming Convention (FIXED — do NOT "fix")

- `CleanerView` = shown to CLEANERS (green/blue theme)
- `ClientView` = shown to CLIENTS (orange/brown theme)
- Color constants are intentionally inverted in code; behavior is correct.

---

## 6. Current Focus: Pulitori Design Sweep + Checkout UI + TestFlight

### 6.1 Checkout UI — polish checklist
*Status audited against the code on 2026-08-04. Don't re-check by eye — the evidence is in brackets.*

**Done:**
- [x] Stripe error state: user-friendly message, NOT raw `error.message` — `lib/friendlyPaymentError.ts`, used 3× in `app/booking/new.tsx`
- [x] KeyboardAvoidingView on inputs — 4 occurrences in `app/booking/new.tsx`
- [x] Safe area top+bottom respected — 3 occurrences
- [x] Debug logs safe — all 4 remaining `console.log` (2 in `lib/realtime-tracking.ts`, 1 in `app/listings/index.tsx`, 1 in `lib/friendlyPaymentError.ts`) are `__DEV__`-guarded

**Still open — confirmed missing:**
- [ ] **Loading state on "Paga" (prevent double tap)** — `app/booking/new.tsx:1604` only has `disabled={!canProceed()}`, which is a *validation* guard. No submitting state → double tap is possible. **Highest risk item: it can double-charge.**
- [ ] **Payment success screen + "Torna home"** — today it's `Alert.alert` → `router.replace("/(tabs)/bookings")` (`new.tsx:765-780`). Route `app/booking/[id]/waiting.tsx` exists and is used at `new.tsx:772`.
- [ ] **8 hardcoded hex colors in checkout** — violates §4 "never hardcoded colors". Lines in `app/booking/new.tsx`: 942 `#d7fff1`, 1403 `#f59e0b`, 1521 `#fef3c7`, 1530 + 1535 `#b45309`, 1539 `#92400e`, 1577 `#dc2626`, 1578 `#9a6c00`. Move to `lib/theme.ts` / `PColor`.

**Not yet audited (needs a visual pass, not grep):**
- [ ] Primary CTA: same color/height across all steps
- [ ] Spacing coherent (4px grid, container padding 16/20)
- [ ] Back button handled (no crash if user exits mid-payment)
- [ ] Typography aligned with `lib/theme.ts` tokens
- [ ] Dark mode coherent (if active)

### 6.2 TestFlight — submit checklist

**Pre-build:**
- [x] `ios.bundleIdentifier` = `com.cleanhome.app` (don't change after first submit) — verified in `app.json:18`
- [x] Permission strings (`NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryUsageDescription`) in Italian, clear — `app.json:144-146`
- [x] Debug `console.log` with sensitive data removed — all remaining ones are `__DEV__`-guarded (see §6.1)
- [x] Icon — holographic app icon shipped 2026-06-26 (`85ccb56`); **re-verify 1024×1024 PNG with no alpha before submit**
- [ ] `app.json`: bump `version` only (currently `1.0.0`). **Do NOT touch `buildNumber` / `versionCode`** — EAS auto-increments them, see Versioning policy below. Current: iOS build 14, Android versionCode 3.
- [ ] Final splash screen
- [ ] `privacy` + `terms` URLs point to cleanhomeapp.com
- [ ] `.env` with PRODUCTION Stripe + Supabase prod keys — **currently TEST**, see §4

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

**Repo state, verified 2026-08-04:** branch `main`, working tree clean (0 uncommitted files), last commit `7e0f3d3` (2026-07-03). 50 migrations, 25 Edge Functions, 3 test suites (`cleanerFilter`, `pricing`, `validation`).

**Shipped log:**
- **2026-11-01** — approved Casa logo with mint doorway; shared vector master for iOS/Android icons and splash; launch zoom and gentle motion, reduced-motion support; minimum launch gate reduced to 1.7 seconds.
- **2026-06-01** — full production-readiness audit + fixes (`de45197`, `e758360`, `2e4f2d4`): booking_date column alignment, escrow payout precondition, error/loading/empty states, availability sync, app.json dedup, jest+pricing tests. tsc 0 / tests 7-7 / sims clean.
- **2026-06-24** — phone verification via Twilio SMS OTP (`e80b21e`), dispatch: SMS only for cleaner requests + push for the rest (`14216fb`), hourly rate with review-unlocked leveling (`54e1871`), map search + filters refinement (`90234da`), anchored notification dropdown + ErrorBoundary escape hatch (`f759066`), Deliveroo-style incoming-offer modal (`713e5d8`).
- **2026-06-26** — profile redesign: gradient icon tiles + filled SVG icons + gradient toggle (`eacd0b1`); holographic app icon matching the splash (`85ccb56`).
- **2026-07-03** — map anchored to saved property + GPS race guard (`550fd01`), gesture-driven dual-mode profile toggle (`c66fa4c`), iOS buildNumber → 14 (`148032c`), all function-style Pressables routed through `AppPressable` (`8b95a00`), client profile converged onto green Pulitori identity (`9030d4a`), AppPressable rule documented (`7e0f3d3`).

**Blocked / needs your go:**
- **PROD rollout still pending since 2026-06-01** (needs explicit go): OTA + deploy 7 Edge Functions (incl. escrow) + apply migrations (cron `work_done`, notifications RLS dedup). ⚠️ **Deployment state on Supabase was NOT verified** in this update — check against the live project before assuming anything.

**Open decisions:**
- Filter chip UI on home.
- Cleaner availability toggle UX.
- Which screens are next in the Pulitori design sweep (§1).

---

### 6.4 Keeping this file honest

This file went **1 month stale** (last updated 2026-07-03, audited 2026-08-04): §6.1/§6.2 had items already done still unchecked, §6.3 was missing 15 commits, and §1 claimed "no new features" while June–July shipped several.

Root cause: every other rule here leaves a trace (tsc output, commit messages, `AppPressable` imports) — this one doesn't, so it's the only one that silently slips.

**Fix:** when a session ends with a commit, add one line to the "Shipped log" in §6.3 *in the same commit as the code*. If a checklist box in §6.1/§6.2 became true, flip it in that same commit. Not a separate "docs:" commit later — that's the one that never happens.

---

## 7. Do NOT do in this phase

- No new screens
- No architectural refactor
- No new libraries (every dependency = TestFlight build risk)
- No "improvements" not explicitly requested
- Only: Pulitori design sweep on existing screens + checkout visual polish + what's needed to pass Apple review
