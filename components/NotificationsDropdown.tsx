import { useCallback, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  useNotifications,
  type AppNotification,
  type NotificationType,
} from "../lib/hooks/useNotifications";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  background: "#f6faf9",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  surfaceContainerHigh: "#e5e9e8",
  surfaceVariant: "#dfe3e2",
  /** Ink — main text / header title */
  ink: "#14342b",
  /** Accent green — CTA text, footer, mark-read button */
  accentGreen: "#1f7a5c",
  /** Icon bg green — check squircle bg */
  accentGreenIcon: "#1f8a5b",
  /** Unread row bg */
  unreadRowBg: "#f3fbf7",
  /** Unread dot */
  unreadDot: "#1f8a5b",
  /** Amber icon */
  amberIcon: "#d99a2b",
  /** Amber icon bg */
  amberBg: "#fff3df",
  /** Blue icon */
  blueIcon: "#3a6fb0",
  /** Blue icon bg */
  blueBg: "#eaf0fb",
  error: "#ba1a1a",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
} as const;

const PANEL_HORIZONTAL_MARGIN = 12;
const PANEL_TOP_GAP = 6;
const PANEL_WIDTH = 340;
const CARET_SIZE = 10; // half-width of the triangle
const CARET_RIGHT_OFFSET = 20; // distance from right edge of panel to caret center

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NotificationsDropdownProps {
  visible: boolean;
  onClose: () => void;
  userId: string | null | undefined;
  /** Pixel offset from the top of the screen to position the panel anchor. */
  topOffset: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type IconCategory = "confirm" | "reminder" | "review" | "info";

function iconCategory(t: string): IconCategory {
  if (
    t.startsWith("booking_accepted") ||
    t.startsWith("booking_completed") ||
    t.startsWith("new_booking") ||
    t.startsWith("payment") ||
    t.startsWith("booking_confirmed")
  )
    return "confirm";
  if (t.startsWith("booking_reminder") || t.startsWith("reminder"))
    return "reminder";
  if (t.startsWith("review")) return "review";
  if (t.startsWith("message")) return "info";
  return "info";
}

interface IconConfig {
  name: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  bgColor: string;
}

function getIconConfig(type: NotificationType): IconConfig {
  switch (iconCategory(type)) {
    case "confirm":
      return {
        name: "checkmark",
        iconColor: "#ffffff",
        bgColor: C.accentGreenIcon,
      };
    case "reminder":
      return {
        name: "time-outline",
        iconColor: C.amberIcon,
        bgColor: C.amberBg,
      };
    case "review":
      return {
        name: "star-outline",
        iconColor: C.blueIcon,
        bgColor: C.blueBg,
      };
    case "info":
    default:
      return {
        name: "chatbubble-outline",
        iconColor: C.onSurfaceVariant,
        bgColor: C.surfaceContainerHigh,
      };
  }
}

function formatTimestamp(created_at: string): string {
  const date = new Date(created_at);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Adesso";
  if (diffMin < 60) return `${diffMin} min fa`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h fa`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}g fa`;
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

// ─── Notification row ─────────────────────────────────────────────────────────

interface RowProps {
  item: AppNotification;
  onPress: (id: string, linkPath: string | null) => void;
}

const NotificationRow = ({ item, onPress }: RowProps) => {
  const isUnread = !item.read_at;
  const iconConfig = getIconConfig(item.type);

  const handlePress = useCallback(() => {
    onPress(item.id, item.link_path);
  }, [item.id, item.link_path, onPress]);

  return (
    <Animated.View entering={FadeInDown.springify().damping(20)}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.row,
          isUnread ? styles.rowUnread : styles.rowRead,
          pressed && styles.rowPressed,
        ]}
        accessibilityLabel={`Notifica: ${item.title}`}
        accessibilityRole="button"
      >
        {/* Squircle icon — 40x40 radius 11 */}
        <View
          style={[
            styles.rowIcon,
            { backgroundColor: iconConfig.bgColor },
          ]}
        >
          <Ionicons
            name={iconConfig.name}
            size={18}
            color={iconConfig.iconColor}
          />
        </View>

        <View style={styles.rowBody}>
          <View style={styles.rowTopRow}>
            <Text
              style={[
                styles.rowTitle,
                isUnread ? styles.rowTitleUnread : styles.rowTitleRead,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <View style={styles.rowTimestampWrap}>
              <Text style={styles.rowTimestamp}>
                {formatTimestamp(item.created_at)}
              </Text>
              {/* Unread dot — 8px, right of timestamp */}
              {isUnread && <View style={styles.unreadDotView} />}
            </View>
          </View>

          <Text
            style={[
              styles.rowDescription,
              !isUnread && styles.rowDescriptionRead,
            ]}
            numberOfLines={2}
          >
            {item.body}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ─── Separator ────────────────────────────────────────────────────────────────

const Separator = () => <View style={styles.separator} />;

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Ionicons
        name="notifications-off-outline"
        size={28}
        color={C.outlineVariant}
      />
      <Text style={styles.emptyText}>Nessuna notifica</Text>
    </View>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

export function NotificationsDropdown({
  visible,
  onClose,
  userId,
  topOffset,
}: NotificationsDropdownProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, markAsRead, markAllAsRead } =
    useNotifications(userId);

  const unreadCount = useMemo(
    () => (data ?? []).filter((n) => !n.read_at).length,
    [data]
  );

  const handleRowPress = useCallback(
    (id: string, linkPath: string | null) => {
      markAsRead(id);
      onClose();
      if (linkPath) {
        setTimeout(() => {
          router.push(linkPath as never);
        }, 50);
      }
    },
    [markAsRead, onClose, router]
  );

  const handleSeeAll = useCallback(() => {
    onClose();
    setTimeout(() => {
      router.push("/(tabs)/notifications" as never);
    }, 50);
  }, [onClose, router]);

  const keyExtractor = useCallback((item: AppNotification) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => (
      <NotificationRow item={item} onPress={handleRowPress} />
    ),
    [handleRowPress]
  );

  // Panel anchors: right-aligned below the header.
  const panelTop = topOffset + PANEL_TOP_GAP + CARET_SIZE; // leave room for caret above panel
  const panelRight = Math.max(PANEL_HORIZONTAL_MARGIN, 16 + insets.right);

  // Caret sits ABOVE the panel, tip pointing upward, horizontally offset so
  // its center aligns with the bell icon (CARET_RIGHT_OFFSET from panel right).
  const caretTop = topOffset + PANEL_TOP_GAP;
  const caretRight = panelRight + CARET_RIGHT_OFFSET;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Full-screen backdrop — tap to close */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Caret / triangle above the panel */}
        <View
          style={[styles.caret, { top: caretTop, right: caretRight }]}
          pointerEvents="none"
        />

        {/* Stop propagation so tapping the panel doesn't close it */}
        <Pressable
          style={[styles.panel, { top: panelTop, right: panelRight }]}
          onPress={() => {
            // swallow touch — prevent backdrop from receiving it
          }}
        >
          {/* Panel header */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Notifiche</Text>
            {unreadCount > 0 && !isLoading && (
              <Pressable
                onPress={markAllAsRead}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.markAllBtn}
                accessibilityLabel="Segna lette"
                accessibilityRole="button"
              >
                <Text style={styles.markAllText}>Segna lette</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.divider} />

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={C.accentGreen} />
            </View>
          ) : (
            <FlatList
              data={data ?? []}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              ItemSeparatorComponent={Separator}
              ListEmptyComponent={<EmptyState />}
              showsVerticalScrollIndicator={false}
              maxToRenderPerBatch={10}
              windowSize={3}
              style={styles.list}
              contentContainerStyle={
                (data ?? []).length === 0
                  ? styles.listEmptyContainer
                  : undefined
              }
            />
          )}

          {/* Footer — "Vedi tutte" */}
          <View style={styles.footerDivider} />
          <Pressable
            onPress={handleSeeAll}
            style={({ pressed }) => [
              styles.footer,
              pressed && styles.footerPressed,
            ]}
            accessibilityLabel="Vedi tutte le notifiche"
            accessibilityRole="button"
          >
            <Text style={styles.footerText}>Vedi tutte</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  // ── Caret ─────────────────────────────────────────────────────────────────────
  // A CSS-style triangle pointing upward, rendered via border trick.
  caret: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: CARET_SIZE,
    borderRightWidth: CARET_SIZE,
    borderBottomWidth: CARET_SIZE,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: C.surface,
  },

  // ── Panel ─────────────────────────────────────────────────────────────────────
  panel: {
    position: "absolute",
    width: PANEL_WIDTH,
    maxHeight: 480,
    backgroundColor: C.surface,
    borderRadius: 22,
    shadowColor: "#022420",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    overflow: "hidden",
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  panelTitle: {
    fontFamily: "System",
    fontSize: 17,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.3,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.accentGreen,
  },
  divider: {
    height: 1,
    backgroundColor: C.outlineVariant,
    opacity: 0.5,
  },

  // ── List ──────────────────────────────────────────────────────────────────────
  list: {
    flexGrow: 0,
  },
  listEmptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  separator: {
    height: 1,
    backgroundColor: C.surfaceLow,
    marginHorizontal: 18,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: "center",
  },

  // ── Row ───────────────────────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowUnread: {
    backgroundColor: C.unreadRowBg,
  },
  rowRead: {
    backgroundColor: C.surface,
  },
  rowPressed: {
    opacity: 0.75,
  },
  // Squircle 40x40 radius 11
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  rowTitleUnread: {
    color: C.ink,
  },
  rowTitleRead: {
    color: `${C.ink}99`,
  },
  rowTimestampWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  // 8px dot, right of timestamp
  unreadDotView: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.unreadDot,
  },
  rowTimestamp: {
    fontSize: 10,
    color: `${C.onSurfaceVariant}99`,
    fontWeight: "500",
  },
  rowDescription: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    lineHeight: 17,
  },
  rowDescriptionRead: {
    opacity: 0.7,
  },

  // ── Footer ────────────────────────────────────────────────────────────────────
  footerDivider: {
    height: 1,
    backgroundColor: C.outlineVariant,
    opacity: 0.4,
  },
  footer: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  footerPressed: {
    opacity: 0.65,
  },
  footerText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.accentGreen,
  },

  // ── Empty ─────────────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    fontWeight: "500",
  },
});
