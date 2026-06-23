import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Polygon,
  Path,
  Circle,
  Ellipse,
  Line,
  G,
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
const BEIGE = "#f4ead4";
const BEIGE_HI = "#fbf4e4"; // roof ridge / highlights
const BEIGE_LO = "#e3d2ad"; // shaded cream
const EAVE = "#cdb98c"; // roof underside / eave separation line
const DOOR_DARK = "#26473a";
const DOOR_HI = "#33594a";
const MINT = "#3ee0a8";
const MINT_BRIGHT = "#aef7d8";
const WARM = "#ffd98a"; // window light
const WARM_CORE = "#fff1cf";

// ─── Tile dimensions ──────────────────────────────────────────────────────────
export const TILE_SIZE = 168;
const RADIUS = 38;

// ─── Door geometry (tile-local coords, used as the zoom pivot) ─────────────────
const DOOR_W = 22;
const DOOR_H = 28;
const DOOR_LEFT = 73; // (TILE_SIZE - DOOR_W) / 2 → horizontally centered
const DOOR_TOP = 112;

// Door center in tile-local coords — app/index.tsx zooms the camera onto this point.
export const DOOR_CENTER_IN_TILE_X = DOOR_LEFT + DOOR_W / 2; // 84
export const DOOR_CENTER_IN_TILE_Y = DOOR_TOP + DOOR_H / 2; // 126

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
    const scale = interpolate(phase, [0, 0.5, 1], [0.6, 1.15, 0.6]);
    const opacity = interpolate(phase, [0, 0.3, 0.7, 1], [0.25, 1, 1, 0.25]);
    const rot = interpolate(phase, [0, 1], [-14, 14]);
    return {
      opacity,
      transform: [{ scale }, { rotate: `${rot}deg` }],
    };
  });

  // Render box is larger than the star so the soft halo has room to bleed.
  const box = size * 2.1;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.sparkle, { top, left, right, bottom, width: box, height: box, marginLeft: -size * 0.55, marginTop: -size * 0.55 }, style]}
    >
      <Svg width={box} height={box} viewBox="0 0 32 32">
        <Defs>
          <RadialGradient id="sparkGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={MINT_BRIGHT} stopOpacity="0.55" />
            <Stop offset="0.5" stopColor={MINT} stopOpacity="0.18" />
            <Stop offset="1" stopColor={MINT} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* soft halo */}
        <Circle cx={16} cy={16} r={15} fill="url(#sparkGlow)" />
        {/* 4-point star */}
        <Path
          d="M16 2 L18.2 13.8 L30 16 L18.2 18.2 L16 30 L13.8 18.2 L2 16 L13.8 13.8 Z"
          fill={MINT}
        />
        {/* bright core */}
        <Circle cx={16} cy={16} r={2.4} fill={WARM_CORE} opacity={0.95} />
      </Svg>
    </Animated.View>
  );
}

// ─── HouseIcon ────────────────────────────────────────────────────────────────
interface HouseIconProps {
  doorOpen: SharedValue<number>; // 0 = closed, 1 = open
  doorGlow: SharedValue<number>; // 0 = off, 1 = mint interior glow
  idle: SharedValue<number>; // 0..1 breathing knob / window light
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

  // Door panel collapses with scaleX from the left hinge — at the heavy 60× world
  // scale a real 3D rotateY Z-fights, so scaleX reads identically and stays clean.
  const doorPanelStyle = useAnimatedStyle(() => {
    const o = doorOpen.value;
    return {
      opacity: 1 - o * 0.12,
      transform: [{ scaleX: Math.max(0.02, 1 - o * 0.98) }],
      transformOrigin: "left center",
    };
  });

  // Interior mint glow — fades in as the door opens.
  const doorInteriorStyle = useAnimatedStyle(() => ({ opacity: doorGlow.value }));

  // Knob breathes during idle.
  const knobStyle = useAnimatedStyle(() => ({ opacity: 0.65 + idle.value * 0.35 }));

  return (
    <View style={styles.tile}>
      {/* ── Tile + house, all crisp vector in one SVG ───────────────────────── */}
      <Svg width={TILE_SIZE} height={TILE_SIZE} viewBox="0 0 168 168" style={StyleSheet.absoluteFill}>
        <Defs>
          {/* tile: radial depth, lighter top-center → deep green edges */}
          <RadialGradient id="tileGrad" cx="50%" cy="38%" r="75%">
            <Stop offset="0" stopColor="#11574733" stopOpacity="1" />
            <Stop offset="0" stopColor="#125949" />
            <Stop offset="0.55" stopColor="#0c3f34" />
            <Stop offset="1" stopColor="#062a23" />
          </RadialGradient>
          <LinearGradient id="tileGloss" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.10" />
            <Stop offset="0.4" stopColor="#ffffff" stopOpacity="0" />
          </LinearGradient>
          {/* soft spotlight behind the house */}
          <RadialGradient id="spot" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={MINT} stopOpacity="0.16" />
            <Stop offset="1" stopColor={MINT} stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={BEIGE_HI} />
            <Stop offset="1" stopColor={BEIGE_LO} />
          </LinearGradient>
          <LinearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={BEIGE} />
            <Stop offset="1" stopColor={BEIGE_LO} />
          </LinearGradient>
          <LinearGradient id="chimGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={BEIGE_HI} />
            <Stop offset="1" stopColor={EAVE} />
          </LinearGradient>
          <RadialGradient id="winGrad" cx="50%" cy="42%" r="62%">
            <Stop offset="0" stopColor={WARM_CORE} />
            <Stop offset="0.55" stopColor={WARM} />
            <Stop offset="1" stopColor="#f3b85a" />
          </RadialGradient>
          <RadialGradient id="winHalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={WARM} stopOpacity="0.45" />
            <Stop offset="1" stopColor={WARM} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* tile background */}
        <Rect x={0} y={0} width={168} height={168} rx={RADIUS} fill="url(#tileGrad)" />
        <Rect x={0} y={0} width={168} height={168} rx={RADIUS} fill="url(#tileGloss)" />
        {/* spotlight behind house */}
        <Ellipse cx={84} cy={96} rx={70} ry={64} fill="url(#spot)" />

