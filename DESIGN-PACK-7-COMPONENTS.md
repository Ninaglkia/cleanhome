# CleanHome — Pack 7 — Componenti riusabili

Stack: React Native + Expo Router v3 + NativeWind + TypeScript
Vedi DESIGN-AUDIT-README.md per il contesto completo.

---

### `components/AnimatedToggle.tsx`

```tsx
import { StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useEffect } from "react";

interface AnimatedToggleProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  activeColor?: string;
  inactiveColor?: string;
  thumbColor?: string;
  width?: number;
  height?: number;
}

const SPRING = { damping: 18, stiffness: 140, mass: 0.6 };

export function AnimatedToggle({
  value,
  onValueChange,
  activeColor = "#006b55",
  inactiveColor = "#c1c8c5",
  thumbColor = "#ffffff",
  width = 56,
  height = 32,
}: AnimatedToggleProps) {
  const thumbSize = height - 6;
  const travel = width - thumbSize - 6;

  const position = useSharedValue(value ? travel : 0);
  const isDragging = useSharedValue(false);
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    if (!isDragging.value) {
      position.value = withSpring(value ? travel : 0, SPRING);
    }
  }, [value]);

  useAnimatedReaction(
    () => Math.min(1, Math.max(0, position.value / travel)),
    (p) => { progress.value = p; }
  );

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onValueChange)(!value);
  });

  const pan = Gesture.Pan()
    .onBegin(() => {
      isDragging.value = true;
    })
    .onUpdate((e) => {
      const base = value ? travel : 0;
      const next = Math.max(0, Math.min(travel, base + e.translationX));
      position.value = next;
    })
    .onEnd(() => {
      isDragging.value = false;
      const halfway = travel / 2;
      const shouldBeOn = position.value > halfway;
      position.value = withSpring(shouldBeOn ? travel : 0, SPRING);
      if (shouldBeOn !== value) {
        runOnJS(onValueChange)(shouldBeOn);
      }
    });

  const gesture = Gesture.Race(pan, tap);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveColor, activeColor]
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.value },
      { scale: isDragging.value ? 1.1 : 1 },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.track,
          { width, height, borderRadius: height / 2 },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: thumbColor,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  track: {
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  thumb: {
    shadowColor: "#022420",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
});
```

---

### `components/CleanerPayoutSection.tsx`

```tsx
import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";
import { useCleanerStripeStatus } from "../lib/hooks/useCleanerStripeStatus";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CleanerPayoutSectionProps {
  cleanerId: string | null | undefined;
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const TOKEN = {
  // State A: not-configured — amber/yellow
  unconfiguredBg: "#FEF3C7",
  unconfiguredBorder: "#F59E0B",
  unconfiguredIconBg: "#FEF9C3",
  unconfiguredIcon: "#D97706",
  unconfiguredTitle: "#92400E",
  unconfiguredBody: "#A16207",
  unconfiguredCta: "#D97706",
  unconfiguredCtaBg: "#FDE68A",

  // State B: pending — orange
  pendingBg: "#FFF7ED",
  pendingBorder: "#F97316",
  pendingIconBg: "#FFEDD5",
  pendingIcon: "#EA580C",
  pendingTitle: "#7C2D12",
  pendingBody: "#9A3412",
  pendingCta: "#EA580C",
  pendingCtaBg: "#FED7AA",

  // State C: active — green brand
  activeBg: "#ECFDF5",
  activeBorder: "#10B981",
  activeIconBg: "#D1FAE5",
  activeIcon: "#059669",
  activeTitle: "#065F46",
  activeBody: "#047857",
  activeLink: "#059669",
} as const;

// ─── Sub-components ──────────────────────────────────────────────────────────

interface StatusIconProps {
  name: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  bgColor: string;
  loading?: boolean;
}

function StatusIcon({ name, color, bgColor, loading = false }: StatusIconProps) {
  return (
    <View
      style={[styles.iconCircle, { backgroundColor: bgColor }]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={name} size={24} color={color} />
      )}
    </View>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CleanerPayoutSection({ cleanerId }: CleanerPayoutSectionProps) {
  const { status, isLoading, refetch } = useCleanerStripeStatus(cleanerId);
  const [invoking, setInvoking] = useState(false);

  const openOnboardingLink = useCallback(async () => {
    if (!cleanerId) return;
    setInvoking(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "stripe-connect-onboarding-link",
        { body: {} }
      );
      if (error) throw error;
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error("Nessun URL ricevuto");

      await WebBrowser.openAuthSessionAsync(
        url,
        "cleanhome://stripe-connect/return"
      );
      // Refresh status after the user returns from Stripe
      refetch();
    } catch (err) {
      Alert.alert(
        "Errore",
        err instanceof Error ? err.message : "Impossibile avviare la configurazione"
      );
    } finally {
      setInvoking(false);
    }
  }, [cleanerId, refetch]);

  const openUpdateLink = useCallback(async () => {
    if (!cleanerId) return;
    setInvoking(true);
    try {
      // Re-use the same onboarding link endpoint — for an active
      // account it returns an Express Dashboard login link; for one
      // still in KYC it returns an account_onboarding link.
      const { data, error } = await supabase.functions.invoke(
        "stripe-connect-onboarding-link",
        { body: {} }
      );

      if (error) {
        // The Edge Function returns the underlying Stripe error in
        // `detail` (added temporarily for debugging) when it returns
        // 500. Pull it out so the alert shows the real cause instead
        // of the generic message.
        type EdgeError = Error & {
          context?: { json?: () => Promise<unknown> };
        };
        let detail: string | undefined;
        const ctx = (error as EdgeError).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const payload = (await ctx.json()) as {
              error?: string;
              detail?: string;
            };
            detail = payload?.detail;
          } catch {
            // best-effort — fall back to the generic error.message
          }
        }
        throw new Error(detail ?? error.message ?? "Errore sconosciuto");
      }

      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error("Nessun URL ricevuto");

      await WebBrowser.openAuthSessionAsync(
        url,
        "cleanhome://stripe-connect/return"
      );
      refetch();
    } catch (err) {
      Alert.alert(
        "Errore",
        err instanceof Error ? err.message : "Impossibile aprire la dashboard"
      );
    } finally {
      setInvoking(false);
    }
  }, [cleanerId, refetch]);

  // Don't render while loading — avoids flicker between states
  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: "#f0f4f3", borderColor: "#c1c8c5" }]}>
        <ActivityIndicator size="small" color="#006b55" style={{ marginVertical: 8 }} />
      </View>
    );
  }

  // ── State A: not-configured ───────────────────────────────────────────────
  if (status === "not-configured") {
    return (
      <Pressable
        onPress={openOnboardingLink}
        disabled={invoking}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: TOKEN.unconfiguredBg,
            borderColor: TOKEN.unconfiguredBorder,
            opacity: pressed ? 0.85 : invoking ? 0.6 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Configura i tuoi pagamenti"
      >
        <StatusIcon
          name="wallet-outline"
          color={TOKEN.unconfiguredIcon}
          bgColor={TOKEN.unconfiguredIconBg}
          loading={invoking}
        />
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: TOKEN.unconfiguredTitle }]}>
            Configura i tuoi pagamenti
          </Text>
          <Text style={[styles.body, { color: TOKEN.unconfiguredBody }]}>
            Aggiungi un IBAN o carta prepagata per ricevere i soldi delle pulizie.
            È sicuro, gestito da Stripe.
          </Text>
          <View
            style={[
              styles.ctaChip,
              { backgroundColor: TOKEN.unconfiguredCtaBg },
            ]}
          >
            <Text style={[styles.ctaText, { color: TOKEN.unconfiguredCta }]}>
              Configura ora
            </Text>
            <Ionicons name="arrow-forward" size={14} color={TOKEN.unconfiguredCta} />
          </View>
        </View>
      </Pressable>
    );
  }

  // ── State B: pending ──────────────────────────────────────────────────────
  if (status === "pending") {
    return (
      <Pressable
        onPress={openUpdateLink}
        disabled={invoking}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: TOKEN.pendingBg,
            borderColor: TOKEN.pendingBorder,
            opacity: pressed ? 0.85 : invoking ? 0.6 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Continua la configurazione pagamenti"
      >
        <StatusIcon
          name="time-outline"
          color={TOKEN.pendingIcon}
          bgColor={TOKEN.pendingIconBg}
          loading={invoking}
        />
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: TOKEN.pendingTitle }]}>
            Verifica in corso
          </Text>
          <Text style={[styles.body, { color: TOKEN.pendingBody }]}>
            Stripe sta verificando i tuoi dati. Riceverai una notifica quando
            sarà completato.
          </Text>
          <View
            style={[styles.ctaChip, { backgroundColor: TOKEN.pendingCtaBg }]}
          >
            <Text style={[styles.ctaText, { color: TOKEN.pendingCta }]}>
              Continua la configurazione
            </Text>
            <Ionicons name="arrow-forward" size={14} color={TOKEN.pendingCta} />
          </View>
        </View>
      </Pressable>
    );
  }

  // ── State C: active ───────────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: TOKEN.activeBg,
          borderColor: TOKEN.activeBorder,
        },
      ]}
    >
      <StatusIcon
        name="checkmark-circle"
        color={TOKEN.activeIcon}
        bgColor={TOKEN.activeIconBg}
      />
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: TOKEN.activeTitle }]}>
          Pagamenti attivi
        </Text>
        <Text style={[styles.body, { color: TOKEN.activeBody }]}>
          I tuoi guadagni vengono accreditati automaticamente sul conto
          collegato a Stripe.
        </Text>
        <Pressable
          onPress={openUpdateLink}
          disabled={invoking}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          accessibilityRole="link"
          accessibilityLabel="Gestisci pagamenti e dati bancari"
        >
          <Text style={[styles.linkText, { color: TOKEN.activeLink }]}>
            {invoking
              ? "Apertura in corso…"
              : "Gestisci pagamenti e dati bancari →"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  textBlock: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
  },
  ctaChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: "600",
  },
  linkText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
});
```

