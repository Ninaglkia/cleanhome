/**
 * ProfileCompletionBar.tsx
 *
 * Persistent banner shown at the top of home/cleaner-home when the user's
 * profile is incomplete. Inspired by Revolut's account-setup nudges —
 * always visible but never blocking, always actionable.
 *
 * Visual anatomy:
 *   [icon_circle] [text_stack: title + subtitle + progress_bar] [arrow]
 *
 * The progress bar fills with a spring animation on mount.
 * The whole card presses with scale 0.98.
 * Auto-hides when percent === 100.
 */

import { useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";

// ─── Design tokens ────────────────────────────────────────────────────────────

const DARK_GREEN = "#022420";
const MINT = "#3ee0a8";
const MINT_BG = "#e8fdf7";
const MINT_BORDER = "#b8f0dc";
const TEXT_PRIMARY = "#022420";
const TEXT_SECONDARY = "#4a6660";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ProfileCompletionBarProps {
  percent: number;          // 0–100
  subtitle: string;         // first missing step label, e.g. "Aggiungi un indirizzo casa"
  onPress: () => void;      // navigate to profile or specific section
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileCompletionBar({
  percent,
  subtitle,
  onPress,
}: ProfileCompletionBarProps) {
  // Don't render if complete
  if (percent >= 100) return null;

  const progressWidth = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const mountOpacity = useSharedValue(0);

  useEffect(() => {
    // Fade card in
    mountOpacity.value = withTiming(1, { duration: 340 });
    // Animate progress bar fill with a spring feel
    progressWidth.value = withSpring(percent / 100, {
      damping: 22,
      stiffness: 120,
      mass: 0.9,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percent]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progressWidth.value, [0, 1], [0, 100])}%` as `${number}%`,
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: mountOpacity.value,
  }));

  const handlePressIn = () => {
    cardScale.value = withSpring(0.98, { damping: 18, stiffness: 280 });
  };

  const handlePressOut = () => {
    cardScale.value = withSpring(1, { damping: 18, stiffness: 280 });
  };

  // Icon color: orange when low (<40%), amber when mid (40-79%), mint when high (>= 80%)
  const iconColor =
    percent < 40 ? "#d97706" : percent < 80 ? "#f59e0b" : MINT;
  const iconBg =
    percent < 40 ? "#fef3c7" : percent < 80 ? "#fefce8" : MINT_BG;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`Completa il tuo profilo, ${percent}% completato. ${subtitle}`}
    >
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        {/* Left: icon */}
        <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
          <Ionicons name="person-circle-outline" size={22} color={iconColor} />
        </View>

        {/* Center: text + bar */}
        <View style={styles.textColumn}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Completa il profilo</Text>
            <Text style={styles.percent}>{percent}%</Text>
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>

          {/* Progress track */}
          <View style={styles.trackOuter}>
            <Animated.View style={[styles.trackFill, progressBarStyle]} />
          </View>
        </View>

        {/* Right: arrow */}
        <View style={styles.arrowWrap}>
          <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: MINT_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MINT_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    shadowColor: DARK_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textColumn: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    letterSpacing: -0.1,
  },
  percent: {
    fontSize: 13,
    fontWeight: "800",
    color: DARK_GREEN,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "500",
    color: TEXT_SECONDARY,
    lineHeight: 15,
    marginBottom: 6,
  },
  trackOuter: {
    height: 4,
    backgroundColor: "#c6ede0",
    borderRadius: 2,
    overflow: "hidden",
  },
  trackFill: {
    height: "100%",
    backgroundColor: MINT,
    borderRadius: 2,
  },
  arrowWrap: {
    flexShrink: 0,
    width: 24,
    alignItems: "center",
  },
});
