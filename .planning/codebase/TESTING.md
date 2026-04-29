# Testing Patterns

**Analysis Date:** 2026-04-28

## Test Framework

**Status:** Not Implemented

This codebase has **no test files** in the application source code. No Jest, Vitest, or other test framework is configured or in use.

- No `jest.config.js`, `vitest.config.ts`, or test configuration files found
- No `test`, `spec` directories in `/app`, `/lib`, or `/components`
- TypeScript strict mode is enforced (see `tsconfig.json`)
- Dependencies include test frameworks in `node_modules` (from transitive deps) but they are not used by the app

**Assertion Library:** Not applicable

## Test File Organization

**Current State:** No tests exist.

**When implementing tests, follow these guidelines:**

**Location:**
- Place test files co-located with source files
- Pattern: `filename.test.ts` or `filename.test.tsx` alongside source
- Example: `lib/api.ts` → `lib/api.test.ts`, `components/ErrorBoundary.tsx` → `components/ErrorBoundary.test.tsx`

**Naming:**
- Use `.test.ts` extension for utility/API functions
- Use `.test.tsx` extension for components and hooks
- Test suites correspond 1:1 with source files

**Structure:**
```
lib/
├── api.ts
├── api.test.ts          # Tests for api.ts
├── supabase.ts
├── supabase.test.ts
└── hooks/
    ├── useNotifications.ts
    └── useNotifications.test.ts

components/
├── ErrorBoundary.tsx
├── ErrorBoundary.test.tsx
└── AnimatedToggle.tsx
```

## Test Structure

**Suite Organization:**
When tests are added, follow this pattern observed in the codebase's strong typing:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react-native";

describe("ErrorBoundary", () => {
  describe("when an error occurs", () => {
    it("should display error message", () => {
      // Test implementation
    });

    it("should show retry button", () => {
      // Test implementation
    });
  });

  describe("retry functionality", () => {
    it("should clear error state on retry", () => {
      // Test implementation
    });
  });
});
```

**Patterns:**
- Use descriptive test names with "should" pattern
- Group related tests with nested `describe` blocks
- One assertion per test preferred (given-when-then structure)
- Setup/teardown with `beforeEach` / `afterEach`

## Mocking

**Framework:** Jest/Vitest with `vi` mocking

**When to Mock:**
- Supabase client calls (database, auth, storage, realtime)
- External API calls (Google Places, Vision API, Nominatim)
- Expo modules (Notifications, Location, AuthSession)
- Navigation (expo-router)
- AsyncStorage / SecureStore

**What NOT to Mock:**
- Core business logic functions
- Type definitions and interfaces
- Theme constants
- Error construction and handling

**Example pattern for Supabase mocking:**
```typescript
import { vi } from "vitest";
import { supabase } from "../lib/supabase";

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "123", name: "Test" },
        error: null,
      }),
    })),
  },
}));
```

**Fixture Data:**
Use realistic data matching the interfaces defined in `lib/types.ts`:
```typescript
const mockBooking: Booking = {
  id: "booking-123",
  client_id: "user-1",
  cleaner_id: "user-2",
  service_type: "Pulizia ordinaria",
  date: "2026-05-01",
  time_slot: "10:00",
  num_rooms: 3,
  estimated_hours: 2,
  base_price: 60,
  client_fee: 5.4,
  cleaner_fee: 5.4,
  total_price: 70.8,
  status: "pending" as const,
  cleaner_deadline: "2026-04-30T20:00:00Z",
  created_at: "2026-04-28T10:00:00Z",
};
```

## Test Types

**Unit Tests (Recommended First):**
- Scope: Individual functions and components in isolation
- Approach: Mock all external dependencies (Supabase, APIs, navigation)
- Examples: 
  - `searchAddresses()` with mocked Google Places and Nominatim
  - `validatePropertyPhoto()` with mocked Vision API
  - `AnimatedToggle` gesture interaction without full app context
  - Pricing calculations in `lib/pricing.ts`
  - Type parsing and error handling

**Integration Tests (Medium Priority):**
- Scope: Multiple components or functions working together
- Approach: Real Supabase test database or stubbed with more realistic payloads
- Examples:
  - Auth flow (sign up → profile creation → role selection → redirect)
  - Booking creation workflow (address search → property selection → booking submission)
  - Message sending and subscription updates
  - Cover coverage zone save → search affected listings

**E2E Tests (Not Yet Implemented):**
- Framework: Detox (for React Native) or Maestro
- When to add: After core booking flow is stable
- Approach: Actual devices or emulators with real app build
- Scope: Critical user journeys (client booking, cleaner accepting, payment)

## Common Patterns

**Async Testing:**
When tests are implemented, handle async functions with `waitFor`:
```typescript
it("should load notifications", async () => {
  const { useNotifications } = await import("../lib/hooks/useNotifications");
  const { result } = renderHook(() => useNotifications("user-123"));
  
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });
  
  expect(result.current.data).toBeDefined();
});
```

**Error Testing:**
Test error paths explicitly:
```typescript
it("should throw on Supabase error", async () => {
  vi.mocked(supabase.from).mockReturnValueOnce({
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValueOnce({
      data: null,
      error: new Error("Not found"),
    }),
  });

  await expect(fetchProfile("user-123")).rejects.toThrow("Not found");
});
```

**Component Interaction:**
Test React Native components with user interactions:
```typescript
it("should toggle on tap", async () => {
  const onValueChange = vi.fn();
  render(
    <AnimatedToggle value={false} onValueChange={onValueChange} />
  );
  
  const toggle = screen.getByRole("button");
  fireEvent.press(toggle);
  
  expect(onValueChange).toHaveBeenCalledWith(true);
});
```

## Coverage

**Current Target:** None enforced

**When implementing:**
- Aim for **80%+ coverage** on `lib/` functions (API, auth, hooks)
- **60%+ coverage** on components (focus on critical UI logic)
- **100% coverage** on type definitions (no-op but good practice)
- Use Vitest `--coverage` flag to measure: `vitest --coverage`

**High-Priority Coverage:**
1. API calls with error cases (`lib/api.ts`)
2. Auth state management (`lib/auth.ts`)
3. Error boundaries and error recovery
4. Payment/booking critical paths
5. Input validation (address, photos, documents)

**View Coverage:**
```bash
npm test -- --coverage
# Generates coverage/ directory with HTML reports
open coverage/index.html
```

## Setup & Run

**When test framework is added, configure as follows:**

**Install dependencies:**
```bash
npm install --save-dev vitest @vitest/ui @testing-library/react-native @testing-library/jest-native
```

**Create `vitest.config.ts`:**
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["lib/**/*.ts", "lib/**/*.tsx", "components/**/*.tsx"],
      exclude: ["**/*.test.ts", "**/*.test.tsx"],
    },
  },
});
```

