# Codebase Structure

**Analysis Date:** 2026-04-28

## Directory Layout

```
CleanHomeRN/
├── app/                          # Expo Router navigation (file-based routing)
│   ├── _layout.tsx              # Root layout: auth init, providers, deep links
│   ├── index.tsx                # Splash screen entry point
│   ├── (auth)/                  # Auth group (login/register, not tabbed)
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/                  # Main tabbed interface (client & cleaner)
│   │   ├── _layout.tsx
│   │   ├── home.tsx             # Client: search/map view for cleaners
│   │   ├── cleaner-home.tsx     # Cleaner: job offers dashboard
│   │   ├── bookings.tsx         # Client: booking history
│   │   ├── messages.tsx         # Chat thread list
│   │   ├── notifications.tsx    # Realtime notification inbox
│   │   └── profile.tsx          # Client/cleaner profile & settings
│   ├── booking/                 # Booking creation & tracking workflow
│   │   ├── _layout.tsx
│   │   ├── new.tsx              # New booking form (5-step wizard)
│   │   └── [id]/                # Dynamic route for specific booking
│   │       ├── waiting.tsx      # Awaiting cleaner response
│   │       ├── tracking.tsx     # Live cleaner location tracking
│   ├── chat/                    # Booking-specific messaging
│   │   ├── _layout.tsx
│   │   └── [bookingId].tsx      # Chat screen for booking
│   ├── cleaner/                 # Cleaner-specific screens
│   │   ├── _layout.tsx
│   │   ├── jobs.tsx             # Available jobs browser
│   │   ├── [id].tsx             # Cleaner profile detail view
│   │   ├── profile-view.tsx     # View another cleaner's profile
│   │   └── reviews.tsx          # Cleaner's review history
│   ├── listing/                 # Cleaner listing management
│   │   ├── _layout.tsx
│   │   └── index.tsx            # Create/edit cleaner listing
│   ├── listings/                # Search & browse listings
│   │   ├── _layout.tsx
│   │   └── index.tsx            # Browse cleaner listings
│   ├── onboarding/              # First-run flow (auth → profile → role)
│   │   ├── _layout.tsx
│   │   ├── features.tsx         # Marketing features tour (pre-login)
│   │   ├── welcome.tsx          # Role selection + profile init
│   │   ├── cleaner.tsx          # Cleaner profile setup
│   │   └── cleaner-setup-checklist.tsx
│   ├── properties/              # Client property (house) management
│   │   ├── _layout.tsx
│   │   └── [...params].tsx      # Dynamic property CRUD
│   ├── payments/                # Invoices & payment history
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   └── invoices.tsx
│   ├── profile/                 # Client/cleaner profile editor
│   │   ├── _layout.tsx
│   │   └── [section].tsx
│   ├── documents/               # Document upload (ID, verification)
│   │   ├── _layout.tsx
│   │   └── index.tsx
│   ├── support/                 # Support & help center
│   │   ├── _layout.tsx
│   │   └── faq/
│   ├── review/                  # Leave review modal
│   │   ├── _layout.tsx
│   │   └── [bookingId].tsx
│   ├── legal/                   # Terms, privacy (static pages)
│   │   ├── _layout.tsx
│   │   ├── terms.tsx
│   │   └── privacy.tsx
│   └── demo/                    # Development/testing routes
│       ├── broadcast.tsx        # Multi-cleaner dispatch testing
│       ├── live-tracking.tsx    # Location tracking demo
│       └── [other demos]
├── lib/                          # Shared business logic & utilities
│   ├── supabase.ts              # Supabase client initialization (auth tokens, storage adapter)
│   ├── auth.ts                  # AuthContext definition & useAuth() hook
│   ├── api.ts                   # REST API wrappers (data fetching, mutations)
│   ├── types.ts                 # TypeScript type definitions (Booking, UserProfile, etc.)
│   ├── theme.ts                 # Design tokens (colors, spacing, animations)
│   ├── pricing.ts               # Price calculation logic (€/sqm, fees, discounts)
│   ├── notifications.ts         # Push notification registration & helpers
│   ├── realtime-tracking.ts     # Live location broadcast/subscription
│   └── hooks/
│       ├── useNotifications.ts  # Realtime notifications subscription hook
│       ├── useCountdown.ts      # Countdown timer for booking offers
│       └── useUserDocuments.ts  # Document upload management
├── components/                   # Reusable UI components
│   ├── ErrorBoundary.tsx        # Global error boundary
│   ├── LegalPage.tsx            # Template for legal pages
│   ├── AnimatedToggle.tsx       # Toggle switch with animation
│   ├── TypologySheet.tsx        # Property type selector (apartments, villas, etc.)
│   ├── booking/                 # Booking-specific components
│   │   └── [shared booking UI]
│   ├── listing/                 # Listing components
│   │   └── [listing display components]
│   ├── search/                  # Search/filter components
│   │   └── [search UI]
│   ├── icons/                   # Custom icon definitions
│   └── ui/                      # Basic UI primitives
├── supabase/                     # Backend configuration
│   ├── functions/               # Deno edge functions (server-side business logic)
│   │   ├── stripe-booking-payment/       # Create Stripe PaymentIntent
│   │   ├── stripe-booking-action/        # Capture payment & dispatch offers
│   │   ├── stripe-webhook/               # Stripe event processing
│   │   ├── stripe-subscription-create/   # Listing subscription management
│   │   ├── stripe-connect-onboarding-link/ # Cleaner payout setup
│   │   ├── cancel-listing-subscription/  # Downgrade listing
│   │   ├── send-push-notification/       # Trigger notifications
│   │   ├── auto-cancel-expired-bookings/ # Scheduled job
│   │   └── delete-account/               # User data cleanup
│   ├── migrations/              # SQL schema versions
│   │   ├── 20240101000001_create_profiles.sql
│   │   ├── 20240101000002_create_cleaner_profiles.sql
│   │   ├── 20240101000003_create_bookings.sql
│   │   ├── 20240101000004_create_messages.sql
│   │   ├── 20240101000005_create_profile_trigger.sql
│   │   ├── 20240101000006_add_cleaner_coverage_zone.sql
│   │   ├── 20240101000007_cleaner_listings.sql
│   │   ├── 20240101000008_stripe_connect.sql
│   │   ├── 20240101000009_reviews.sql
│   │   ├── 20240101000010_push_tokens.sql
│   │   ├── 20240101000011_lock_profile_select.sql
│   │   ├── 20240101000012_client_properties.sql
│   │   ├── 20240101000013_property_type_frequency.sql
│   │   ├── 20240101000014_cleaner_setup_progress.sql
│   │   ├── 20240101000015_notifications.sql
│   │   ├── 20240101000016_user_documents.sql
│   │   ├── 20240101000017_bookings_dispute_refund_columns.sql
│   │   ├── 20240101000018_cleaner_listings_rls_active_only.sql
│   │   ├── 20240101000019_bookings_insert_via_service_role_only.sql
│   │   └── [other migrations]
│   └── email-templates/         # Email template files (Supabase Auth emails)
├── assets/                       # Static images, icons, Lottie animations
│   ├── icon.png                 # App icon
│   ├── splash-icon.png          # Splash screen image
│   ├── lottie/                  # Lottie animation JSON files
│   │   ├── property-types/      # Property type selector animations
│   │   └── [other animations]
│   └── [other assets]
├── ios/                          # Native iOS project (Xcode)
├── build/                        # Xcode build artifacts (ignored)
├── package.json                  # Dependencies (Expo, React Native, Supabase, Stripe, etc.)
├── tsconfig.json                 # TypeScript config
├── app.json                      # Expo app configuration (bundle ID, permissions, plugins)
├── babel.config.js               # Babel configuration (Expo preset)
├── metro.config.js               # Metro bundler config
├── tailwind.config.js            # Tailwind/NativeWind config
├── .env.local                    # Local env vars (SUPABASE_URL, STRIPE_KEY, etc.)
├── .env.example                  # Env var template
├── global.css                    # Global styles (NativeWind/Tailwind)
└── nativewind-env.d.ts          # TypeScript definitions for NativeWind
```