        {/* ground shadow */}
        <Ellipse cx={84} cy={147} rx={54} ry={9} fill="#000000" opacity={0.18} />

        {/* chimney (drawn before roof so the slope overlaps its base) */}
        <Rect x={108} y={42} width={12} height={44} rx={2.5} fill="url(#chimGrad)" />

        {/* body */}
        <Path
          d="M30 84 Q30 78 36 78 L132 78 Q138 78 138 84 L138 132 Q138 140 130 140 L38 140 Q30 140 30 132 Z"
          fill="url(#bodyGrad)"
        />

        {/* warm window halos (soft glow, no blur filter needed) */}
        <Rect x={36} y={88} width={36} height={36} rx={10} fill="url(#winHalo)" />
        <Rect x={96} y={88} width={36} height={36} rx={10} fill="url(#winHalo)" />

        {/* roof — overhangs the body, with a darker eave line + ridge highlight */}
        <Polygon points="84,33 150,87 18,87" fill="url(#roofGrad)" />
        <Line x1={18} y1={87} x2={150} y2={87} stroke={EAVE} strokeWidth={2.4} strokeLinecap="round" />
        <Line x1={84} y1={37} x2={120} y2={66} stroke={BEIGE_HI} strokeWidth={2} strokeLinecap="round" opacity={0.7} />

        {/* left window */}
        <G>
          <Rect x={45} y={96} width={24} height={22} rx={4} fill="url(#winGrad)" />
          <Line x1={57} y1={96} x2={57} y2={118} stroke={BEIGE} strokeWidth={2} />
          <Line x1={45} y1={107} x2={69} y2={107} stroke={BEIGE} strokeWidth={2} />
          <Rect x={43} y={119} width={28} height={3} rx={1.5} fill={BEIGE_LO} />
        </G>

        {/* right window */}
        <G>
          <Rect x={99} y={96} width={24} height={22} rx={4} fill="url(#winGrad)" />
          <Line x1={111} y1={96} x2={111} y2={118} stroke={BEIGE} strokeWidth={2} />
          <Line x1={99} y1={107} x2={123} y2={107} stroke={BEIGE} strokeWidth={2} />
          <Rect x={97} y={119} width={28} height={3} rx={1.5} fill={BEIGE_LO} />
        </G>

        {/* door frame (cream trim) + recess (dark) — the animated panel sits on top */}
        <Rect x={70} y={108} width={28} height={32} rx={9} fill={BEIGE_HI} />
        <Rect x={73} y={112} width={22} height={28} rx={7} fill="#06251f" />
      </Svg>

      {/* ── Sparkles (Animated, bleed outside the tile) ─────────────────────── */}
      <Sparkle top={26} left={22} size={13} delay={0} pulse={pulse} />
      <Sparkle top={20} right={26} size={18} delay={0.25} pulse={pulse} />
      <Sparkle top={78} right={12} size={10} delay={0.55} pulse={pulse} />
      <Sparkle bottom={34} left={16} size={9} delay={0.8} pulse={pulse} />

      {/* ── DOOR ASSEMBLY (opens to reveal mint interior) ───────────────────── */}
      <View
        style={{
          position: "absolute",
          top: DOOR_TOP,
          left: DOOR_LEFT,
          width: DOOR_W,
          height: DOOR_H,
          borderTopLeftRadius: 7,
          borderTopRightRadius: 7,
          borderBottomLeftRadius: 1,
          borderBottomRightRadius: 1,
          overflow: "hidden",
        }}
      >
        {/* mint interior glow — fades in as door opens */}
        <Animated.View style={[StyleSheet.absoluteFill, doorInteriorStyle]}>
          <Svg width={DOOR_W} height={DOOR_H} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="interior" cx="50%" cy="58%" r="65%">
                <Stop offset="0" stopColor={MINT_BRIGHT} />
                <Stop offset="1" stopColor={MINT} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={DOOR_W} height={DOOR_H} fill="url(#interior)" />
          </Svg>
        </Animated.View>

        {/* door panel — collapses on scaleX from the left hinge */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: DOOR_DARK,
              borderTopLeftRadius: 7,
              borderTopRightRadius: 7,
              borderBottomLeftRadius: 1,
              borderBottomRightRadius: 1,
            },
            doorPanelStyle,
          ]}
        >
          {/* subtle hinge-side highlight for depth */}
          <View style={styles.doorHinge} />
          {/* knob with glow */}
          <Animated.View style={[styles.knob, knobStyle]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: RADIUS,
    // sparkles bleed outside the tile bounds
    overflow: "visible",
  },
  sparkle: {
    position: "absolute",
  },
  doorHinge: {
    position: "absolute",
    left: 2,
    top: 4,
    bottom: 4,
    width: 1.5,
    borderRadius: 1,
    backgroundColor: DOOR_HI,
    opacity: 0.8,
  },
  knob: {
    position: "absolute",
    right: 3.5,
    top: "54%",
    width: 3.2,
    height: 3.2,
    borderRadius: 1.6,
    backgroundColor: MINT_BRIGHT,
    shadowColor: MINT,
    shadowOpacity: 0.9,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 0 },
  },
});
