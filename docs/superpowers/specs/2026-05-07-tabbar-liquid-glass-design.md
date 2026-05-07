# Tab Bar Liquid Glass iOS 26 — Design

**Date:** 2026-05-07
**Status:** Approved (B1 nativa)
**Owner:** Nino

## Goal

Replicate the iOS 26 App Store native Liquid Glass bottom tab bar in CleanHome RN, replacing the current custom `expo-router/Tabs` setup with a real `UITabBarController` so iOS 26 applies its native morphing glass effect automatically.

## Why

The current tab bar is a JS-rendered `@react-navigation/bottom-tabs` with a custom pill highlight and rgba background. On iOS 26 (the user's iPhone 14 Pro) this looks dated next to first-party apps that adopt the native Liquid Glass material. The user explicitly chose A1 (real native) over a BlurView fake — they accept the rebuild cost.

## Approach

Use `react-native-bottom-tabs` (Callstack) with the `@bottom-tabs/react-navigation` adapter. On iOS the lib renders a real `UITabBarController` which automatically picks up Liquid Glass on iOS 26+. Bridge it into Expo Router with `withLayoutContext` so existing route files (`home.tsx`, `cleaner-home.tsx`, `messages.tsx`, `bookings.tsx`, `profile.tsx`, `notifications.tsx`) keep working untouched.

## Non-goals

- Android — no `android/` folder exists, iOS-only project for now
- Keeping the custom green pill — Apple controls the active highlight on native UITabBar
- Horizontal swipe between tabs — not part of iOS HIG, not requested

## Architecture

### Files changed

| File | Change |
|---|---|
| `package.json` | Add `react-native-bottom-tabs`, `@bottom-tabs/react-navigation` |
| `app.json` | Add `react-native-bottom-tabs` to `plugins` array |
| `app/(tabs)/_layout.tsx` | Rewrite: drop custom `TabItem` JSX, use native adapter |
| `ios/Podfile.lock` | Auto-update via `pod install` (run by `expo prebuild`) |

### Tab bar layout (native)

```ts
const Tabs = withLayoutContext(
  createNativeBottomTabNavigator().Navigator
);

<Tabs
  screenOptions={{
    tabBarActiveTintColor: isCleaner ? "#006b55" : "#6f4627",
    tabBarInactiveTintColor: isCleaner ? "rgba(2,36,32,0.4)" : "rgba(80,60,40,0.35)",
  }}
>
  {/* 5 screens — same names as today */}
</Tabs>
```

### Icon mapping (Ionicons → SF Symbols)

iOS native tab bar prefers SF Symbols. The adapter accepts a `sfSymbol` string:

| Tab | Outline / Filled |
|---|---|
| Lavori (cleaner) / Esplora (client) | `briefcase` / `briefcase.fill` ; `map` / `map.fill` |
| Messaggi / Chat | `bubble.left.and.bubble.right` / `.fill` |
| Incarichi / Prenotazioni | `doc.text` / `doc.text.fill` |
| Profilo | `person` / `person.fill` |

Active state is handled by iOS itself (filled variant + tint color).

### Dynamic theming (cleaner vs client)

Driven by `profile?.active_role` from `useAuth()`. Tint colors flip:
- cleaner → teal `#006b55` active, faded teal inactive
- client → warm brown `#6f4627` active, faded brown inactive

Liquid Glass background is iOS-managed (light/dark adapts automatically).

### Badge

Replace custom `badgeDot` View with `tabBarBadge` prop on `messages` screen. Set it to the unread count when wired up later. Hidden screens (`notifications`, the inactive home variant) keep `href: null`.

## Data flow

`useAuth().profile.active_role` → ternary in `_layout.tsx` → tint colors + first tab name (`cleaner-home` vs `home`) + tab labels (`Lavori`/`Esplora`, `Incarichi`/`Prenotazioni`, `Messaggi`/`Chat`).

## Build & deployment

1. `bun install react-native-bottom-tabs @bottom-tabs/react-navigation`
2. `npx expo prebuild --clean=false` (regenerates iOS Pods with the new module)
3. `npx expo run:ios --device` (rebuilds dev client onto the connected iPhone — ~10 min first time)
4. Reload Metro: `curl -X POST http://localhost:8081/reload`

## Verification

- `npx tsc --noEmit` zero errors
- App launches on iPhone with Liquid Glass tab bar (fluttuante, sfocata, morphing al tap)
- Switching role (Modalità Professionista toggle) flips tint colors live
- All 4 visible tabs route to their screens; hidden screens (`notifications`, inactive home) not visible in bar but still pushable

## Risks

- **Compatibility**: `react-native-bottom-tabs` must support Expo SDK 55 + RN 0.83. Verified at install time; if peer deps clash, fallback to A2 (BlurView fake) and document the regression.
- **First-time rebuild**: ~10 min on user's iPhone. Communicated and accepted.
- **Loss of pill highlight**: accepted by user (Question 2 → option A).

## Rollback

If the lib breaks the build or the iOS 26 effect isn't there, revert via:
```
git revert <commit-sha>
bun install
npx expo prebuild --clean=false
npx expo run:ios --device
```

## Done criteria

- iPhone 14 Pro shows a Liquid Glass tab bar identical in style to the iOS 26 App Store screenshot
- Both cleaner and client modes render with their respective tint colors
- Badge support hooked up on messages tab (placeholder for later unread-count wiring)
- TypeScript clean, Metro bundle clean, pushed to `main`
