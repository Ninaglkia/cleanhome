import { useState, useCallback, useEffect } from "react";
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
  Easing,
} from "react-native-reanimated";
import { Colors, Spacing, Radius, Shadows, SpringConfig } from "../../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = "client" | "cleaner" | "both";

interface RoleOption {
  id: UserRole;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: RoleOption[] = [
  {
    id: "client",
    title: "Cliente",
    description: "Cerco servizi di pulizia professionali",
    icon: "home-outline",
    color: Colors.secondary,
    bgColor: Colors.accentLight,
  },
  {
    id: "cleaner",
    title: "Pulitore",
    description: "Voglio offrire i miei servizi",
    icon: "briefcase-outline",
    color: Colors.cleanerPrimary,
    bgColor: Colors.cleanerAccentLight,
  },
  {
    id: "both",
    title: "Entrambi",
    description: "Esplora le opzioni",
    icon: "swap-horizontal-outline",
    color: Colors.primary,
    bgColor: Colors.backgroundAlt,
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

interface RoleCardProps {
  option: RoleOption;
  isSelected: boolean;
  onPress: (id: UserRole) => void;
}

function RoleCard({ option, isSelected, onPress }: RoleCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, SpringConfig.press);
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SpringConfig.press);
  }, []);

  const handlePress = useCallback(() => {
    onPress(option.id);
  }, [option.id, onPress]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[
          styles.roleCard,
          isSelected && styles.roleCardSelected,
          isSelected && { borderColor: option.color },
        ]}
      >
        {/* Icon */}
        <View
          style={[
            styles.roleIconWrapper,
            { backgroundColor: isSelected ? option.bgColor : Colors.backgroundAlt },
          ]}
        >
          <Ionicons
            name={option.icon}
            size={22}
            color={isSelected ? option.color : Colors.textSecondary}
          />
        </View>

        {/* Text */}
        <View style={styles.roleTextBlock}>
          <Text
            style={[
              styles.roleTitle,
              isSelected && { color: option.color },
            ]}
          >
            {option.title}
          </Text>
          <Text style={styles.roleDescription}>{option.description}</Text>
        </View>

        {/* Selected indicator */}
        <View
          style={[
            styles.roleRadio,
            isSelected && { backgroundColor: option.color, borderColor: option.color },
          ]}
        >
          {isSelected && (
            <Ionicons name="checkmark" size={12} color="#ffffff" />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedRole, setSelectedRole] = useState<UserRole>("client");

  // Entrance animations
  const imageOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(30);
  const contentOpacity = useSharedValue(0);

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  useEffect(() => {
    imageOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    contentOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    contentTranslateY.value = withSpring(0, SpringConfig.entrance);
  }, []);

  const handleSelectRole = useCallback((id: UserRole) => {
    setSelectedRole(id);
  }, []);

  const handleNext = useCallback(() => {
    router.push("/onboarding/features");
  }, [router]);

  const handleSkip = useCallback(() => {
    router.replace("/(auth)/login");
  }, [router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Skip button */}
      <Pressable
        onPress={handleSkip}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={[styles.skipButton, { top: insets.top + 12 }]}
      >
        <Text style={styles.skipText}>SALTA</Text>
      </Pressable>

      {/* Hero image area */}
      <Animated.View style={[styles.heroArea, imageStyle]}>
        <View style={styles.heroGradient}>
          <View style={styles.heroInner}>
            <Ionicons name="home" size={56} color={Colors.accent} />
            <Text style={styles.heroLabel}>CleanHome</Text>
          </View>
        </View>
      </Animated.View>

      {/* Content card */}
      <Animated.View style={[styles.contentCard, contentStyle]}>
        {/* Title */}
        <Text style={styles.title}>
          Come ti piacerebbe{"\n"}usare CleanHome?
        </Text>

        {/* Role options */}
        <View style={styles.rolesContainer}>
          {ROLE_OPTIONS.map((option) => (
            <RoleCard
              key={option.id}
              option={option}
              isSelected={selectedRole === option.id}
              onPress={handleSelectRole}
            />
          ))}
        </View>

        {/* Page dots */}
        <PageDots total={3} active={0} />

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

  // Skip
  skipButton: {
    position: "absolute",
    right: 20,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: Radius.full,
  },
  skipText: {
    color: Colors.textOnDark,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },

  // Hero
  heroArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
    maxHeight: 280,
  },
  heroGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  heroInner: {
    alignItems: "center",
    gap: 12,
  },
  heroLabel: {
    color: Colors.textOnDark,
    fontSize: 20,
    fontWeight: "700",
    fontStyle: "italic",
    letterSpacing: 0.5,
  },

  // Content card
  contentCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.xl,
    paddingTop: 32,
    paddingBottom: Platform.OS === "ios" ? 0 : Spacing.xl,
    flex: 1.4,
    ...Shadows.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.xl,
    lineHeight: 32,
  },

  // Role cards
  rolesContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  roleCardSelected: {
    backgroundColor: Colors.surface,
    ...Shadows.md,
  },
  roleIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  roleTextBlock: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 2,
  },
  roleDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  roleRadio: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
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

  // Next button
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
});
