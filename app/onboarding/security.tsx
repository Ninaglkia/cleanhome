// ============================================================================
// Screen: Pre-login marketing tour — slide 2 of 2 ("Pagamenti Sicuri")
// ----------------------------------------------------------------------------
// Second and final marketing slide. Explains trust-and-safety: payments are
// escrowed by Stripe, cleaners are vetted, and the client is protected end
// to end. Uses a Lottie security animation instead of a stock image. The
// CTA marks the onboarding as seen (so the tour never shows again) and
// forwards to the login screen.
// ============================================================================

import { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LottieView from "lottie-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from "react-native-reanimated";

// Keep in sync with app/index.tsx
const ONBOARDING_SEEN_KEY = "cleanhome.onboarding_seen";

const C = {
  bg: "#f6faf9",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  primary: "#022420",
  primaryContainer: "#1a3a35",
  secondary: "#006b55",
  accent: "#00c896",
  accentLight: "#e8fdf7",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outlineVariant: "#c1c8c5",
} as const;

interface BulletProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  delay: number;
}

function Bullet({ icon, title, description, delay }: BulletProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(
      delay,
      withSpring(0, { damping: 18, stiffness: 160 })
    );
  }, []);

  return (
    <Animated.View style={[styles.bullet, animStyle]}>
      <View style={styles.bulletIcon}>
        <Ionicons name={icon} size={20} color={C.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bulletTitle}>{title}</Text>
        <Text style={styles.bulletDescription}>{description}</Text>
      </View>
    </Animated.View>
  );
}

export default function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);

  const heroOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.9);
  const headlineOpacity = useSharedValue(0);
  const headlineTranslate = useSharedValue(16);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));
  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headlineOpacity.value,
    transform: [{ translateY: headlineTranslate.value }],
  }));

  useEffect(() => {
    heroOpacity.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
    heroScale.value = withSpring(1, { damping: 20, stiffness: 180 });
    headlineOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    headlineTranslate.value = withDelay(
      200,
      withSpring(0, { damping: 18, stiffness: 160 })
    );
  }, []);

  // Final CTA of the marketing tour — persist "seen" flag so the tour
  // never re-triggers from app/index.tsx, then forward to login.
  const handleGetStarted = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    } catch {
      // Storage failure is non-fatal — worst case the tour shows again
      // next time, which is a harmless redundancy.
    }
    router.replace("/(auth)/login");
  }, [router]);

  const handleBack = useCallback(() => {
    // Guard against an empty back stack — security.tsx can be entered
    // directly via deep link or after a hot reload with state reset.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/onboarding/features");
    }
  }, [router]);

  const handleAlreadyHaveAccount = useCallback(() => {
    handleGetStarted();
  }, [handleGetStarted]);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Brand bar with back ── */}
      <View style={styles.brandBar}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
          <Text style={styles.backText}>Indietro</Text>
        </Pressable>
        <View style={styles.brandRight}>
          <Ionicons name="leaf" size={20} color={C.primary} />
          <Text style={styles.brandText}>CleanHome</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Lottie ── */}
        <Animated.View style={[styles.heroWrap, heroStyle]}>
          <View style={styles.heroCircleGlow} />
          <LottieView
            ref={lottieRef}
            source={require("../../assets/lottie/security.json")}
            autoPlay
            loop
            style={styles.lottie}
            resizeMode="contain"
          />
        </Animated.View>

        {/* ── Headline ── */}
        <Animated.View style={[styles.textBlock, headlineStyle]}>
          <Text style={styles.eyebrow}>TRANQUILLITÀ GARANTITA</Text>
          <Text style={styles.headline}>Pagamenti{"\n"}Sicuri</Text>
          <Text style={styles.body}>
            Ogni pagamento è protetto da <Text style={styles.bodyBold}>Stripe</Text> con
            crittografia di livello bancario. I tuoi soldi restano in
            <Text style={styles.bodyBold}> escrow</Text> e vengono rilasciati al
            pulitore solo dopo la tua conferma o automaticamente 48 ore dopo il
            completamento.
          </Text>
        </Animated.View>

        {/* ── Trust bullets ── */}
        <View style={styles.bullets}>
          <Bullet
            icon="lock-closed-outline"
            title="Fondi protetti in escrow"
            description="Hai 48 ore dopo il completamento per confermare o segnalare un problema. Senza la tua conferma, il pagamento non parte."
            delay={500}
          />
          <Bullet
            icon="shield-checkmark-outline"
            title="Professionisti verificati"
            description="Ogni pulitore passa un processo di verifica prima di poter offrire il servizio."
            delay={650}
          />
          <Bullet
            icon="refresh-outline"
            title="Rimborso garantito"
            description="Se qualcosa va storto, apri una segnalazione e ti rimborsiamo integralmente."
            delay={800}
          />
        </View>
      </ScrollView>

      {/* ── Dots ── */}
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotOff]} />
        <View style={[styles.dot, styles.dotOn]} />
      </View>

      {/* ── CTA ── */}
      <View style={styles.buttons}>
        <View style={styles.ctaBtnOuter}>
          <Pressable
            onPress={handleGetStarted}
            style={({ pressed }) => [
              styles.ctaBtnTap,
              pressed && { opacity: 0.92 },
            ]}
          >
            <Text style={styles.ctaText}>Inizia ora</Text>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 24,
  },

  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.primary,
  },
  brandRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: {
    fontSize: 20,
    fontWeight: "900",
    color: C.primary,
    letterSpacing: -0.3,
  },

  scroll: {
    paddingBottom: 12,
  },

  // --- Hero ---
  heroWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 220,
    marginTop: 16,
    marginBottom: 16,
  },
  heroCircleGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: C.accentLight,
    opacity: 0.6,
  },
  lottie: {
    width: 240,
    height: 240,
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
  bodyBold: {
    fontWeight: "800",
    color: C.primary,
  },

  // --- Bullets ---
  bullets: {
    gap: 12,
    marginBottom: 16,
  },
  bullet: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: C.surfaceLow,
    borderRadius: 14,
    padding: 16,
  },
  bulletIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.primary,
    marginBottom: 3,
  },
  bulletDescription: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    lineHeight: 18,
  },

  // --- Dots ---
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
    marginTop: 8,
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
    gap: 4,
  },
  ctaBtnOuter: {
    height: 56,
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
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
