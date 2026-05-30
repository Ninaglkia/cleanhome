/**
 * Button — the single source of truth for primary actions across CleanHome.
 *
 * Replaces the per-screen, reinvented CTAs (different heights/colours/radii)
 * with one consistent component. Variants map to the design tokens in
 * lib/theme.ts; sizes give a fixed height so every "Paga"/"Continua"/"Salva"
 * looks identical app-wide (CLAUDE.md §6.1).
 */
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Colors, Radius, Spacing, SpringConfig } from "../../lib/theme";

export type ButtonVariant = "primary" | "dark" | "secondary" | "ghost" | "danger";
export type ButtonSize = "lg" | "md" | "sm";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
  /** When false the button hugs its content instead of filling the row. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const HEIGHTS: Record<ButtonSize, number> = { lg: 56, md: 48, sm: 40 };
const FONT_SIZES: Record<ButtonSize, number> = { lg: 16, md: 15, sm: 14 };
const ICON_SIZES: Record<ButtonSize, number> = { lg: 20, md: 18, sm: 16 };

function paletteFor(variant: ButtonVariant): {
  bg: string;
  fg: string;
  border?: string;
} {
  switch (variant) {
    case "dark":
      return { bg: Colors.primary, fg: Colors.textOnDark };
    case "secondary":
      return { bg: Colors.accentLight, fg: Colors.secondary };
    case "ghost":
      return { bg: "transparent", fg: Colors.secondary, border: Colors.border };
    case "danger":
      return { bg: Colors.error, fg: "#ffffff" };
    case "primary":
    default:
      return { bg: Colors.secondary, fg: Colors.textOnDark };
  }
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  loading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  fullWidth = true,
  style,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const isDisabled = disabled || loading;
  const palette = paletteFor(variant);
  const fg = palette.fg;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={isDisabled ? undefined : onPress}
      onPressIn={() => {
        if (!isDisabled) scale.value = withSpring(0.97, SpringConfig.press);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SpringConfig.press);
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        {
          height: HEIGHTS[size],
          backgroundColor: palette.bg,
          borderWidth: palette.border ? 1.5 : 0,
          borderColor: palette.border,
          width: fullWidth ? "100%" : undefined,
          // disabled (not loading) dims; loading keeps full colour + spinner
          opacity: disabled && !loading ? 0.45 : 1,
        },
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        // Inner row View — avoids the iOS Pressable flex-row layout bug.
        <View style={styles.inner}>
          {icon && iconPosition === "left" ? (
            <Ionicons name={icon} size={ICON_SIZES[size]} color={fg} />
          ) : null}
          <Text
            style={[styles.label, { color: fg, fontSize: FONT_SIZES[size] }]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {icon && iconPosition === "right" ? (
            <Ionicons name={icon} size={ICON_SIZES[size]} color={fg} />
          ) : null}
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  label: {
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

export default Button;
