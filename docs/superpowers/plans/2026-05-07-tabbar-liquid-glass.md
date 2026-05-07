# iOS 26 Liquid Glass Tab Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current JS-rendered Expo Router `Tabs` with a real native `UITabBarController` so iOS 26 applies its Liquid Glass material automatically — matching the App Store look on the user's iPhone 14 Pro.

**Architecture:** Install `react-native-bottom-tabs` (Callstack) + `@bottom-tabs/react-navigation` adapter. Bridge into Expo Router via `withLayoutContext`. Keep all existing route files untouched. Native rebuild required.

**Tech Stack:** Expo SDK 55, RN 0.83, expo-router, react-native-bottom-tabs, SF Symbols, TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-07-tabbar-liquid-glass-design.md`

---

## Task 1: Verify lib compatibility & install

**Files:**
- Modify: `package.json` (deps)
- Modify: `bun.lock` / `package-lock.json` (auto)

- [ ] **Step 1: Check `react-native-bottom-tabs` peer-dep matrix**

Run:
```bash
cd /Users/ninomarianolai/CleanHomeRN && npm view react-native-bottom-tabs peerDependencies
npm view @bottom-tabs/react-navigation peerDependencies
```
Expected: `react`, `react-native`, `@react-navigation/native` versions compatible with our `react@19`, `react-native@0.83.x`, `@react-navigation/native@^7`. If incompatible, STOP and surface the conflict to the user — do not proceed to install.

- [ ] **Step 2: Install**

Run:
```bash
cd /Users/ninomarianolai/CleanHomeRN && bun install react-native-bottom-tabs @bottom-tabs/react-navigation
```
Expected: install succeeds, no peer-dep warnings.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add react-native-bottom-tabs for native iOS tab bar"
```

---

## Task 2: Configure Expo plugin

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Add the plugin**

Open `app.json` and add `"react-native-bottom-tabs"` to the `expo.plugins` array (create the array if it doesn't exist). Example:

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      "react-native-bottom-tabs"
    ]
  }
}
```
Keep all other existing plugins.

- [ ] **Step 2: Commit**

```bash
git add app.json
git commit -m "chore: register react-native-bottom-tabs expo plugin"
```

---

## Task 3: Prebuild iOS

**Files:**
- Modify: `ios/Podfile.lock` (auto)
- Modify: `ios/Podfile` (auto if changed)

- [ ] **Step 1: Run prebuild**

```bash
cd /Users/ninomarianolai/CleanHomeRN && npx expo prebuild --platform ios --clean=false
```
Expected: prebuild completes; `pod install` runs; new pods for `react-native-bottom-tabs` show in `Podfile.lock`.

- [ ] **Step 2: Commit**

```bash
git add ios/Podfile.lock ios/Podfile
git commit -m "chore: prebuild ios after adding native tab bar"
```

---

## Task 4: Rewrite `_layout.tsx` to use native tabs

**Files:**
- Modify: `app/(tabs)/_layout.tsx` (full rewrite)

- [ ] **Step 1: Replace file content**

Replace the entire file with:

```tsx
import { withLayoutContext } from "expo-router";
import { createNativeBottomTabNavigator } from "@bottom-tabs/react-navigation";
import { useAuth } from "../../lib/auth";

const { Navigator } = createNativeBottomTabNavigator();
const Tabs = withLayoutContext(Navigator);

const CLIENT_TINT = { active: "#006b55", inactive: "rgba(2,36,32,0.4)" };
const CLEANER_TINT = { active: "#6f4627", inactive: "rgba(80,60,40,0.35)" };

export default function TabsLayout() {
  const { profile } = useAuth();
  const isCleaner = profile?.active_role === "cleaner";

  // Naming convention from CLAUDE.md is intentionally inverted: cleaner mode
  // shows the "client" tint colors (verde) and vice versa. Don't "fix".
  const T = isCleaner ? CLIENT_TINT : CLEANER_TINT;

  const UNREAD_NOTIFICATIONS = 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: T.active,
        tabBarInactiveTintColor: T.inactive,
      }}
    >
      <Tabs.Screen
        name={isCleaner ? "cleaner-home" : "home"}
        options={{
          title: isCleaner ? "Lavori" : "Esplora",
          tabBarIcon: () => ({
            sfSymbol: isCleaner ? "briefcase" : "map",
          }),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: isCleaner ? "Messaggi" : "Chat",
          tabBarIcon: () => ({ sfSymbol: "bubble.left.and.bubble.right" }),
          tabBarBadge: UNREAD_NOTIFICATIONS > 0 ? String(UNREAD_NOTIFICATIONS) : undefined,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: isCleaner ? "Incarichi" : "Prenotazioni",
          tabBarIcon: () => ({ sfSymbol: "doc.text" }),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profilo",
          tabBarIcon: () => ({ sfSymbol: "person" }),
        }}
      />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen
        name={isCleaner ? "home" : "cleaner-home"}
        options={{ href: null }}
      />
    </Tabs>
  );
}
```

NOTE: The exact `tabBarIcon` API for `@bottom-tabs/react-navigation` may differ slightly from the snippet above. Read `node_modules/@bottom-tabs/react-navigation/README.md` after install and adjust the `sfSymbol` prop wrapping if needed (could be `sfSymbol: "name"` directly on `options` instead of a function).

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/ninomarianolai/CleanHomeRN && npx tsc --noEmit
```
Expected: zero errors. If type errors on tabBarIcon shape, consult lib README for the exact prop name.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/_layout.tsx
git commit -m "feat: switch to native iOS UITabBar (Liquid Glass on iOS 26)"
```

---

## Task 5: Rebuild dev client on iPhone

**Files:** none (native build)

- [ ] **Step 1: Verify Xcode + device available**

```bash
xcrun devicectl list devices | grep -i iphone
```
Expected: iPhone listed as `available (paired)`.

- [ ] **Step 2: Build & install**

```bash
cd /Users/ninomarianolai/CleanHomeRN && npx expo run:ios --device
```
Expected: ~10 min build, app installs and launches on iPhone with new Liquid Glass tab bar.

If the build fails with native linkage errors related to `react-native-bottom-tabs`, surface the failure to the user with the exact error and STOP — do not attempt random workarounds.

- [ ] **Step 3: Reload Metro**

```bash
curl -X POST http://localhost:8081/reload
```

---

## Task 6: Visual verification

**Files:** none

- [ ] **Step 1: User-driven smoke test**

Ask the user to open the app and verify:
1. Tab bar visually matches App Store iOS 26 (fluttuante, sfocata, morphing al tap)
2. All 4 tabs are clickable and route correctly
3. Switching role (Modalità Professionista toggle in profile) flips tint colors
4. Labels show in Italian: Lavori/Esplora, Messaggi/Chat, Incarichi/Prenotazioni, Profilo

- [ ] **Step 2: If user reports issues, surface and stop**

Do not attempt fixes without user approval.

---

## Task 7: Push branch

**Files:** none

- [ ] **Step 1: Push**

```bash
git push origin main
```

---

## Self-review notes

- Spec coverage: Tasks 1-4 cover install + plugin + prebuild + rewrite. Task 5 covers rebuild. Task 6 covers verification. Risk-mitigation (compatibility check) is in Task 1 Step 1.
- Placeholders: none. Code in Task 4 is full file content; SF Symbol API caveat is explicitly flagged with fallback.
- Type consistency: `T.active` / `T.inactive` used consistently; `isCleaner` flag drives both name + label + icon ternaries the same way.
- Rollback: covered in spec.
