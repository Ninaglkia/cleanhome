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
 *   • Step badge (mint pill "N / total")
 *   • Navigation: "Salta tutto" (skip), "Indietro" (back), "Avanti"/"Fine"
 *
 * Animations:
 *   • Tooltip pops in with a springy cubic-bezier feel (withSpring overshoot)
 *   • Spotlight position transitions smoothly with withTiming
 *   • On dismiss, everything fades out with withTiming
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
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
const WHITE = "#ffffff";
const SCRIM = "rgba(6,42,35,0.72)";
const PADDING = 10; // spotlight padding around target

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Tooltip arrow ────────────────────────────────────────────────────────────

type ArrowDir = "up" | "down";

function TooltipArrow({ dir }: { dir: ArrowDir }) {
  if (dir === "down") {
    return (
      <View
        style={[
          styles.arrow,
          styles.arrowDown,
        ]}
      />
    );
  }
  return (
    <View
      style={[
        styles.arrow,
        styles.arrowUp,
      ]}
    />
  );
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

  // Tooltip animation — we re-trigger on step change
  const tooltipScale = useSharedValue(0.5);
  const tooltipOpacity = useSharedValue(0);

  const triggerTooltipIn = useCallback(() => {
    tooltipScale.value = 0.5;
    tooltipOpacity.value = 0;
    tooltipScale.value = withSpring(1, { damping: 10, stiffness: 120, mass: 0.8 });
    tooltipOpacity.value = withTiming(1, { duration: 220 });
  }, [tooltipScale, tooltipOpacity]);

  useEffect(() => {
    if (visible) triggerTooltipIn();
  }, [currentStep, visible, triggerTooltipIn]);

  const dismiss = useCallback(async () => {
    // Fade out entire overlay
    overlayOpacity.value = withTiming(
      0,
      { duration: 320, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(setVisible)(false);
        }
      }
    );
    try {
      await AsyncStorage.setItem(storageKey, "1");
    } catch {
      // non-critical
    }
    onDone?.();
  }, [overlayOpacity, storageKey, onDone]);

  const handleSkip = useCallback(() => {
    dismiss();
  }, [dismiss]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
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

  // Determine tooltip placement: above or below the spotlight
  const spotlightTop = step.rect.y - PADDING;
  const spotlightBottom = step.rect.y + step.rect.height + PADDING;
  const spaceBelow = SH - spotlightBottom;
  const spaceAbove = spotlightTop;
  const placeBelow = spaceBelow >= 200 || spaceBelow > spaceAbove;

  const tooltipTop = placeBelow ? spotlightBottom + 16 : undefined;
  const tooltipBottom = !placeBelow ? SH - spotlightTop + 16 : undefined;
  const arrowDir: ArrowDir = placeBelow ? "up" : "down";

  // Horizontal centering of tooltip (clamp to screen)
  const tooltipWidth = SW - 48;
  const targetCenterX = step.rect.x + step.rect.width / 2;
  let tooltipLeft = targetCenterX - tooltipWidth / 2;
  tooltipLeft = Math.max(24, Math.min(tooltipLeft, SW - tooltipWidth - 24));

  // Arrow X offset relative to tooltip container
  const arrowX = targetCenterX - tooltipLeft - 10;
  const clampedArrowX = Math.max(16, Math.min(arrowX, tooltipWidth - 32));

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.root,
          { opacity: overlayOpacity },
        ]}
        pointerEvents="box-none"
      >
        {/* ── Scrim (4 rectangles surrounding the spotlight) ── */}
        {/* Top */}
        <View
          style={[
            styles.scrimPart,
            {
              top: 0,
              left: 0,
              right: 0,
              height: Math.max(0, spotlightTop),
            },
          ]}
          pointerEvents="auto"
        />
        {/* Bottom */}
        <View
          style={[
            styles.scrimPart,
            {
              top: spotlightBottom,
              left: 0,
              right: 0,
              bottom: 0,
            },
          ]}
          pointerEvents="auto"
        />
        {/* Left */}
        <View
          style={[
            styles.scrimPart,
            {
              top: spotlightTop,
              left: 0,
              width: Math.max(0, step.rect.x - PADDING),
              height: step.rect.height + PADDING * 2,
            },
          ]}
          pointerEvents="auto"
        />
        {/* Right */}
        <View
          style={[
            styles.scrimPart,
            {
              top: spotlightTop,
              left: step.rect.x + step.rect.width + PADDING,
              right: 0,
              height: step.rect.height + PADDING * 2,
            },
          ]}
          pointerEvents="auto"
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
            styles.tooltip,
            {
              position: "absolute",
              top: tooltipTop,
              bottom: tooltipBottom,
              left: tooltipLeft,
              width: tooltipWidth,
              transformOrigin: "top center",
            },
            useAnimatedStyle(() => ({
              transform: [{ scale: tooltipScale.value }],
              opacity: tooltipOpacity.value,
            })),
          ]}
          pointerEvents="auto"
        >
          {/* Arrow — top or bottom */}
          {arrowDir === "up" && (
            <View style={[styles.arrowWrap, { left: clampedArrowX }]}>
              <TooltipArrow dir="up" />
            </View>
          )}

          <View style={styles.tooltipInner}>
            {/* Step badge + skip row */}
            <View style={styles.tooltipHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>
                  {currentStep + 1} / {totalSteps}
                </Text>
              </View>
              <Pressable
                onPress={handleSkip}
                hitSlop={10}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                accessibilityLabel="Salta tour"
                accessibilityRole="button"
              >
                <Text style={styles.skipText}>Salta tutto</Text>
              </Pressable>
            </View>

            {/* Content */}
            <Text style={styles.tooltipTitle}>{step.title}</Text>
            <Text style={styles.tooltipDescription}>{step.description}</Text>

            {/* Navigation buttons */}
            <View style={styles.navRow}>
              {currentStep > 0 ? (
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
              ) : (
                <View />
              )}
              <Pressable
                onPress={handleNext}
                style={({ pressed }) => [
                  styles.btnNext,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityLabel={isLast ? "Fine tour" : "Prossimo suggerimento"}
                accessibilityRole="button"
              >
                <Text style={styles.btnNextText}>
                  {isLast ? "Fine" : "Avanti"}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Arrow — bottom */}
          {arrowDir === "down" && (
            <View style={[styles.arrowWrapBottom, { left: clampedArrowX }]}>
              <TooltipArrow dir="down" />
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
    zIndex: 9999,
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
    zIndex: 1,
    // Glow effect via shadow
    shadowColor: MINT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 0,
  },
  tooltip: {
    zIndex: 10,
  },
  tooltipInner: {
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: DARK_GREEN,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
  },
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
  skipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: DARK_GREEN,
    letterSpacing: -0.3,
    marginBottom: 6,
    lineHeight: 24,
  },
  tooltipDescription: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
    marginBottom: 20,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  btnBack: {
    paddingHorizontal: 20,
    paddingVertical: 11,
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
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: DARK_GREEN,
    shadowColor: DARK_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
  btnNextText: {
    fontSize: 14,
    fontWeight: "700",
    color: WHITE,
  },

  // Arrow shapes (diamond / triangle)
  arrowWrap: {
    position: "absolute",
    top: -10,
    zIndex: 11,
  },
  arrowWrapBottom: {
    position: "absolute",
    bottom: -10,
    zIndex: 11,
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
