# Codebase Concerns

**Analysis Date:** 2026-04-28

## Critical Pre-Launch Issues

### Stripe Test Mode Active — Environment Mismatch
- **Issue:** Stripe is running in TEST mode (`sk_test_*`); Edge Functions are configured with test keys but will switch to production at launch without code changes
- **Files:** `supabase/functions/stripe-subscription-create/index.ts` (line 30), `supabase/functions/stripe-booking-payment/index.ts` (line 45)
- **Impact:** CRITICAL — Test transactions will not process as real charges. Mismatch between `.env.local` (test keys) and Supabase secrets (must be updated before production)
- **Fix approach:** 
  1. Before production launch, rotate STRIPE_SECRET_KEY and STRIPE_LISTING_PRICE_ID in Supabase Edge Function environment variables
  2. Verify EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in app (`app/_layout.tsx:364`) matches production publishable key
  3. Update all three keys in Supabase project settings
  4. Test full flow (booking → payment → transfer) with production keys in staging
  5. Never commit production keys to git — always use Supabase secrets management

### Debug Information Leaks in Edge Functions
- **Issue:** `stripe-subscription-create` error handler (line 246-265) returns debug info and env_check object to client, exposing key prefixes and environment details
- **Files:** `supabase/functions/stripe-subscription-create/index.ts` (lines 248-265)
- **Current behavior:**
  ```typescript
  return json({
    error: "Impossibile creare l'abbonamento. Riprova più tardi.",
    debug: msg,  // <— Raw error messages exposed
    env_check: {
      has_secret_key: !!STRIPE_SECRET_KEY,
      price_id_prefix: STRIPE_LISTING_PRICE_ID?.slice(0, 12),  // <— Leaking prefix
      secret_key_mode: STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : "test",  // <— Mode exposure
    },
  }, 500);
  ```
- **Impact:** CRITICAL SECURITY — Exposes Stripe key mode, partial key prefixes, and raw error details to client. Attackers learn environment is in test mode
- **Fix approach:**
  1. Remove entire `debug` and `env_check` fields from error response (line 253-263 delete)
  2. Add server-side logging: `console.error("[stripe-subscription-create]", msg, STRIPE_SECRET_KEY?.slice(0, 12), STRIPE_LISTING_PRICE_ID?.slice(0, 12))`
  3. Return only: `{ error: "Impossibile creare l'abbonamento. Riprova più tardi." }`
  4. Apply same fix to `stripe-booking-payment` if it leaks (check line 304-308)
  5. Add code review checklist: "Never return debug objects or error details to clients"

## Data Integrity & Business Logic Gaps

### Incomplete Escrow Implementation
- **Issue:** `payout_blocked` flag is set when booking accepted (`stripe-booking-action/index.ts:186`), but there is NO release-on-confirm flow to unlock payouts
- **Files:** 
  - `supabase/migrations/20240101000017_bookings_dispute_refund_columns.sql` (defines `payout_blocked`, no release logic)
  - `supabase/functions/stripe-booking-action/index.ts` (line 186 sets flag but never releases)
  - No endpoint found to call release-on-confirm
- **Current state:** Cleaner's payout is transferred immediately on accept (line 174-180) but marked blocked (line 186). Contradiction: funds already transferred, but flag says blocked
- **Impact:** MEDIUM — Escrow logic is contradictory. Funds go out immediately, but payout_blocked suggests they're held. Clients cannot release payouts on job confirmation because there's no confirmation flow endpoint
- **Fix approach:**
  1. Decide design: (A) Hold funds until confirmed, OR (B) Release immediately on accept (current)
  2. If choice A: Move transfer from `accept` handler to new `confirm-completion` endpoint; keep payout_blocked until client confirms
  3. If choice B (current): Remove `payout_blocked` logic entirely, or repurpose it for disputes only
  4. Add RPC `release_payout_on_confirm(booking_id: UUID)` that updates `payout_blocked = FALSE` and triggers transfer if held
  5. Add "Confirm Job Done" button in client booking UI that calls the confirm endpoint
  6. Document design choice in `lib/types.ts` (add comment explaining payout_blocked purpose)

### Missing Booking Offers Table in Schema
- **Issue:** `booking_offers` table is queried and manipulated in Edge Functions (`stripe-booking-action/index.ts:107`, `stripe-webhook/index.ts:334`) but is NOT defined in any migration file
- **Files:**
  - `supabase/functions/stripe-booking-action/index.ts` (lines 107-111, 218, 241, 248)
  - `supabase/functions/stripe-webhook/index.ts` (line 334)
  - `supabase/migrations/` — no file contains `CREATE TABLE public.booking_offers`
