# Architecture

**Analysis Date:** 2026-04-28

## Pattern Overview

**Overall:** Frontend-driven mobile-first architecture with Expo Router file-based routing on the client, Supabase PostgreSQL as the database backbone, and Supabase Edge Functions (Deno) handling server-side business logic.

**Key Characteristics:**
- Multi-role marketplace (clients + cleaners) with distinct dashboards and feature sets
- Realtime features (notifications, live location tracking, chat) via Supabase Realtime/PostgreSQL subscriptions
- Stripe integration for payments with multi-dispatch job offering
- PostGIS coverage zone management for cleaner service areas
- Expo dev client for native build workflows on iOS/Android

## Layers

**Presentation Layer (UI):**
- Purpose: Screen components and navigation, animated transitions, forms, maps, real-time UI updates
- Location: `app/` (Expo Router), `components/`
- Contains: Screen files (`.tsx`), layout grouping with Expo Router syntax (parentheses), UI components, icons, animations via `react-native-reanimated`
- Depends on: `lib/auth`, `lib/api`, `lib/hooks`, `@stripe/stripe-react-native`, `react-native-maps`, NativeWind for styling
- Used by: Entry point at `app/index.tsx` (splash), auth at `app/(auth)/`, main UI at `app/(tabs)/`

**API/Business Logic Layer:**
- Purpose: Supabase REST client calls, type-safe data fetching, calculations (pricing), location services
- Location: `lib/api.ts`, `lib/pricing.ts`, `lib/notifications.ts`, `lib/realtime-tracking.ts`
- Contains: Async functions wrapping `supabase` queries, RPC calls (e.g., `search_listings_by_point`), calculations, Stripe API wrappers
- Depends on: `lib/supabase` client, Expo Location, Expo Notifications
- Used by: All screens for data fetching and mutations

**Authentication & State Layer:**
- Purpose: Auth context, session management, profile caching, role switching
- Location: `lib/auth.ts`, `lib/supabase.ts`, `app/_layout.tsx`
- Contains: React Context (`AuthContext`) providing session/user/profile, Supabase client with SecureStore adapter, OAuth flow handlers (Google, Apple, email)
- Depends on: `@supabase/supabase-js`, `expo-secure-store`, `expo-auth-session`, `expo-web-browser`
- Used by: `app/_layout.tsx` for app-wide auth state, screens via `useAuth()` hook

**Data Types & Constants:**
- Purpose: Centralized type definitions and enums
- Location: `lib/types.ts`, `lib/theme.ts`, `lib/pricing.ts`
- Contains: TypeScript interfaces (`Booking`, `CleanerProfile`, `UserProfile`, `ClientProperty`, etc.), subscription enums, service type arrays, color palette, animations configs
- Depends on: None (leaf module)
- Used by: All layers for type safety

**Custom Hooks:**
- Purpose: Encapsulate stateful logic for notifications, countdown timers, document uploads
- Location: `lib/hooks/`
- Contains: `useNotifications` (realtime notifications with Postgres subscriptions), `useCountdown`, `useUserDocuments`
- Depends on: `lib/supabase`, `lib/api`
- Used by: Screen components for reactive data management

**Backend Services (Edge Functions):**
- Purpose: Server-side business logic for payments, Stripe webhooks, booking lifecycle
- Location: `supabase/functions/`
- Contains: Deno TypeScript functions handling payment intents, multi-dispatch offer routing, subscription management, push notifications, webhook validation
- Entry points: Stripe API calls, webhook events, scheduled jobs (auto-cancel expired bookings)
- Used by: Client calls via `supabase.functions.invoke()` or Stripe webhooks

**Database & Migrations:**
- Purpose: Schema definition, triggers, RLS policies, spatial indexes
- Location: `supabase/migrations/`
- Contains: SQL migrations for tables (profiles, cleaner_profiles, bookings, client_properties, cleaner_listings, messages, reviews, notifications), triggers (auto-profile creation), RLS row-level security policies
- Entry points: Applied once on project init via Supabase CLI or manual SQL
- Used by: All API calls via `supabase` client

## Data Flow

**Authentication & Cold Start:**

