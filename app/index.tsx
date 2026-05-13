import { useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useAuth } from "../lib/auth";
import HouseIcon, {
  TILE_SIZE,
  DOOR_CENTER_IN_TILE_X,
  DOOR_CENTER_IN_TILE_Y,
} from "../components/splash/HouseIcon";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

SplashScreen.preventAutoHideAsync();

// ─── Phase timeline (matches design handoff PDF) ──────────────────────────────
const T_MOUNT = 50;
const T_IDLE = 1400;
const T_ZOOM = 2400;              // zoom starts (single fluid motion 1→60)
const ZOOM_DURATION = 2000;       // per design spec
const T_DOOR_OPEN = 3300;         // door starts opening 900ms into zoom
const DOOR_OPEN_DURATION = 600;   // 3D rotateY -78deg
const T_INSIDE = 4400;            // navigate

const SCALE_MAX = 60;

// ─── Door pivot in screen coordinates ─────────────────────────────────────────
const TILE_CENTER_X = SCREEN_W / 2;
const TILE_CENTER_Y = SCREEN_H * 0.42;
const DOOR_SCREEN_X = TILE_CENTER_X + (DOOR_CENTER_IN_TILE_X - TILE_SIZE / 2);
const DOOR_SCREEN_Y = TILE_CENTER_Y + (DOOR_CENTER_IN_TILE_Y - TILE_SIZE / 2);
const DOOR_DX = DOOR_SCREEN_X - SCREEN_W / 2;
const DOOR_DY = DOOR_SCREEN_Y - SCREEN_H / 2;


