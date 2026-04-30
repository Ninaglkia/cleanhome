import { useEffect, useCallback } from "react";
import { View, Text, Image, StyleSheet, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../lib/auth";

const ONBOARDING_SEEN_KEY = "cleanhome.onboarding_seen";
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

SplashScreen.preventAutoHideAsync();

// ─── Floating sparkle particle ────────────────────────────────────────────────

interface SparkleProps {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

function Sparkle({ x, y, size, delay, duration }: SparkleProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      )
    );
  }, [delay, duration, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 1, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -20]) },
      { scale: interpolate(progress.value, [0, 0.5, 1], [0.6, 1, 0.6]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.sparkle,
        { left: x, top: y, width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

// ─── Splash screen ────────────────────────────────────────────────────────────

export default function SplashScreenView() {
  const { isLoading, user, profile } = useAuth();
  const router = useRouter();

  // Animation values
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.7);
  const haloPulse = useSharedValue(0);
  const brandOpacity = useSharedValue(0);
  const brandTranslateY = useSharedValue(16);
  const taglineOpacity = useSharedValue(0);

  // Hide native splash as soon as our view mounts
  const onLayoutReady = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  // Entrance choreography
  useEffect(() => {
    // Logo: fade + scale up
    logoOpacity.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
    logoScale.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.back(1.4)),
    });

    // Halo: continuous breathing pulse
    haloPulse.value = withDelay(
      400,
      withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );

    // Brand name: slide-up + fade after logo
    brandOpacity.value = withDelay(
      500,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    );
    brandTranslateY.value = withDelay(
      500,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );

    // Tagline: fade in last
    taglineOpacity.value = withDelay(
      900,
      withTiming(0.8, { duration: 600, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  // Navigate when auth resolved.
  // Hold longer in dev (5s) so Nino can review the splash design.
  // Production cuts to 1.7s for a snappy launch feel.
  const HOLD_MS = __DEV__ ? 5000 : 1700;

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(async () => {
      if (!user) {
        let seen = false;
        try {
          seen = (await AsyncStorage.getItem(ONBOARDING_SEEN_KEY)) === "true";
        } catch {
          seen = false;
        }
        router.replace(seen ? "/(auth)/login" : "/onboarding/features");
      } else if (!profile || !profile.cleaner_onboarded) {
        router.replace("/onboarding/welcome");
      } else if (profile.active_role === "cleaner") {
        router.replace("/(tabs)/cleaner-home");
      } else {
        router.replace("/(tabs)/home");
      }
    }, HOLD_MS);

    return () => clearTimeout(timer);
  }, [isLoading, user, profile, HOLD_MS]);

  // Animated styles
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const haloOuterStyle = useAnimatedStyle(() => ({
    opacity: interpolate(haloPulse.value, [0, 1], [0.25, 0.55]),
    transform: [{ scale: interpolate(haloPulse.value, [0, 1], [1, 1.18]) }],
  }));

  const haloInnerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(haloPulse.value, [0, 1], [0.4, 0.7]),
    transform: [{ scale: interpolate(haloPulse.value, [0, 1], [1, 1.08]) }],
  }));

  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: brandTranslateY.value }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  // Sparkle positions: scattered around logo, off the central area
  const sparkles: SparkleProps[] = [
    { x: SCREEN_W * 0.18, y: SCREEN_H * 0.32, size: 4, delay: 600, duration: 2200 },
    { x: SCREEN_W * 0.78, y: SCREEN_H * 0.28, size: 3, delay: 900, duration: 2600 },
    { x: SCREEN_W * 0.12, y: SCREEN_H * 0.52, size: 5, delay: 1100, duration: 2400 },
    { x: SCREEN_W * 0.84, y: SCREEN_H * 0.55, size: 4, delay: 750, duration: 2800 },
    { x: SCREEN_W * 0.25, y: SCREEN_H * 0.7, size: 3, delay: 1300, duration: 2300 },
    { x: SCREEN_W * 0.7, y: SCREEN_H * 0.72, size: 5, delay: 800, duration: 2700 },
    { x: SCREEN_W * 0.5, y: SCREEN_H * 0.18, size: 3, delay: 1500, duration: 2500 },
    { x: SCREEN_W * 0.45, y: SCREEN_H * 0.85, size: 4, delay: 1700, duration: 2400 },
  ];

  return (
    <View style={styles.container} onLayout={onLayoutReady}>
      {/* Layered ambient blobs for depth (no gradient lib required) */}
      <View style={styles.bgBlobTop} />
      <View style={styles.bgBlobMid} />
      <View style={styles.bgBlobBottom} />

      {/* Floating sparkles in the background */}
      {sparkles.map((s, i) => (
        <Sparkle key={i} {...s} />
      ))}

      {/* Center brand block */}
      <View style={styles.centerContent}>
        {/* Logo with breathing halo */}
        <View style={styles.logoSlot}>
          <Animated.View style={[styles.haloOuter, haloOuterStyle]} />
          <Animated.View style={[styles.haloInner, haloInnerStyle]} />
          <Animated.View style={[styles.logoWrap, logoStyle]}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../assets/icon.png")}
              style={styles.logoImg}
            />
          </Animated.View>
        </View>

        {/* Brand wordmark */}
        <Animated.Text style={[styles.brandName, brandStyle]}>
          CleanHome
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, taglineStyle]}>
          La tua casa al meglio.{"\n"}Sempre.
        </Animated.Text>
      </View>

      {/* Subtle bottom shimmer */}
      <View style={styles.bottomShimmer} pointerEvents="none" />
    </View>
  );
}