---

### `components/CoachMarks/CoachMarkOverlay.tsx`

```tsx
/**
 * CoachMarkOverlay.tsx
 *
 * Fullscreen coach-mark (spotlight tooltip) system.
 *
 * Usage:
 *   <CoachMarkOverlay
 *     steps={steps}
 *     storageKey="cleanhome.first_run_tour_done"
 *   />
 *
 * Each step describes a target rectangle on screen (measure it with
 * a View ref before passing it in), a title, and a description.
 *
 * The overlay renders:
 *   • Dark scrim with a rectangular "spotlight" cut-out around the target
 *   • Mint ring around the spotlight for visual emphasis
 *   • Tooltip card (white, radius 16) with diamond arrow pointing toward target
 *   • Header: step badge "N/total" (left) + "Suggerimento" label (right)
 *   • Navigation footer: "Salta tutto" (left), "Indietro" (center, step>0), "Avanti"/"Fine" (right)
 *
 * Animations:
 *   • Tooltip pops in with a springy cubic-bezier feel (withSpring overshoot)
 *   • On dismiss, everything fades out with withTiming
 */

import { useEffect, useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoachMarkRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoachMarkStep {
  /** Measured position of the target element on screen */
  rect: CoachMarkRect;
  title: string;
  description: string;
}

export interface CoachMarkOverlayProps {
  steps: CoachMarkStep[];
  /** AsyncStorage key — marks tour as complete on "Fine" or "Salta tutto" */
  storageKey: string;
  /** Called after tour finishes (either completed or skipped) */
  onDone?: () => void;
}

// ─── Design tokens ─────────────────────────────────────────────────────────────

const DARK_GREEN = "#062a23";
const MINT = "#3ee0a8";
const MINT_LIGHT = "#e8faf4";
const WHITE = "#ffffff";
const SCRIM = "rgba(6,42,35,0.72)";
const PADDING = 10; // spotlight padding around target

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Tooltip arrow ────────────────────────────────────────────────────────────

type ArrowDir = "up" | "down";

function TooltipArrow({ dir }: { dir: ArrowDir }) {
  if (dir === "down") {
    return <View style={[styles.arrow, styles.arrowDown]} />;
  }
  return <View style={[styles.arrow, styles.arrowUp]} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CoachMarkOverlay({
  steps,
  storageKey,
  onDone,
}: CoachMarkOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(true);

  // Animated values
  const overlayOpacity = useSharedValue(1);

  // Tooltip animation — re-trigger on step change
  const tooltipScale = useSharedValue(0.5);
  const tooltipOpacity = useSharedValue(0);

  const triggerTooltipIn = useCallback(() => {
    tooltipScale.value = 0.5;
    tooltipOpacity.value = 0;
    tooltipScale.value = withSpring(1, {
      damping: 10,
      stiffness: 120,
      mass: 0.8,
    });
    tooltipOpacity.value = withTiming(1, { duration: 220 });
  }, [tooltipScale, tooltipOpacity]);

  useEffect(() => {
    if (visible) triggerTooltipIn();
  }, [currentStep, visible, triggerTooltipIn]);

  const dismiss = useCallback(async () => {
    overlayOpacity.value = withTiming(
      0,
      { duration: 320, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setVisible)(false);
      }
    );
    try {
      await AsyncStorage.setItem(storageKey, "1");
    } catch {
      // non-critical
    }
    onDone?.();
  }, [overlayOpacity, storageKey, onDone]);

  const handleSkip = useCallback(() => dismiss(), [dismiss]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [currentStep, steps.length, dismiss]);

  if (!visible || steps.length === 0) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const totalSteps = steps.length;
  const isFirst = currentStep === 0;

  // ── Spotlight geometry ─────────────────────────────────────────────────────
  const spotlightTop = step.rect.y - PADDING;
  const spotlightBottom = step.rect.y + step.rect.height + PADDING;
  const spaceBelow = SH - spotlightBottom;
  const spaceAbove = spotlightTop;
  const placeBelow = spaceBelow >= 200 || spaceBelow > spaceAbove;

  // ── Tooltip position ───────────────────────────────────────────────────────
  // Always use `top` positioning to avoid bottom-anchor layout glitches.
  // When placing above the spotlight, we calculate the top from the top of
  // screen and rely on the card's natural height.
  const TOOLTIP_MARGIN = 16;
  const TOOLTIP_MAX_HEIGHT = 220; // generous upper bound so above-placement works

  const tooltipTop = placeBelow
    ? spotlightBottom + TOOLTIP_MARGIN
    : Math.max(8, spotlightTop - TOOLTIP_MARGIN - TOOLTIP_MAX_HEIGHT);

  const arrowDir: ArrowDir = placeBelow ? "up" : "down";

  // ── Horizontal centering (clamped to screen edges) ─────────────────────────
  const tooltipWidth = SW - 48;
  const targetCenterX = step.rect.x + step.rect.width / 2;
  let tooltipLeft = targetCenterX - tooltipWidth / 2;
  tooltipLeft = Math.max(24, Math.min(tooltipLeft, SW - tooltipWidth - 24));

  // Arrow X offset relative to tooltip container
  const arrowX = targetCenterX - tooltipLeft - 10;
  const clampedArrowX = Math.max(16, Math.min(arrowX, tooltipWidth - 32));

  // ── Animated style ─────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const tooltipAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: tooltipScale.value }],
    opacity: tooltipOpacity.value,
  }));

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        style={[styles.root, { opacity: overlayOpacity }]}
        pointerEvents="box-none"
      >
        {/* ── Scrim (4 rectangles surrounding the spotlight) ──
            Tapping ANY scrim region advances to the next step (or finishes
            the tour on the last step). Way more intuitive than forcing the
            user to hit the small "Avanti" button. */}
        {/* Top */}
        <Pressable
          style={[
            styles.scrimPart,
            { top: 0, left: 0, right: 0, height: Math.max(0, spotlightTop) },
          ]}
          onPress={handleNext}
        />
        {/* Bottom */}
        <Pressable
          style={[
            styles.scrimPart,
            { top: spotlightBottom, left: 0, right: 0, bottom: 0 },
          ]}
          onPress={handleNext}
        />
        {/* Left */}
        <Pressable
          style={[
            styles.scrimPart,
            {
              top: spotlightTop,
              left: 0,
              width: Math.max(0, step.rect.x - PADDING),
              height: step.rect.height + PADDING * 2,
            },
          ]}
          onPress={handleNext}
        />
        {/* Right */}
        <Pressable
          style={[
            styles.scrimPart,
            {
              top: spotlightTop,
              left: step.rect.x + step.rect.width + PADDING,
              right: 0,
              height: step.rect.height + PADDING * 2,
            },
          ]}
          onPress={handleNext}
        />

        {/* ── Mint spotlight ring ── */}
        <View
          style={[
            styles.spotlightRing,
            {
              top: spotlightTop - 3,
              left: step.rect.x - PADDING - 3,
              width: step.rect.width + PADDING * 2 + 6,
              height: step.rect.height + PADDING * 2 + 6,
            },
          ]}
          pointerEvents="none"
        />

        {/* ── Tooltip card ── */}
        <Animated.View
          style={[
            styles.tooltipContainer,
            {
              top: tooltipTop,
              left: tooltipLeft,
              width: tooltipWidth,
            },
            tooltipAnimatedStyle,
          ]}
          pointerEvents="auto"
        >
          {/* Arrow — points DOWN toward target (tooltip is above target) */}
          {arrowDir === "down" && (
            <View
              style={[
                styles.arrowWrapBottom,
                { left: clampedArrowX },
              ]}
              pointerEvents="none"
            >
              <TooltipArrow dir="down" />
            </View>
          )}

          {/* White card */}
          <View style={styles.tooltipInner}>
            {/* ── Header: badge + "Suggerimento" label ── */}
            <View style={styles.tooltipHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>
                  {currentStep + 1} / {totalSteps}
                </Text>
              </View>
              <View style={styles.suggLabel}>
                <View style={styles.suggDot} />
                <Text style={styles.suggLabelText}>Suggerimento</Text>
              </View>
            </View>

            {/* ── Content ── */}
            <Text style={styles.tooltipTitle}>{step.title}</Text>
            <Text style={styles.tooltipDescription}>{step.description}</Text>

            {/* ── Hint: tap anywhere advances ── */}
            <Text style={styles.tapHint}>Tocca lo schermo per continuare</Text>

            {/* ── Divider ── */}
            <View style={styles.divider} />

            {/* ── Footer: 3-slot row ── */}
            {/*
             *  Slot layout: [skipText] — [backBtn?] — [nextBtn]
             *  Using a fixed 3-column approach with flex weights avoids
             *  justify-content glitches when center slot is conditionally absent.
             *
             *  Left slot:  flex 1, align start  → "Salta tutto"
             *  Mid slot:   flex 0, fixed width  → "Indietro" (hidden on step 0 via opacity+pointerEvents)
             *  Right slot: flex 1, align end    → "Avanti" / "Fine"
             */}
            <View style={styles.footer}>
              {/* Left: Salta tutto */}
              <View style={styles.footerLeft}>
                <Pressable
                  onPress={handleSkip}
                  hitSlop={12}
                  style={({ pressed }) => [
                    styles.skipBtn,
                    pressed && { opacity: 0.5 },
                  ]}
                  accessibilityLabel="Salta tour"
                  accessibilityRole="button"
                >
                  <Text style={styles.skipText}>Salta tutto</Text>
                </Pressable>
              </View>

              {/* Center: Indietro — always rendered, invisible on first step */}
              <View
                style={[
                  styles.footerCenter,
                  isFirst && styles.footerCenterHidden,
                ]}
                pointerEvents={isFirst ? "none" : "auto"}
              >
                <Pressable
                  onPress={handleBack}
                  style={({ pressed }) => [
                    styles.btnBack,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityLabel="Indietro"
                  accessibilityRole="button"
                >
                  <Text style={styles.btnBackText}>Indietro</Text>
                </Pressable>
              </View>

              {/* Right: Avanti / Fine */}
              <View style={styles.footerRight}>
                <Pressable
                  onPress={handleNext}
                  style={({ pressed }) => [
                    styles.btnNext,
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityLabel={
                    isLast ? "Fine tour" : "Prossimo suggerimento"
                  }
                  accessibilityRole="button"
                >
                  <Text style={styles.btnNextText}>
                    {isLast ? "Fine" : "Avanti  →"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Arrow — points UP toward target (tooltip is below target) */}
          {arrowDir === "up" && (
            <View
              style={[styles.arrowWrapTop, { left: clampedArrowX }]}
              pointerEvents="none"
            >
              <TooltipArrow dir="up" />
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // zIndex on Modal children is not required — Modal renders in its own
    // React Native layer on top of everything automatically.
  },
  scrimPart: {
    position: "absolute",
    backgroundColor: SCRIM,
  },
  spotlightRing: {
    position: "absolute",
    borderRadius: 14,
    borderWidth: 3,
    borderColor: MINT,
    shadowColor: MINT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 0,
  },

  // ── Tooltip container ────────────────────────────────────────────────────
  // Positioned absolute. Wraps arrow + white card.
  // overflow: visible so the arrow (absolute -10px outside) is not clipped.
  tooltipContainer: {
    position: "absolute",
    overflow: "visible",
  },

  // ── White card ────────────────────────────────────────────────────────────
  tooltipInner: {
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: DARK_GREEN,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
    overflow: "visible",
  },

  // ── Header row ────────────────────────────────────────────────────────────
  tooltipHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  stepBadge: {
    backgroundColor: MINT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: DARK_GREEN,
    letterSpacing: 0.5,
  },
  suggLabel: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: MINT_LIGHT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  suggDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: MINT,
  },
  suggLabelText: {
    fontSize: 11,
    fontWeight: "700",
    color: DARK_GREEN,
    letterSpacing: 0.2,
  },

  // ── Content ───────────────────────────────────────────────────────────────
  tooltipTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: DARK_GREEN,
    letterSpacing: -0.3,
    marginBottom: 6,
    lineHeight: 23,
  },
  tooltipDescription: {
    fontSize: 13,
    color: "#4b5563",
    lineHeight: 19,
    marginBottom: 0,
  },
  tapHint: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: "600",
    color: "#9ca3af",
    fontStyle: "italic",
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 14,
    marginHorizontal: -20, // bleed to card edges
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  // 3-slot approach: left (flex 1) | center (fixed) | right (flex 1)
  // This guarantees Avanti/Fine is ALWAYS visible regardless of center slot.
  footer: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44, // ensures footer never collapses
  },
  footerLeft: {
    flex: 1,
    alignItems: "flex-start",
  },
  footerCenter: {
    // No flex — natural size, centered between left and right
    marginHorizontal: 8,
  },
  footerCenterHidden: {
    // Keep in layout (avoids reflow) but invisible
    opacity: 0,
  },
  footerRight: {
    flex: 1,
    alignItems: "flex-end",
  },

  skipBtn: {
    paddingVertical: 4,
  },
  skipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
  },
  btnBack: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
  },
  btnBackText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6b7280",
  },
  btnNext: {
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: DARK_GREEN,
    shadowColor: DARK_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
  btnNextText: {
    fontSize: 13,
    fontWeight: "700",
    color: WHITE,
    letterSpacing: 0.2,
  },

  // ── Arrow shapes ──────────────────────────────────────────────────────────
  // Positioned absolute relative to tooltipContainer (not tooltipInner).
  // arrowWrapTop: appears above the card (tooltip is below target → arrow points up)
  // arrowWrapBottom: appears below the card (tooltip is above target → arrow points down)
  arrowWrapTop: {
    position: "absolute",
    top: -10,
    zIndex: 1,
  },
  arrowWrapBottom: {
    position: "absolute",
    bottom: -10,
    zIndex: 1,
  },
  arrow: {
    width: 0,
    height: 0,
  },
  arrowUp: {
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: WHITE,
  },
  arrowDown: {
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: WHITE,
  },
});
```

