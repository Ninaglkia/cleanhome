# Coding Conventions

**Analysis Date:** 2026-04-28

## Naming Patterns

**Files:**
- Source files: lowercase with hyphens for separators (e.g., `realtime-tracking.ts`, `use-notifications.ts`)
- Component files: PascalCase (e.g., `AnimatedToggle.tsx`, `ErrorBoundary.tsx`, `CleanerCard.tsx`)
- Type files: lowercase descriptive (e.g., `types.ts`)
- Hooks: `use[Name].ts` pattern in `lib/hooks/` directory (e.g., `useNotifications.ts`, `useCountdown.ts`)
- Utility/API files: lowercase descriptive (e.g., `api.ts`, `auth.ts`, `supabase.ts`)

**Functions:**
- camelCase for all async functions: `fetchClientProperties`, `uploadPropertyPhoto`, `searchCleanersNearPoint`
- camelCase for sync functions: `refreshProfile`, `handleRetry`, `markAsRead`
- Handler functions: `handle[Action]` pattern (e.g., `handleRetry`, `handleDeepLink`)
- Subscription/callback setup: `subscribe[To][Verb]` pattern (e.g., `subscribeToMessages`, `subscribeToBooking`, `subscribeToCleanerOffers`)

**Variables:**
- State variables: camelCase (e.g., `isLoading`, `isAuthenticated`, `hasError`)
- Constants (uppercase): `ONBOARDING_SEEN_KEY`, `SECURE_CHUNK_SIZE`, `SPRING` (animation config), `ALL_SERVICES`, `HOUSE_LIKE_LABELS`
- Private variables (single underscore prefix rarely used): Focus on camelCase for clarity
- Shared values (Reanimated): descriptive names (e.g., `position`, `isDragging`, `progress`, `glowOpacity`)

**Types:**
- Interfaces: PascalCase with `Interface` suffix or standalone (e.g., `AuthState`, `AnimatedToggleProps`, `ClientProperty`, `CleanerProfile`, `AppNotification`)
- Type aliases: PascalCase or descriptive (e.g., `BookingStatus`, `PropertyType`, `CleaningFrequency`, `DocumentKind`)
- Generic/wrapped types: `New[Entity]` pattern (e.g., `NewClientProperty`)

**Database Models:**
- Snake_case for database column names reflected in TypeScript (e.g., `client_id`, `cleaner_id`, `booking_id`, `created_at`, `is_available`)
- Type names remain PascalCase in TS code
- Mapping happens in supabase client initialization and in individual API calls

## Code Style

**Formatting:**
- No explicit Prettier config found — code follows consistent spacing with 2-space indentation
- Single quotes for strings in JavaScript/TypeScript (observed in imports and code)
- Trailing commas in multi-line arrays/objects
- Line length appears ~100-120 characters (pragmatic, not strict)

**Linting:**
- No ESLint config file found
- TypeScript strict mode enabled in `tsconfig.json` (see `compilerOptions.strict: true`)
- Code exhibits strong type discipline throughout

## Import Organization

**Order:**
1. React and React Native imports (`import React`, `import { useState, ... } from "react"`)
2. React Native modules and Expo packages (`import { View, Text } from "react-native"`, `import * as Notifications from "expo-notifications"`)
3. Third-party libraries (`import Animated`, `import { Gesture }`, `import * as Sentry`)
4. Relative imports from project (`import { supabase }`, `import { AuthContext }`, `import { fetchProfile }`)
5. Styles and configuration (`import "../global.css"`, `import { Colors }`)

**Path Aliases:**
- No `@/` aliases observed in the codebase
- Direct relative paths used throughout (e.g., `"../lib/api"`, `"../components/ErrorBoundary"`)
- Supabase imports centralized: `import { supabase } from "./supabase"`

**Example from `/Users/ninomarianolai/CleanHomeRN/app/_layout.tsx`:**
```typescript
import { useEffect, useState, useCallback, useRef } from "react";
import { Platform, Alert, View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StripeProvider } from "@stripe/stripe-react-native";
import ErrorBoundary from "../components/ErrorBoundary";
import * as Sentry from "@sentry/react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";
import { AuthContext } from "../lib/auth";
import { UserProfile } from "../lib/types";
import { fetchProfile, upsertActiveRole } from "../lib/api";
import { registerForPushNotifications } from "../lib/notifications";
import "../global.css";
```

## Error Handling

**Patterns:**
- Destructuring `{ error }` from Supabase calls: `const { data, error } = await supabase.from(...)`
- Immediate error check: `if (error) throw error;`
- Silent failure in non-critical paths: wrapped in try/catch with `.catch(() => {})` or comment explaining why
- Graceful degradation when table/column doesn't exist yet: `if (error?.code === "42P01" || error?.message?.includes("does not exist"))`
- Type-safe error extraction from Edge Functions:
  ```typescript
  type EdgeFnError = Error & { context?: { text?: () => Promise<string> } };
  const ctx = (error as EdgeFnError).context;
  ```
- Promise rejection in callbacks: `throw new Error("descriptive message")`
- Dialog alerts in auth flow: `Alert.alert("title", "message")` when user action is needed

