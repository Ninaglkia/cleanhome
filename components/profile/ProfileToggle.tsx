import React, { useEffect } from 'react'
import { Pressable, View, StyleSheet } from 'react-native'
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Circle,
} from 'react-native-svg'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'

const TRACK_W = 56
const TRACK_H = 32
const PAD = 3
const KNOB = 26 // TRACK_H - PAD*2
const TRAVEL = TRACK_W - KNOB - PAD * 2 // 56-26-6 = 24

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
  // cleaner: knob a destra (progress=1); client: knob a sinistra (progress=0)
  const progress = useSharedValue(mode === 'cleaner' ? 1 : 0)

  useEffect(() => {
    progress.value = withSpring(mode === 'cleaner' ? 1 : 0, {
      damping: 14,
      stiffness: 160,
    })
  }, [mode, progress])

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: PAD + progress.value * TRAVEL }],
  }))

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={{ opacity: disabled ? 0.5 : 1 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: mode === 'cleaner' }}
    >
      <View style={styles.track}>
        {/* Track background — SVG gradient */}
        <Svg
          width={TRACK_W}
          height={TRACK_H}
          style={StyleSheet.absoluteFillObject}
        >
          <Defs>
            {mode === 'cleaner' ? (
              <LinearGradient id="toggleGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#37D69E" />
                <Stop offset="1" stopColor="#0FA576" />
              </LinearGradient>
            ) : (
              <LinearGradient id="toggleGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#DDBC92" />
                <Stop offset="1" stopColor="#BE9256" />
              </LinearGradient>
            )}
          </Defs>
          <Rect
            width={TRACK_W}
            height={TRACK_H}
            rx={TRACK_H / 2}
            fill="url(#toggleGrad)"
          />
        </Svg>
        {/* Animated knob */}
        <Animated.View style={[styles.knob, thumbStyle]}>
          <Svg width={KNOB} height={KNOB} viewBox="0 0 26 26">
            {mode === 'cleaner' ? (
              // check verde
              <Path
                d="M7 13.5l4.5 4.5L19 9"
                stroke="#0FA576"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ) : (
              // persona marrone
              <>
                <Circle cx="13" cy="9" r="3.4" fill="#B5824D" />
                <Path
                  d="M6.6 20c0-3.4 2.9-5.2 6.4-5.2s6.4 1.8 6.4 5.2c0 .6-.4 1-1 1H7.6c-.6 0-1-.4-1-1Z"
                  fill="#B5824D"
                />
              </>
            )}
          </Svg>
        </Animated.View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  knob: {
    position: 'absolute',
    left: 0,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
})
