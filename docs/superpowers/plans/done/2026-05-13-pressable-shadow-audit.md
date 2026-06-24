# Pressable CTA + Shadow Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all Pressable dynamic-style-function CTA buttons that may render as invisible (no fill) on iOS, and fix all circular icon shadows with #000 color + high opacity that produce visual glitches.

**Architecture:** Two bug classes. Class A: `style={({ pressed }) => ({ backgroundColor: ... })}` returning an object — iOS Pressable may drop the backgroundColor on first render when the function returns `opacity: 1`. Fix: convert to `style={[staticStyles.base, pressed && staticStyles.pressed]}` with separate StyleSheet or inline array. Class B: `shadowColor: "#000"` with `shadowOpacity >= 0.2` on small elements (<= 56px) — produces heavy oval shadow on iOS. Fix: use `shadowColor: Colors.primary` or a brand color, `shadowOpacity: 0.06-0.08`.

**Tech Stack:** React Native 0.76, Expo SDK 55, TypeScript strict, NativeWind (minimal usage here — all inline StyleSheet)

---

### Task 1: Fix CTA buttons in app/legal/ (privacy, terms, refund)

**Files:**
- Modify: `app/legal/privacy.tsx`
- Modify: `app/legal/terms.tsx`
- Modify: `app/legal/refund.tsx`

- [ ] **Step 1: Fix privacy.tsx** — replace object-return style function with array pattern

Replace:
```tsx
style={({ pressed }) => ({
  backgroundColor: Colors.primary,
  paddingVertical: 16,
  paddingHorizontal: 32,
  borderRadius: 16,
  width: "100%",
  alignItems: "center",
  opacity: pressed ? 0.85 : 1,
})}
```
With:
```tsx
style={({ pressed }) => [
  {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    borderWidth: 0,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
]}
```

- [ ] **Step 2: Fix terms.tsx** — same pattern as privacy.tsx

- [ ] **Step 3: Fix refund.tsx** — same pattern as privacy.tsx

- [ ] **Step 4: Run TypeScript check**
```bash
cd /Users/ninomarianolai/CleanHomeRN && bunx tsc --noEmit 2>&1 | head -20
```

---

### Task 2: Fix CTA buttons in app/listings/index.tsx

**Files:**
- Modify: `app/listings/index.tsx` (lines 350, 829)

- [ ] **Step 1: Fix line 350** — Stripe Connect banner (backgroundColor: "#FEF3C7" + opacity logic)

Replace object return with array:
```tsx
style={({ pressed }) => [
  {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  (pressed || verifying) && { opacity: pressed ? 0.8 : 0.6 },
]}
```

- [ ] **Step 2: Fix line 829** — retry button (backgroundColor: C.secondary)

```tsx
style={({ pressed }) => [
  {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: C.secondary,
  },
  pressed && { opacity: 0.9 },
]}
```

- [ ] **Step 3: Also fix shadowColor "#000" at lines 604, 879, 964, 1130** — change to brand color with reduced opacity

Line 604 context: use `shadowColor: C.secondary` + `shadowOpacity: 0.08`
Line 879: `shadowColor: "#022420"` + `shadowOpacity: 0.1` + `elevation: 4`
Line 964: `shadowColor: "#022420"` + `shadowOpacity: 0.08`
Line 1130: `shadowColor: "#022420"` + `shadowOpacity: 0.08`

---

### Task 3: Fix dynamic style buttons in app/(tabs)/home.tsx

**Files:**
- Modify: `app/(tabs)/home.tsx` (lines 1396, 1523)

- [ ] **Step 1: Fix line 1396** — property picker rows with dynamic backgroundColor

```tsx
style={({ pressed }) => [
  {
    borderRadius: 18,
    marginBottom: 10,
    backgroundColor: selected ? "#e8fdf7" : "#f6faf9",
    borderWidth: 1.5,
    borderColor: selected ? "#006b55" : "rgba(193,200,197,0.3)",
  },
  pressed && { opacity: 0.85 },
]}
```

- [ ] **Step 2: Fix line 1523** — "Add new house" dashed button

```tsx
style={({ pressed }) => [
  {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#d4e4e0",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  pressed && { opacity: 0.6 },
]}
```

- [ ] **Step 3: Fix shadowColor "#000" at line 138 and 1715** — map marker shadows

Line 138: `shadowColor: "#022420"`, keep opacity as-is (selected ? 0.28 : 0.18 is acceptable with brand color)
Line 1715: `shadowColor: "#022420"` + `shadowOpacity: 0.12`

