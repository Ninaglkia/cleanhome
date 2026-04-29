# Technology Stack

**Analysis Date:** 2026-04-28

## Languages

**Primary:**
- JavaScript/TypeScript 5.9.2 - All application and frontend code
- SQL - Supabase/PostgreSQL database migrations and triggers
- Deno - Supabase Edge Functions runtime

**Secondary:**
- Swift - iOS native dependencies (Expo)
- Kotlin - Android native dependencies (Expo)

## Runtime

**Environment:**
- Expo 55.0.8 - React Native development and build platform
- Node.js 24.13.1 - Local development tooling
- Deno - Edge Functions execution on Supabase

**Package Manager:**
- npm - Primary package management
- Lockfile: package-lock.json (implied, standard for npm)

## Frameworks

**Core:**
- React 19.2.0 - UI library
- React Native 0.83.2 - Native mobile framework
- Expo Router 55.0.7 - File-based routing and navigation
- React DOM 19.2.0 - Web platform support

**Styling:**
- Tailwind CSS 3.4.19 - Utility-first CSS framework
- NativeWind 4.2.3 - Tailwind CSS for React Native
- React Native Reanimated 4.2.1 - Animation library

**Build/Dev:**
- Babel - JavaScript transpilation (expo preset with NativeWind JSX plugin)
- Metro - React Native bundler (configured via metro.config.js)
- TypeScript 5.9.2 - Static type checking

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.100.1 - Supabase client library (auth, database, realtime, storage)
- @stripe/stripe-react-native 0.63.0 - Stripe payment integration for mobile

**Native Modules:**
- expo-router - File-based routing and deep linking
- expo-location - GPS tracking and geolocation
- expo-notifications - Push notifications (FCM on Android, APNs on iOS)
- expo-secure-store - Encrypted credential storage (iOS Keychain, Android Keystore)
- expo-auth-session - OAuth flow with deep linking
- expo-apple-authentication - Sign in with Apple
- expo-image-picker - Photo/video selection from device
- expo-crypto - Cryptographic operations
- expo-web-browser - Deep link authentication handling
- react-native-maps 1.27.2 - Google Maps integration
- expo-image - Image loading and display

**State & Storage:**
- @react-native-async-storage/async-storage 2.2.0 - Local key-value storage
- react-native-gesture-handler 2.30.0 - Touch handling
- react-native-safe-area-context 5.6.2 - Safe area insets
- react-native-screens 4.23.0 - Native screens wrapper
- react-native-svg 15.8.0 - SVG rendering
- react-native-reanimated - Worklet-driven animations
- react-native-worklets 0.7.0 - High-performance background tasks

**Vector Icons & Animations:**
- @expo/vector-icons 15.1.1 - Icon library (Material, Feather, etc.)
- lottie-react-native 7.3.6 - Lottie animation playback

**Monitoring:**
- @sentry/react-native ~7.11.0 - Error and performance tracking (sample rate 0.2 in production)

**Utilities:**
- react-native-url-polyfill 3.0.0 - URL API polyfill for Supabase

## Configuration

**Environment:**
- `.env.local` - Development environment (not committed)
- `.env.example` - Template with required variables
- EXPO_PUBLIC_* prefix enforces public client-side variables
- Secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) never shipped to client

**Required Environment Variables:**
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` - Google Places API key (for address autocomplete)
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `EXPO_PUBLIC_SENTRY_DSN` - Sentry error tracking DSN
- `STRIPE_SECRET_KEY` - Stripe secret key (Edge Functions only)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (Edge Functions only)

**Build:**
- `tsconfig.json` - Extends expo/tsconfig.base with strict mode
- `babel.config.js` - Babel preset with NativeWind JSX plugin and Reanimated
- `metro.config.js` - Metro bundler configuration with NativeWind
- `tailwind.config.js` - Tailwind content paths (app/**, components/**, lib/**) with custom ch-* color palette

## Backend Infrastructure

**Supabase (Postgres + PostGIS):**
- Database: PostgreSQL with PostGIS extension enabled
- Real-time: Supabase Realtime for location tracking and messaging
- Auth: Supabase Auth (email/password, Google OAuth, Apple Sign-In)
- Storage: `property-photos` bucket for user-uploaded property images
- Edge Functions: Deno-based serverless functions at `supabase/functions/`

**Stripe Integration:**
- API Version: 2023-10-16
- Platform: Stripe Connect for marketplace payments
- Payment Flow: PaymentIntent with multi-dispatch to cleaners
- Webhook Handling: Incoming webhook validation and event processing

## Platform Requirements

**Development:**
- macOS with Xcode (iOS development)
- Android SDK (Android development)
- Expo Dev Client (iOS) or Android dev build
- Apple Developer Account (iOS app testing)
- Google Play Developer Account (Android distribution)

**Production:**
- iOS 13+ (via Expo managed build service)
- Android 12+ (via Expo managed build service)
- App signed with developer certificates/keystores

---

*Stack analysis: 2026-04-28*
