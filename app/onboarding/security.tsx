import { useCallback, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  ScrollView,
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
import { Colors, Spacing, Radius, Shadows, SpringConfig } from "../../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SecurityCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  delay: number;
}

// ─── Page Dots ────────────────────────────────────────────────────────────────

interface PageDotsProps {
  total: number;
  active: number;
}

function PageDots({ total, active }: PageDotsProps) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === active ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

// ─── Security Info Card ───────────────────────────────────────────────────────

function SecurityCard({ icon, title, description, delay }: SecurityCardProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(delay, withSpring(0, SpringConfig.entrance));
  }, []);

  return (
    <Animated.View style={[styles.securityCard, animStyle]}>
      <View style={styles.securityCardIconWrapper}>
        <Ionicons name={icon} size={22} color={Colors.accent} />
      </View>
      <View style={styles.securityCardText}>
        <Text style={styles.securityCardTitle}>{title}</Text>
        <Text style={styles.securityCardDescription}>{description}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Entrance animations
  const heroOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.85);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(30);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  useEffect(() => {
    heroOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    heroScale.value = withSpring(1, SpringConfig.entrance);
    contentOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
    );
    contentTranslateY.value = withDelay(200, withSpring(0, SpringConfig.entrance));
  }, []);

  const handleGetStarted = useCallback(async () => {
    try {
      await AsyncStorage.setItem("onboarding_completed", "true");
    } catch {
      // Storage failure is non-fatal — proceed to login anyway
    }
    router.replace("/(auth)/login");
  }, [router]);

  const handleTerms = useCallback(() => {
    // Placeholder — navigate to terms screen when available
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Dark hero area */}
      <Animated.View
        style={[
          styles.heroArea,
          { paddingTop: insets.top + Spacing.xl },
          heroStyle,
        ]}
      >
        {/* Shield icon with glow ring */}
        <View style={styles.shieldRing}>
          <View style={styles.shieldInner}>
            <Ionicons name="shield-checkmark" size={40} color={Colors.accent} />
          </View>
        </View>

        {/* Label */}
        <Text style={styles.heroLabel}>SECURITY FIRST</Text>

        {/* Title */}
        <Text style={styles.heroTitle}>Pagamenti{"\n"}Sicuri</Text>
      </Animated.View>

      {/* Content card */}
      <Animated.View
        style={[
          styles.contentCard,
          contentStyle,
          { paddingBottom: insets.bottom + Spacing.base },
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Description */}
          <Text style={styles.description}>
            La tua tranquillità è la nostra priorità. Ogni transazione è protetta
            da crittografia end-to-end di livello bancario.
          </Text>

          {/* Security cards */}
          <SecurityCard
            icon="lock-closed-outline"
            title="Transazioni Criptate"
            description="Dati protetti e mai condivisi con terze parti"
            delay={300}
          />
          <SecurityCard
            icon="shield-outline"
            title="Pagamenti Garantiti"
            description="Ricevi i tuoi compensi puntuali e automatici"
            delay={450}
          />

          {/* Page dots */}
          <PageDots total={3} active={2} />

          {/* Get Started button */}
          <Pressable
            onPress={handleGetStarted}
            style={({ pressed }) => [
              styles.getStartedButton,
              pressed && styles.getStartedButtonPressed,
            ]}
          >
            <Text style={styles.getStartedButtonText}>Inizia Ora</Text>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" />
          </Pressable>

          {/* Terms link */}
          <Pressable
            onPress={handleTerms}
            hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}
            style={styles.termsWrapper}
          >
            <Ionicons name="lock-closed" size={12} color={Colors.textTertiary} />
            <Text style={styles.termsText}>
              Termini e Condizioni di Sicurezza
            </Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },

  // Hero
  heroArea: {
    alignItems: "center",
    paddingBottom: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  shieldRing: {
    width: 88,
    height: 88,
    borderRadius: Radius.full,
    backgroundColor: "rgba(0, 200, 150, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  shieldInner: {
    width: 68,
    height: 68,
    borderRadius: Radius.full,
    backgroundColor: "rgba(0, 200, 150, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.accent,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.textOnDark,
    textAlign: "center",
    lineHeight: 40,
  },

  // Content card
  contentCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    flex: 1,
    ...Shadows.lg,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 28,
    paddingBottom: Spacing.base,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },

  // Security cards
  securityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  securityCardIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight ?? "#0d3b34",
    alignItems: "center",
    justifyContent: "center",
  },
  securityCardText: {
    flex: 1,
  },
  securityCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 3,
  },
  securityCardDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Dots
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginVertical: Spacing.xl,
  },
  dot: {
    height: 8,
    borderRadius: Radius.full,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.accent,
  },
  dotInactive: {
    width: 8,
    backgroundColor: Colors.outlineVariant,
  },

  // Buttons
  getStartedButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: Spacing.base,
    ...Shadows.md,
  },
  getStartedButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  getStartedButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  termsWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: Spacing.sm,
  },
  termsText: {
    fontSize: 12,
    color: Colors.textTertiary,
    textDecorationLine: "underline",
    letterSpacing: 0.2,
  },
});