- **Impact:** CRITICAL — Table may not exist in Supabase. Multi-dispatch booking flow will fail at runtime when trying to insert/update offers
- **Fix approach:**
  1. Create `20240101000020_booking_offers.sql` migration:
     ```sql
     CREATE TABLE public.booking_offers (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
       cleaner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
       status TEXT NOT NULL DEFAULT 'pending' 
         CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       responded_at TIMESTAMPTZ,
       PRIMARY KEY (booking_id, cleaner_id),
       INDEX idx_booking_offers_cleaner_id (cleaner_id),
       INDEX idx_booking_offers_status (status)
     );
     ALTER TABLE public.booking_offers ENABLE ROW LEVEL SECURITY;
     ```
  2. Add RLS policies (cleaner can read own offers, update own status)
  3. Verify `dispatch_accept_offer` RPC exists (called in `stripe-booking-action/index.ts:124`)
  4. Add to `_RUN_ALL_IN_SUPABASE.sql` for local setup

### RPC dispatch_accept_offer Not Found
- **Issue:** `stripe-booking-action/index.ts` calls RPC `dispatch_accept_offer` (line 124) to handle race-safe first-accept-wins, but this RPC is not defined in any migration
- **Files:** 
  - `supabase/functions/stripe-booking-action/index.ts` (lines 123-132)
  - No migration file contains `CREATE OR REPLACE FUNCTION dispatch_accept_offer`
- **Impact:** CRITICAL — Multi-dispatch booking acceptance will fail with "function not found" at runtime
- **Fix approach:**
  1. Create RPC in migration (add to `20240101000020_booking_offers.sql` or new migration):
     ```sql
     CREATE OR REPLACE FUNCTION public.dispatch_accept_offer(
       p_booking_id UUID,
       p_cleaner_id UUID
     )
     RETURNS TABLE(won BOOLEAN, cancelled_count INTEGER) AS $$
     WITH win_attempt AS (
       UPDATE public.booking_offers
       SET status = 'accepted'
       WHERE booking_id = p_booking_id
         AND cleaner_id = p_cleaner_id
         AND status = 'pending'
       RETURNING id
     ),
     close_others AS (
       UPDATE public.booking_offers
       SET status = 'cancelled'
       WHERE booking_id = p_booking_id
         AND cleaner_id != p_cleaner_id
         AND status = 'pending'
       RETURNING id
     ),
     claim_booking AS (
       UPDATE public.bookings
       SET status = 'accepted', cleaner_id = p_cleaner_id
       WHERE id = p_booking_id AND status = 'open'
       RETURNING id
     )
     SELECT 
       (SELECT COUNT(*) > 0 FROM win_attempt) AS won,
       (SELECT COUNT(*) FROM close_others) AS cancelled_count;
     $$ LANGUAGE SQL;
     ```
  2. Test for race conditions: run two accepts simultaneously on same booking
  3. Document atomicity guarantee in comment

## Chat & Communication Risks

### Chat Anti-Bypass (Contact Info Filters) Not Implemented
- **Issue:** Chat screen allows free-form text messages with no validation to block phone numbers, email addresses, WhatsApp, Telegram, etc. Users can share contact info to bypass platform payments
- **Files:** 
  - `app/chat/[bookingId].tsx` (no validation in message send)
  - `lib/api.ts` (sendMessage function, check if validation exists)
  - `supabase/functions/` (no Edge Function filter detected)
- **Current behavior:** User types "Call me at +39 123 456 789" and message goes through unfiltered to other party
- **Impact:** MEDIUM — Users bypass marketplace fees by negotiating outside platform. Reduces platform revenue
- **Fix approach:**
  1. Add server-side validation in new Edge Function `validate-message`:
     ```typescript
     // Regex patterns
     const PHONE_RE = /[\d\s\-\+\(\)]{10,}/;
     const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
     const CONTACT_RE = /(whatsapp|telegram|signal|viber|skype|discord|slack|wechat|threema)/i;
     ```
  2. Call validation before inserting message to `messages` table
  3. Return 400 with user-friendly message: "Per garantire un'esperienza sicura, non puoi condividere contatti direttamente nel chat. Completa il servizio dalla piattaforma."
  4. Log blocked attempts for abuse monitoring
  5. Document policy in Terms of Service (`docs/legal/terms-of-service.md`)

## Storage & Security Gaps