---

### `components/ErrorBoundary.tsx`

```tsx
import React, { Component, ErrorInfo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary — catches unhandled JS errors in the React
 * tree and shows a friendly "something went wrong" screen instead of
 * a white screen or a raw red error.
 *
 * Wrap the root of the app with this (inside _layout.tsx).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, send to Sentry/Crashlytics here
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconCircle}>
            <Ionicons name="warning-outline" size={48} color="#E53E3E" />
          </View>
          <Text style={styles.title}>Qualcosa è andato storto</Text>
          <Text style={styles.subtitle}>
            Si è verificato un errore imprevisto. Prova a ricaricare la
            schermata.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.debug}>
              {this.state.error.message}
            </Text>
          )}
          <View style={styles.retryBtn}>
            <Pressable
              onPress={this.handleRetry}
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 14,
                paddingHorizontal: 28,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryText}>Riprova</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6faf9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#181c1c",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#717976",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  debug: {
    fontSize: 11,
    color: "#E53E3E",
    textAlign: "center",
    marginBottom: 16,
    fontFamily: "monospace",
  },
  retryBtn: {
    backgroundColor: "#006b55",
    borderRadius: 999,
    overflow: "hidden",
  },
  retryText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
```

---

### `components/escrow/DisputeModal.tsx`

