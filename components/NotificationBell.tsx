import { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PColor } from "../lib/design/pulitori";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  cancelAnimation,
} from "react-native-reanimated";
import { useAuth } from "../lib/auth";
import { useUnreadNotificationsCount } from "../lib/hooks/useUnreadNotificationsCount";
import { NotificationsDropdown } from "./NotificationsDropdown";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NotificationBellProps {
  /** Outline icon color. Defaults to the shared green ink. */
  color?: string;
  /** Hit area size for the pressable. Defaults to 46. */
  size?: number;
}

// ─── Shared outline glyph ─────────────────────────────────────────────────────

function BellGlyph({ color, size }: { color: string; size: number }) {
  return <Ionicons name="notifications-outline" size={size} color={color} accessible={false} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationBell({
  color = PColor.ink,
  size = 46,
}: NotificationBellProps) {
  const { user } = useAuth();
  const { count } = useUnreadNotificationsCount(user?.id);
  const insets = useSafeAreaInsets();

  const bellRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchorBottom, setAnchorBottom] = useState(insets.top + 56);

  // ── Animation values ───────────────────────────────────────────────────────
  // swing    — Z-axis pendulum rotation (degrees)
  // press    — tactile scale dip on press
  // tilt     — X-axis rotation for pseudo-3D depth
  // badgePop — badge spring scale on new notification
  const swing    = useSharedValue(0);
  const press    = useSharedValue(1);
  const tilt     = useSharedValue(0);
  const badgePop = useSharedValue(1);

  // ── Ring animation ─────────────────────────────────────────────────────────
  // Pendulum with real physics feel: big first swing, attenuating oscillation.
  // rotateX tilts the bell forward on the first swing so it reads as 3D.
  const ring = useCallback(() => {
    swing.value = withSequence(
      withTiming(-20, { duration: 85 }),
      withTiming(15,  { duration: 115 }),
      withTiming(-10, { duration: 100 }),
      withTiming(7,   { duration: 90  }),
      withTiming(-4,  { duration: 80  }),
      withTiming(0,   { duration: 130 })
    );
    tilt.value = withSequence(
      withTiming(14, { duration: 100 }),
      withTiming(-4, { duration: 180 }),
      withTiming(0,  { duration: 200 })
    );
  }, [swing, tilt]);

  // Periodic ring while there are unread notifications
  useEffect(() => {
    if (count <= 0) return;

    // Pop the badge when count changes (new notification arrived)
    badgePop.value = withSequence(
      withSpring(1.4, { damping: 8, stiffness: 380 }),
      withSpring(1.0, { damping: 14, stiffness: 260 })
    );

    ring(); // ring immediately on first render with unread
    const id = setInterval(ring, 5200);
    return () => {
      clearInterval(id);
      cancelAnimation(swing);
      cancelAnimation(tilt);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, ring]);

  // ── Animated styles ────────────────────────────────────────────────────────
  //
  // Pivot near the top of the bell: translate down by ~30% of size so the
  // rotation origin sits at the hanger, then translate back.
  const pivotOffset = size * 0.28;

  const bellStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 400 },
      { translateY: -pivotOffset },
      { rotateZ: `${swing.value}deg` },
      { rotateX: `${tilt.value}deg` },
      { translateY: pivotOffset },
      { scale: press.value },
    ],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgePop.value }],
  }));

  // ── Event handlers ─────────────────────────────────────────────────────────

  const handlePress = useCallback(() => {
    ring();
    const node = bellRef.current;
    if (node) {
      node.measureInWindow((_x, y, _w, h) => {
        if (h > 0) setAnchorBottom(y + h);
        setOpen(true);
      });
    } else {
      setOpen(true);
    }
  }, [ring]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const badgeLabel = count > 9 ? "9+" : count > 0 ? String(count) : null;
  const dropdownTopOffset = anchorBottom;

  // Match the 22px outline family while retaining the existing hit-area API.
  const glyph = Math.round(size * (22 / 46));

  return (
    <>
      <Pressable
        ref={bellRef}
        onPress={handlePress}
        onPressIn={() => {
          press.value = withSpring(0.84, { damping: 11, stiffness: 340 });
          ring();
        }}
        onPressOut={() => {
          press.value = withSpring(1, { damping: 10, stiffness: 260 });
        }}
        accessibilityLabel={
          count > 0 ? `Notifiche, ${count} non lette` : "Notifiche"
        }
        accessibilityRole="button"
        style={[
          styles.wrap,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Animated.View style={bellStyle}>
          <BellGlyph color={color} size={glyph} />
        </Animated.View>

        {badgeLabel !== null && (
          <Animated.View style={[styles.badge, badgeStyle]}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </Animated.View>
        )}
      </Pressable>

      <NotificationsDropdown
        visible={open}
        onClose={handleClose}
        userId={user?.id}
        topOffset={dropdownTopOffset}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 1,
    right: 1,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: PColor.error,
    alignItems: "center",
    justifyContent: "center",
    // White ring around badge so it pops on any background
    borderWidth: 2,
    borderColor: PColor.white,
  },
  badgeText: {
    color: PColor.white,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
});