### AsyncStorage Fallback — Not Ideal for Auth Tokens
- **Issue:** `lib/supabase.ts` (lines 27-39) falls back to AsyncStorage (plain text) if SecureStore native module isn't linked, but auth tokens contain sensitive refresh/access tokens
- **Files:** `lib/supabase.ts` (lines 27-104)
- **Current behavior:**
  - iOS/Android try to load `expo-secure-store` (iOS Keychain / Android Keystore)
  - If module not linked (dev build built before expo-secure-store was added), falls back to AsyncStorage
  - AsyncStorage stores data in plain text on Android and unencrypted on iOS
  - Comment says "works but not ideal" (line 24)
- **Impact:** MEDIUM — Auth tokens in plain text on older dev builds. Production builds are fine (SecureStore required). Dev/staging devices with old builds expose tokens if device is lost/stolen
- **Fix approach:**
  1. Require SecureStore in dev build: `eas build --profile development` should not complete without expo-secure-store linked
  2. Add check at app startup: if `Platform.OS !== 'web' && !SecureStore`, show error: "Dev build requires rebuild with SecureStore. Run: eas build --profile development"
  3. Add to Expo config (`app.json`): `"plugins": ["expo-secure-store"]` (already there, line 95)
  4. Document in README: "Always use dev builds with SecureStore enabled. Expo Go is not supported for production testing."
  5. Monitor: If user launches app with fallback, log warning to Sentry

## Pre-Launch Completeness

### Legal & Policy Documents Not Published
- **Issue:** Privacy policy, Terms of Service, and Refund Policy exist as code (`app/legal/privacy.tsx`, `app/legal/terms.tsx`) and markdown (`docs/legal/`), but are NOT published to a public URL or website
- **Files:**
  - `app/legal/privacy.tsx` (in-app only, no published URL)
  - `app/legal/terms.tsx` (in-app only)
  - `docs/legal/privacy-policy.md` (local docs, not hosted)
  - `docs/legal/terms-of-service.md` (local docs)
  - `docs/legal/refund-policy.md` (local docs)
- **Current state:** Policies are rendered in-app but there is no `privacy.cleanhome.app` or similar public-facing URL
- **Impact:** MEDIUM-HIGH — App Store & Play Store require publicly accessible privacy policy URLs. In-app policies may not meet submission requirements. GDPR requires "clear and transparent" communication
- **Fix approach:**
  1. Deploy docs to static site (Vercel, GitHub Pages, Netlify):
     ```bash
     # Create /docs folder in separate repo or docs branch
     # Deploy markdown as HTML to https://cleanhome.app/privacy, /terms, /refund
     ```
  2. Add to `app.json` — Privacy Policy URL for app stores
  3. Update `app/legal/privacy.tsx` to link to public URL: `https://cleanhome.app/privacy`
  4. Add `<link rel="legal">` headers to any future web version
  5. Document URLs in codebase: `constants/legal.ts`:
     ```typescript
     export const LEGAL_URLS = {
       privacy: 'https://cleanhome.app/privacy',
       terms: 'https://cleanhome.app/terms',
       refund: 'https://cleanhome.app/refund',
     };
     ```

### App Store & Play Store Submissions Not Started
- **Issue:** App is in pre-launch state; iOS and Android builds have never been submitted to app stores
- **Files:** `eas.json` (configured), `app.json` (metadata ready), but no `.ipa` or `.aab` artifacts built for review
- **Current state:** Development builds only; no production builds in CI/CD
- **Impact:** HIGH — Launch timeline depends on store approval (1-3 weeks for each platform). Unexpected rejections can cause delays. No review feedback received yet
- **Fix approach:**
  1. Create EAS Submission checklist:
     - [ ] Run `eas build --platform ios --profile production` → produces `.ipa`
     - [ ] Run `eas build --platform android --profile production` → produces `.aab`
     - [ ] Verify Sentry DSN is set in production build
     - [ ] Verify STRIPE keys are LIVE (sk_live_*)
     - [ ] Run smoke tests: auth, booking payment, chat, notifications
     - [ ] Generate screenshots for store listing
     - [ ] Write compelling app description (ASO) in Italian & English
     - [ ] Submit to TestFlight (iOS) / Google Play Internal Testing (Android)
     - [ ] Validate no crashes for 48 hours
     - [ ] Fix any rejection reasons (content policy, privacy, functionality)
     - [ ] Submit to production
  2. Set up EAS submission automation (optional): Add GitHub Action to trigger builds on version bump
  3. Block production launches until all checklist items complete

## Performance & Scaling Concerns