**Example from `/Users/ninomarianolai/CleanHomeRN/lib/api.ts` (lines 509-520):**
```typescript
if (error) {
  type EdgeFnError = Error & { context?: { text?: () => Promise<string> } };
  const ctx = (error as EdgeFnError).context;
  let details = error.message;
  if (ctx && typeof ctx.text === "function") {
    try {
      details = `${error.message}: ${await ctx.text()}`;
    } catch {}
  }
  throw new Error(details);
}
```

## Logging

**Framework:** `console` (native browser/React Native) with `__DEV__` guard for dev-only logs

**Patterns:**
- Development logs wrapped in `if (__DEV__)` to avoid console spam in production
- Error logs use prefixed console.error: `console.error("[ErrorBoundary]", error, info.componentStack)`
- Warnings for suspicious behavior: `console.warn("Deep link: malformed URL", url)`
- Sentry integration initialized at app root for crash reporting (see `/Users/ninomarianolai/CleanHomeRN/app/_layout.tsx` lines 11-16)
- Silent failures for non-fatal operations (token registration, push notification delivery)

**Example from `/Users/ninomarianolai/CleanHomeRN/lib/notifications.ts` (lines 158-165):**
```typescript
if (__DEV__) {
  console.warn(
    "[sendPushNotification] called without bookingId, skipping",
    { targetUserId, title }
  );
}
```

## Comments

**When to Comment:**
- Complex algorithms (e.g., address parsing logic, security nonce generation)
- Database trigger behavior and cascading effects
- Why something is done a certain way (not what it does)
- Italian UI strings — comments explain English context for developers
- Critical business logic (payment capture atomicity, RLS enforcement)

**JSDoc/TSDoc:**
- Used selectively for exported functions and complex flows
- Single-line comments with /** /** style for function purposes:
  ```typescript
  /**
   * Toggles the cleaner's availability flag. Used by the active/inactive
   * Switch on the listing page.
   */
  export async function setCleanerAvailability(...)
  ```
- Inline comments explain "why" not "what":
  ```typescript
  // Only process our own scheme to prevent open-redirect / fixation
  // attacks via crafted external links.
  if (!url || !url.startsWith("cleanhome://") || !url.includes("auth/callback")) {
    return;
  }
  ```

## Function Design

**Size:** Functions average 20-80 lines; large functions (100+ lines) are rare and handle multi-step flows with clear internal structure

**Parameters:**
- Simple scalar parameters (string, number, boolean) preferred: `fetchBooking(id: string)`
- Object parameters for complex input: `createListing(cleanerId: string, isFirst: boolean)`
- Callback/handler parameters use arrow function syntax: `onValueChange: (val: boolean) => void`
- Optional parameters use `?`: `onProgress?: (percent: number) => void`
- Optional data with `null` or nullable generics: `booking?: Booking`, `profile: UserProfile | null`

**Return Values:**
- Async functions return `Promise<T>` (void for side effects only)
- Null is used to indicate "not found": `fetchProfile(): Promise<UserProfile | null>`
- Empty arrays `[]` for collections when empty (not null)
- Object returns for multiple related values: `{ booking: Booking | null; offers: BookingOffer[] }`
- Union types for success/error: `{ ok: boolean; error?: string }` in non-throwing error paths

**Example from `/Users/ninomarianolai/CleanHomeRN/lib/api.ts` (lines 1226-1270):**
```typescript
export async function fetchBookingWithOffers(
  bookingId: string
): Promise<{ booking: Booking | null; offers: BookingOffer[] }> {
  const [bookingResult, offersResult] = await Promise.all([...]);
  // ... error handling ...
  return {
    booking: bookingResult.data as Booking | null,
    offers: mappedOffers,
  };
}
```

## Module Design

**Exports:**
- Named exports preferred for API functions: `export async function fetchCleaners(...)`
- Default exports only for React components: `export default function RootLayout() {}`
- Interface/type exports adjacent to usage: `export interface AddressSuggestion { ... }`
- Constants exported when used across modules: `export const ALL_SERVICES = [...]`

**Barrel Files:**
- Not used in this codebase — imports are direct
- Each module (lib, components) imported explicitly

**Example from `/Users/ninomarianolai/CleanHomeRN/lib/types.ts`:**
```typescript
export type BookingStatus = "pending" | "accepted" | "declined" | ...;
export interface Booking { id: string; client_id: string; ... }
export interface CleanerProfile { id: string; ... }
export const ALL_SERVICES = [...];
```

## Italian Language in UI

The codebase contains Italian-language UI strings throughout:
- Error messages: `"La foto contiene contenuti non appropriati."` (photo validation in `lib/api.ts`)
- Notification messages: `"Nuova prenotazione!"` (in `lib/notifications.ts`)
- UI labels: `"Pulizia ordinaria"`, `"Stiratura"` (service types in `lib/types.ts`)
- Component text: `"Qualcosa è andato storto"` (error boundary in `components/ErrorBoundary.tsx`)
- Comments: Mixed Italian/English (e.g., `// Blocco lo schermo subito!` in `app/_layout.tsx`)

Keep Italian strings in code as-is; do not translate to English unless explicitly refactoring for i18n.

---

*Convention analysis: 2026-04-28*
