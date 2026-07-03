import React, { useEffect, useId } from 'react'
import { StyleSheet } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle } from 'react-native-svg'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

// ─── Layout constants ──────────────────────────────────────────────────────────
const TRACK_W = 68
const TRACK_H = 36
const PAD = 3
const KNOB = TRACK_H - PAD * 2          // 30
const TRAVEL = TRACK_W - KNOB - PAD * 2 // 32
const CHECK_LEN = 19 // ≈ real length of the check path (no draw-on dead zone)

// ─── Spring configs ────────────────────────────────────────────────────────────
const SPRING = { damping: 14, stiffness: 170, mass: 0.7 }
const SPRING_FAST = { damping: 14, stiffness: 320 }

// ─── Palette ───────────────────────────────────────────────────────────────────
// CLIENT = warm vibrant orange (left side) — pushed toward true orange so it
// never reads yellow/olive once the inset shadow is layered on top.
const CLIENT_A = '#FF8A33'   // top of gradient — clean orange (less yellow)
const CLIENT_B = '#F0610D'   // bottom — deep saturated orange
const CLIENT_INK = '#B14E00' // glyph tint on the knob (person icon)
const CLIENT_HALO = '#FF8A33'

// PRO = forest green (right side)
const PRO_A = '#2DD496'      // top — light emerald
const PRO_B = '#0FA576'      // bottom — deep teal-green
const PRO_INK = '#0A7A56'    // glyph tint on the knob (check icon)
const PRO_HALO = '#19E3A6'

// Dimmed alpha for the inactive half — muted so the active side dominates
const MUTE = 0.38

const AnimatedPath = Animated.createAnimatedComponent(Path)

type ToggleMode = 'cleaner' | 'client'

interface ProfileToggleProps {
  mode: ToggleMode
  onPress: () => void
  disabled?: boolean
}

