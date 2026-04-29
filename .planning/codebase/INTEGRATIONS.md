# External Integrations

**Analysis Date:** 2026-04-28

## APIs & External Services

**Payment Processing:**
- Stripe (Payments & Connect) - Marketplace payment processing
  - SDK/Client: @stripe/stripe-react-native 0.63.0
  - Client-side: EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
  - Backend secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
  - Flow: Implemented in `supabase/functions/stripe-booking-payment`, `stripe-booking-action`, `stripe-webhook`, `stripe-subscription-create`, `stripe-connect-onboarding-link`

**Maps & Geolocation:**
- Google Places API - Address autocomplete and place details
  - API Key: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY (GCP project-scoped)
  - Fallback: OpenStreetMap Nominatim (free alternative when Places API unavailable)
  - Implementation: `lib/api.ts` functions `searchAddresses()`, `fetchAddressDetails()`
  - Note: Graceful fallback to Nominatim when Places API returns 403 or is disabled

- Google Maps - Map rendering
  - SDK: react-native-maps 1.27.2
  - Usage: Booking map display, property location viewing

- Google Vision API - Image recognition (property photos)
  - Implementation: `lib/api.ts` uses Google Vision for property photo analysis

**Error Tracking:**
- Sentry - Error and performance monitoring
  - SDK: @sentry/react-native ~7.11.0
  - DSN: EXPO_PUBLIC_SENTRY_DSN
  - Configuration: `app/_layout.tsx`
  - Sample rate: 20% in production, disabled in dev (__DEV__)

## Data Storage

**Databases:**
- PostgreSQL (via Supabase)
  - Extensions: PostGIS enabled for geospatial queries
  - Client: @supabase/supabase-js 2.100.1
  - Connection: EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
  - Auth: Supabase Auth (protected by Row-Level Security policies)

**File Storage:**
- Supabase Storage (`property-photos` bucket)
  - Public bucket for property photos
  - Path structure: `{clientId}/{kind}-{timestamp}-{random}.{ext}`
  - Kinds: "cover" (main property photo), "room" (additional room photos)
  - RLS enforced: clients can only upload/read their own folder
  - Implementation: `lib/api.ts` functions `uploadPropertyPhoto()`, storage policies in migrations

**Caching:**
- Local device caching via AsyncStorage
  - Library: @react-native-async-storage/async-storage 2.2.0
  - Usage: Session state, user preferences
  - Secure storage: expo-secure-store (iOS Keychain, Android Keystore) for auth tokens

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (self-hosted PostgreSQL auth)
  - Implementation: `lib/auth.ts` context + `lib/supabase.ts` client config
  - Root provider: `app/_layout.tsx` wraps entire app with AuthContext

**Auth Methods:**
- Email/password: Custom email/password registration and login
- Google OAuth: Via expo-auth-session + Supabase Auth
- Apple Sign-In: Via expo-apple-authentication + Supabase Auth

**Session Storage:**
- Native platforms: expo-secure-store (encrypted at rest)
  - Falls back to AsyncStorage if native module not linked
  - Token chunking for large sessions (1900-byte chunks)
- Web: AsyncStorage (localStorage, browser origin isolation)
- Auto-refresh: enabled in Supabase client config
- Persistence: enabled (survives app restart)

**Roles:**
- User roles: "client" and "cleaner" (switchable per user)
- Active role: Stored in database, managed by `setActiveRole()` in AuthContext

## Monitoring & Observability

**Error Tracking:**
- Sentry (error/crash reporting and performance metrics)
  - Configured in `app/_layout.tsx`
  - Disabled in development to avoid noise
  - Enabled in production with 20% trace sampling

**Logs:**
- Console logging: Application logs via console.log/error (viewed in Expo Dev Client)
- Edge Function logs: Deno logs visible in Supabase Dashboard
- No persistent centralized logging configured

