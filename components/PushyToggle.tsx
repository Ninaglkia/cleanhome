import React, { useEffect } from "react";
import { Pressable, View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

// Optional haptics — guarded so a missing module never crashes.
let Haptics: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Haptics = require("expo-haptics");
} catch {
  Haptics = null;
}

const TRACK_W = 78;
const TRACK_H = 42;
const PAD = 4;
const THUMB = TRACK_H - PAD * 2; // 34
const TRAVEL = TRACK_W - THUMB - PAD * 2; // distance the thumb slides

interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

/**
 * A chunky, "alive" toggle: red→orange gradient when on, a satisfying spring
 * with squash/stretch on the thumb and a haptic punch — inspired by the
 * "guy shoving the switch" illustration.
 */
export default function PushyToggle({ value, onChange, disabled }: Props) {
  const progress = useSharedValue(value ? 1 : 0); // 0 = off, 1 = on
  const squash = useSharedValue(1); // >1 = stretched horizontally

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, { damping: 13, stiffness: 170, mass: 0.8 });
  }, [value, progress]);

  const toggle = () => {
    if (disabled) return;
    const next = !value;
    // squash & stretch as it gets "shoved" across, then settle with overshoot
    squash.value = withSequence(
      withTiming(1.32, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 7, stiffness: 220 })
    );
    Haptics?.impactAsync?.(Haptics?.ImpactFeedbackStyle?.Medium).catch?.(() => {});
    onChange(next);
  };

  // gradient (on) cross-fades over the grey (off) track
  const gradientStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: PAD + progress.value * TRAVEL },
      { scaleX: squash.value },
      { scaleY: 2 - squash.value }, // keep volume so it looks like a real squish
    ],
  }));

  return (
    <Pressable onPress={toggle} disabled={disabled} hitSlop={8} style={{ opacity: disabled ? 0.5 : 1 }}>
      <View style={styles.track}>
        {/* grey base */}
        <View style={[StyleSheet.absoluteFill, styles.trackBase]} />
        {/* red → orange gradient (fades in when ON) */}
        <Animated.View style={[StyleSheet.absoluteFill, gradientStyle]}>
          <Svg width={TRACK_W} height={TRACK_H}>
            <Defs>
              <LinearGradient id="pushyGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#f0445b" />
                <Stop offset="1" stopColor="#ff9d2e" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={TRACK_W} height={TRACK_H} rx={TRACK_H / 2} fill="url(#pushyGrad)" />
          </Svg>
        </Animated.View>

        {/* thumb */}
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: "center",
    overflow: "hidden",
  },
  trackBase: {
    backgroundColor: "#d7dee0",
    borderRadius: TRACK_H / 2,
  },
  thumb: {
    position: "absolute",
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3.5,
    elevation: 4,
  },
});
