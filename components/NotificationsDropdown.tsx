import { useCallback, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";
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
  primary: "#022420",
  secondary: "#006b55",
  error: "#ba1a1a",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
} as const;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NotificationsDropdownProps {
  visible: boolean;
  onClose: () => void;
  userId: string | null | undefined;
  /** Pixel offset from the top of the screen to position the panel anchor. */
  topOffset: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTypeIcon(
  type: NotificationType
): React.ComponentProps<typeof Ionicons>["name"] {
  switch (type) {
    case "booking":
      return "calendar-outline";
    case "message":
      return "chatbubble-outline";
    case "system":
      return "shield-checkmark-outline";
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
  const iconName = getTypeIcon(item.type);

  const handlePress = useCallback(() => {
    onPress(item.id, item.link_path);
  }, [item.id, item.link_path, onPress]);

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(20)}
      layout={Layout.springify()}
    >
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
        <View
          style={[
            styles.rowIcon,
            isUnread ? styles.rowIconUnread : styles.rowIconRead,
          ]}
        >
          <Ionicons
            name={iconName}
            size={18}
            color={isUnread ? C.secondary : C.primary}
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
              {isUnread && <View style={styles.unreadDot} />}
              <Text style={styles.rowTimestamp}>
                {formatTimestamp(item.created_at)}
              </Text>
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
      <Ionicons name="notifications-off-outline" size={28} color={C.outlineVariant} />
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
        // Navigate after a tick so the modal has time to close
        setTimeout(() => {
          router.push(linkPath as never);
        }, 50);
      }
    },
    [markAsRead, onClose, router]
  );

  const keyExtractor = useCallback((item: AppNotification) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => (
      <NotificationRow item={item} onPress={handleRowPress} />
    ),
    [handleRowPress]
  );

  // Panel anchors: right-aligned below the bell icon
  const panelTop = topOffset;
  const panelRight = 16 + insets.right;

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
        {/* Stop propagation so tapping the panel doesn't close it */}
        <Pressable
          style={[
            styles.panel,
            { top: panelTop, right: panelRight },
          ]}
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
                accessibilityLabel="Segna tutte come lette"
                accessibilityRole="button"
              >
                <Ionicons
                  name="checkmark-done-outline"
                  size={14}
                  color={C.primary}
                />
                <Text style={styles.markAllText}>Segna tutte lette</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.divider} />

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={C.secondary} />
            </View>
          ) : (
            <FlatList
              data={data ?? []}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              ItemSeparatorComponent={Separator}
              ListEmptyComponent={<EmptyState />}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={3}
              style={styles.list}
              contentContainerStyle={
                (data ?? []).length === 0 ? styles.listEmptyContainer : undefined
              }
            />
          )}
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

  // ── Panel ─────────────────────────────────────────────────────────────────────
  panel: {
    position: "absolute",
    width: 340,
    maxHeight: 480,
    backgroundColor: C.surface,
    borderRadius: 18,
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
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.3,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.primary,
  },
  divider: {
    height: 1,
    backgroundColor: C.outlineVariant,
    opacity: 0.5,
    marginHorizontal: 0,
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
    backgroundColor: C.surface,
    borderLeftWidth: 3,
    borderLeftColor: C.secondary,
  },
  rowRead: {
    backgroundColor: C.surface,
  },
  rowPressed: {
    opacity: 0.75,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowIconUnread: {
    backgroundColor: `${C.secondary}1A`,
  },
  rowIconRead: {
    backgroundColor: C.surfaceVariant,
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
    color: C.primary,
  },
  rowTitleRead: {
    color: `${C.primary}99`,
  },
  rowTimestampWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.secondary,
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