```tsx
import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  openBookingDispute,
  PhotoRejectedError,
  uploadAndModerateBookingPhoto,
} from "../../lib/api";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";

const MIN_PHOTOS = 1;
const MAX_PHOTOS = 6;
const MIN_REASON = 20;
const MAX_REASON = 2000;

interface DisputeModalProps {
  visible: boolean;
  bookingId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface PhotoSlot {
  uri: string;
  uploading: boolean;
  uploaded: boolean;
  photoUrl?: string;
}

export function DisputeModal({
  visible,
  bookingId,
  onClose,
  onSuccess,
}: DisputeModalProps) {
  const [reason, setReason] = useState("");
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reasonLen = reason.trim().length;
  const reasonValid = reasonLen >= MIN_REASON && reasonLen <= MAX_REASON;
  const canSubmit = reasonValid && photos.length >= MIN_PHOTOS && !submitting;

  const pickPhoto = async (mode: "camera" | "library") => {
    if (photos.length >= MAX_PHOTOS) return;

    if (mode === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permesso fotocamera", "Abilita l'accesso nelle impostazioni.");
        return;
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permesso galleria", "Abilita l'accesso nelle impostazioni.");
        return;
      }
    }

    const launcher =
      mode === "camera"
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

    const result = await launcher({
      mediaTypes: ["images"],
      quality: 0.6,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;

    setPhotos((prev) => [...prev, { uri, uploading: false, uploaded: false }]);
  };

  const choosePhoto = () => {
    Alert.alert("Aggiungi foto", "Mostra il problema riscontrato", [
      { text: "Fotocamera", onPress: () => pickPhoto("camera") },
      { text: "Galleria", onPress: () => pickPhoto("library") },
      { text: "Annulla", style: "cancel" },
    ]);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const updated = [...photos];
      for (let i = 0; i < updated.length; i++) {
        if (updated[i].uploaded) continue;
        updated[i] = { ...updated[i], uploading: true };
        setPhotos([...updated]);

        try {
          const { photoUrl } = await uploadAndModerateBookingPhoto({
            bookingId,
            uri: updated[i].uri,
            type: "dispute_client",
          });
          updated[i] = {
            ...updated[i],
            uploading: false,
            uploaded: true,
            photoUrl,
          };
        } catch (err) {
          if (err instanceof PhotoRejectedError) {
            updated[i] = { ...updated[i], uploading: false };
            setPhotos(updated.filter((_, j) => j !== i));
            Alert.alert("Foto non ammessa", err.friendlyMessage);
            setSubmitting(false);
            return;
          }
          throw err;
        }
        setPhotos([...updated]);
      }

      await openBookingDispute(bookingId, reason);

      Alert.alert(
        "Contestazione aperta",
        "CleanHome esaminerà il caso entro 5 giorni lavorativi. Il pagamento al cleaner è temporaneamente sospeso.",
        [{ text: "Ok", onPress: onSuccess }]
      );
    } catch (err: any) {
      Alert.alert("Errore", err?.message ?? "Riprova più tardi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12} disabled={submitting}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Segnala un problema</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.warning}>
              <Ionicons name="alert-circle" size={20} color="#9a6c00" />
              <Text style={styles.warningText}>
                Apri una contestazione solo se il servizio non è stato eseguito o è stato fatto male. Il pagamento al cleaner verrà sospeso fino alla risoluzione.
              </Text>
            </View>

            <Text style={styles.label}>Cosa è successo?</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={6}
              placeholder="Descrivi il problema in dettaglio: cosa non è stato pulito, com'era prima, com'è adesso..."
              placeholderTextColor={Colors.textSecondary}
              value={reason}
              onChangeText={setReason}
              maxLength={MAX_REASON}
              editable={!submitting}
              textAlignVertical="top"
            />
            <Text
              style={[
                styles.counter,
                !reasonValid && reasonLen > 0 && styles.counterError,
              ]}
            >
              {reasonLen}/{MIN_REASON} caratteri minimi
            </Text>

            <Text style={[styles.label, { marginTop: Spacing.lg }]}>
              Foto del problema (min {MIN_PHOTOS}, max {MAX_PHOTOS})
            </Text>
            <Text style={styles.hint}>
              Fai foto chiare delle aree non pulite o del problema. Le foto non idonee verranno rifiutate.
            </Text>

            <View style={styles.photoGrid}>
              {photos.map((photo, idx) => (
                <View key={idx} style={styles.photoCard}>
                  <Image source={{ uri: photo.uri }} style={styles.photo} />
                  {photo.uploading && (
                    <View style={styles.photoOverlay}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  )}
                  {photo.uploaded && (
                    <View style={[styles.photoOverlay, styles.photoOverlaySuccess]}>
                      <Ionicons name="checkmark-circle" size={28} color="#22c55e" />
                    </View>
                  )}
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => removePhoto(idx)}
                    disabled={submitting}
                    hitSlop={10}
                  >
                    <Ionicons name="close-circle" size={22} color="#fff" />
                  </Pressable>
                </View>
              ))}

              {photos.length < MAX_PHOTOS && (
                <Pressable
                  style={styles.addPhotoBtn}
                  onPress={choosePhoto}
                  disabled={submitting}
                >
                  <Ionicons name="camera-outline" size={28} color={Colors.primary} />
                  <Text style={styles.addPhotoText}>Aggiungi foto</Text>
                  <Text style={styles.addPhotoSubtext}>
                    {photos.length}/{MAX_PHOTOS}
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Apri contestazione</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: Colors.text },
  body: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  warning: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fef3c7",
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
  },
  warningText: { flex: 1, fontSize: 13, color: "#9a6c00", lineHeight: 18 },
  label: { fontSize: 14, fontWeight: "600", color: Colors.text, marginBottom: 8 },
  hint: { fontSize: 12, color: Colors.textSecondary, marginBottom: Spacing.md },
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 15,
    color: Colors.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  counter: { fontSize: 12, color: Colors.textSecondary, marginTop: 6, textAlign: "right" },
  counterError: { color: "#ef4444" },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  photoCard: {
    width: "47%",
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: "hidden",
    ...Shadows.sm,
  },
  photo: { width: "100%", height: "100%" },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoOverlaySuccess: { backgroundColor: "rgba(34,197,94,0.15)" },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
  addPhotoBtn: {
    width: "47%",
    aspectRatio: 1,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: "dashed",
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addPhotoText: { fontSize: 14, color: Colors.primary, fontWeight: "600" },
  addPhotoSubtext: { fontSize: 11, color: Colors.textSecondary },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  submitBtn: {
    backgroundColor: "#dc2626",
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  submitBtnDisabled: { backgroundColor: Colors.textSecondary, opacity: 0.5 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

---

### `components/escrow/MarkDoneModal.tsx`

```tsx
import { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  markBookingDone,
  PhotoRejectedError,
  uploadAndModerateBookingPhoto,
} from "../../lib/api";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 6;
const ROOM_SUGGESTIONS = ["Cucina", "Bagno", "Soggiorno", "Camera", "Altro"];

interface MarkDoneModalProps {
  visible: boolean;
  bookingId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface PhotoSlot {
  uri: string;
  uploading: boolean;
  uploaded: boolean;
  photoUrl?: string;
  roomLabel?: string;
  error?: string;
}

export function MarkDoneModal({
  visible,
  bookingId,
  onClose,
  onSuccess,
}: MarkDoneModalProps) {
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const pickPhoto = async (mode: "camera" | "library") => {
    if (photos.length >= MAX_PHOTOS) return;

    if (mode === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permesso fotocamera", "Abilita l'accesso alla fotocamera nelle impostazioni.");
        return;
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permesso galleria", "Abilita l'accesso alle foto nelle impostazioni.");
        return;
      }
    }

    const launcher =
      mode === "camera"
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

    const result = await launcher({
      mediaTypes: ["images"],
      quality: 0.6,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;

    setPhotos((prev) => [
      ...prev,
      { uri, uploading: false, uploaded: false },
    ]);
  };

  const choosePhoto = () => {
    Alert.alert(
      "Aggiungi foto",
      "Scatta una foto del lavoro completato",
      [
        { text: "Fotocamera", onPress: () => pickPhoto("camera") },
        { text: "Galleria", onPress: () => pickPhoto("library") },
        { text: "Annulla", style: "cancel" },
      ]
    );
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const setRoomLabel = (idx: number, label: string) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], roomLabel: label };
      return next;
    });
  };

  const handleSubmit = async () => {
    if (photos.length < MIN_PHOTOS) {
      Alert.alert(
        "Servono più foto",
        `Carica almeno ${MIN_PHOTOS} foto del lavoro completato per procedere.`
      );
      return;
    }
    setSubmitting(true);

    try {
      // Upload + moderation in sequenza per gestione errori chiara
      const updated = [...photos];
      for (let i = 0; i < updated.length; i++) {
        if (updated[i].uploaded) continue;
        updated[i] = { ...updated[i], uploading: true, error: undefined };
        setPhotos([...updated]);

        try {
          const { photoUrl } = await uploadAndModerateBookingPhoto({
            bookingId,
            uri: updated[i].uri,
            type: "after_cleaner",
            roomLabel: updated[i].roomLabel,
          });
          updated[i] = {
            ...updated[i],
            uploading: false,
            uploaded: true,
            photoUrl,
          };
        } catch (err) {
          if (err instanceof PhotoRejectedError) {
            updated[i] = {
              ...updated[i],
              uploading: false,
              error: err.friendlyMessage,
            };
            setPhotos([...updated]);
            Alert.alert("Foto non ammessa", err.friendlyMessage);
            setSubmitting(false);
            return;
          }
          throw err;
        }
        setPhotos([...updated]);
      }

      // Mark done after all photos uploaded
      await markBookingDone(bookingId);

      Alert.alert(
        "Lavoro segnalato come completato",
        "Il cliente ha 48h per confermare. Riceverai il pagamento dopo la conferma o automaticamente dopo 48h.",
        [{ text: "Ok", onPress: onSuccess }]
      );
    } catch (err: any) {
      Alert.alert("Errore", err?.message ?? "Riprova più tardi");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = photos.length >= MIN_PHOTOS && !submitting;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} disabled={submitting}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Lavoro completato</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.intro}>
            Carica almeno {MIN_PHOTOS} foto del lavoro completato.{"\n"}
            Servono come prova in caso di contestazione.
          </Text>

          <View style={styles.photoGrid}>
            {photos.map((photo, idx) => (
              <View key={idx} style={styles.photoCard}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                {photo.uploading && (
                  <View style={styles.photoOverlay}>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.photoOverlayText}>Verifica...</Text>
                  </View>
                )}
                {photo.uploaded && (
                  <View style={[styles.photoOverlay, styles.photoOverlaySuccess]}>
                    <Ionicons name="checkmark-circle" size={28} color="#22c55e" />
                  </View>
                )}
                {photo.error && (
                  <View style={[styles.photoOverlay, styles.photoOverlayError]}>
                    <Ionicons name="alert-circle" size={28} color="#ef4444" />
                  </View>
                )}
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => removePhoto(idx)}
                  disabled={submitting}
                  hitSlop={10}
                >
                  <Ionicons name="close-circle" size={22} color="#fff" />
                </Pressable>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.roomChips}
                >
                  {ROOM_SUGGESTIONS.map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setRoomLabel(idx, r)}
                      disabled={submitting}
                      style={[
                        styles.roomChip,
                        photo.roomLabel === r && styles.roomChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roomChipText,
                          photo.roomLabel === r && styles.roomChipTextActive,
                        ]}
                      >
                        {r}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ))}

            {photos.length < MAX_PHOTOS && (
              <Pressable
                style={styles.addPhotoBtn}
                onPress={choosePhoto}
                disabled={submitting}
              >
                <Ionicons name="camera-outline" size={28} color={Colors.primary} />
                <Text style={styles.addPhotoText}>Aggiungi foto</Text>
                <Text style={styles.addPhotoSubtext}>
                  {photos.length}/{MAX_PHOTOS}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.warning}>
            <Ionicons name="information-circle" size={18} color="#9a6c00" />
            <Text style={styles.warningText}>
              Le foto vengono verificate automaticamente. Carica solo foto del lavoro di pulizia.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                Conferma lavoro completato
              </Text>
            )}
          </Pressable>
          <Text style={styles.footerHint}>
            {photos.length}/{MIN_PHOTOS} foto minime
            {photos.length < MIN_PHOTOS &&
              ` — mancano ${MIN_PHOTOS - photos.length}`}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: Colors.text },
  body: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  intro: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  photoCard: {
    width: "47%",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: "hidden",
    ...Shadows.sm,
  },
  photo: { width: "100%", height: 140 },
  photoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 60,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoOverlaySuccess: { backgroundColor: "rgba(34,197,94,0.15)" },
  photoOverlayError: { backgroundColor: "rgba(239,68,68,0.15)" },
  photoOverlayText: { color: "#fff", fontSize: 12 },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
  roomChips: { paddingHorizontal: 8, paddingVertical: 8, gap: 6 },
  roomChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 6,
  },
  roomChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roomChipText: { fontSize: 11, color: Colors.textSecondary },
  roomChipTextActive: { color: "#fff", fontWeight: "600" },
  addPhotoBtn: {
    width: "47%",
    height: 192,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: "dashed",
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addPhotoText: { fontSize: 14, color: Colors.primary, fontWeight: "600" },
  addPhotoSubtext: { fontSize: 11, color: Colors.textSecondary },
  warning: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#fef3c7",
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
  },
  warningText: { flex: 1, fontSize: 13, color: "#9a6c00", lineHeight: 18 },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  submitBtnDisabled: { backgroundColor: Colors.textSecondary, opacity: 0.5 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  footerHint: {
    textAlign: "center",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});