## Directory Purposes

**`app/`:**
- Purpose: Expo Router file-based navigation. Each file/folder maps to a route. Parentheses create navigation groups (not shown in URL). Dynamic routes use `[param]` syntax.
- Contains: All screen components
- Key files: `_layout.tsx` (nested layouts), `page.tsx` or folder `index.tsx` (screens)

**`lib/`:**
- Purpose: Shared non-UI code (API wrappers, auth, types, hooks)
- Contains: Zero JSX/UI, only TypeScript functions and hooks
- Key files: `api.ts` (large file ~39KB, all Supabase queries), `supabase.ts` (client init), `auth.ts` (context), `types.ts` (interfaces)

**`components/`:**
- Purpose: Reusable UI components used across multiple screens
- Contains: Presentational components (no route logic)
- Key files: `ErrorBoundary.tsx` (catches render errors), `TypologySheet.tsx` (property type modal), feature-specific subfolders

**`supabase/functions/`:**
- Purpose: Deno Edge Functions (replace serverless backends). Run on Supabase infrastructure, triggered by client `invoke()` or webhooks.
- Contains: TypeScript functions, no React
- Key files: `stripe-booking-payment` (payment intent creation, multi-dispatch logic), `stripe-webhook` (payment event processing), push notification triggers

**`supabase/migrations/`:**
- Purpose: Ordered SQL schema changes. Applied once to Supabase project.
- Contains: `.sql` files with CREATE TABLE, ALTER, RLS policies, triggers, functions
- Execution: Sequential by filename (date-prefixed). Run via Supabase CLI or manual import.

