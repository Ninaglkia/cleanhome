import { useCallback, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  ScrollView,
  Dimensions,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from "react-native-reanimated";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Design tokens — Stitch HTML onboarding_step_3 ────────────────────────────
const C = {
  background: "#f6faf9",          // surface
  surface: "#ffffff",             // surface-container-lowest
  surfaceLow: "#f0f4f3",          // surface-container-low
  primary: "#022420",
  primaryContainer: "#1a3a35",    // bg del CTA
  onPrimaryContainer: "#83a49d",  // testo del CTA
  secondary: "#006b55",           // dot attivo step 3 = bg-secondary
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outlineVariant: "#c1c8c5",
} as const;

// Immagine hero dallo Stitch HTML (usata con mix-blend-overlay opacity-60)
const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBTiRIg8XYOASJ2QmIYFVZUlNB_4MRnwP83nj81_lIgfy5GPwgfIkCGCscxyu79JW7lfqIuoKZcHgAoc0AdLhOIf4BLLAkm_7OXmKU8ZbRR0ty3zaavs2BoT9gSbw2XcUjWleoy1mDbl9J8f4ukpkP1UoEgkX77qj8LTGKJvNIDA_5YGNjdrbhAkQH5LvpxpbKxwwCFKwWpawNcPmFfPWGjuiq7OkLCSv7VwFIiuEw6MKZkUaEgv_L3t52qf4_Ydv-OugxpkPdA8bs";

// ─── Page Dots ────────────────────────────────────────────────────────────────

function PageDots({ active }: { active: number }) {
  return (
    <View style={styles.dotsRow}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[styles.dot, i === active ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

// ─── Feature Card ─────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  delay: number;
}

function FeatureCard({ icon, title, description, delay }: FeatureCardProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 18, stiffness: 160 }));
  }, []);

  return (
    <Animated.View style={[styles.featureCard, animStyle]}>
      <Ionicons name={icon} size={22} color={C.secondary} />
      <View style={styles.featureCardText}>
        <Text style={styles.featureCardTitle}>{title}</Text>
        <Text style={styles.featureCardDescription}>{description}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const heroOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.88);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(20);
  const contentOpacity = useSharedValue(0);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  useEffect(() => {
    heroOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    heroScale.value = withSpring(1, { damping: 20, stiffness: 180 });
    cardOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
    cardTranslateY.value = withDelay(300, withSpring(0, { damping: 18, stiffness: 160 }));
    contentOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
  }, []);

  const handleGetStarted = useCallback(async () => {
    try {
      await AsyncStorage.setItem("onboarding_completed", "true");
    } catch {
      // storage failure non è fatale
    }
    router.replace("/(auth)/login");
  }, [router]);

  // Larghezza hero card = 4/5 dello schermo (w-4/5 nel HTML)
  const heroCardW = SCREEN_W * 0.8;
  const heroCardH = heroCardW * (5 / 4); // aspect-[4/5]

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Asymmetric hero section ── */}
        <View style={[styles.heroSection, { marginBottom: 64 }]}>
          {/* Dark primary-container card con immagine overlay */}
          <Animated.View
            style={[
              styles.heroImageCard,
              { width: heroCardW, height: heroCardH },
              heroStyle,
            ]}
          >
            {/* Immagine con effetto mix-blend-overlay opacity-60 */}
            <Image
              source={{ uri: HERO_IMAGE }}
              style={styles.heroImageOverlay}
              resizeMode="cover"
            />
            {/* Shield icon centrato con ring traslucido */}
            <View style={styles.shieldContainer}>
              <View style={styles.shieldRing}>
                <Ionicons name="shield-checkmark" size={56} color="#ffffff" />
              </View>
            </View>
          </Animated.View>

          {/* Overlapping editorial text card — bottom-right ── */}
          {/* HTML: absolute -bottom-6 -right-2 w-2/3 */}
          <Animated.View
            style={[
              styles.overlappingCard,
              { width: SCREEN_W * 0.62 },
              cardStyle,
            ]}
          >
            <Text style={styles.overlappingEyebrow}>Security First</Text>
            <Text style={styles.overlappingTitle}>Pagamenti{"\n"}Sicuri</Text>
          </Animated.View>
        </View>

        {/* ── Content ── */}
        <Animated.View style={[styles.contentArea, contentStyle]}>
          <Text style={styles.description}>
            La tua tranquillità è la nostra priorità. Ogni transazione è protetta
            da{" "}
            <Text style={styles.descriptionBold}>crittografia end-to-end</Text>
            {" "}di livello bancario.
          </Text>

          <FeatureCard
            icon="lock-closed-outline"
            title="Transazioni Criptate"
            description="Dati protetti e mai condivisi con terze parti."
            delay={500}
          />
          <FeatureCard
            icon="wallet-outline"
            title="Pagamenti Garantiti"
            description="Ricevi i tuoi compensi in modo puntuale e automatico."
            delay={650}
          />
        </Animated.View>

        {/* ── Footer ── */}
        <View style={styles.footerArea}>
          {/* Progress dots — step 3 active (index 2), dot attivo = bg-secondary */}
          <PageDots active={2} />

          {/* Back button */}
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#022420" />
            <Text style={styles.backText}>Indietro</Text>
          </Pressable>

          {/* CTA "Get Started" — bg primary-container (#1a3a35), testo on-primary-container (#83a49d) */}
          <View style={styles.ctaBtnOuter}>
            <Pressable
              onPress={handleGetStarted}
              style={styles.ctaBtnTap}
            >
              <Text style={styles.ctaText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={20} color={C.onPrimaryContainer} />
            </Pressable>
          </View>

          {/* Terms link */}
          <Pressable
            hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}
            style={styles.termsWrapper}
          >
            <Text style={styles.termsText}>Termini e Condizioni di Sicurezza</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },

  // ── Hero section ──────────────────────────────────────────────────────────────
  heroSection: {
    position: "relative",
  },
  heroImageCard: {
    backgroundColor: C.primaryContainer,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 14,
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
  },
  shieldContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  shieldRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
  },

  // ── Overlapping text card ─────────────────────────────────────────────────────
  // HTML: absolute -bottom-6 -right-2 z-20
  overlappingCard: {
    position: "absolute",
    bottom: -24,
    right: -8,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 28,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(193, 200, 197, 0.10)",
    gap: 6,
  },
  overlappingEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    color: C.secondary,
    letterSpacing: 3.5,
    textTransform: "uppercase",
  },
  overlappingTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: C.primary,
    lineHeight: 34,
    letterSpacing: -0.5,
  },

  // ── Content ───────────────────────────────────────────────────────────────────
  contentArea: {
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: C.onSurfaceVariant,
    lineHeight: 26,
    marginBottom: 20,
  },
  descriptionBold: {
    fontWeight: "700",
    color: C.primary,
  },

  // ── Feature cards ─────────────────────────────────────────────────────────────
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: C.surfaceLow,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  featureCardText: {
    flex: 1,
  },
  featureCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.primary,
    marginBottom: 4,
  },
  featureCardDescription: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    lineHeight: 18,
  },

  // ── Footer ────────────────────────────────────────────────────────────────────
  footerArea: {
    paddingTop: 16,
    alignItems: "center",
  },

  // ── Progress dots — step 3 dot attivo = bg-secondary ─────────────────────────
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 24,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 32,
    backgroundColor: C.secondary,   // bg-secondary = #006b55 ✓
  },
  dotInactive: {
    width: 6,
    backgroundColor: C.outlineVariant,
  },

  // ── Back button ────────────────────────────────────────────────────────────────
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    marginBottom: 6,
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#022420",
  },

  // ── CTA "Get Started" — bg primary-container, testo on-primary-container ──────
  ctaBtnOuter: {
    height: 54,
    backgroundColor: C.primaryContainer,   // #1a3a35
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 8,
  },
  ctaBtnTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaText: {
    color: C.onPrimaryContainer,            // #83a49d
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // ── Terms ──────────────────────────────────────────────────────────────────────
  termsWrapper: {
    paddingVertical: 12,
  },
  termsText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.onSurfaceVariant,
  },
});