const LOGO_SIZE = 96;
const HALO_OUTER_SIZE = 220;
const HALO_INNER_SIZE = 150;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#022420",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bgBlobTop: {
    position: "absolute",
    top: -SCREEN_W * 0.4,
    left: -SCREEN_W * 0.3,
    width: SCREEN_W * 1.2,
    height: SCREEN_W * 1.2,
    borderRadius: SCREEN_W * 0.6,
    backgroundColor: "rgba(79, 196, 163, 0.10)",
  },
  bgBlobMid: {
    position: "absolute",
    width: SCREEN_W * 0.9,
    height: SCREEN_W * 0.9,
    borderRadius: SCREEN_W * 0.45,
    backgroundColor: "rgba(26, 82, 72, 0.55)",
    top: SCREEN_H * 0.1,
    left: SCREEN_W * 0.05,
  },
  bgBlobBottom: {
    position: "absolute",
    bottom: -SCREEN_W * 0.3,
    right: -SCREEN_W * 0.3,
    width: SCREEN_W * 1.0,
    height: SCREEN_W * 1.0,
    borderRadius: SCREEN_W * 0.5,
    backgroundColor: "rgba(10, 58, 50, 0.6)",
  },
  centerContent: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
  logoSlot: {
    width: HALO_OUTER_SIZE,
    height: HALO_OUTER_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  haloOuter: {
    position: "absolute",
    width: HALO_OUTER_SIZE,
    height: HALO_OUTER_SIZE,
    borderRadius: HALO_OUTER_SIZE / 2,
    backgroundColor: "rgba(79, 196, 163, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(130, 244, 209, 0.10)",
  },
  haloInner: {
    position: "absolute",
    width: HALO_INNER_SIZE,
    height: HALO_INNER_SIZE,
    borderRadius: HALO_INNER_SIZE / 2,
    backgroundColor: "rgba(79, 196, 163, 0.18)",
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(130, 244, 209, 0.20)",
    shadowColor: "#82f4d1",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  logoImg: {
    width: LOGO_SIZE - 16,
    height: LOGO_SIZE - 16,
    borderRadius: 18,
  },
  brandName: {
    color: "#ffffff",
    fontSize: 44,
    fontWeight: "700",
    letterSpacing: -1,
    marginBottom: 16,
    textShadowColor: "rgba(130, 244, 209, 0.25)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  tagline: {
    color: "#82f4d1",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 4,
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 22,
  },
  sparkle: {
    position: "absolute",
    backgroundColor: "#82f4d1",
    shadowColor: "#82f4d1",
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  bottomShimmer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: "rgba(130, 244, 209, 0.06)",
    borderTopLeftRadius: SCREEN_W * 0.5,
    borderTopRightRadius: SCREEN_W * 0.5,
  },
});
