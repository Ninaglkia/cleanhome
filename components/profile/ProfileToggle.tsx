import React, { useCallback, useEffect, useId } from 'react'
import { StyleSheet, type AccessibilityActionEvent } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle, ClipPath } from 'react-native-svg'
import Animated, {
  cancelAnimation,
  interpolateColor,
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useReducedMotion,
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

// ─── Spring configs ────────────────────────────────────────────────────────────
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

const AnimatedRect = Animated.createAnimatedComponent(Rect)

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
  const uid   = useId().replace(/:/g, '')
  const reducedMotion = useReducedMotion()

  // Knob rests at 0 (left = Cliente) or TRAVEL (right = Professionista)
  const position = useSharedValue(isPro ? TRAVEL : 0)
  const dragStart = useSharedValue(isPro ? TRAVEL : 0)
  const currentRole = useSharedValue(isPro ? 1 : 0)
  const isDragging = useSharedValue(false)
  const isSettling = useSharedValue(false)
  const knobScale = useSharedValue(1)
  const bloom = useSharedValue(0)
  // One source of truth for the knob, reveal, halo and glyphs.
  const progress = useDerivedValue(() => Math.max(0, Math.min(1, position.value / TRAVEL)))

  useEffect(() => {
    currentRole.value = isPro ? 1 : 0
    // Also follow role updates from outside the control, without fighting a drag.
    if (!isDragging.value) {
      isSettling.value = false
      position.value = withTiming(isPro ? TRAVEL : 0, {
        duration: reducedMotion ? 0 : 220,
        easing: Easing.out(Easing.cubic),
      })
    }
    bloom.value = reducedMotion ? 0 : withDelay(
      150,
      withSequence(
        withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 380 }),
      )
    )
    return () => cancelAnimation(bloom)
  }, [isPro, disabled, reducedMotion, currentRole, isDragging, isSettling, position, bloom])

  useEffect(() => () => {
    cancelAnimation(position)
    cancelAnimation(knobScale)
    cancelAnimation(bloom)
  }, [position, knobScale, bloom])

  const settleTo = useCallback((wantPro: boolean, notify: boolean) => {
    'worklet'
    const target = wantPro ? TRAVEL : 0
    isSettling.value = true
    // Commit after the visible sweep; the parent swaps the two profile views.
    position.value = withTiming(target, {
      duration: reducedMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (!finished) return
      isSettling.value = false
      if (notify && Number(wantPro) !== currentRole.value) runOnJS(onPress)()
    })
  }, [position, isSettling, reducedMotion, currentRole, onPress])

  const handleAccessibilityAction = useCallback((event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName !== 'activate' || disabled || isDragging.value || isSettling.value) return
    settleTo(currentRole.value === 0, true)
  }, [disabled, isDragging, isSettling, currentRole, settleTo])

  // ── Gestures ────────────────────────────────────────────────────────────────

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onEnd((_event, success) => {
      if (success && !isDragging.value && !isSettling.value) {
        settleTo(currentRole.value === 0, true)
      }
    })

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-3, 3])
    .failOffsetY([-12, 12])
    .onStart(() => {
      cancelAnimation(position)
      dragStart.value = position.value
      isSettling.value = false
      isDragging.value = true
      knobScale.value = reducedMotion ? 1 : withSpring(1.08, SPRING_FAST)
    })
    .onUpdate((e) => {
      const next = Math.max(0, Math.min(TRAVEL, dragStart.value + e.translationX))
      position.value = next
    })
    .onEnd((_event, success) => {
      if (!success) return
      isDragging.value = false
      settleTo(position.value > TRAVEL / 2, true)
    })
    .onFinalize(() => {
      // An interrupted active pan returns to the controlled role, without firing.
      if (isDragging.value) {
        isDragging.value = false
        settleTo(currentRole.value === 1, false)
      }
      knobScale.value = reducedMotion ? 1 : withSpring(1, SPRING_FAST)
    })

  const gesture = Gesture.Race(pan, tap)

  // ── Animated styles ─────────────────────────────────────────────────────────

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.value },
      { scale: knobScale.value },
    ],
  }))

  const trackStyle = useAnimatedStyle(() => ({
    shadowColor: interpolateColor(progress.value, [0, 1], [CLIENT_HALO, PRO_HALO]),
  }))

  const haloStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [CLIENT_HALO, PRO_HALO]),
    opacity: bloom.value * 0.15,
    transform: [{ scale: 0.7 + bloom.value * 0.9 }],
  }))

  const clientGlyphStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }))
  const proGlyphStyle = useAnimatedStyle(() => ({ opacity: progress.value }))
  const revealProps = useAnimatedProps(() => ({
    // Keep the division hidden below the knob; clear both end caps at rest.
    width: progress.value <= 0 ? 0 : progress.value >= 1
      ? TRACK_W
      : PAD + KNOB / 2 + position.value,
  }))

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.touchTarget, { opacity: disabled ? 0.5 : 1 }]}
        collapsable={false}
        accessible
        accessibilityRole="switch"
        accessibilityLabel="Modalità Professionista"
        accessibilityValue={{ text: isPro ? 'Professionista' : 'Cliente' }}
        accessibilityState={{ checked: isPro, disabled }}
        accessibilityActions={[{ name: 'activate', label: 'Cambia modalità' }]}
        onAccessibilityAction={handleAccessibilityAction}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.track,
            trackStyle,
          ]}
        >
          {/* Orange base, with green revealed spatially behind the moving knob. */}
          <Svg
            width={TRACK_W}
            height={TRACK_H}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id={`client_${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={CLIENT_A} />
                <Stop offset="1" stopColor={CLIENT_B} />
              </LinearGradient>
              <LinearGradient id={`pro_${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={PRO_A} />
                <Stop offset="1" stopColor={PRO_B} />
              </LinearGradient>
              <ClipPath id={`reveal_${uid}`}>
                <AnimatedRect x={0} y={0} height={TRACK_H} animatedProps={revealProps} />
              </ClipPath>
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
            <Rect width={TRACK_W} height={TRACK_H} rx={TRACK_H / 2} fill={`url(#client_${uid})`} />
            <Rect width={TRACK_W} height={TRACK_H} rx={TRACK_H / 2} fill={`url(#pro_${uid})`} clipPath={`url(#reveal_${uid})`} />
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
              style={[styles.halo, haloStyle]}
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

            {/* Both glyphs remain mounted and crossfade with the finger. */}
            <Animated.View
              style={[StyleSheet.absoluteFillObject, styles.glyphWrap, proGlyphStyle]}
            >
              <Svg width={KNOB} height={KNOB} viewBox="0 0 24 24">
                <Path
                  d="M6 12.5l4 4L18 6.5"
                  stroke={PRO_INK}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            </Animated.View>
            <Animated.View
              style={[StyleSheet.absoluteFillObject, styles.glyphWrap, clientGlyphStyle]}
            >
              <Svg width={KNOB} height={KNOB} viewBox="0 0 24 24">
                <Circle cx="12" cy="9" r="3.2" fill={CLIENT_INK} />
                <Path
                  d="M6.2 18.5c0-3.1 2.7-4.8 5.8-4.8s5.8 1.7 5.8 4.8c0 .6-.4 1-1 1H7.2c-.6 0-1-.4-1-1Z"
                  fill={CLIENT_INK}
                />
              </Svg>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  touchTarget: {
    width: TRACK_W,
    height: 44,
    justifyContent: 'center',
  },
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
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
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