```

---

### `components/icons/AppleLogo.tsx`

```tsx
import Svg, { Path } from "react-native-svg";

export function AppleLogo({
  size = 20,
  color = "#ffffff",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 384 512">
      <Path
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 21.8-88.5 21.8-11.4 0-51.1-19-84.1-19C52.9 142.1 0 193.1 0 279.3c0 83.3 52.1 202.4 105.7 202.4 21 0 54.4-14.7 82.2-14.7 28.2 0 56.6 14.7 82.2 14.7 45.8 0 102.6-90.2 102.6-90.2-61.1-27.1-59.5-107-59.5-107.8zM216.3 84.9c23.7-28.7 39.4-68.5 35.1-108.3-32.6 1.4-71.6 21.7-95.2 49.6-20.7 24.3-38.8 65.5-34 104 36.3 2.9 71.3-17.7 94.1-45.3z"
        fill={color}
      />
    </Svg>
  );
}
```

---

### `components/icons/GoogleLogo.tsx`

```tsx
import Svg, { Path } from "react-native-svg";

export function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        fill="#EA4335"
      />
      <Path
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        fill="#4285F4"
      />
      <Path
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        fill="#FBBC05"
      />
      <Path
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        fill="#34A853"
      />
    </Svg>
  );
}
```

---

### `components/LegalPage.tsx`

```tsx
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../lib/theme";

export type LegalSection = {
  heading: string;
  body: string;
};

export type LegalPageProps = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
};

export function LegalPage({ title, lastUpdated, intro, sections }: LegalPageProps) {
  const router = useRouter();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: Colors.surface,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "700",
            color: Colors.text,
          }}
        >
          {title}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 26,
            fontWeight: "800",
            color: Colors.text,
            letterSpacing: -0.6,
            marginBottom: 6,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: Colors.textTertiary,
            marginBottom: 18,
          }}
        >
          Ultimo aggiornamento: {lastUpdated}
        </Text>

        <Text
          style={{
            fontSize: 15,
            color: Colors.textSecondary,
            lineHeight: 23,
            marginBottom: 28,
          }}
        >
          {intro}
        </Text>

        {sections.map((section, i) => (
          <View key={i} style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: Colors.text,
                marginBottom: 8,
              }}
            >
              {i + 1}. {section.heading}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: Colors.textSecondary,
                lineHeight: 22,
              }}
            >
              {section.body}
            </Text>
          </View>
        ))}

        <View
          style={{
            marginTop: 16,
            padding: 16,
            backgroundColor: Colors.accentLight,
            borderRadius: 14,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: Colors.secondary,
              fontWeight: "600",
              lineHeight: 20,
            }}
          >
            Per qualsiasi domanda puoi contattarci all'indirizzo {""}
            <Text style={{ fontWeight: "800" }}>info@cleanhomeapp.com</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

---

### `components/listing/tokens.ts`

```tsx
import type { LatLng } from "react-native-maps";

// ─── Design tokens ─────────────────────────────────────────────────────────────

export const C = {
  primary: "#022420",
  secondary: "#006b55",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  background: "#f6faf9",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
  primaryContainer: "#1a3a35",
  accent: "#00c896",
} as const;

export const MAP_CIRCLE_FILL = "#006b5540";
export const MAP_CIRCLE_STROKE = "#006b55";
export const DRAW_SAMPLE_EVERY = 1;
export const DRAW_MAX_POINTS = 150;

// ─── Coverage plans ────────────────────────────────────────────────────────────

export interface CoveragePlan {
  name: string;
  minKm: number;
  maxKm: number;
  priceLabel: string;
  priceMonthly: number | null;
}

export const COVERAGE_PLANS: readonly CoveragePlan[] = [
  { name: "Base", minKm: 0, maxKm: 5, priceLabel: "Gratis", priceMonthly: null },
  { name: "Standard", minKm: 6, maxKm: 15, priceLabel: "4,99 €/mese", priceMonthly: 4.99 },
  { name: "Premium", minKm: 16, maxKm: 30, priceLabel: "9,99 €/mese", priceMonthly: 9.99 },
  { name: "Pro", minKm: 31, maxKm: 50, priceLabel: "14,99 €/mese", priceMonthly: 14.99 },
] as const;

export const SLIDER_MIN_KM = 1;
export const SLIDER_MAX_KM = 50;
export const ROME_COORDS = { latitude: 41.9028, longitude: 12.4964 };

export function getPlanForRadius(km: number): CoveragePlan {
  return (
    COVERAGE_PLANS.find((p) => km >= p.minKm && km <= p.maxKm) ??
    COVERAGE_PLANS[COVERAGE_PLANS.length - 1]
  );
}

export function kmToMeters(km: number): number {
  return km * 1000;
}

// ─── Geometry helpers ──────────────────────────────────────────────────────────

export function chaikinSmoothLatLng(points: LatLng[], iterations: number): LatLng[] {
  if (points.length < 3) return points;
  let pts = points;
  for (let iter = 0; iter < iterations; iter++) {
    const next: LatLng[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      next.push({
        latitude: 0.75 * p0.latitude + 0.25 * p1.latitude,
        longitude: 0.75 * p0.longitude + 0.25 * p1.longitude,
      });
      next.push({
        latitude: 0.25 * p0.latitude + 0.75 * p1.latitude,
        longitude: 0.25 * p0.longitude + 0.75 * p1.longitude,
      });
    }
    pts = next;
  }
  return pts;
}

export function buildSvgPathFromPoints(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`;
  }
  return d;
}

