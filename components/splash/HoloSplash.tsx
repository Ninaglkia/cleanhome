/**
 * HoloSplash — premium iridescent holographic splash for CleanHome
 *
 * Visual language: "Emerald Holo Studio"
 *   - Near-black deep-green background (#04140f → #0a1a14), full-bleed
 *   - House emblem filled with an oil-slick iridescent gradient that SHIFTS:
 *     achieved by two gradient SVG layers cross-fading continuously (worklet-driven)
 *   - God-ray beams (SVG polygon fans) slowly rotating behind the emblem
 *   - Glossy diagonal highlight sweep every ~3.5 s
 *   - Soft bloom: 3 layered semi-transparent emblem copies, gently pulsing
 *   - Gentle float (±6 px translateY) + breath (scale 0.99 ↔ 1.01)
 *   - Wordmark + tagline slide-up / fade-in ~600 ms after emblem
 *   - Twinkling sparkle stars
 *
 * Tech: react-native-reanimated + react-native-svg only. Zero new deps.
 * All animation runs on the UI thread via shared values + useAnimatedStyle.
 */

import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions, Text } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Polygon,
  Path,
  Rect,
  Circle,
  G,
  ClipPath,
} from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withDelay,
  withSequence,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";

const { width: W, height: H } = Dimensions.get("window");
const CX = W / 2;
const CY = H * 0.42;

// Emblem size
const EMBLEM = 160;
const E_HALF = EMBLEM / 2;

// God-ray count
const RAY_COUNT = 8;
const RAY_LEN = W * 1.5;
const RAY_SPREAD = 11; // degrees half-angle per ray

// God-ray holo colors — brand green/teal/mint palette, one warm-gold accent
const RAY_COLORS = [
  "#006b55", // deep forest green
  "#0fc8a8", // teal
  "#3ee0a8", // mint
  "#82f4d1", // light mint
  "#ffd98a", // warm gold accent
  "#0a6b55", // mid forest green
  "#14c8b0", // teal-cyan
  "#3ef0b0", // bright mint
];

export interface HoloSplashProps {
  /** When true, triggers the exit animation */
  shouldExit: boolean;
  /** Called (via runOnJS) once the exit animation completes */
  onExitComplete: () => void;
}

