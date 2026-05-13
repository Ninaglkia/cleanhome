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