export function distSq(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function calcPolygonRadiusKm(points: LatLng[]): number {
  if (points.length < 3) return 0;
  const centroid = points.reduce(
    (acc, p) => ({
      latitude: acc.latitude + p.latitude / points.length,
      longitude: acc.longitude + p.longitude / points.length,
    }),
    { latitude: 0, longitude: 0 }
  );
  const avgDist =
    points.reduce((sum, p) => {
      const dLat = (p.latitude - centroid.latitude) * 111;
      const dLng =
        (p.longitude - centroid.longitude) *
        111 *
        Math.cos((centroid.latitude * Math.PI) / 180);
      return sum + Math.sqrt(dLat * dLat + dLng * dLng);
    }, 0) / points.length;
  return Math.round(avgDist * 10) / 10;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ListingStatus = "active" | "review" | "draft" | "paused";

export interface ServiceTag {
  id: string;
  label: string;
  selected: boolean;
}

export interface DayAvailability {
  day: string;
  short: string;
  available: boolean;
}

export interface CoverageZone {
  id: string;
  city: string;
  radiusKm: number;
  plan: CoveragePlan;
  lat: number;
  lng: number;
  polygon?: LatLng[];
}

export const STATUS_CONFIG: Record<
  ListingStatus,
  { label: string; color: string; bg: string }
> = {
  active: { label: "Attivo", color: "#006b55", bg: "#e6f4f1" },
  review: { label: "In revisione", color: "#b45309", bg: "#fef3c7" },
  draft: { label: "Bozza", color: "#717976", bg: "#f0f4f3" },
  paused: { label: "In pausa", color: "#8a4502", bg: "#fef0d9" },
};

export const INITIAL_SERVICES: ServiceTag[] = [
  { id: "standard", label: "Pulizia Standard", selected: true },
  { id: "deep", label: "Pulizia Profonda", selected: true },
  { id: "ironing", label: "Stiratura", selected: false },
  { id: "windows", label: "Pulizia Vetri", selected: true },
  { id: "laundry", label: "Lavanderia", selected: false },
  { id: "oven", label: "Pulizia Forno", selected: false },
];

export const INITIAL_DAYS: DayAvailability[] = [
  { day: "Lunedì", short: "Lun", available: true },
  { day: "Martedì", short: "Mar", available: true },
  { day: "Mercoledì", short: "Mer", available: false },
  { day: "Giovedì", short: "Gio", available: true },
  { day: "Venerdì", short: "Ven", available: true },
  { day: "Sabato", short: "Sab", available: false },
  { day: "Domenica", short: "Dom", available: false },
];
```

---

### `components/NotificationBell.tsx`

```tsx
import { useCallback, useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth";
import { useUnreadNotificationsCount } from "../lib/hooks/useUnreadNotificationsCount";
import { NotificationsDropdown } from "./NotificationsDropdown";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NotificationBellProps {
  /** Icon and badge accent color. Defaults to "#022420" (client theme). */
  color?: string;
  /** Hit area size for the pressable. Defaults to 40. */
  size?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationBell({
  color = "#022420",
  size = 40,
}: NotificationBellProps) {
  const { user } = useAuth();
  const { count } = useUnreadNotificationsCount(user?.id);
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);

  const handlePress = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const badgeLabel = count > 9 ? "9+" : count > 0 ? String(count) : null;

  // Position the dropdown below the status bar + top inset + header (≈56px)
  const dropdownTopOffset = insets.top + 56;

  return (
    <>
      <Pressable
        onPress={handlePress}
        accessibilityLabel={
          count > 0 ? `Notifiche, ${count} non lette` : "Notifiche"
        }
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.wrap,
          { width: size, height: size, borderRadius: size / 2 },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="notifications-outline" size={22} color={color} />

        {badgeLabel !== null && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        )}
      </Pressable>

      <NotificationsDropdown
        visible={open}
        onClose={handleClose}
        userId={user?.id}
        topOffset={dropdownTopOffset}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.65,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ba1a1a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: 12,
  },
});
```

---

### `components/NotificationsDropdown.tsx`

```tsx
import { useCallback, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";
import {
  useNotifications,
  type AppNotification,
  type NotificationType,
} from "../lib/hooks/useNotifications";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  background: "#f6faf9",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  surfaceContainerHigh: "#e5e9e8",
  surfaceVariant: "#dfe3e2",
  primary: "#022420",
  secondary: "#006b55",
  error: "#ba1a1a",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
} as const;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NotificationsDropdownProps {
  visible: boolean;
  onClose: () => void;
  userId: string | null | undefined;
  /** Pixel offset from the top of the screen to position the panel anchor. */
  topOffset: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTypeIcon(
  type: NotificationType
): React.ComponentProps<typeof Ionicons>["name"] {
  switch (type) {
    case "booking":
      return "calendar-outline";
    case "message":
      return "chatbubble-outline";
    case "system":
      return "shield-checkmark-outline";
  }
}

function formatTimestamp(created_at: string): string {
  const date = new Date(created_at);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Adesso";
  if (diffMin < 60) return `${diffMin} min fa`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h fa`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}g fa`;
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

// ─── Notification row ─────────────────────────────────────────────────────────

interface RowProps {
  item: AppNotification;
  onPress: (id: string, linkPath: string | null) => void;
}

const NotificationRow = ({ item, onPress }: RowProps) => {
  const isUnread = !item.read_at;
  const iconName = getTypeIcon(item.type);

  const handlePress = useCallback(() => {
    onPress(item.id, item.link_path);
  }, [item.id, item.link_path, onPress]);

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(20)}
      layout={Layout.springify()}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.row,
          isUnread ? styles.rowUnread : styles.rowRead,
          pressed && styles.rowPressed,
        ]}
        accessibilityLabel={`Notifica: ${item.title}`}
        accessibilityRole="button"
      >
        <View
          style={[
            styles.rowIcon,
            isUnread ? styles.rowIconUnread : styles.rowIconRead,
          ]}
        >
          <Ionicons
            name={iconName}
            size={18}
            color={isUnread ? C.secondary : C.primary}
          />
        </View>

        <View style={styles.rowBody}>
          <View style={styles.rowTopRow}>
            <Text
              style={[
                styles.rowTitle,
                isUnread ? styles.rowTitleUnread : styles.rowTitleRead,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <View style={styles.rowTimestampWrap}>
              {isUnread && <View style={styles.unreadDot} />}
              <Text style={styles.rowTimestamp}>
                {formatTimestamp(item.created_at)}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.rowDescription,
              !isUnread && styles.rowDescriptionRead,
            ]}
            numberOfLines={2}
          >
            {item.body}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ─── Separator ────────────────────────────────────────────────────────────────

const Separator = () => <View style={styles.separator} />;

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-off-outline" size={28} color={C.outlineVariant} />
      <Text style={styles.emptyText}>Nessuna notifica</Text>
    </View>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

export function NotificationsDropdown({
  visible,
  onClose,
  userId,
  topOffset,
}: NotificationsDropdownProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, markAsRead, markAllAsRead } =
    useNotifications(userId);

  const unreadCount = useMemo(
    () => (data ?? []).filter((n) => !n.read_at).length,
    [data]
  );

  const handleRowPress = useCallback(
    (id: string, linkPath: string | null) => {
      markAsRead(id);
      onClose();
      if (linkPath) {
        // Navigate after a tick so the modal has time to close
        setTimeout(() => {
          router.push(linkPath as never);
        }, 50);
      }
    },
    [markAsRead, onClose, router]
  );

  const keyExtractor = useCallback((item: AppNotification) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => (
      <NotificationRow item={item} onPress={handleRowPress} />
    ),
    [handleRowPress]
  );

  // Panel anchors: right-aligned below the bell icon
  const panelTop = topOffset;
  const panelRight = 16 + insets.right;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Full-screen backdrop — tap to close */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop propagation so tapping the panel doesn't close it */}
        <Pressable
          style={[
            styles.panel,
            { top: panelTop, right: panelRight },
          ]}
          onPress={() => {
            // swallow touch — prevent backdrop from receiving it
          }}
        >
          {/* Panel header */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Notifiche</Text>
            {unreadCount > 0 && !isLoading && (
              <Pressable
                onPress={markAllAsRead}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.markAllBtn}
                accessibilityLabel="Segna tutte come lette"
                accessibilityRole="button"
              >
                <Ionicons
                  name="checkmark-done-outline"
                  size={14}
                  color={C.primary}
                />
                <Text style={styles.markAllText}>Segna tutte lette</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.divider} />

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={C.secondary} />
            </View>
          ) : (
            <FlatList
              data={data ?? []}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              ItemSeparatorComponent={Separator}
              ListEmptyComponent={<EmptyState />}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={3}
              style={styles.list}
              contentContainerStyle={
                (data ?? []).length === 0 ? styles.listEmptyContainer : undefined
              }
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  // ── Panel ─────────────────────────────────────────────────────────────────────
  panel: {
    position: "absolute",
    width: 340,
    maxHeight: 480,
    backgroundColor: C.surface,
    borderRadius: 18,
    shadowColor: "#022420",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    overflow: "hidden",
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  panelTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.3,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.primary,
  },
  divider: {
    height: 1,
    backgroundColor: C.outlineVariant,
    opacity: 0.5,
    marginHorizontal: 0,
  },

  // ── List ──────────────────────────────────────────────────────────────────────
  list: {
    flexGrow: 0,
  },
  listEmptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  separator: {
    height: 1,
    backgroundColor: C.surfaceLow,
    marginHorizontal: 18,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: "center",
  },

  // ── Row ───────────────────────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowUnread: {
    backgroundColor: C.surface,
    borderLeftWidth: 3,
    borderLeftColor: C.secondary,
  },
  rowRead: {
    backgroundColor: C.surface,
  },
  rowPressed: {
    opacity: 0.75,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowIconUnread: {
    backgroundColor: `${C.secondary}1A`,
  },
  rowIconRead: {
    backgroundColor: C.surfaceVariant,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  rowTitleUnread: {
    color: C.primary,
  },
  rowTitleRead: {
    color: `${C.primary}99`,
  },
  rowTimestampWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.secondary,
  },
  rowTimestamp: {
    fontSize: 10,
    color: `${C.onSurfaceVariant}99`,
    fontWeight: "500",
  },
  rowDescription: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    lineHeight: 17,
  },
  rowDescriptionRead: {
    opacity: 0.7,
  },

  // ── Empty ─────────────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    fontWeight: "500",
  },
});
```

---

### `components/profile/ProfileStatCard.tsx`

```tsx
import { View, Text, StyleSheet } from "react-native";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProfileStatCardProps {
  value: string;
  label: string;
  subtitle?: string;
  bgColor: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileStatCard({
  value,
  label,
  subtitle,
  bgColor,
}: ProfileStatCardProps) {
  return (
    <View style={[statStyles.card, { backgroundColor: bgColor }]}>
      <Text style={statStyles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={statStyles.label} numberOfLines={1}>
        {label}
      </Text>
      {subtitle != null ? (
        <Text style={statStyles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    shadowColor: "#022420",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  value: {
    fontSize: 22,
    fontWeight: "700",
    color: "#022420",
    letterSpacing: -0.5,
    marginBottom: 4,
    textAlign: "center",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#414846",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 11,
    color: "#717976",
    marginTop: 2,
    textAlign: "center",
  },
});
```

---

### `components/profile/ProfileStatsStrip.tsx`

```tsx
import { View, StyleSheet } from "react-native";
import { ProfileStatCard } from "./ProfileStatCard";
import { useProfileStats } from "../../lib/hooks/useProfileStats";

// ─── Currency formatter (Italian locale) ─────────────────────────────────────

const euroFmt = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatEuro(value: number): string {
  return euroFmt.format(value);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileStatsStripProps {
  userId: string | null | undefined;
  role: "cleaner" | "client";
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const CLEANER_BG = "#F0F9F6";
const CLIENT_BG = "#FAF6F1";

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileStatsStrip({ userId, role }: ProfileStatsStripProps) {
  const stats = useProfileStats(userId, role);
  const bg = role === "cleaner" ? CLEANER_BG : CLIENT_BG;
  const placeholder = "—";

  if (role === "cleaner") {
    const { earnings, jobs, rating, reviewCount, isLoading } = stats as Extract<
      typeof stats,
      { role: "cleaner" }
    >;

    return (
      <View style={stripStyles.row}>
        <ProfileStatCard
          value={isLoading ? placeholder : formatEuro(earnings)}
          label="Guadagnati"
          subtitle="Questo mese"
          bgColor={bg}
        />
        <ProfileStatCard
          value={isLoading ? placeholder : String(jobs)}
          label="Lavori"
          subtitle="Totali"
          bgColor={bg}
        />
        <ProfileStatCard
          value={isLoading ? placeholder : `★ ${rating}`}
          label="Rating"
          subtitle={isLoading ? placeholder : `${reviewCount} recensioni`}
          bgColor={bg}
        />
      </View>
    );
  }

  const { spent, bookingsCount, propertiesCount, isLoading } = stats as Extract<
    typeof stats,
    { role: "client" }
  >;

  return (
    <View style={stripStyles.row}>
      <ProfileStatCard
        value={isLoading ? placeholder : formatEuro(spent)}
        label="Spesi"
        subtitle="Totale"
        bgColor={bg}
      />
      <ProfileStatCard
        value={isLoading ? placeholder : String(bookingsCount)}
        label="Prenotazioni"
        subtitle="Completate"
        bgColor={bg}
      />
      <ProfileStatCard
        value={isLoading ? placeholder : String(propertiesCount)}
        label="Case"
        subtitle="Indirizzi"
        bgColor={bg}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const stripStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 16,
  },
});
```

---

### `components/ProfileCompletionBar.tsx`

```tsx
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
```

---

### `components/search/CleanerCard.tsx`

```tsx
import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CleanerProfile } from "../../lib/types";
import { Colors } from "../../lib/theme";

interface Props {
  cleaner: CleanerProfile;
  onPress: () => void;
}

function CleanerCard({ cleaner, onPress }: Props) {
  const initials = cleaner.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 16,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Avatar */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: Colors.primary,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Text
            style={{ color: Colors.accent, fontSize: 18, fontWeight: "800" }}
          >
            {initials}
          </Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: Colors.text,
                flex: 1,
                marginRight: 8,
              }}
              numberOfLines={1}
            >
              {cleaner.full_name}
            </Text>
            {cleaner.hourly_rate && (
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: Colors.secondary,
                  letterSpacing: -0.3,
                }}
              >
                €{cleaner.hourly_rate}/h
              </Text>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="star" size={13} color={Colors.warning} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: Colors.text,
                marginLeft: 4,
              }}
            >
              {cleaner.avg_rating.toFixed(1)}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: Colors.textTertiary,
                marginLeft: 3,
              }}
            >
              ({cleaner.review_count})
            </Text>

            {cleaner.city && (
              <>
                <View
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 1.5,
                    backgroundColor: Colors.border,
                    marginHorizontal: 8,
                  }}
                />
                <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
                <Text
                  style={{
                    fontSize: 13,
                    color: Colors.textSecondary,
                    marginLeft: 3,
                  }}
                  numberOfLines={1}
                >
                  {cleaner.city}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Services chips */}
      {cleaner.services && cleaner.services.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginTop: 12,
            gap: 6,
          }}
        >
          {cleaner.services.slice(0, 3).map((s) => (
            <View
              key={s}
              style={{
                backgroundColor: Colors.accentLight,
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "500",
                  color: Colors.secondary,
                }}
              >
                {s}
              </Text>
            </View>
          ))}
          {cleaner.services.length > 3 && (
            <View
              style={{
                backgroundColor: Colors.surfaceElevated,
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "500",
                  color: Colors.textSecondary,
                }}
              >
                +{cleaner.services.length - 3}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Availability indicator */}
      {cleaner.is_available !== undefined && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: Colors.borderLight,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: cleaner.is_available ? Colors.success : Colors.error,
              marginRight: 6,
            }}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "500",
              color: cleaner.is_available ? Colors.success : Colors.error,
            }}
          >
            {cleaner.is_available ? "Disponibile ora" : "Non disponibile"}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default memo(CleanerCard);
