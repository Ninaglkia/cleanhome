/**
 * WelcomeModal.tsx
 *
 * Post-rocket welcome card that offers the user a choice:
 *   "Sì, mostrami" → launch 2-step coach marks
 *   "Esplora subito" → go straight to home
 *
 * Visual anatomy:
 *   - Bottom sheet modal (white, radius 28) that slides up from below the content
 *   - App icon (64px, radius 16) top-center
 *   - Bold title + soft subtitle
 *   - Two pill buttons stacked vertically
 *
 * Persist: sets `cleanhome.welcome_choice_made = "1"` in AsyncStorage so the
 * modal never shows again after the user makes a choice.
 */

import { useEffect } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Modal,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";

const { height: SH } = Dimensions.get("window");

// ─── Storage key ──────────────────────────────────────────────────────────────
export const WELCOME_CHOICE_KEY = "cleanhome.welcome_choice_made";

// ─── Design tokens ────────────────────────────────────────────────────────────
const DARK_GREEN = "#022420";
const MINT = "#3ee0a8";
const MINT_LIGHT = "#e8fdf7";
const WHITE = "#ffffff";
const TEXT_SECONDARY = "#4a6660";
const SCRIM = "rgba(2, 36, 32, 0.48)";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WelcomeModalProps {
  visible: boolean;
  firstName: string;
  onStartTour: () => void;
  onSkipTour: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WelcomeModal({
  visible,
  firstName,
  onStartTour,
  onSkipTour,
}: WelcomeModalProps) {
  // Card slides up from off-screen bottom
  const cardTranslateY = useSharedValue(300);
  const cardOpacity = useSharedValue(0);
  const scrimOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scrimOpacity.value = withTiming(1, { duration: 280 });
      cardTranslateY.value = withSpring(0, {
        damping: 22,
        stiffness: 160,
        mass: 0.9,
      });
      cardOpacity.value = withTiming(1, { duration: 220 });
    } else {
      scrimOpacity.value = withTiming(0, { duration: 220 });
      cardTranslateY.value = withTiming(300, {
        duration: 280,
        easing: Easing.in(Easing.cubic),
      });
      cardOpacity.value = withTiming(0, { duration: 200 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardTranslateY.value }],
    opacity: cardOpacity.value,
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  const markChoice = async () => {
    try {
      await AsyncStorage.setItem(WELCOME_CHOICE_KEY, "1");
    } catch {
      // non-critical
    }
  };

  const handleStartTour = async () => {
    await markChoice();
    onStartTour();
  };

  const handleSkip = async () => {
    await markChoice();
    onSkipTour();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      {/* Scrim */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />

      {/* Card — anchored at the bottom */}
      <View style={styles.sheetContainer} pointerEvents="box-none">
        <Animated.View style={[styles.card, cardStyle]}>
          {/* App icon */}
          <View style={styles.iconWrap}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../assets/icon.png")}
              style={styles.appIcon}
              resizeMode="cover"
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>
            Benvenuto in CleanHome,{"\n"}
            <Text style={styles.titleAccent}>{firstName}!</Text>
          </Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Vuoi un tour rapido di 30 secondi per scoprire come funziona?
          </Text>

          {/* Mint divider line */}
          <View style={styles.divider} />

          {/* Primary CTA */}
          <View style={styles.btnPrimary}>
            <Pressable
              onPress={handleStartTour}
              accessibilityRole="button"
              accessibilityLabel="Inizia il tour guidato"
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={({ pressed }) => ({
                width: "100%",
                alignItems: "center",
                paddingVertical: 15,
                paddingHorizontal: 32,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={styles.btnPrimaryText}>Si, mostrami</Text>
            </Pressable>
          </View>

          {/* Secondary CTA */}
          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [
              styles.btnSecondary,
              pressed && styles.btnSecondaryPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Esplora da solo"
          >
            <Text style={styles.btnSecondaryText}>Esplora subito</Text>
          </Pressable>

          {/* Bottom hint */}
          <Text style={styles.hint}>
            Puoi tornare su questo in qualsiasi momento dal profilo
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: SCRIM,
  },
  sheetContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: "center",
    shadowColor: DARK_GREEN,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 20,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: DARK_GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  appIcon: {
    width: 72,
    height: 72,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: DARK_GREEN,
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 30,
    marginBottom: 10,
  },
  titleAccent: {
    color: "#006b55",
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  divider: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: MINT,
    marginBottom: 24,
    opacity: 0.7,
  },
  btnPrimary: {
    backgroundColor: DARK_GREEN,
    borderRadius: 9999,
    width: "100%",
    marginBottom: 12,
    shadowColor: DARK_GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  btnPrimaryPressed: {
    opacity: 0.85,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: WHITE,
    letterSpacing: 0.2,
  },
  btnSecondary: {
    borderRadius: 9999,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#d4e4e0",
    backgroundColor: "transparent",
    marginBottom: 16,
  },
  btnSecondaryPressed: {
    backgroundColor: MINT_LIGHT,
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: DARK_GREEN,
    letterSpacing: 0.1,
  },
  hint: {
    fontSize: 11,
    fontWeight: "400",
    color: "#8aaca6",
    textAlign: "center",
    lineHeight: 15,
  },
});
