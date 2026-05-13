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
