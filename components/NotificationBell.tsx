import { useCallback, useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth";
import { useUnreadNotificationsCount } from "../lib/hooks/useUnreadNotificationsCount";
import { NotificationsDropdown } from "./NotificationsDropdown";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NotificationBellProps {
  /** Icon and badge accent color. Defaults to "#022420" (client theme). */
  color?: string;
  /** Hit area size for the pressable. Defaults to 40. */
  size?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationBell({
  color = "#022420",
  size = 40,
}: NotificationBellProps) {
  const { user } = useAuth();
  const { count } = useUnreadNotificationsCount(user?.id);
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);

  const handlePress = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const badgeLabel = count > 9 ? "9+" : count > 0 ? String(count) : null;

  // Position the dropdown below the status bar + top inset + header (≈56px)
  const dropdownTopOffset = insets.top + 56;

  return (
    <>
      <Pressable
        onPress={handlePress}
        accessibilityLabel={
          count > 0 ? `Notifiche, ${count} non lette` : "Notifiche"
        }
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.wrap,
          { width: size, height: size, borderRadius: size / 2 },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="notifications-outline" size={22} color={color} />

        {badgeLabel !== null && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.65,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ba1a1a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: 12,
  },
});