```

---

### `components/splash/HouseIcon.tsx`

```tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Polygon,
  Path,
} from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  type SharedValue,
} from "react-native-reanimated";

// ─── Palette ──────────────────────────────────────────────────────────────────
const TILE_TOP = "#0d4a3d";
const TILE_BOT = "#072e26";
const BEIGE = "#f3e9d2";
const DOOR_DARK = "#2a4a3c";
const MINT = "#3ee0a8";

// ─── Tile dimensions ──────────────────────────────────────────────────────────
export const TILE_SIZE = 168;
const RADIUS = 38;

// House wrapper inside the tile
const HOUSE_W = 120;
const HOUSE_H = 110;
const HOUSE_LEFT = (TILE_SIZE - HOUSE_W) / 2;       // 24
const HOUSE_TOP = TILE_SIZE / 2 - HOUSE_H * 0.45;  // ~34.5

// Door dimensions
const DOOR_W = 22;
const DOOR_H = 32;
const DOOR_LEFT_IN_HOUSE = (HOUSE_W - DOOR_W) / 2; // 49
const DOOR_TOP_IN_HOUSE = HOUSE_H - DOOR_H;         // 78

// Door center in tile-local coords — used by app/index.tsx for zoom pivot
export const DOOR_CENTER_IN_TILE_X = HOUSE_LEFT + DOOR_LEFT_IN_HOUSE + DOOR_W / 2; // 84
export const DOOR_CENTER_IN_TILE_Y = HOUSE_TOP + DOOR_TOP_IN_HOUSE + DOOR_H / 2;   // ~128.5

// ─── Sparkle ──────────────────────────────────────────────────────────────────
interface SparkleProps {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  size: number;
  delay: number;
  pulse: SharedValue<number>;
}

function Sparkle({ top, left, right, bottom, size, delay, pulse }: SparkleProps) {
  const style = useAnimatedStyle(() => {
    const phase = (pulse.value + delay) % 1;
    const scale = interpolate(phase, [0, 0.5, 1], [0.7, 1.1, 0.7]);
    const opacity = interpolate(phase, [0, 0.3, 0.7, 1], [0.4, 1, 1, 0.4]);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sparkle,
        { top, left, right, bottom, width: size, height: size },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 1 L13.5 10.5 L23 12 L13.5 13.5 L12 23 L10.5 13.5 L1 12 L10.5 10.5 Z"
          fill={MINT}
        />
      </Svg>
    </Animated.View>
  );
}

// ─── HouseIcon ────────────────────────────────────────────────────────────────
interface HouseIconProps {
  doorOpen: SharedValue<number>;   // 0 = closed, 1 = open (rotateY -78deg)
  doorGlow: SharedValue<number>;   // 0 = off, 1 = mint interior glow
  idle: SharedValue<number>;       // 0..1 knob breathing
}

export default function HouseIcon({ doorOpen, doorGlow, idle }: HouseIconProps) {
  const pulse = useSharedValue(0);
  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      false
    );
  }, [pulse]);

  // Door panel — 2D scaleX collapse from left hinge (3D rotateY glitches
  // inside the world's heavy scale on RN; scaleX reads the same visually).
  const doorPanelStyle = useAnimatedStyle(() => {
    const o = doorOpen.value;
    return {
      opacity: 1 - o * 0.15,
      transform: [{ scaleX: Math.max(0.02, 1 - o * 0.98) }],
      transformOrigin: "left center",
    };
  });

  // Interior glow — pure mint fill, fades in as door opens
  const doorInteriorStyle = useAnimatedStyle(() => ({
    opacity: doorGlow.value,
  }));

  // Knob breathes during idle
  const knobStyle = useAnimatedStyle(() => ({
    opacity: 0.7 + idle.value * 0.3,
  }));

  return (
    // NOTE: overflow="visible" on the tile so sparkles can bleed out.
    // The tile itself has NO shadow here — shadows at world scale 8x
    // become enormous (shadowRadius 30 * 8 = 240px) and look broken.
    // Shadow is acceptable at scale 1; at higher scales it clips fine
    // because the container has overflow:hidden.
    <View style={styles.tile}>
      {/* Tile gradient via SVG — fills rounded rect perfectly */}
      <Svg width={TILE_SIZE} height={TILE_SIZE} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="tileGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={TILE_TOP} />
            <Stop offset="100%" stopColor={TILE_BOT} />
          </LinearGradient>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={TILE_SIZE}
          height={TILE_SIZE}
          rx={RADIUS}
          fill="url(#tileGrad)"
        />
      </Svg>

      {/* Sparkles — positioned outside tile via overflow:visible on parent */}
      <Sparkle top={22} left={18} size={14} delay={0} pulse={pulse} />
      <Sparkle top={18} right={24} size={18} delay={0.25} pulse={pulse} />
      <Sparkle top={70} right={14} size={11} delay={0.5} pulse={pulse} />
      <Sparkle bottom={30} left={14} size={9} delay={0.75} pulse={pulse} />

      {/* House body */}
      <View
        style={{
          position: "absolute",
          left: HOUSE_LEFT,
          top: HOUSE_TOP,
          width: HOUSE_W,
          height: HOUSE_H,
        }}
      >
        {/* Chimney */}
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 18,
            width: 12,
            height: 26,
            backgroundColor: BEIGE,
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
          }}
        />

        {/* Roof — SVG polygon for clean triangle */}
        <Svg
          style={{ position: "absolute", top: 8, left: 0 }}
          width={HOUSE_W}
          height={50}
        >
          <Polygon points={`${HOUSE_W / 2},0 ${HOUSE_W},50 0,50`} fill={BEIGE} />
        </Svg>

        {/* Body */}
        <View
          style={{
            position: "absolute",
            top: 50,
            left: 8,
            width: 104,
            height: 60,
            backgroundColor: BEIGE,
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
            borderBottomLeftRadius: 6,
            borderBottomRightRadius: 6,
          }}
        />

        {/* Left window */}
        <View style={[styles.window, { top: 64, left: 18 }]}>
          <View style={styles.windowBarV} />
          <View style={styles.windowBarH} />
        </View>

        {/* Right window */}
        <View style={[styles.window, { top: 64, right: 18 }]}>
          <View style={styles.windowBarV} />
          <View style={styles.windowBarH} />
        </View>

        {/* ── DOOR ASSEMBLY ────────────────────────────────────────────────
            Door frame holds: (1) the interior mint glow, (2) the door panel
            that swings open on Y axis. Perspective on the frame enables
            real 3D rotation of the panel without Z-fighting at small scales. */}
        <View
          style={{
            position: "absolute",
            top: DOOR_TOP_IN_HOUSE,
            left: DOOR_LEFT_IN_HOUSE,
            width: DOOR_W,
            height: DOOR_H,
            borderTopLeftRadius: 11,
            borderTopRightRadius: 11,
            borderBottomLeftRadius: 1,
            borderBottomRightRadius: 1,
            overflow: "hidden",
            backgroundColor: "transparent",
          }}
        >
          {/* Interior: tile-matching dark background (always visible behind door) */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: TILE_BOT },
            ]}
          />

          {/* Mint glow — fades in as door opens, revealed from behind panel */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: MINT,
              },
              doorInteriorStyle,
            ]}
          />

          {/* Door panel — rotates 3D on Y axis from left hinge */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: DOOR_DARK,
                borderTopLeftRadius: 11,
                borderTopRightRadius: 11,
                borderBottomLeftRadius: 1,
                borderBottomRightRadius: 1,
              },
              doorPanelStyle,
            ]}
          >
            {/* Knob */}
            <Animated.View
              style={[
                {
                  position: "absolute",
                  right: 4,
                  top: "55%",
                  width: 3,
                  height: 3,
                  borderRadius: 1.5,
                  backgroundColor: MINT,
                },
                knobStyle,
              ]}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: RADIUS,
    // overflow: "visible" so sparkles bleed outside the tile bounds.
    // The SVG gradient fills the rounded rect shape — no background clipping issues.
    overflow: "visible",
  },
  sparkle: {
    position: "absolute",
  },
  window: {
    position: "absolute",
    width: 22,
    height: 18,
    backgroundColor: DOOR_DARK,
    borderRadius: 3,
  },
  windowBarV: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1.5,
    marginLeft: -0.75,
    backgroundColor: BEIGE,
  },
  windowBarH: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 1.5,
    marginTop: -0.75,
    backgroundColor: BEIGE,
  },
});
```

---

### `components/TypologySheet.tsx`

```tsx
// TypologySheet.tsx
// Bottom sheet per selezionare tipologia casa + camere + bagni + mq.
// Stile allineato a lib/theme.ts (Fresh Luxe).
//
// Uso:
//   <TypologySheet
//     visible={sheetOpen}
//     onClose={() => setSheetOpen(false)}
//     value={{ typology: 'trilocale', bedrooms: 2, bathrooms: 1, sqm: '85' }}
//     onChange={setValue}
//   />