**`assets/`:**
- Purpose: App bundle assets (images, icons, Lottie JSON)
- Contains: PNG/JPG images, Lottie animation JSON files
- Key files: `icon.png` (app launcher icon), `splash-icon.png` (splash screen), `lottie/property-types/` (animations for property selection)

**`ios/`:**
- Purpose: Native iOS Xcode project (not hand-edited in this workflow)
- Contains: Generated by Expo prebuild (`eas build` or `expo prebuild`)
- Edit: Only when necessary for native module linking

## Key File Locations

**Entry Points:**
- `app/index.tsx`: App splash screen (first visible screen, handles auth check)
- `app/_layout.tsx`: Root layout, initializes Supabase auth listener, wraps app in providers (StripeProvider, GestureHandlerRootView, AuthContext)
- `supabase/functions/stripe-webhook/index.ts`: Stripe webhook handler (entry point for payment events from Stripe API)

**Configuration:**
- `app.json`: Expo app config (bundle ID, permissions, plugins, splash screen)
- `tsconfig.json`: TypeScript compiler options
- `.env.local`: Environment variables (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY, etc.)
- `supabase/migrations/_RUN_ALL_IN_SUPABASE.sql`: Master migration file combining all migrations

**Core Logic:**
- `lib/api.ts`: All Supabase REST calls (~950 lines). Functions grouped by domain: properties, bookings, cleaners, messages, reviews, documents.
- `lib/supabase.ts`: Supabase client initialization with secure storage adapter (SecureStore for native, AsyncStorage fallback)
- `lib/auth.ts`: AuthContext (React Context for app-wide auth state) + useAuth hook
- `app/(tabs)/home.tsx`: Client search screen (large ~500+ lines, interactive map with search filters)
- `app/booking/new.tsx`: Booking creation wizard (5-step form with pricing calculation, cleaner search)

**Testing:**
- No test files in codebase. Testing is manual or via Expo dev client.

## Naming Conventions

