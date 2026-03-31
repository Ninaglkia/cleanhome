import { useCallback, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { Colors, Spacing, Radius, Shadows, SpringConfig } from "../../lib/theme";

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

// ─── Feature Badge ────────────────────────────────────────────────────────────

interface FeatureBadgeProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  delay: number;
}

function FeatureBadge({ icon, label, delay }: FeatureBadgeProps) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(-16);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    translateX.value = withDelay(delay, withSpring(0, SpringConfig.entrance));
  }, []);

  return (
    <Animated.View style={[styles.featureBadge, animStyle]}>
      <Ionicons name={icon} size={16} color={Colors.accent} />
      <Text style={styles.featureBadgeText}>{label}</Text>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FeaturesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Entrance animations
  const mockupOpacity = useSharedValue(0);
  const mockupScale = useSharedValue(0.88);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(24);

  const mockupStyle = useAnimatedStyle(() => ({
    opacity: mockupOpacity.value,
    transform: [{ scale: mockupScale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  useEffect(() => {
    mockupOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    mockupScale.value = withSpring(1, SpringConfig.entrance);
    contentOpacity.value = withDelay(200, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    contentTranslateY.value = withDelay(200, withSpring(0, SpringConfig.entrance));
  }, []);

  const handleNext = useCallback(() => {
    router.push("/onboarding/security");
  }, [router]);

  const handleSkip = useCallback(() => {
    router.replace("/(auth)/login");
  }, [router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Hero mockup area */}
      <Animated.View style={[styles.heroArea, mockupStyle]}>
        {/* Phone mockup placeholder */}
        <View style={styles.phoneMockup}>
          <View style={styles.phoneScreen}>
            {/* Mini UI inside mockup */}
            <View style={styles.mockupTopBar}>
              <View style={styles.mockupDot} />
              <View style={[styles.mockupDot, { backgroundColor: Colors.accent }]} />
              <View style={styles.mockupDot} />
            </View>
            <View style={styles.mockupCard}>
              <View style={styles.mockupCardLine} />
              <View style={[styles.mockupCardLine, { width: "70%" }]} />
            </View>
            <View style={[styles.mockupCard, { backgroundColor: Colors.accentLight }]}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.secondary} />
              <View style={styles.mockupCardLine} />
            </View>
            <View style={styles.mockupCard}>
              <View style={[styles.mockupCardLine, { width: "60%" }]} />
              <View style={[styles.mockupCardLine, { width: "40%" }]} />
            </View>
          </View>
          {/* Phone notch */}
          <View style={styles.phoneNotch} />
        </View>

        {/* Floating badges */}
        <View style={styles.floatingBadgeTopRight}>
          <FeatureBadge icon="flash-outline" label="Prenotazione rapida" delay={400} />
        </View>
        <View style={styles.floatingBadgeBottomLeft}>
          <FeatureBadge icon="star-outline" label="Professionisti certificati" delay={600} />
        </View>
      </Animated.View>

      {/* Content card */}
      <Animated.View
        style={[
          styles.contentCard,
          contentStyle,
          { paddingBottom: insets.bottom + Spacing.base },
        ]}
      >
        {/* Label */}
        <Text style={styles.label}>L'ARTE DELLA CURA</Text>

        {/* Title */}
        <Text style={styles.title}>Prenotazione{"\n"}Semplice</Text>

        {/* Description */}
        <Text style={styles.description}>
          Dimentica le lunghe attese. Trova i migliori professionisti certificati
          della pulizia e prenota il tuo servizio in pochi tocchi, esattamente
          quando ne hai bisogno.
        </Text>

        {/* Page dots */}
        <PageDots total={3} active={1} />

        {/* Next button */}
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.nextButton,
            pressed && styles.nextButtonPressed,
          ]}
        >
          <Text style={styles.nextButtonText}>Avanti</Text>
          <Ionicons name="arrow-forward" size={18} color="#ffffff" />
        </Pressable>

        {/* Skip link */}
        <Pressable
          onPress={handleSkip}
          hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}
          style={styles.skipWrapper}
        >
          <Text style={styles.skipText}>SALTA</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Hero
  heroArea: {
    flex: 1.1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingVertical: Spacing.xl,
  },

  // Phone mockup
  phoneMockup: {
    width: 160,
    height: 300,
    backgroundColor: Colors.primary,
    borderRadius: 28,
    padding: 3,
    ...Shadows.lg,
    alignItems: "center",
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 26,
    padding: 10,
    gap: 8,
    overflow: "hidden",
  },
  phoneNotch: {
    position: "absolute",
    top: 10,
    width: 50,
    height: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  mockupTopBar: {
    flexDirection: "row",
    gap: 4,
    marginTop: 14,
    marginBottom: 4,
  },
  mockupDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
  },
  mockupCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 8,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
    ...Shadows.sm,
  },
  mockupCardLine: {
    flex: 1,
    height: 7,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
  },

  // Floating badges
  floatingBadgeTopRight: {
    position: "absolute",
    right: 20,
    top: "25%",
  },
  floatingBadgeBottomLeft: {
    position: "absolute",
    left: 20,
    bottom: "20%",
  },
  featureBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingVertical: 8,
    paddingHorizontal: 12,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  featureBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: 0.2,
  },

  // Content card
  contentCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.xl,
    paddingTop: 28,
    flex: 1,
    ...Shadows.lg,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.accent,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.text,
    lineHeight: 36,
    marginBottom: Spacing.base,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },

  // Dots
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: Spacing.xl,
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
  nextButton: {
    backgroundColor: Colors.secondary,
    borderRadius: Radius.lg,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: Spacing.base,
    ...Shadows.md,
  },
  nextButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  nextButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  skipWrapper: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skipText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
});