### Large Component Files — Code Organization Risk
- **Issue:** Several screen/page files exceed 1500+ lines, making them difficult to maintain, test, and reason about
- **Files:**
  - `app/listing/index.tsx` (3956 lines) — Listing marketplace display
  - `app/properties/new.tsx` (2593 lines) — New property form
  - `app/properties/edit.tsx` (2034 lines) — Edit property form
  - `app/booking/new.tsx` (1817 lines) — New booking creation
  - `app/(tabs)/home.tsx` (1578 lines) — Home screen
- **Impact:** MEDIUM — Harder to test individual features, higher bug risk during refactoring, onboarding new developers takes longer
- **Fix approach:**
  1. Break down largest files (3000+ lines) into smaller components:
     - Extract form sections as `<PropertyFormBasics />`, `<PropertyFormLocation />`, `<PropertyFormPhotos />`
     - Extract list item renderers as separate components
     - Move validation logic to custom hooks: `usePropertyForm()`, `useListingFilters()`
  2. Add component file size lint rule (e.g., max 600 lines per file) to ESLint config
  3. Create component composition pattern guide in `.planning/codebase/CONVENTIONS.md` (if not present)

### No Test Coverage — High Risk for Critical Flows
- **Issue:** No test files (`.test.ts`, `.spec.ts`) found in codebase. Critical flows like payment capture, offer acceptance, payout release are untested
- **Files:** None found — absence of tests
- **Impact:** HIGH — Edge case bugs in payment/booking flows only discovered in production. No regression safety during refactoring
- **Fix approach:**
  1. Add Jest/Vitest configuration: `npm install --save-dev jest @testing-library/react-native @testing-library/react`
  2. Create test structure:
     ```
     app/__tests__/
     ├── api.test.ts
     ├── auth.test.ts
     lib/__tests__/
     ├── supabase.test.ts
     ├── api.test.ts
     supabase/functions/__tests__/
     ├── stripe-booking-payment.test.ts
     ├── stripe-booking-action.test.ts
     ```
  3. Target 80%+ coverage for critical paths:
     - Payment intent creation/capture
     - Booking state transitions
     - Offer race conditions
  4. Add CI check: `npm test --coverage` in GitHub Actions
  5. Document testing patterns in `TESTING.md` (see templates)

## Operational & Maintenance

### Sentry Error Tracking Disabled in Dev
- **Issue:** `app/_layout.tsx` (line 14) disables Sentry in dev mode (`enabled: !__DEV__`), meaning development errors are not captured
- **Files:** `app/_layout.tsx` (lines 11-16)
- **Impact:** LOW — By design. Makes sense for local development noise, but staging environment won't catch errors if built as dev
- **Fix approach:**
  1. Add environment-aware config:
     ```typescript
     const ENV = process.env.EXPO_PUBLIC_ENV || 'development';
     Sentry.init({
       enabled: ENV !== 'local', // Only disable for local __DEV__
       tracesSampleRate: ENV === 'production' ? 1.0 : 0.1,
     });
     ```
  2. Use `EXPO_PUBLIC_ENV` to distinguish local vs staging vs production

### No Uptime Monitoring or Health Checks
- **Issue:** No health check endpoints, no uptime monitoring, no alerting for Edge Function failures
- **Files:** No `functions/health-check` or `/health` endpoint detected
- **Impact:** MEDIUM — If stripe-webhook or stripe-booking-payment crashes, no automatic alert. Users experience silent failures
- **Fix approach:**
  1. Add health check Edge Function:
     ```
     supabase/functions/health/index.ts
     - Returns { status: "ok", timestamp, functions: { webhook: "ok", payment: "ok" } }
     ```
  2. Set up external monitoring: UptimeRobot or Checkly to ping health endpoint every 5 min
  3. Alert to Slack/email if response fails or latency > 5 seconds
  4. Add function error logging: each Edge Function should `console.error` with structured tags (function name, error type)

---

## Summary of Critical Fixes Before Launch

| Issue | Severity | Deadline |
|-------|----------|----------|
| Strip Test Mode / Key Rotation | CRITICAL | Before production deployment |
| Debug Info Leaks (Edge Functions) | CRITICAL | Before production deployment |
| booking_offers Table Missing | CRITICAL | Before first multi-dispatch booking |
| dispatch_accept_offer RPC Missing | CRITICAL | Before first multi-dispatch booking |
| Chat Contact Info Filters | MEDIUM | Within 2 weeks of launch |
| Legal Docs Not Published | MEDIUM-HIGH | Before App Store submission |
| App Store/Play Store Not Submitted | HIGH | Launch timeline blocker |
| Escrow Payout Release Logic | MEDIUM | Before refund/dispute features go live |
| Test Coverage | MEDIUM | Implement incrementally post-launch |

*Last updated: 2026-04-28*