**Run Commands (when implemented):**
```bash
npm test                    # Run all tests once
npm test -- --watch         # Watch mode
npm test -- --coverage      # Coverage report
npm test -- lib/api.test.ts # Single file
npm test -- --reporter=ui   # Vitest UI
```

## Key Files to Test (Priority Order)

1. **`lib/api.ts`** (1362 lines) - Core API layer with 50+ exported functions
   - Address search (Google Places + Nominatim fallback)
   - Photo validation (Google Vision API)
   - Supabase CRUD operations
   - Realtime subscriptions
   - File uploads

2. **`lib/notifications.ts`** (207 lines) - Push notification setup and sending
   - Device token registration
   - Notification channel configuration
   - Edge Function invocation

3. **`lib/hooks/useNotifications.ts`** - Hook with state management and subscriptions
   - Loading/error states
   - Optimistic updates
   - Realtime sync

4. **`app/_layout.tsx`** (410 lines) - Root layout with auth and deep linking
   - Auth state initialization
   - OAuth flow (Google, Apple)
   - Deep link handling
   - Notification response routing

5. **`components/ErrorBoundary.tsx`** - Error boundary component
   - Error state display
   - Retry functionality
   - Dev debug mode

6. **`lib/auth.ts`** (33 lines) - Auth context and hook
   - Context creation and usage
   - Auth state types

---

*Testing analysis: 2026-04-28*

## Notes for Implementation

- CleanHome is a mobile app — prioritize `@testing-library/react-native` over jsdom
- Mock Supabase realtime channels carefully (they are stateful)
- Test Italian UI strings as-is (no translation needed in tests)
- Consider snapshot testing for complex error messages and layouts
- E2E tests will need actual Stripe test mode keys — set up separate test env