---

### Task 4: Fix dynamic style buttons in app/properties/new.tsx and edit.tsx

**Files:**
- Modify: `app/properties/new.tsx` (lines 1771, 1985, 2205)
- Modify: `app/properties/edit.tsx` (line 827)

- [ ] **Step 1: Fix properties/new.tsx line 1771** — close button 40×40 circle

The close button has shadowColor "#062a23" + opacity 0.12 — this is already acceptable (brand color, low opacity). The `opacity: pressed ? 0.75 : 1` in the object return is the bug. Fix:

```tsx
style={({ pressed }) => [
  {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#062a23",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  pressed && { opacity: 0.75 },
]}
```

- [ ] **Step 2: Fix line 1985** — search result list rows (transparent→brand bg)

```tsx
style={({ pressed }) => [
  {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: index < Math.min(searchResults.length, 6) - 1 ? 1 : 0,
    borderBottomColor: "rgba(6,42,35,0.08)",
    minHeight: 52,
  },
  pressed && { backgroundColor: "rgba(6,42,35,0.05)" },
]}
```

- [ ] **Step 3: Fix line 2205** — confirm location button (opacity-only Pressable inside styled View)

```tsx
style={({ pressed }) => [
  {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: 20,
  },
  pressed && { opacity: 0.88 },
]}
```

- [ ] **Step 4: Fix properties/edit.tsx line 827** — map picker inner Pressable

```tsx
style={({ pressed }) => [
  {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  pressed && { opacity: 0.88 },
]}
```

- [ ] **Step 5: Fix shadowColor "#000" at properties/edit.tsx line 1812**

`shadowColor: "#062a23"` + `shadowOpacity: 0.18` + `elevation: 6`

---

### Task 5: Fix dynamic style buttons in app/listing/index.tsx and app/onboarding/cleaner.tsx

**Files:**
- Modify: `app/listing/index.tsx` (line 2610)
- Modify: `app/onboarding/cleaner.tsx` (line 376)

- [ ] **Step 1: Fix listing/index.tsx line 2610** — delete listing button

```tsx
style={({ pressed }) => [
  {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: 10,
    marginTop: 24,
    marginBottom: 8,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    backgroundColor: "#fde7e7",
  },
  pressed && { opacity: 0.7 },
]}
```

- [ ] **Step 2: Fix onboarding/cleaner.tsx line 376** — city suggestion rows

```tsx
style={({ pressed }) => [
  {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: idx === 0 ? 0 : 1,
    borderTopColor: Colors.borderLight,
  },
  pressed && { backgroundColor: Colors.backgroundAlt },
]}
```

---

### Task 6: Fix shadowColor "#000" in profile, AnimatedToggle, ProfileStatCard

**Files:**
- Modify: `app/(tabs)/profile.tsx` (lines 182, 1342, 1598)
- Modify: `components/AnimatedToggle.tsx` (line 124)
- Modify: `components/profile/ProfileStatCard.tsx` (line 46)

- [ ] **Step 1: Fix profile.tsx shadows** — replace `shadowColor: "#000"` with `shadowColor: "#022420"` and reduce opacity where > 0.1

- [ ] **Step 2: Fix AnimatedToggle.tsx line 124** — `shadowColor: "#000"` + `shadowOpacity: 0.25` → `shadowColor: "#022420"` + `shadowOpacity: 0.08`

- [ ] **Step 3: Fix ProfileStatCard.tsx line 46** — same pattern

---

### Task 7: Final TypeScript check + Metro reload + commit

- [ ] **Step 1: TypeScript check**
```bash
cd /Users/ninomarianolai/CleanHomeRN && bunx tsc --noEmit
```

- [ ] **Step 2: Metro reload**
```bash
curl -X POST http://localhost:8081/reload
```

- [ ] **Step 3: Commit**
```bash
git add app/legal/privacy.tsx app/legal/terms.tsx app/legal/refund.tsx \
  app/listings/index.tsx "app/(tabs)/home.tsx" \
  app/properties/new.tsx app/properties/edit.tsx \
  app/listing/index.tsx app/onboarding/cleaner.tsx \
  "app/(tabs)/profile.tsx" components/AnimatedToggle.tsx \
  components/profile/ProfileStatCard.tsx
git commit -m "fix: convert Pressable dynamic-object styles to array pattern, fix shadow colors"
```
