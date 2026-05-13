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
