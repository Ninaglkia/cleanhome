/** CleanHome Casa launch: a gentle zoom followed by a quiet floating motion. */
import React, { useCallback, useEffect, useRef } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { CleanHomeMark } from "../brand/CleanHomeMark";
import { BrandColor } from "../../lib/design/brand";

export interface HoloSplashProps {
  shouldExit: boolean;
  onExitComplete: () => void;
}

// Retain the existing public name so the root launch gate stays unchanged.
export default function HoloSplash({ shouldExit, onExitComplete }: HoloSplashProps) {
  const reducedMotion = useReducedMotion();
  const logoScale = useSharedValue(reducedMotion ? 1 : 0.78);
  const logoY = useSharedValue(reducedMotion ? 0 : 12);
  const idleY = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const titleY = useSharedValue(reducedMotion ? 0 : 8);
  const titleOpacity = useSharedValue(0);
  const canvasOpacity = useSharedValue(1);
  const exitCallback = useRef(onExitComplete);
  exitCallback.current = onExitComplete;
  const finishExit = useCallback(() => exitCallback.current(), []);

  useEffect(() => {
    canvasOpacity.value = 1;
    logoOpacity.value = withTiming(1, { duration: reducedMotion ? 120 : 300 });
    titleOpacity.value = withDelay(
      reducedMotion ? 0 : 180,
      withTiming(1, { duration: reducedMotion ? 120 : 320 }),
    );

    if (reducedMotion) {
      logoScale.value = 1;
      logoY.value = 0;
      idleY.value = 0;
      titleY.value = 0;
    } else {
      logoScale.value = withSequence(
        withTiming(1.035, { duration: 440, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 210, easing: Easing.inOut(Easing.quad) }),
        withRepeat(
          withTiming(1.016, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        ),
      );
      logoY.value = withTiming(0, { duration: 650, easing: Easing.out(Easing.cubic) });
      titleY.value = withDelay(
        180,
        withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }),
      );
      idleY.value = withDelay(
        650,
        withRepeat(
          withTiming(-3, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        ),
      );
    }

    return () => {
      cancelAnimation(logoScale);
      cancelAnimation(logoY);
      cancelAnimation(idleY);
      cancelAnimation(logoOpacity);
      cancelAnimation(titleY);
      cancelAnimation(titleOpacity);
      cancelAnimation(canvasOpacity);
    };
  }, [reducedMotion, canvasOpacity, logoScale, logoY, idleY, logoOpacity, titleY, titleOpacity]);

  useEffect(() => {
    if (!shouldExit) return;

    const duration = reducedMotion ? 120 : 260;
    logoScale.value = withTiming(reducedMotion ? 1 : 1.12, {
      duration,
      easing: Easing.in(Easing.quad),
    });
    canvasOpacity.value = withTiming(0, { duration }, (finished) => {
      if (finished) runOnJS(finishExit)();
    });

    return () => cancelAnimation(canvasOpacity);
  }, [shouldExit, reducedMotion, logoScale, canvasOpacity, finishExit]);

  const canvasStyle = useAnimatedStyle(() => ({
    backgroundColor: BrandColor.background,
    opacity: canvasOpacity.value,
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoY.value + idleY.value }, { scale: logoScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    color: BrandColor.foreground,
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  return (
    <Animated.View
      className="flex-1 items-center justify-center pb-10"
      style={canvasStyle}
      accessible
      accessibilityRole="image"
      accessibilityLabel="CleanHome"
    >
      <Animated.View style={logoStyle}>
        <CleanHomeMark size={168} />
      </Animated.View>
      <Animated.Text
        className="mt-5 text-[38px] font-bold tracking-[-1.6px]"
        style={titleStyle}
        accessible={false}
      >
        CleanHome
      </Animated.Text>
    </Animated.View>
  );
}