export default function HoloSplash({ shouldExit, onExitComplete }: HoloSplashProps) {
  // ─── Shared values ────────────────────────────────────────────────────────
  const mountProgress = useSharedValue(0);   // 0→1, emblem entrance spring
  const titleProgress = useSharedValue(0);   // 0→1, title fade-in
  const floatY = useSharedValue(0);          // 0→1, float ±6 px
  const breathScale = useSharedValue(0);     // 0→1, scale 0.99↔1.01
  const bloomPulse = useSharedValue(0);      // 0→1, outer glow pulse

  // Oil-slick: two gradient layers cross-fade, phase 0→1 looping
  const gradCrossFade = useSharedValue(0);

  // God-ray rotation 0→360
  const rayDeg = useSharedValue(0);

  // Highlight sweep position: -1 (left off-screen) → +1 (right off-screen)
  const sweepX = useSharedValue(-2);

  // Sparkle pulses
  const spark1 = useSharedValue(0);
  const spark2 = useSharedValue(0);
  const spark3 = useSharedValue(0);
  const spark4 = useSharedValue(0);
  const spark5 = useSharedValue(0);

  // Exit screen fade
  const exitFade = useSharedValue(0);

  // ─── Entrance choreography ────────────────────────────────────────────────
  useEffect(() => {
    // Emblem springs in
    mountProgress.value = withDelay(
      80,
      withSpring(1, { damping: 14, stiffness: 90, mass: 0.9 })
    );

    // Title slides + fades 600 ms later
    titleProgress.value = withDelay(
      680,
      withTiming(1, { duration: 700, easing: Easing.bezier(0.22, 1, 0.36, 1) })
    );

    // Idle float
    floatY.value = withDelay(
      900,
      withRepeat(
        withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );

    // Breath
    breathScale.value = withDelay(
      900,
      withRepeat(
        withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );

    // Bloom pulse
    bloomPulse.value = withDelay(
      800,
      withRepeat(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );

    // Oil-slick cross-fade loop: 8 s per cycle
    gradCrossFade.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );

    // God-rays rotation: 20 s full turn
    rayDeg.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );

    // Highlight sweep — fires once then repeats every 3.6 s
    const fireSweep = () => {
      sweepX.value = -2;
      sweepX.value = withTiming(2, {
        duration: 900,
        easing: Easing.bezier(0.4, 0, 0.6, 1),
      });
    };
    fireSweep();
    const sweepTimer = setInterval(fireSweep, 3600);

    // Sparkles staggered
    const startSpark = (sv: typeof spark1, delay: number) => {
      sv.value = withDelay(
        800 + delay,
        withRepeat(
          withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
          -1,
          true
        )
      );
    };
    startSpark(spark1, 0);
    startSpark(spark2, 320);
    startSpark(spark3, 640);
    startSpark(spark4, 960);
    startSpark(spark5, 180);

    return () => clearInterval(sweepTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Exit choreography ────────────────────────────────────────────────────
  useEffect(() => {
    if (!shouldExit) return;
    exitFade.value = withTiming(1, {
      duration: 400,
      easing: Easing.in(Easing.cubic),
    }, (finished) => {
      if (finished) runOnJS(onExitComplete)();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldExit]);

  // ─── Animated styles ──────────────────────────────────────────────────────

  // Full container: dims on exit
  const containerStyle = useAnimatedStyle(() => ({
    opacity: 1 - exitFade.value,
  }));

  // God-ray wrapper
  const raysStyle = useAnimatedStyle(() => ({
    opacity: mountProgress.value * 0.6,
    transform: [{ rotate: `${rayDeg.value}deg` }],
  }));

  // Emblem: spring entrance + float + breath
  const emblemStyle = useAnimatedStyle(() => {
    const m = mountProgress.value;
    const sc = 0.3 + 0.7 * m;
    const breath = 0.99 + breathScale.value * 0.02;
    const floatOffset = floatY.value * -6;
    return {
      opacity: m,
      transform: [
        { scale: sc * breath },
        { translateY: floatOffset },
      ],
    };
  });

  // Gradient layer A (solid holo)
  const gradAStyle = useAnimatedStyle(() => ({
    opacity: 1 - gradCrossFade.value * 0.55,
  }));

  // Gradient layer B (phase-shifted holo)
  const gradBStyle = useAnimatedStyle(() => ({
    opacity: gradCrossFade.value * 0.85,
  }));

  // Bloom 1 (closest ring)
  const bloom1Style = useAnimatedStyle(() => {
    const m = mountProgress.value;
    const p = bloomPulse.value;
    return {
      opacity: m * (0.18 + p * 0.10),
      transform: [
        { scale: 1.22 + p * 0.06 },
        { translateY: floatY.value * -6 },
      ],
    };
  });

  // Bloom 2 (mid ring)
  const bloom2Style = useAnimatedStyle(() => {
    const m = mountProgress.value;
    const p = bloomPulse.value;
    return {
      opacity: m * (0.10 + p * 0.06),
      transform: [
        { scale: 1.55 + p * 0.08 },
        { translateY: floatY.value * -6 },
      ],
    };
  });

  // Bloom 3 (far ring)
  const bloom3Style = useAnimatedStyle(() => {
    const m = mountProgress.value;
    const p = bloomPulse.value;
    return {
      opacity: m * (0.05 + p * 0.03),
      transform: [
        { scale: 2.0 + p * 0.12 },
        { translateY: floatY.value * -6 },
      ],
    };
  });

  // Highlight sweep: translates across the emblem
  const sweepStyle = useAnimatedStyle(() => {
    const tx = sweepX.value * EMBLEM * 0.9;
    const rawOpacity = 1 - Math.abs(sweepX.value) * 0.7;
    const opacity = Math.max(0, rawOpacity) * mountProgress.value * 0.8;
    return {
      opacity,
      transform: [{ translateX: tx }],
    };
  });

  // Title
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleProgress.value,
    transform: [{ translateY: (1 - titleProgress.value) * 20 }],
  }));

  // Sparkle helper
  const makeSparkStyle = (sv: typeof spark1) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({
      opacity: interpolate(sv.value, [0, 0.3, 0.7, 1], [0.08, 1, 1, 0.08]) * mountProgress.value,
      transform: [
        { scale: interpolate(sv.value, [0, 0.5, 1], [0.3, 1.2, 0.3]) },
        { rotate: `${interpolate(sv.value, [0, 1], [-18, 18])}deg` },
      ],
    }));

  const s1Style = makeSparkStyle(spark1);
  const s2Style = makeSparkStyle(spark2);
  const s3Style = makeSparkStyle(spark3);
  const s4Style = makeSparkStyle(spark4);
  const s5Style = makeSparkStyle(spark5);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[StyleSheet.absoluteFill, containerStyle]} pointerEvents="none">
      {/* ── Background vertical gradient (dark studio) ─────────────────────── */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#04140f" stopOpacity="1" />
              <Stop offset="100%" stopColor="#0a1a14" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={W} height={H} fill="url(#bgGrad)" />
        </Svg>
      </View>

      {/* ── God-ray beams (rotating behind emblem) ─────────────────────────── */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: W * 3,
            height: W * 3,
            left: CX - W * 1.5,
            top: CY - W * 1.5,
          },
          raysStyle,
        ]}
      >
        <Svg
          width={W * 3}
          height={W * 3}
          viewBox={`0 0 ${W * 3} ${W * 3}`}
        >
          <Defs>
            {RAY_COLORS.map((color, i) => (
              <LinearGradient
                key={`rg${i}`}
                id={`rg${i}`}
                x1={`${W * 1.5}`}
                y1={`${W * 1.5}`}
                x2={`${W * 1.5}`}
                y2={`${W * 1.5 - RAY_LEN}`}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor={color} stopOpacity="0.50" />
                <Stop offset="0.35" stopColor={color} stopOpacity="0.22" />
                <Stop offset="1" stopColor={color} stopOpacity="0" />
              </LinearGradient>
            ))}
          </Defs>
          {RAY_COLORS.map((_, i) => {
            const angle = (i / RAY_COUNT) * 360;
            const cx = W * 1.5;
            const cy = W * 1.5;
            const a1 = ((angle - RAY_SPREAD) * Math.PI) / 180;
            const a2 = ((angle + RAY_SPREAD) * Math.PI) / 180;
            const x1 = cx + Math.cos(a1) * RAY_LEN;
            const y1 = cy + Math.sin(a1) * RAY_LEN;
            const x2 = cx + Math.cos(a2) * RAY_LEN;
            const y2 = cy + Math.sin(a2) * RAY_LEN;
            return (
              <Polygon
                key={i}
                points={`${cx},${cy} ${x1},${y1} ${x2},${y2}`}
                fill={`url(#rg${i})`}
              />
            );
          })}
        </Svg>
      </Animated.View>

      {/* ── Bloom layers (emblem glow rings) ───────────────────────────────── */}
      {(
        [
          [bloom1Style, "#0fc8a8", 0.7],
          [bloom2Style, "#3ee0a8", 0.5],
          [bloom3Style, "#82f4d1", 0.3],
        ] as [ReturnType<typeof useAnimatedStyle>, string, number][]
      ).map(([blStyle, color, op], idx) => (
        <Animated.View
          key={`bloom${idx}`}
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              width: EMBLEM,
              height: EMBLEM,
              left: CX - E_HALF,
              top: CY - E_HALF,
            },
            blStyle,
          ]}
        >
          <Svg width={EMBLEM} height={EMBLEM} viewBox="0 0 160 160">
            <Defs>
              <RadialGradient id={`bl${idx}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={color} stopOpacity={`${op}`} />
                <Stop offset="0.5" stopColor={color} stopOpacity="0.2" />
                <Stop offset="1" stopColor={color} stopOpacity="0" />
              </RadialGradient>
              <ClipPath id={`blClip${idx}`}>
                <HouseSilhouette />
              </ClipPath>
            </Defs>
            <Rect
              x={0}
              y={0}
              width={160}
              height={160}
              fill={`url(#bl${idx})`}
              clipPath={`url(#blClip${idx})`}
            />
          </Svg>
        </Animated.View>
      ))}

      {/* ── Main emblem ────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: EMBLEM,
            height: EMBLEM,
            left: CX - E_HALF,
            top: CY - E_HALF,
            overflow: "hidden",
          },
          emblemStyle,
        ]}
      >
        {/* Gradient Layer A — emerald → teal → mint → warm gold */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, gradAStyle]}
        >
          <Svg width={EMBLEM} height={EMBLEM} viewBox="0 0 160 160">
            <Defs>
              <LinearGradient id="holoA" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#022420" stopOpacity="1" />
                <Stop offset="20%" stopColor="#006b55" stopOpacity="1" />
                <Stop offset="45%" stopColor="#0fc8a8" stopOpacity="1" />
                <Stop offset="70%" stopColor="#3ee0a8" stopOpacity="1" />
                <Stop offset="88%" stopColor="#82f4d1" stopOpacity="1" />
                <Stop offset="100%" stopColor="#ffd98a" stopOpacity="1" />
              </LinearGradient>
              <LinearGradient id="depthA" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0" stopColor="#000000" stopOpacity="0" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0.32" />
              </LinearGradient>
              <LinearGradient id="glossA" x1="0%" y1="0%" x2="20%" y2="55%">
                <Stop offset="0" stopColor="#ffffff" stopOpacity="0.30" />
                <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </LinearGradient>
              <ClipPath id="houseClipA">
                <HouseSilhouette />
              </ClipPath>
            </Defs>
            <G clipPath="url(#houseClipA)">
              <Rect x={0} y={0} width={160} height={160} fill="url(#holoA)" />
              <Rect x={0} y={0} width={160} height={160} fill="url(#depthA)" />
              <Rect x={0} y={0} width={160} height={160} fill="url(#glossA)" />
            </G>
            <HouseSilhouette fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth={1.2} />
            <HouseDetails />
          </Svg>
        </Animated.View>

        {/* Gradient Layer B — phase-shifted (teal → cyan-mint → gold → cream) */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, gradBStyle]}
        >
          <Svg width={EMBLEM} height={EMBLEM} viewBox="0 0 160 160">
            <Defs>
              <LinearGradient id="holoB" x1="100%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#14c8b0" stopOpacity="1" />
                <Stop offset="25%" stopColor="#3ef0b0" stopOpacity="1" />
                <Stop offset="50%" stopColor="#aef7d8" stopOpacity="1" />
                <Stop offset="72%" stopColor="#fff1cf" stopOpacity="1" />
                <Stop offset="88%" stopColor="#ffd98a" stopOpacity="1" />
                <Stop offset="100%" stopColor="#0a6b55" stopOpacity="1" />
              </LinearGradient>
              <LinearGradient id="depthB" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0" stopColor="#000000" stopOpacity="0" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0.32" />
              </LinearGradient>
              <LinearGradient id="glossB" x1="0%" y1="0%" x2="20%" y2="55%">
                <Stop offset="0" stopColor="#ffffff" stopOpacity="0.30" />
                <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </LinearGradient>
              <ClipPath id="houseClipB">
                <HouseSilhouette />
              </ClipPath>
            </Defs>
            <G clipPath="url(#houseClipB)">
              <Rect x={0} y={0} width={160} height={160} fill="url(#holoB)" />
              <Rect x={0} y={0} width={160} height={160} fill="url(#depthB)" />
              <Rect x={0} y={0} width={160} height={160} fill="url(#glossB)" />
            </G>
            <HouseSilhouette fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth={1.2} />
            <HouseDetails />
          </Svg>
        </Animated.View>

        {/* Diagonal highlight sweep */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: -EMBLEM * 0.5,
              left: 0,
              width: EMBLEM * 0.20,
              height: EMBLEM * 2,
              backgroundColor: "rgba(255,255,255,0.60)",
              transform: [{ skewX: "-18deg" }],
            },
            sweepStyle,
          ]}
        />
      </Animated.View>

      {/* ── Sparkles ───────────────────────────────────────────────────────── */}
      <SparkDot style={s1Style} x={CX - 90} y={CY - 64} size={14} />
      <SparkDot style={s2Style} x={CX + 76} y={CY - 76} size={19} />
      <SparkDot style={s3Style} x={CX + 88} y={CY + 24} size={11} />
      <SparkDot style={s4Style} x={CX - 92} y={CY + 36} size={10} />
      <SparkDot style={s5Style} x={CX + 14} y={CY - 94} size={8} />

      {/* ── Wordmark + tagline ─────────────────────────────────────────────── */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            top: CY + E_HALF + 40,
            alignItems: "center",
          },
          titleStyle,
        ]}
      >
        <Text style={styles.brand} allowFontScaling={false}>
          CleanHome
        </Text>
        <Text style={styles.tagline} allowFontScaling={false}>
          LA TUA CASA AL MEGLIO
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// ─── House silhouette path (160×160 viewBox) ──────────────────────────────────
// Bold modern house: wide triangular roof + rounded-corner rectangular body.
interface SilhouetteProps {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}
function HouseSilhouette({ fill = "#ffffff", stroke, strokeWidth }: SilhouetteProps) {
  return (
    <Path
      // Compound path:
      //   Roof: triangle 80,16 → 14,74 → 146,74
      //   Body: rounded rect from 24,74 to 136,148, r=12
      d="M 80 16 L 14 74 L 24 74 L 24 136 Q 24 148 36 148 L 124 148 Q 136 148 136 136 L 136 74 L 146 74 Z"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}

// ─── Interior details (windows, door — clipped inside the silhouette) ─────────
function HouseDetails() {
  return (
    <G>
      {/* Left window */}
      <Rect x={34} y={90} width={28} height={24} rx={5} fill="rgba(0,0,0,0.30)" />
      <Path
        d="M48 90 L48 114 M34 102 L62 102"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1.2}
      />
      {/* Right window */}
      <Rect x={98} y={90} width={28} height={24} rx={5} fill="rgba(0,0,0,0.30)" />
      <Path
        d="M112 90 L112 114 M98 102 L126 102"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1.2}
      />
      {/* Door */}
      <Rect x={64} y={112} width={32} height={36} rx={9} fill="rgba(0,0,0,0.40)" />
      <Circle cx={92} cy={131} r={2.5} fill="rgba(255,255,255,0.52)" />
      {/* Roof ridge highlight */}
      <Path
        d="M80 22 L110 56"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </G>
  );
}

