import { useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../lib/auth";

// AsyncStorage key that records whether the user has seen the pre-login
// marketing onboarding. Set when the user taps the CTA on the last slide
// of the tour. Guards against re-showing the tour on every cold start.
const ONBOARDING_SEEN_KEY = "cleanhome.onboarding_seen";

const { width: SCREEN_W } = Dimensions.get("window");
const PROGRESS_BAR_WIDTH = 48;

// Keep native splash visible until we're ready
SplashScreen.preventAutoHideAsync();

export default function SplashScreenView() {
  const { isLoading, user, profile } = useAuth();
  const router = useRouter();

  const opacity = useSharedValue(1); // Start visible immediately
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.4);
  const progressWidth = useSharedValue(0);
  const bottomOpacity = useSharedValue(1);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const bottomStyle = useAnimatedStyle(() => ({
    opacity: bottomOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: progressWidth.value,
  }));

  // Hide native splash as soon as our view mounts
  const onLayoutReady = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    // Animate progress bar from 0 → 70% quickly, then slow to ~90%
    progressWidth.value = withSequence(
      withTiming(PROGRESS_BAR_WIDTH * 0.7, {
        duration: 1500,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(PROGRESS_BAR_WIDTH * 0.9, {
        duration: 1000,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, []);

  useEffect(() => {
    if (isLoading) return;

    // Data loaded — fill the progress bar a bit more slowly so the splash
    // doesn't feel rushed. Users barely see the brand at 600ms: 1.6s of
    // fill + 200ms pause reads as intentional branding without being slow.
    progressWidth.value = withTiming(
      PROGRESS_BAR_WIDTH,
      { duration: 1600, easing: Easing.out(Easing.cubic) }
    );

    const timer = setTimeout(async () => {
      if (!user) {
        // Not authenticated. First-time visitors see the marketing tour
        // (features → security → login) while returning visitors skip
        // straight to the login screen. The AsyncStorage flag is set
        // when the user completes the tour, so it only shows once.
        let seen = false;
        try {
          seen = (await AsyncStorage.getItem(ONBOARDING_SEEN_KEY)) === "true";
        } catch {
          // Storage failure is non-fatal — treat as "not seen" so the
          // user at least sees the tour in the worst case.
          seen = false;
        }
        router.replace(seen ? "/(auth)/login" : "/onboarding/features");
      } else if (!profile || !profile.cleaner_onboarded) {
        // First login OR profile row not yet created by the DB trigger.
        // Both go to /onboarding/welcome which collects the role AND
        // marks the profile as onboarded in a single unified flow.
        router.replace("/onboarding/welcome");
      } else if (profile.active_role === "cleaner") {
        router.replace("/(tabs)/cleaner-home");
      } else {
        router.replace("/(tabs)/home");
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [isLoading, user, profile]);

  return (
    <View style={styles.container} onLayout={onLayoutReady}>
      {/* Ambient glow */}
      <Animated.View style={[styles.glowTopLeft, glowStyle]} />
      <Animated.View style={[styles.glowBottomRight, glowStyle]} />

      {/* Center content — visible immediately */}
      <Animated.View style={[styles.centerContent, contentStyle]}>
        {/* Logo icon */}
        <View style={styles.iconWrapper}>
          <View style={styles.iconInnerGlow} />
          <Ionicons name="leaf" size={52} color="#4fc4a3" />
          <View style={styles.sparkleWrap}>
            <Ionicons name="sparkles" size={18} color="#4fc4a3" />
          </View>
        </View>

        {/* Brand name */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="leaf" size={28} color="#022420" />
          <Text style={styles.brandName}>CleanHome</Text>
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>
          L'eccellenza nella cura domestica
        </Text>
      </Animated.View>

      {/* Bottom — progress bar + label */}
      <Animated.View style={[styles.bottomArea, bottomStyle]}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>
        <Text style={styles.initLabel}>Inizializzazione</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a3a35",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  glowTopLeft: {
    position: "absolute",
    top: "-10%",
    left: "-10%",
    width: SCREEN_W * 0.7,
    height: SCREEN_W * 0.7,
    borderRadius: SCREEN_W * 0.35,
    backgroundColor: "rgba(79, 196, 163, 0.08)",
  },
  glowBottomRight: {
    position: "absolute",
    bottom: "-10%",
    right: "-10%",
    width: SCREEN_W * 0.6,
    height: SCREEN_W * 0.6,
    borderRadius: SCREEN_W * 0.3,
    backgroundColor: "rgba(79, 196, 163, 0.04)",
  },
  centerContent: {
    alignItems: "center",
  },
  iconWrapper: {
    width: 128,
    height: 128,
    borderRadius: 16,
    backgroundColor: "rgba(2, 36, 32, 0.20)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "rgba(130, 244, 209, 0.10)",
  },
  iconInnerGlow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(79, 196, 163, 0.10)",
  },
  sparkleWrap: {
    position: "absolute",
    top: -4,
    right: -4,
  },
  brandName: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  tagline: {
    color: "#83a49d",
    fontSize: 18,
    fontWeight: "500",
    letterSpacing: 3.5,
    textTransform: "uppercase",
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 26,
  },
  bottomArea: {
    position: "absolute",
    bottom: 80,
    alignItems: "center",
    gap: 16,
  },
  progressTrack: {
    width: PROGRESS_BAR_WIDTH,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(130, 244, 209, 0.30)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#4fc4a3",
    borderRadius: 1,
  },
  initLabel: {
    color: "rgba(79, 196, 163, 0.60)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 4,
    textTransform: "uppercase",
  },
});
