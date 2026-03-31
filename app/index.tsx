import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { useAuth } from "../lib/auth";

// ─── Splash Screen ────────────────────────────────────────────────────────────
// Design: full-screen #022420, centered leaf icon + "CleanHome" serif +
// tagline uppercase + bottom "INIZIALIZZAZIONE" + ActivityIndicator

export default function SplashScreen() {
  const { isLoading, user, profile } = useAuth();
  const router = useRouter();

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.82);
  const bottomOpacity = useSharedValue(0);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const bottomStyle = useAnimatedStyle(() => ({
    opacity: bottomOpacity.value,
  }));

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    scale.value = withSpring(1, { damping: 18, stiffness: 200 });
    bottomOpacity.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(async () => {
      if (!user) {
        const hasOnboarded = await AsyncStorage.getItem("onboarding_completed");
        if (hasOnboarded) {
          router.replace("/(auth)/login");
        } else {
          router.replace("/onboarding/welcome");
        }
      } else if (!profile) {
        router.replace("/(auth)/role-selection");
      } else if (profile.active_role === "cleaner") {
        router.replace("/(tabs)/cleaner-home");
      } else {
        router.replace("/(tabs)/home");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isLoading, user, profile]);

  return (
    <View style={styles.container}>
      {/* Center content */}
      <Animated.View style={[styles.centerContent, contentStyle]}>
        {/* Rounded square icon */}
        <View style={styles.iconWrapper}>
          {/* Leaf icon — stylized text approximation */}
          <Text style={styles.leafEmoji}>🌿</Text>
          {/* Sparkle dot — top-right */}
          <View style={styles.sparkleDot} />
        </View>

        {/* Brand name — serif italic via fontWeight 700 + fontStyle italic */}
        <Text style={styles.brandName}>CleanHome</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>
          L'ECCELLENZA NELLA CURA DOMESTICA
        </Text>
      </Animated.View>

      {/* Bottom loading area */}
      <Animated.View style={[styles.bottomArea, bottomStyle]}>
        <Text style={styles.initLabel}>INIZIALIZZAZIONE</Text>
        <ActivityIndicator size="small" color="#00c896" style={styles.spinner} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#022420",
    alignItems: "center",
    justifyContent: "center",
  },
  centerContent: {
    alignItems: "center",
  },
  iconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: "#1a3a35",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    shadowColor: "#00c896",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 12,
  },
  leafEmoji: {
    fontSize: 36,
    lineHeight: 44,
  },
  sparkleDot: {
    position: "absolute",
    top: 13,
    right: 13,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00c896",
  },
  brandName: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    fontStyle: "italic",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  tagline: {
    color: "#6b9e96",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  bottomArea: {
    position: "absolute",
    bottom: 64,
    alignItems: "center",
  },
  initLabel: {
    color: "#3d6b62",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  spinner: {
    // ActivityIndicator default size "small" is fine
  },
});