**Push Notifications:**
- Firebase Cloud Messaging (Android) - Handled by Expo
- Apple Push Notification service (iOS) - Handled by Expo
- Implementation: `lib/notifications.ts`
  - Token registration: Saved to `push_token` and `push_token_native` in user profiles
  - Channels: "default", "bookings" (high priority), "messages" (high priority)
  - Notification insertion: via Supabase table `notifications`

## CI/CD & Deployment

**Hosting:**
- Expo Application Services (EAS) - Managed build service
  - iOS builds: EAS Build (requires Apple Developer membership)
  - Android builds: EAS Build (requires Google Play Developer membership)
- Supabase Hosting - PostgreSQL database + Edge Functions + Auth

**CI Pipeline:**
- GitHub Actions: Not detected (no .github/workflows found)
- Manual builds: Via `eas build` CLI or Expo Dashboard web UI

**Edge Functions Deployment:**
- Supabase Edge Functions (Deno runtime)
- Deployed to `supabase/functions/` directory:
  - `stripe-booking-payment` - Create PaymentIntent for bookings
  - `stripe-booking-action` - Capture/cancel payment and update booking status
  - `stripe-webhook` - Handle Stripe webhook events
  - `stripe-subscription-create` - Manage listing subscriptions
  - `stripe-connect-onboarding-link` - Generate Connect onboarding URL for cleaners
  - `auto-cancel-expired-bookings` - Scheduled function to expire old bookings
  - `send-push-notification` - Trigger push notifications
  - `delete-account` - User account deletion
  - `cancel-listing-subscription` - Cancel cleaner listing subscription

## Environment Configuration

**Required env vars (client-side — public):**
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase client key
- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` - Google Places API key
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `EXPO_PUBLIC_SENTRY_DSN` - Sentry project DSN

**Server-only secrets (Edge Functions/backend only):**
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signature secret
- `SUPABASE_SERVICE_ROLE_KEY` - Service role token for Edge Functions
- These are never exposed to the client and must be set in Supabase dashboard

**Config location:**
- `.env.local` - Development (gitignored)
- `.env.example` - Template with placeholder values
- EAS Secrets: Via `eas secret` CLI for build-time secrets
- Supabase Secrets: Via Supabase Dashboard for Edge Functions

## Webhooks & Callbacks

**Incoming Webhooks:**
- Stripe Webhook - Payment events
  - Endpoint: `supabase/functions/stripe-webhook` (invoked by Stripe)
  - Events handled:
    - `payment_intent.amount_capturable_updated` - Creates booking + booking_offers for multi-dispatch
    - `payment_intent.payment_failed` - Updates booking status
    - `charge.refunded` - Processes refunds
    - `charge.dispute.created` - Logs chargeback
  - Secret validation: STRIPE_WEBHOOK_SECRET via Stripe signature verification

**Outgoing Webhooks:**
- Stripe Connect events - Triggered when cleaner's account is updated
  - Logged and handled in `stripe-webhook` function
- Supabase Realtime broadcasts - Location tracking and messaging (bidirectional)
  - Channel prefix: `booking-tracking:{bookingId}` for location
  - Messages channel: `messages:{conversationId}` for chat

## Geolocation & Spatial Queries

**PostGIS Integration:**
- Extension: PostGIS enabled in `supabase/migrations/20240101000006_add_cleaner_coverage_zone.sql`
- Coverage zones: Cleaner geographic service areas defined as GIS polygons
- Functions:
  - `nearby_cleaners_in_zone(lat, lng)` - Find cleaners covering a location
  - Coverage calculated via buffer + geography overlap
- Usage: Booking dispatch to nearby available cleaners

**Client-side Location:**
- expo-location - GPS tracking with foreground permissions
- Implementation: `lib/realtime-tracking.ts`
  - `startLocationBroadcast()` - Real-time cleaner location broadcast during active booking
  - `subscribeToLocation()` - Client watches cleaner location via Realtime
  - Update interval: 8 seconds, distance threshold: 15 meters
  - Haversine distance calculation: `haversineKm()`
  - ETA estimation: `estimateEtaMinutes()` (default 25 km/h average)

---

*Integration audit: 2026-04-28*
