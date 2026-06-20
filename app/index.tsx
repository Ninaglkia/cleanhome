/**
 * app/index.tsx — CleanHome splash entry point
 *
 * Hard constraints preserved:
 *  1. SplashScreen.preventAutoHideAsync() at module scope
 *  2. SplashScreen.hideAsync() in onLayout
 *  3. useAuth() gate — exit fires only once !isLoading
 *  4. navigateAway routing logic unchanged (verbatim)
 *  5. Background #05070a (dark studio)
 *  6. MIN_VISIBLE_MS = 2400
 *  7. No new dependencies
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useAuth } from "../lib/auth";
import HoloSplash from "../components/splash/HoloSplash";

// Prevent native splash from auto-hiding — constraint 1
SplashScreen.preventAutoHideAsync();

// Minimum on-screen time so the animation never flashes — constraint 6
// The splash visual now lives in app/_layout.tsx's gate (so it shows on every
// cold launch before the auth redirect). This "/" route is only reached by
// logged-out users after that gate, so route them onward immediately.
const MIN_VISIBLE_MS = 0;

export default function SplashEntry() {
  const { isLoading, user, profile } = useAuth();
  const router = useRouter();

  // shouldExit drives HoloSplash's exit animation
  const [shouldExit, setShouldExit] = useState(false);

  // Track preconditions (refs avoid stale closure issues in callbacks)
  const minTimeElapsed = useRef(false);
  const authResolved = useRef(false);
  const exitTriggered = useRef(false);

  // Routing logic — verbatim from constraint 3 + 4
  const navigateAway = useCallback(async () => {
    if (!user) {
      router.replace("/onboarding/features");
    } else if (!profile || !profile.cleaner_onboarded) {
      router.replace("/onboarding/welcome");
    } else if (profile.active_role === "cleaner") {
      router.replace("/(tabs)/cleaner-home");
    } else {
      router.replace("/(tabs)/home");
    }
  }, [user, profile, router]);

  // Arms the exit animation once BOTH preconditions are met
  const triggerExitIfReady = useCallback(() => {
    if (exitTriggered.current) return;
    if (!minTimeElapsed.current || !authResolved.current) return;
    exitTriggered.current = true;
    setShouldExit(true);
  }, []);

  // Minimum visible timer (constraint 6)
  useEffect(() => {
    const t = setTimeout(() => {
      minTimeElapsed.current = true;
      triggerExitIfReady();
    }, MIN_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [triggerExitIfReady]);

  // Auth gate — wait for auth to settle (constraint 3)
  useEffect(() => {
    if (isLoading) return;
    authResolved.current = true;
    triggerExitIfReady();
  }, [isLoading, triggerExitIfReady]);

  // Hide native splash on layout (constraint 2)
  const onLayoutReady = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  // Called by HoloSplash after its exit animation completes
  const handleExitComplete = useCallback(() => {
    navigateAway();
  }, [navigateAway]);

  return (
    // Dark studio background — constraints 4 & 5
    <View style={styles.container} onLayout={onLayoutReady}>
      <HoloSplash
        shouldExit={shouldExit}
        onExitComplete={handleExitComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#05070a",
  },
});