1. `app/index.tsx` (splash screen) loads and hides native splash via `SplashScreen.hideAsync()`
2. `app/_layout.tsx` root layout initializes:
   - Calls `supabase.auth.getSession()` to check for existing session
   - Sets up auth state listener via `supabase.auth.onAuthStateChange()` (persists across app restarts)
   - Fetches user profile via `fetchProfile(user.id)` from `users` table
3. Deep link handler (OAuth callback `cleanhome://auth/callback?code=...`) triggers session exchange
4. `index.tsx` redirects based on auth state:
   - Not authenticated + never saw onboarding → `/onboarding/features` (marketing tour)
   - Not authenticated + saw onboarding → `/(auth)/login`
   - Authenticated + not onboarded → `/onboarding/welcome` (role selection + profiling)
   - Authenticated + client → `/(tabs)/home` (search map)
   - Authenticated + cleaner → `/(tabs)/cleaner-home` (job offers dashboard)

**Booking Creation (Client):**

1. Client navigates `/(tabs)/home` → taps cleaner or listing card → `app/booking/new.tsx`
2. User selects date, service type, property (or creates new via `createClientProperty`)
3. Pricing calculated via `calculatePrice()` from `lib/pricing.ts` (€1.30/sqm, €50 minimum, 9% client fee added)
4. Form submitted → calls `supabase.functions.invoke('stripe-booking-payment')` with multi-dispatch params:
   - If `preferred_cleaner_ids[]` provided: narrow offer to 6 max cleaners
   - Else broadcast to 6 nearest cleaners via `search_lat`/`search_lng`
5. Edge function creates Stripe PaymentIntent (without destination — unknown winner yet), returns `clientSecret` for mobile payment sheet
6. User completes payment via `Stripe.initPaymentSheet()` on mobile
7. Payment intent success → webhook `stripe-webhook` receives payment event, calls `stripe-booking-action` function
8. `stripe-booking-action` function:
   - Creates booking record in `bookings` table with status `pending`
   - Creates N BookingOffers in `booking_offers` table (one per selected/broadcast cleaner)
   - Triggers push notifications via `send-push-notification` edge function to each cleaner
9. Client directed to `app/booking/[id]/waiting.tsx` (awaiting cleaner response)

**Realtime Notifications:**

1. Backend inserts into `notifications` table → Postgres triggers broadcast via Supabase Realtime
2. `useNotifications` hook in `app/(tabs)/notifications.tsx` subscribes via `supabase.channel()` with `postgres_changes` filter
3. New notifications prepended to state, UI updates in real-time
4. User taps notification → mapped to screen via `data.screen` field in `app/_layout.tsx` notification handler

**Location Tracking (Live Booking):**

1. Cleaner accepts offer → booking transitions to `accepted` status
2. Client navigates to `app/booking/[id]/tracking.tsx`
3. Component calls `startLocationBroadcast(bookingId)` from `lib/realtime-tracking.ts`
4. Location service requests foreground permissions, then broadcasts cleaner's coordinates via `supabase.channel('booking-tracking:{bookingId}').broadcast()`
5. Client subscribes to same channel and receives location updates in real-time via WebSocket (Supabase Realtime)
6. Map updates with marker + ETA calculation
7. On booking completion, broadcast stops via `stop()` cleanup

**State Management:**

- **Auth state:** React Context (`AuthContext`) in `app/_layout.tsx`, memoized to prevent re-renders
- **Page-level state:** React `useState` hooks (no Redux/Zustand — local scope sufficient for mobile)
- **Realtime subscriptions:** Custom hooks (`useNotifications`, `useUserDocuments`) managing subscriptions and optimistic updates
- **Caching:** AsyncStorage for "seen onboarding" flag, Supabase session auto-refresh via persistence layer

## Key Abstractions

**Supabase Client Adapter:**
- Purpose: Unified database access with platform-specific secure storage (iOS Keychain, Android Keystore, web localStorage)
- Example: `lib/supabase.ts` wraps `SecureStore` (native) vs `AsyncStorage` (fallback) for auth tokens
- Pattern: Adapter pattern with graceful degradation — if SecureStore unavailable, falls back to AsyncStorage

**Payment Intent Orchestration:**
- Purpose: Decouple payment capture from booking dispatch in multi-cleaner scenarios
- Flow: `stripe-booking-payment` creates intent (no destination), `stripe-booking-action` captures + transfers after cleaner acceptance
- Reduces race conditions where cleaner declines but payment already transferred