export function ProfileToggle({
  mode,
  onPress,
  disabled = false,
}: ProfileToggleProps) {
  const isPro = mode === 'cleaner'  // Professionista = right, Cliente = left
  const ink   = isPro ? PRO_INK : CLIENT_INK
  const halo  = isPro ? PRO_HALO : CLIENT_HALO
  const uid   = useId().replace(/:/g, '')

  // Knob rests at 0 (left = Cliente) or TRAVEL (right = Professionista)
  const rest     = isPro ? TRAVEL : 0
  const position = useSharedValue(rest)
  const isDragging   = useSharedValue(false)
  const knobScale    = useSharedValue(1)
  const check        = useSharedValue(isPro ? 1 : 0)
  const glyphIn      = useSharedValue(0)
  const bloom        = useSharedValue(0)
  // Animate knob progress [0=client, 1=pro] for the halves opacity
  const progress = useSharedValue(isPro ? 1 : 0)

  useEffect(() => {
    // Reset glyph entrance whenever the active side changes
    glyphIn.value = 0
    glyphIn.value = withDelay(170, withTiming(1, { duration: 220, easing: Easing.out(Easing.back(1.6)) }))

    // Checkmark draw-on for Pro; immediate show for Cliente
    check.value = isPro
      ? withDelay(210, withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }))
      : 1

    // Halo bloom on settle
    bloom.value = withDelay(
      150,
      withSequence(
        withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 380 })
      )
    )

    // Animate the half-opacity progress
    progress.value = withSpring(isPro ? 1 : 0, SPRING)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro])

  // ── Gestures ────────────────────────────────────────────────────────────────

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onEnd(() => {
      // Optimistic: spring knob to the opposite side, then fire onPress
      const target = isPro ? 0 : TRAVEL
      position.value = withSpring(target, SPRING)
      progress.value = withSpring(isPro ? 0 : 1, SPRING)
      runOnJS(onPress)()
    })

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      isDragging.value = true
      knobScale.value  = withSpring(1.08, SPRING_FAST)
    })
    .onUpdate((e) => {
      const next = Math.max(0, Math.min(TRAVEL, rest + e.translationX))
      position.value = next
      progress.value = next / TRAVEL
    })
    .onEnd(() => {
      isDragging.value = false
      const knobOnRight = position.value > TRAVEL / 2
      const wantPro     = knobOnRight
      if (wantPro !== isPro) {
        position.value = withSpring(wantPro ? TRAVEL : 0, SPRING)
        progress.value = withSpring(wantPro ? 1 : 0, SPRING)
        runOnJS(onPress)()
      } else {
        position.value = withSpring(rest, SPRING)
        progress.value = withSpring(isPro ? 1 : 0, SPRING)
      }
    })
    .onFinalize(() => {
      knobScale.value = withSpring(1, { damping: 10, stiffness: 240 })
    })

  const gesture = Gesture.Race(pan, tap)

  // ── Animated styles ─────────────────────────────────────────────────────────

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.value },
      { scale: knobScale.value },
    ],
  }))

  const haloStyle = useAnimatedStyle(() => ({
    opacity: bloom.value * 0.5,
    transform: [{ scale: 0.7 + bloom.value * 0.9 }],
  }))

  const glyphStyle = useAnimatedStyle(() => ({
    opacity: glyphIn.value,
    transform: [{ scale: 0.5 + glyphIn.value * 0.5 }],
  }))

  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_LEN * (1 - check.value),
  }))

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.track,
          { shadowColor: halo, opacity: disabled ? 0.5 : 1 },
        ]}
      >
        {/* ── Track: single pill in the ACTIVE role's colour, so the visible
            channel reads orange (Cliente) or green (Professionista) ── */}
        <Svg
          width={TRACK_W}
          height={TRACK_H}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id={`tr_${uid}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={isPro ? PRO_A : CLIENT_A} />
              <Stop offset="1" stopColor={isPro ? PRO_B : CLIENT_B} />
            </LinearGradient>
            {/* top inner light */}
            <LinearGradient id={`tl_${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
              <Stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
            </LinearGradient>
            {/* bottom inset shadow for a recessed channel — kept light so it
                doesn't muddy the orange into olive */}
            <LinearGradient id={`ts_${uid}`} x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="#000000" stopOpacity="0.10" />
              <Stop offset="0.4" stopColor="#000000" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width={TRACK_W} height={TRACK_H} rx={TRACK_H / 2} fill={`url(#tr_${uid})`} />
          <Rect width={TRACK_W} height={TRACK_H} rx={TRACK_H / 2} fill={`url(#ts_${uid})`} />
          <Rect width={TRACK_W} height={TRACK_H} rx={TRACK_H / 2} fill={`url(#tl_${uid})`} />
        </Svg>

        {/* Role dots — subtle pill-end indicators */}
        <Svg
          width={TRACK_W}
          height={TRACK_H}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        >
          {/* Left dot = client position marker */}
          <Circle cx={PAD + KNOB / 2} cy={TRACK_H / 2} r="2.2" fill="#ffffff" opacity="0.45" />
          {/* Right dot = pro position marker */}
          <Circle cx={TRACK_W - PAD - KNOB / 2} cy={TRACK_H / 2} r="2.2" fill="#ffffff" opacity="0.45" />
        </Svg>

        {/* ── Knob ── */}
        <Animated.View style={[styles.knob, thumbStyle]}>
          {/* Halo bloom */}
          <Animated.View
            pointerEvents="none"
            style={[styles.halo, { backgroundColor: halo }, haloStyle]}
          />
          {/* White knob body: gradient + bevel */}
          <Svg width={KNOB} height={KNOB} viewBox={`0 0 ${KNOB} ${KNOB}`}>
            <Defs>
              <LinearGradient id={`kn_${uid}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#ffffff" />
                <Stop offset="1" stopColor="#eef2f0" />
              </LinearGradient>
              <LinearGradient id={`kb_${uid}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
                <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect
              width={KNOB}
              height={KNOB}
              rx={KNOB / 2}
              fill={`url(#kn_${uid})`}
            />
            {/* top sheen */}
            <Rect
              x="2"
              y="2"
              width={KNOB - 4}
              height={KNOB / 2}
              rx={(KNOB - 4) / 2}
              fill={`url(#kb_${uid})`}
            />
          </Svg>

          {/* Role glyph */}
          <Animated.View
            style={[StyleSheet.absoluteFillObject, styles.glyphWrap, glyphStyle]}
          >
            <Svg width={KNOB} height={KNOB} viewBox="0 0 24 24">
              {isPro ? (
                // Check mark for Professionista — draws on
                <AnimatedPath
                  d="M6 12.5l4 4L18 6.5"
                  stroke={ink}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  strokeDasharray={CHECK_LEN}
                  animatedProps={checkProps}
                />
              ) : (
                // Person silhouette for Cliente
                <>
                  <Circle cx="12" cy="9" r="3.2" fill={ink} />
                  <Path
                    d="M6.2 18.5c0-3.1 2.7-4.8 5.8-4.8s5.8 1.7 5.8 4.8c0 .6-.4 1-1 1H7.2c-.6 0-1-.4-1-1Z"
                    fill={ink}
                  />
                </>
              )}
            </Svg>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: 'center',
    // Opaque backing so iOS casts the colored halo shadow (a clipping
    // overflow:hidden would also kill the shadow — the SVG pills already
    // round the corners, so it isn't needed). The colour is fully covered
    // by the gradient panels above.
    backgroundColor: '#1a1a1a',
    // Shadow color is set dynamically (halo of active role)
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  knob: {
    position: 'absolute',
    left: PAD,
    top: PAD,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Knob shadow for lift illusion
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 6,
  },
  halo: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
  },
  glyphWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
