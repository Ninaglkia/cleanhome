// ============================================================================
// Screen: Pre-login marketing tour — slide 1 of 2 ("Prenotazione Semplice")
// ----------------------------------------------------------------------------
// First-time visitors see this after the splash screen. The slide explains
// the core value proposition (find and book a vetted cleaner in seconds)
// with a Lottie booking animation instead of a generic stock hero photo.
// Swipes to security.tsx on "Avanti" or jumps to /login on "Ho già un
// account".
// ============================================================================

import { useCallback, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from "react-native-reanimated";

const C = {
  bg: "#f6faf9",
  surface: "#ffffff",
  primary: "#022420",
  secondary: "#006b55",
  accent: "#00c896",
  accentLight: "#e8fdf7",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outlineVariant: "#c1c8c5",
} as const;

export default function FeaturesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);

  // Staggered entrance animations — hero pops in first, then content, then CTA
  const heroOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.92);
  const textOpacity = useSharedValue(0);
  const textTranslate = useSharedValue(16);
  const ctaOpacity = useSharedValue(0);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslate.value }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value }));

  useEffect(() => {
    heroOpacity.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
    heroScale.value = withSpring(1, { damping: 20, stiffness: 180 });
    textOpacity.value = withDelay(250, withTiming(1, { duration: 500 }));
    textTranslate.value = withDelay(
      250,
      withSpring(0, { damping: 18, stiffness: 160 })
    );
    ctaOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
  }, []);

  const handleNext = useCallback(() => {
    router.push("/onboarding/security");
  }, [router]);

  // "I already have an account" — push (not replace) so the user can come
  // back to continue the tour if they changed their mind.
  const handleAlreadyHaveAccount = useCallback(() => {
    router.push("/(auth)/login");
  }, [router]);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Brand bar ── */}
      <View style={styles.brandBar}>
        <View style={styles.brandLeft}>
          <Ionicons name="leaf" size={20} color={C.primary} />
          <Text style={styles.brandText}>CleanHome</Text>
        </View>
      </View>

      {/* ── Hero Lottie ── */}
      <Animated.View style={[styles.heroWrap, heroStyle]}>
        <View style={styles.heroCircleGlow} />
        <LottieView
          ref={lottieRef}
          source={require("../../assets/lottie/booking.json")}
          autoPlay
          loop
          style={styles.lottie}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Text block ── */}
      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={styles.eyebrow}>L'ARTE DELLA CURA</Text>
        <Text style={styles.headline}>
          Prenotazione{"\n"}in un tocco
        </Text>
        <Text style={styles.body}>
          Dimentica le lunghe attese. Trova professionisti verificati della
          pulizia nella tua zona e prenota in pochi secondi — esattamente quando
          ne hai bisogno.
        </Text>
      </Animated.View>

      {/* ── Dots ── */}
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotOn]} />
        <View style={[styles.dot, styles.dotOff]} />
      </View>

      {/* ── Buttons ── */}
      <Animated.View style={[styles.buttons, ctaStyle]}>
        <View style={styles.ctaBtnOuter}>
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              styles.ctaBtnTap,
              pressed && { opacity: 0.92 },
            ]}
          >
            <Text style={styles.ctaText}>Avanti</Text>
            <Ionicons name="arrow-forward" size={20} color="#ffffff" />
          </Pressable>
        </View>

        <Pressable
          onPress={handleAlreadyHaveAccount}
          style={({ pressed }) => [
            styles.altBtn,
            pressed && { opacity: 0.6 },
          ]}
          hitSlop={8}
        >
          <Text style={styles.altText}>Ho già un account — Accedi</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 24,
  },

  // --- Brand bar ---
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  brandLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: {
    fontSize: 20,
    fontWeight: "900",
    color: C.primary,
    letterSpacing: -0.3,
  },

  // --- Hero ---
  heroWrap: {
    flex: 5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  heroCircleGlow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: C.accentLight,
    opacity: 0.6,
  },
  lottie: {
    width: 320,
    height: 320,
  },

  // --- Text ---
  textBlock: {
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: C.secondary,
    letterSpacing: 3.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  headline: {
    fontSize: 34,
    fontWeight: "900",
    color: C.primary,
    lineHeight: 40,
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: C.onSurfaceVariant,
    lineHeight: 22,
  },

  // --- Dots ---
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotOn: {
    width: 28,
    backgroundColor: C.secondary,
  },
  dotOff: {
    width: 6,
    backgroundColor: C.outlineVariant,
  },

  // --- Buttons ---
  buttons: {
    gap: 8,
  },
  ctaBtnOuter: {
    backgroundColor: C.primary,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaBtnTap: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  altBtn: {
    alignItems: "center",
    paddingVertical: 14,
  },
  altText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.secondary,
    letterSpacing: 0.2,
  },
});