**Coverage Zone (PostGIS):**
- Purpose: Spatial query for "which cleaners serve this address?"
- Implementation: `coverage_mode` (circle or polygon), SQL RPC `search_listings_by_point(lat, lng)` uses PostGIS `ST_Contains()`
- Data: Stored as `coverage_polygon` (JSON array of lat/lng) or `coverage_radius_km` + `coverage_center_lat/lng`

**Role-Scoped Features:**
- Purpose: Different screens and capabilities for clients vs cleaners
- Abstraction: Same user can switch roles via `setActiveRole()`, profile stores `active_role` field
- UI routing: Conditional navigation in `app/_layout.tsx` checks `profile.active_role` to redirect to correct dashboard

**Realtime Subscriptions with Cleanup:**
- Purpose: Live updates for notifications, messages, location tracking without polling
- Pattern: `useNotifications` hook manages subscription lifecycle — subscribe on mount, unsubscribe on unmount
- Type-safe: Postgres change events typed via custom interface `AppNotification`

## Entry Points

**App Entry:**
- Location: `app/index.tsx` (splash screen)
- Triggers: Expo Router initialization
- Responsibilities: Show splash animation (Lottie), check auth status, determine routing destination

**Root Layout:**
- Location: `app/_layout.tsx`
- Triggers: After splash, sets up app-wide providers
- Responsibilities: Initialize Supabase auth listener, create AuthContext, wrap in StripeProvider + GestureHandlerRootView, handle deep links, setup notification tap handlers

**Main Navigation:**
- Location: `app/(tabs)/_layout.tsx` (tabbed interface for clients), `app/(tabs)/cleaner-home.tsx` (cleaner home)
- Routes: Home (map search) → Bookings → Notifications → Profile for clients; equivalent structure for cleaners
- Triggered by: Root layout redirect based on `profile.active_role`

**Backend Webhooks:**
- Location: `supabase/functions/stripe-webhook/index.ts`
- Triggers: Stripe API sends payment events (charge.succeeded, etc.)
- Responsibilities: Validate Stripe signature, call appropriate business logic function (e.g., `stripe-booking-action`)

## Error Handling

**Strategy:** Try-catch at API boundary, user-facing alerts, Sentry error tracking for analytics

**Patterns:**

- **API calls:** Wrapped in try-catch, throw early, caller decides alert vs. silent retry
  ```typescript
  export async function fetchProfile(userId: string) {
    const { data, error } = await supabase.from("profiles").select().eq("id", userId).single();
    if (error) throw error;
    return data;
  }
  ```

- **Realtime subscriptions:** Graceful degradation — if notifications table doesn't exist, `useNotifications` treats as empty array (code: 42P01)
  
- **Async operations:** Optimistic updates with revert fallback — mark notification as read immediately, revert if API fails

- **Global error boundary:** `ErrorBoundary.tsx` catches React render errors, displays fallback UI

- **Stripe errors:** Caught in payment sheet flow, user alerted via Alert dialog, transaction not recorded if payment fails

## Cross-Cutting Concerns

**Logging:** 
- Dev only: `console.log()` (visible in Expo dev client) with `__DEV__` guard
- Production: Sentry integration via `@sentry/react-native` (initialized in `app/_layout.tsx`)

**Validation:**
- Type safety via TypeScript interfaces (compile-time)
- API input validation in Edge Functions before DB insert (server-side)
- UI form validation (client-side) — date selection, room count, service type checks

**Authentication:**
- Session persistence: Supabase handles refresh tokens automatically via `persistSession: true`
- Deep link auth: Custom handler in `app/_layout.tsx` validates `cleanhome://` scheme to prevent open-redirect attacks
- Row-level security (RLS): Postgres policies enforce user isolation — users see only their own bookings/properties via `auth.uid()` checks

**Permissions:**
- Location: Requested on-demand in screens (home map, tracking), handled by Expo Location
- Notifications: Registered on auth in `app/_layout.tsx` via `registerForPushNotifications()`
- Camera/photo: Handled per-flow (property photo upload, document verification) via Expo ImagePicker

---

*Architecture analysis: 2026-04-28*
