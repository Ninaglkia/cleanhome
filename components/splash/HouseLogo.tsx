import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  interpolate,
} from "react-native-reanimated";
import Svg, { Path, Rect, Circle, G } from "react-native-svg";

const AnimatedG = Animated.createAnimatedComponent(G);

interface HouseLogoProps {
  size?: number;
}

export function HouseLogo({ size = 88 }: HouseLogoProps) {
  // Window sparkle (windows light up rhythmically)
  const window1 = useSharedValue(0);
  const window2 = useSharedValue(0);
  // Cleaning sparkle that orbits the roof
  const orbit = useSharedValue(0);

  useEffect(() => {
    window1.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    window2.value = withDelay(
      400,
      withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );
    orbit.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
  }, [window1, window2, orbit]);

  const window1Style = useAnimatedStyle(() => ({
    opacity: interpolate(window1.value, [0, 1], [0.5, 1]),
  }));
  const window2Style = useAnimatedStyle(() => ({
    opacity: interpolate(window2.value, [0, 1], [0.5, 1]),
  }));

  const orbitStyle = useAnimatedStyle(() => {
    const angle = interpolate(orbit.value, [0, 1], [0, 360]);
    const radians = (angle * Math.PI) / 180;
    const radius = 36;
    return {
      transform: [
        { translateX: radius * Math.cos(radians) },
        { translateY: -8 + radius * Math.sin(radians) * 0.3 },
        { scale: interpolate(orbit.value, [0, 0.5, 1], [0.8, 1.2, 0.8]) },
      ],
      opacity: interpolate(orbit.value, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
    };
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Roof — deep teal, slight overhang */}
      <Path
        d="M 14 50 L 50 18 L 86 50 L 80 50 L 50 26 L 20 50 Z"
        fill="#0a3a32"
      />
      {/* Roof highlight */}
      <Path
        d="M 50 18 L 86 50 L 80 50 L 50 26 Z"
        fill="#1a5248"
      />

      {/* House body */}
      <Rect x="22" y="48" width="56" height="40" rx="3" fill="#82f4d1" />
      {/* Body shadow side */}
      <Rect x="60" y="48" width="18" height="40" rx="2" fill="#5fd4b3" />

      {/* Door */}
      <Rect x="44" y="64" width="12" height="24" rx="2" fill="#0a3a32" />
      {/* Door knob */}
      <Circle cx="53" cy="76" r="1" fill="#82f4d1" />

      {/* Windows (animated glow) */}
      <AnimatedG style={window1Style}>
        <Rect x="28" y="56" width="10" height="10" rx="1.5" fill="#fff8d4" />
        <Path
          d="M 33 56 L 33 66 M 28 61 L 38 61"
          stroke="#0a3a32"
          strokeWidth="0.8"
        />
      </AnimatedG>
      <AnimatedG style={window2Style}>
        <Rect x="62" y="56" width="10" height="10" rx="1.5" fill="#fff8d4" />
        <Path
          d="M 67 56 L 67 66 M 62 61 L 72 61"
          stroke="#0a3a32"
          strokeWidth="0.8"
        />
      </AnimatedG>

      {/* Chimney */}
      <Rect x="65" y="22" width="6" height="14" fill="#0a3a32" />
      <Rect x="64" y="20" width="8" height="3" fill="#1a5248" />

      {/* Ground line (subtle) */}
      <Rect x="14" y="88" width="72" height="1" fill="#0a3a32" opacity={0.5} />

      {/* Cleaning sparkle orbiting the house */}
      <AnimatedG style={orbitStyle} originX={50} originY={50}>
        <G x={50} y={20}>
          <Path
            d="M 0 -4 L 1 -1 L 4 0 L 1 1 L 0 4 L -1 1 L -4 0 L -1 -1 Z"
            fill="#fff8d4"
          />
        </G>
      </AnimatedG>
    </Svg>
  );
}