import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ScrollView,
  TextInput, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../lib/theme';

const TYPOLOGIES = [
  { id: 'monolocale',   label: 'Monolocale',   sub: '1 ambiente',   icon: 'home-outline' },
  { id: 'bilocale',     label: 'Bilocale',     sub: '1 camera',     icon: 'home-outline' },
  { id: 'trilocale',    label: 'Trilocale',    sub: '2 camere',     icon: 'home-outline' },
  { id: 'quadrilocale', label: 'Quadrilocale', sub: '3 camere',     icon: 'home-outline' },
  { id: '5locali',      label: '5 locali',     sub: 'Grande',       icon: 'home-outline' },
  { id: '6locali',      label: '6 locali',     sub: 'Molto grande', icon: 'home-outline' },
  { id: '7locali',      label: '7+ locali',    sub: 'Villa/attico', icon: 'home-outline' },
] as const;

export type TypologyValue = {
  typology: string;
  bedrooms: number;
  bathrooms: number;
  sqm: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  value: TypologyValue;
  onChange: (v: TypologyValue) => void;
};

// ── StyleSheet declared before component to avoid Hermes TDZ issues ──
const { height: WIN_H } = Dimensions.get('window');

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,36,32,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: WIN_H * 0.9,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: -6 } },
      android: { elevation: 12 },
    }),
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.borderLight,
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  optional: {
    textTransform: 'none',
    color: Colors.textTertiary,
    fontWeight: '600',
  },

  // tipologia grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: '48%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  typeCardOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 8,
  },
  typeLabelOn: { color: '#fff' },
  typeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  typeSubOn: { color: 'rgba(255,255,255,0.85)' },

  // stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  stepValue: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.6,
    minWidth: 60,
    textAlign: 'center',
  },

  // sqm
  sqmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    paddingHorizontal: 14,
    height: 48,
  },
  sqmInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  sqmUnit: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textTertiary,
  },
  sqmQuickRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  sqmChip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sqmChipOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.accentLight,
  },
  sqmChipTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  sqmChipTxtOn: {
    color: Colors.primary,
  },

  // footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.3,
  },
  saveBtn: {
    flex: 2,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTxt: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
});

// ── Sub-component: Stepper ──
function Stepper({
  value, onChange, min, max,
}: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={[styles.stepBtn, value <= min && styles.stepBtnDisabled]}
        onPress={() => onChange(value - 1)}
        disabled={value <= min}
        hitSlop={8}
      >
        <Ionicons name="remove" size={22} color={value <= min ? Colors.textTertiary : Colors.text} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        style={[styles.stepBtn, value >= max && styles.stepBtnDisabled]}
        onPress={() => onChange(value + 1)}
        disabled={value >= max}
        hitSlop={8}
      >
        <Ionicons name="add" size={22} color={value >= max ? Colors.textTertiary : Colors.text} />
      </Pressable>
    </View>
  );
}

// ── Main component ──
export default function TypologySheet({ visible, onClose, value, onChange }: Props) {
  // Draft state — changes inside the sheet are local until the user
  // taps "Conferma". "Annulla" or backdrop dismiss discards them.
  const [draft, setDraft] = useState<TypologyValue>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const setTypology = (id: string) => setDraft((d) => ({ ...d, typology: id }));
  const setBedrooms = (n: number) => setDraft((d) => ({ ...d, bedrooms: Math.max(0, Math.min(10, n)) }));
  const setBathrooms = (n: number) => setDraft((d) => ({ ...d, bathrooms: Math.max(1, Math.min(6, n)) }));
  const setSqm = (s: string) => setDraft((d) => ({ ...d, sqm: s.replace(/\D/g, '') }));

  const handleConfirm = () => {
    onChange(draft);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Grabber */}
        <View style={styles.grabber} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Dettagli casa</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={18} color={Colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Tipologia grid */}
          <Text style={styles.sectionLabel}>Tipologia</Text>
          <View style={styles.grid}>
            {TYPOLOGIES.map(t => {
              const on = draft.typology === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTypology(t.id)}
                  style={[styles.typeCard, on && styles.typeCardOn]}
                >
                  <Ionicons
                    name={t.icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={on ? '#fff' : Colors.text}
                  />
                  <Text style={[styles.typeLabel, on && styles.typeLabelOn]}>{t.label}</Text>
                  <Text style={[styles.typeSub, on && styles.typeSubOn]}>{t.sub}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Stepper camere */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Camere da letto</Text>
          <Stepper value={draft.bedrooms} onChange={setBedrooms} min={0} max={10} />

          {/* Stepper bagni */}
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Bagni</Text>
          <Stepper value={draft.bathrooms} onChange={setBathrooms} min={1} max={6} />

          {/* Input mq */}
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
            Superficie <Text style={styles.optional}>(opzionale)</Text>
          </Text>
          <View style={styles.sqmRow}>
            <TextInput
              value={draft.sqm}
              onChangeText={setSqm}
              placeholder="Es. 85"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
              style={styles.sqmInput}
            />
            <Text style={styles.sqmUnit}>m²</Text>
          </View>

          {/* Quick-select mq */}
          <View style={styles.sqmQuickRow}>
            {['50', '75', '100', '150'].map(v => (
              <Pressable
                key={v}
                onPress={() => setSqm(v)}
                style={[styles.sqmChip, draft.sqm === v && styles.sqmChipOn]}
              >
                <Text style={[styles.sqmChipTxt, draft.sqm === v && styles.sqmChipTxtOn]}>{v} m²</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* CTA Annulla / Conferma */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelTxt}>Annulla</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleConfirm}>
              <Text style={styles.saveTxt}>Conferma</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

---

### `components/WelcomeModal.tsx`

```tsx
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
            {firstName?.trim() ? (
              <>
                Benvenuto in CleanHome,{"\n"}
                <Text style={styles.titleAccent}>{firstName}!</Text>
              </>
            ) : (
              <Text style={styles.titleAccent}>Benvenuto in CleanHome!</Text>
            )}
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
```