// ─── Sparkle dot ──────────────────────────────────────────────────────────────
interface SparkDotProps {
  style: ReturnType<typeof useAnimatedStyle>;
  x: number;
  y: number;
  size: number;
}
function SparkDot({ style, x, y, size }: SparkDotProps) {
  const box = size * 2.2;
  const uniqueId = `sg${Math.round(size * 10)}`;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: x - box / 2,
          top: y - box / 2,
          width: box,
          height: box,
        },
        style,
      ]}
    >
      <Svg width={box} height={box} viewBox="0 0 32 32">
        <Defs>
          <RadialGradient id={uniqueId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#c8f0ff" stopOpacity="0.55" />
            <Stop offset="0.6" stopColor="#3ef0b0" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#3ef0b0" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={16} cy={16} r={15} fill={`url(#${uniqueId})`} />
        {/* 4-point star */}
        <Path
          d="M16 2 L17.6 13.8 L30 16 L17.6 18.2 L16 30 L14.4 18.2 L2 16 L14.4 13.8 Z"
          fill="#c8f0ff"
        />
        <Circle cx={16} cy={16} r={2} fill="white" opacity={0.92} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: -0.8,
    textShadowColor: "rgba(62, 240, 176, 0.50)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  tagline: {
    marginTop: 10,
    color: "#3ef0b0",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 4,
    opacity: 0.88,
  },
});