**Files:**
- Screen files: lowercase with hyphens (e.g., `cleaner-home.tsx`, `booking-detail.tsx`)
- Component files: PascalCase (e.g., `ErrorBoundary.tsx`, `TypologySheet.tsx`)
- Utility/hook files: camelCase (e.g., `useNotifications.ts`, `realtime-tracking.ts`)
- Edge function folders: kebab-case matching function name (e.g., `stripe-booking-payment/`)
- Migration files: `YYYYMMDDHHMMSS_descriptive_name.sql` (sequential, date-prefixed)

**Variables & Functions:**
- Functions: camelCase (e.g., `fetchProfile()`, `calculatePrice()`, `startLocationBroadcast()`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_CLEANERS`, `FEE_RATE`, `STRIPE_API_VERSION`)
- React component props: PascalCase in interfaces (e.g., `interface PriceMarkerProps`)
- Database columns: snake_case (e.g., `cleaner_id`, `created_at`, `cover_photo_url`)
- Enums/types: PascalCase (e.g., `BookingStatus`, `CleanerType`)

**Directories:**
- Feature grouping: lowercase with parentheses for navigation groups (e.g., `(tabs)`, `(auth)`)
- Dynamic routes: brackets (e.g., `[bookingId]`, `[id]`)
- Private routes: leading underscore (e.g., `_layout.tsx`, `_helpers.ts`)

## Where to Add New Code

**New Feature (Multi-file: screen + API + types):**
- Add screen: `app/[feature]/index.tsx` or `app/[feature]/[action].tsx`
- Add API functions: New exports in `lib/api.ts` (or new file `lib/[feature]-api.ts` if large)
- Add types: New interfaces in `lib/types.ts` or dedicated `lib/[feature]-types.ts`
- Add hooks: New file in `lib/hooks/use[Feature].ts`

**New Component (Reusable UI):**
- Implementation: `components/[Feature]/[ComponentName].tsx`
- Example: Button component → `components/ui/Button.tsx`; Booking card → `components/booking/BookingCard.tsx`

**New Custom Hook:**
- Implementation: `lib/hooks/use[HookName].ts`
- Example: `useBookingTimer` → `lib/hooks/useBookingTimer.ts`

**Shared Utilities:**
- Plain functions: Add to `lib/[module].ts` (e.g., `pricing.ts` for price calculations)
- Custom hooks: `lib/hooks/use[Name].ts`
- Database operations: Always in `lib/api.ts` (single source of truth for queries)

**Backend Edge Function:**
- New function: Create folder `supabase/functions/[function-name]/`
- Implementation: `supabase/functions/[function-name]/index.ts` (Deno TypeScript)
- Entrypoint: Use `serve()` from Deno std library, export `POST` or `GET` handler

**Database Change (Migration):**
- New migration: Create `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- Pattern: One semantic change per file (CREATE TABLE, ADD COLUMN, CREATE TRIGGER)
- Apply: Via Supabase CLI (`supabase db push`) or manual import in Supabase console

## Special Directories

**`app/_layout.tsx` & nested `_layout.tsx`:**
- Purpose: Define screen grouping and shared layout
- Generated: No (hand-written)
- Committed: Yes
- Note: Root `_layout.tsx` is where auth listeners, context providers, and notification handlers are initialized

**`.env.local`:**
- Purpose: Local environment variables (secrets not committed)
- Generated: No (created manually on setup)
- Committed: No (in .gitignore)
- Required vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`, Sentry DSN

**`build/` and `.expo/`:**
- Purpose: Build artifacts and Expo dev client cache
- Generated: Yes (by Xcode, Expo CLI, or eas build)
- Committed: No (in .gitignore)

**`supabase/.temp/`:**
- Purpose: Temporary files from Supabase CLI operations
- Generated: Yes
- Committed: No

**`supabase/migrations/` (all files):**
- Purpose: SQL schema history
- Generated: No (hand-written by developers)
- Committed: Yes (source of truth for DB schema)

**`dist/` & `build/`:**
- Purpose: Web build output (for `expo start --web`)
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-04-28*
