import { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Path, Circle, Ellipse } from "react-native-svg";
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
  /** Icon and badge accent color. Defaults to "#022420" (client theme). */
  color?: string;
  /** Hit area size for the pressable. Defaults to 46. */
  size?: number;
}

// ─── Bell SVG — premium filled bell with inner highlight ─────────────────────

function BellGlyph({ color, size }: { color: string; size: number }) {
  // Bell body sits inside a viewBox of 24×24, scaled to `size`
  // A subtle linear gradient overlaid gives the illusion of 3D depth:
  // top-left highlight → transparent → slight bottom shadow.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        {/* Inner highlight: top-left is a bit lighter, giving the bell depth */}
        <LinearGradient id="bell_shine" x1="0.15" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0.32" />
          <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0.10" />
        </LinearGradient>
      </Defs>

      {/* Bell body — filled, rounded dome with flared skirt */}
      <Path
        d={[
          // Dome: arc from left shoulder to right shoulder
          "M12 2.5",
          "C8.2 2.5 5.2 5.6 5.2 9.4",
          // Left side down along the body
          "L5.2 14.8",
          // Left skirt flare
          "C5.2 15.6 4.4 16.2 3.6 16.5",
          "C3.0 16.8 2.8 17.4 3.0 17.9",
          "C3.2 18.4 3.7 18.7 4.2 18.7",
          "L19.8 18.7",
          // Right skirt and up
          "C20.3 18.7 20.8 18.4 21.0 17.9",
          "C21.2 17.4 21.0 16.8 20.4 16.5",
          "C19.6 16.2 18.8 15.6 18.8 14.8",
          "L18.8 9.4",
          "C18.8 5.6 15.8 2.5 12 2.5Z",
        ].join(" ")}
        fill={color}
      />
      {/* Highlight overlay on the bell body */}
      <Path
        d={[
          "M12 2.5",
          "C8.2 2.5 5.2 5.6 5.2 9.4",
          "L5.2 14.8",
          "C5.2 15.6 4.4 16.2 3.6 16.5",
          "C3.0 16.8 2.8 17.4 3.0 17.9",
          "C3.2 18.4 3.7 18.7 4.2 18.7",
          "L19.8 18.7",
          "C20.3 18.7 20.8 18.4 21.0 17.9",
          "C21.2 17.4 21.0 16.8 20.4 16.5",
          "C19.6 16.2 18.8 15.6 18.8 14.8",
          "L18.8 9.4",
          "C18.8 5.6 15.8 2.5 12 2.5Z",
        ].join(" ")}
        fill="url(#bell_shine)"
      />

      {/* Clapper / ringer — dome at the bottom */}
      <Path
        d="M10.1 19.8a2.1 2.1 0 0 0 3.8 0Z"
        fill={color}
      />

      {/* Stem / hook at the top */}
      <Circle cx="12" cy="2.5" r="1.3" fill={color} />

      {/* Small specular highlight dot — top-left of dome, reads as glossy 3D */}
      <Ellipse cx="9" cy="7.5" rx="1.4" ry="0.9" fill="#ffffff" opacity="0.35" />
    </Svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationBell({
  color = "#022420",
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

  // The glyph occupies ~60% of the hit-area for a bold, present feel
  const glyph = Math.round(size * 0.60);

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
    backgroundColor: "#E0382B",
    alignItems: "center",
    justifyContent: "center",
    // White ring around badge so it pops on any background
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
});