export default function SplashScreenView() {
  const { isLoading, user, profile } = useAuth();
  const router = useRouter();

  // Entry & idle
  const mount = useSharedValue(0);
  const idleFloat = useSharedValue(0);
  const idlePulse = useSharedValue(0);

  // Outro — world zoom (moderate)
  const worldScale = useSharedValue(1);
  const titleOpacity = useSharedValue(0);

  // Door animation
  const doorOpen = useSharedValue(0);
  const doorGlow = useSharedValue(0);

  // Final dark fade — fades in as we exit through the doorway,
  // hides the moment of transition to the next screen.
  const exitFade = useSharedValue(0);
  // Dim of the world during go-through (we're entering a darker space)
  const worldDim = useSharedValue(0);
  // Loading dots (3 mint dots that bounce during idle)
  const dotsOpacity = useSharedValue(0);
  const dotPulse = useSharedValue(0);

  const onLayoutReady = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  const navigateAway = async () => {
    // Non-logged-in users ALWAYS see the onboarding tour first.
    // Returning users can tap "Ho già un account — Accedi" from the tour
    // to jump to the login screen.
    if (!user) {
      router.replace("/onboarding/features");
    } else if (!profile || !profile.cleaner_onboarded) {
      router.replace("/onboarding/welcome");
    } else if (profile.active_role === "cleaner") {
      router.replace("/(tabs)/cleaner-home");
    } else {
      router.replace("/(tabs)/home");
    }
  };

  // ─── Entrance choreography ────────────────────────────────────────────────
  useEffect(() => {
    mount.value = withDelay(
      T_MOUNT,
      withTiming(1, {
        duration: 900,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      })
    );
    titleOpacity.value = withDelay(
      T_MOUNT + 200,
      withTiming(1, {
        duration: 700,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      })
    );

    idleFloat.value = withDelay(
      T_IDLE,
      withRepeat(
        withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );
    idlePulse.value = withDelay(
      T_IDLE,
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );

    // Loading dots fade in at idle, then bounce continuously
    dotsOpacity.value = withDelay(
      T_IDLE,
      withTiming(0.85, { duration: 400, easing: Easing.out(Easing.cubic) })
    );
    dotPulse.value = withDelay(
      T_IDLE,
      withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        -1,
        false
      )
    );
  }, []);

  // ─── Outro (per design handoff PDF) ──────────────────────────────────────
  // Single fluid camera move: scale 1 → 60 over 2000ms with ease-zoom.
  // Door opens 3D rotateY -78° at 900ms in (~scale 10x). Final blackout.
  useEffect(() => {
    if (isLoading) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Title + dots fade out as zoom begins
    timers.push(
      setTimeout(() => {
        titleOpacity.value = withTiming(0, {
          duration: 400,
          easing: Easing.out(Easing.cubic),
        });
        dotsOpacity.value = withTiming(0, { duration: 250 });
      }, T_ZOOM - 200)
    );

    // ZOOM — single fluid scale 1→60 over 2000ms with ease-zoom (per design)
    timers.push(
      setTimeout(() => {
        worldScale.value = withTiming(SCALE_MAX, {
          duration: ZOOM_DURATION,
          easing: Easing.bezier(0.5, 0, 0.85, 0.3),
        });
      }, T_ZOOM)
    );

    // DOOR OPENS — 3D rotateY -78° at 900ms into zoom (scale ~10x at that point)
    timers.push(
      setTimeout(() => {
        doorOpen.value = withTiming(1, {
          duration: DOOR_OPEN_DURATION,
          easing: Easing.bezier(0.5, 0, 0.3, 1),
        });
        doorGlow.value = withTiming(1, {
          duration: 400,
          easing: Easing.out(Easing.cubic),
        });
      }, T_DOOR_OPEN)
    );

    // Late blackout — covers navigation handoff
    timers.push(
      setTimeout(() => {
        worldDim.value = withTiming(1, {
          duration: 500,
          easing: Easing.in(Easing.cubic),
        });
        exitFade.value = withDelay(
          200,
          withTiming(1, { duration: 400, easing: Easing.in(Easing.cubic) })
        );
      }, T_INSIDE - 600)
    );

    // Navigate when fade is complete
    timers.push(
      setTimeout(() => {
        runOnJS(navigateAway)();
      }, T_INSIDE)
    );

    return () => timers.forEach(clearTimeout);
  }, [isLoading, user, profile]);

  // ─── World transform: scale + perfect centering on door ───────────────────
  // Pivot math that ALSO smoothly slides the door to screen center as we zoom.
  // At s=1: identity (door at natural y, slightly above center).
  // At s=SCALE_MAX: door is exactly on screen center (0, 0).
  // Formula: ty = -DOOR_DY * (SCALE_MAX / (SCALE_MAX - 1)) * (s - 1)
  const CENTERING_FACTOR = SCALE_MAX / (SCALE_MAX - 1);
  const worldStyle = useAnimatedStyle(() => {
    const s = worldScale.value;
    return {
      opacity: 1 - worldDim.value * 0.85,
      transform: [
        { translateX: -DOOR_DX * CENTERING_FACTOR * (s - 1) },
        { translateY: -DOOR_DY * CENTERING_FACTOR * (s - 1) },
        { scale: s },
      ],
    };
  });

  // ─── Icon entrance + idle float ────────────────────────────────────────────
  const iconStyle = useAnimatedStyle(() => {
    const m = mount.value;
    const float = idleFloat.value;
    return {
      opacity: m,
      transform: [
        { translateX: -TILE_SIZE / 2 },
        { translateY: -TILE_SIZE / 2 + (1 - m) * 30 + float * -6 },
        { scale: 0.85 + 0.15 * m },
      ],
    };
  });

  // ─── Title ─────────────────────────────────────────────────────────────────
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: (1 - titleOpacity.value) * 16 }],
  }));

  // Final dark fade — covers the screen at end of "going through" so the
  // navigation handoff is invisible.
  const exitStyle = useAnimatedStyle(() => ({
    opacity: exitFade.value,
  }));

  // 3 bouncing loading dots — visible during idle phase
  const dotsStyle = useAnimatedStyle(() => ({
    opacity: dotsOpacity.value,
  }));

  // Each dot bounces with a phase offset (sequential bounce, design uses 0.15s stagger)
  const dot1Style = useAnimatedStyle(() => {
    const phase = dotPulse.value % 1;
    const bounce = phase < 0.4 ? Math.sin((phase / 0.4) * Math.PI) : 0;
    return {
      opacity: 0.4 + bounce * 0.6,
      transform: [{ translateY: -bounce * 6 }],
    };
  });
  const dot2Style = useAnimatedStyle(() => {
    const phase = (dotPulse.value + 0.15) % 1;
    const bounce = phase < 0.4 ? Math.sin((phase / 0.4) * Math.PI) : 0;
    return {
      opacity: 0.4 + bounce * 0.6,
      transform: [{ translateY: -bounce * 6 }],
    };
  });
  const dot3Style = useAnimatedStyle(() => {
    const phase = (dotPulse.value + 0.3) % 1;
    const bounce = phase < 0.4 ? Math.sin((phase / 0.4) * Math.PI) : 0;
    return {
      opacity: 0.4 + bounce * 0.6,
      transform: [{ translateY: -bounce * 6 }],
    };
  });

  return (
    <View style={styles.container} onLayout={onLayoutReady}>
      {/* Scaling world */}
      <Animated.View style={[StyleSheet.absoluteFill, worldStyle]}>
        {/* House icon */}
        <Animated.View
          style={[
            {
              position: "absolute",
              left: SCREEN_W / 2,
              top: SCREEN_H * 0.42,
            },
            iconStyle,
          ]}
        >
          <HouseIcon
            doorOpen={doorOpen}
            doorGlow={doorGlow}
            idle={idlePulse}
          />
        </Animated.View>

        {/* Title */}
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              top: SCREEN_H * 0.62,
              alignItems: "center",
            },
            titleStyle,
          ]}
        >
          <Text style={styles.brand}>CleanHome</Text>
          <Text style={styles.tagline}>LA TUA CASA AL MEGLIO</Text>
        </Animated.View>

        {/* 3 bouncing loading dots near bottom */}
        <Animated.View style={[styles.dotsRow, dotsStyle]}>
          <Animated.View style={[styles.dot, dot1Style]} />
          <Animated.View style={[styles.dot, dot2Style]} />
          <Animated.View style={[styles.dot, dot3Style]} />
        </Animated.View>
      </Animated.View>

      {/* Final dark fade — covers screen during navigation handoff */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.exit, exitStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#062a23",
    overflow: "hidden",
  },
  dotsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 80,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#3ee0a8",
  },
  brand: {
    color: "#ffffff",
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -0.7,
  },
  tagline: {
    marginTop: 10,
    color: "#3ee0a8",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 3.5,
  },
  exit: {
    backgroundColor: "#062a23",
  },
});

