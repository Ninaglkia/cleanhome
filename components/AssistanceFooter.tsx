import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Colors, Spacing, Radius, Shadows, SpringConfig } from "../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssistanceFooterProps {
  onChatPress: () => void;
  onEmailPress: () => void;
  title?: string;
  subtitle?: string;
  /**
   * "default" — full padding card (24)
   * "compact" — tighter padding (20), used in dense pages
   */
  variant?: "default" | "compact";
  /** Optional override for the chat CTA copy (defaults to "Chat con noi") */
  chatLabel?: string;
  /** Optional override for the email CTA copy (defaults to "Scrivi email") */
  emailLabel?: string;
}

// ─── Animated CTA ─────────────────────────────────────────────────────────────

interface AnimatedCTAProps {
  variant: "primary" | "secondary";
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint: string;
}

function AnimatedCTA({
  variant,
  iconName,
  label,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: AnimatedCTAProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, SpringConfig.press);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, SpringConfig.press);
  };

  const isPrimary = variant === "primary";

  return (
    <Animated.View style={[styles.ctaWrap, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        android_ripple={
          isPrimary
            ? { color: "rgba(255,255,255,0.12)", borderless: false }
            : { color: "rgba(0,107,85,0.08)", borderless: false }
        }
        style={isPrimary ? styles.chatBtn : styles.emailBtn}
      >
        {/* Inner View — prevents iOS Pressable+flexDirection collapse bug
            when the style prop is a function (see payments/index.tsx InfoRow) */}
        <View style={styles.btnInner} pointerEvents="none">
          <Ionicons
            name={iconName}
            size={18}
            color={isPrimary ? Colors.textOnDark : Colors.secondary}
          />
          <Text
            style={isPrimary ? styles.chatBtnText : styles.emailBtnText}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>

        {/* Primary button — subtle top-edge highlight to simulate iOS light bevel */}
        {isPrimary && <View pointerEvents="none" style={styles.chatHighlight} />}
      </Pressable>
    </Animated.View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssistanceFooter({
  onChatPress,
  onEmailPress,
  title = "Hai bisogno di aiuto?",
  subtitle = "Il nostro team è disponibile 7 giorni su 7",
  variant = "default",
  chatLabel = "Chat con noi",
  emailLabel = "Scrivi email",
}: AssistanceFooterProps) {
  const isCompact = variant === "compact";

  return (
    <View
      style={[styles.card, isCompact && styles.cardCompact]}
      accessible={false}
    >
      {/* Icon chip — mint halo + solid chip stacked */}
      <View style={styles.iconWrap}>
        <View pointerEvents="none" style={styles.iconHalo} />
        <View style={styles.iconChip}>
          <Ionicons
            name="help-buoy-outline"
            size={26}
            color={Colors.secondary}
          />
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>

      {/* Subtitle */}
      <Text style={styles.subtitle} numberOfLines={2}>
        {subtitle}
      </Text>

      {/* Buttons row — side-by-side 50/50 */}
      <View style={styles.buttonsRow}>
        <AnimatedCTA
          variant="primary"
          iconName="chatbubble-ellipses-outline"
          label={chatLabel}
          onPress={onChatPress}
          accessibilityLabel="Apri la chat con il supporto"
          accessibilityHint="Avvia una conversazione in tempo reale con il team di assistenza"
        />
        <AnimatedCTA
          variant="secondary"
          iconName="mail-outline"
          label={emailLabel}
          onPress={onEmailPress}
          accessibilityLabel="Contatta il supporto via email"
          accessibilityHint="Apre il client di posta con l'indirizzo del supporto già compilato"
        />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl, // 20 — slightly more premium than lg(16)
    paddingHorizontal: Spacing.xl, // 24
    paddingTop: Spacing.xl, // 24
    paddingBottom: Spacing.xl, // 24
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  cardCompact: {
    paddingHorizontal: Spacing.lg, // 20
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },

  // Icon chip — wrap holds halo + chip
  iconWrap: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.base, // 16
  },
  // Soft mint halo behind chip — adds depth without a gradient lib
  iconHalo: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: Radius.xl, // 20
    backgroundColor: Colors.accentLight,
    opacity: 0.55,
    transform: [{ scale: 1.0 }],
  },
  iconChip: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg, // 16
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,107,85,0.08)",
  },

  title: {
    fontSize: 19,
    fontWeight: "700",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: Spacing.sm, // 8
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
    textAlign: "center",
    letterSpacing: -0.1,
    paddingHorizontal: Spacing.sm, // 8 — keeps line from kissing edges on long subtitles
    marginBottom: Spacing.xl, // 24
  },

  // Buttons row — side-by-side 50/50
  buttonsRow: {
    flexDirection: "row",
    gap: Spacing.md, // 12
    alignSelf: "stretch",
  },

  // CTA wrap — Animated.View, holds the press animation
  ctaWrap: {
    flex: 1,
  },

  // Chat button — dark filled, the hero CTA
  chatBtn: {
    height: 52,
    borderRadius: Radius.md + 2, // 14 — tuned to match button proportions
    backgroundColor: Colors.text,
    overflow: "hidden",
    // Lifted shadow makes the dark CTA pop on white card
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  // Subtle inner top-edge highlight — adds dimensionality to the dark surface
  chatHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  // Email button — secondary outline
  emailBtn: {
    height: 52,
    borderRadius: Radius.md + 2, // 14
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
    overflow: "hidden",
  },

  // Inner View — enforces horizontal layout on iOS (Pressable flex fix)
  btnInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm, // 8
  },

  chatBtnText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.1,
    color: Colors.textOnDark,
  },

  emailBtnText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.1,
    color: Colors.secondary,
  },
});
