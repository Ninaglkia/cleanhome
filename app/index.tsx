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
import { useAuth } from "../lib/auth";

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

    // Data loaded — fill progress to 100% then navigate
    progressWidth.value = withTiming(
      PROGRESS_BAR_WIDTH,
      { duration: 400, easing: Easing.out(Easing.cubic) }
    );

    const timer = setTimeout(async () => {
      if (!user) {
        // Non loggato → sempre login prima di tutto
        router.replace("/(auth)/login");
      } else if (!profile) {
        // Profilo non ancora creato (trigger in corso) — aspetta
        router.replace("/(auth)/role-selection");
      } else if (!profile.cleaner_onboarded) {
        // Primo accesso: profilo esiste ma onboarding non completato
        // → mostra le slides di benvenuto + scelta ruolo
        router.replace("/onboarding/welcome");
      } else if (profile.active_role === "cleaner") {
        router.replace("/(tabs)/cleaner-home");
      } else {
        router.replace("/(tabs)/home");
      }
    }, 600);

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
