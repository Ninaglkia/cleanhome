import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// ─── Design tokens (Stitch) ───────────────────────────────────────────────────

const C = {
  background: "#f6faf9",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  surfaceContainerHigh: "#e5e9e8",
  surfaceVariant: "#dfe3e2",
  primary: "#022420",
  secondary: "#006b55",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationType = "booking" | "message" | "system";
type NotificationFilter = "all" | "bookings" | "messages" | "system";

interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  actionLabel?: string;
}

// Notifications are driven by the backend. Until the notifications table
// is populated (webhook → INSERT on booking status changes, etc.) this
// screen shows an empty state with guidance for the user.
const INITIAL_NOTIFICATIONS: AppNotification[] = [];

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 120;
const SEPARATOR_HEIGHT = 12;

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: "all", label: "All Updates" },
  { key: "bookings", label: "Bookings" },
  { key: "messages", label: "Messages" },
  { key: "system", label: "System" },
];

// ─── Icon helpers ─────────────────────────────────────────────────────────────

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

// ─── Notification card ────────────────────────────────────────────────────────

interface NotificationCardProps {
  item: AppNotification;
  onPress: (id: string) => void;
}

const NotificationCard = ({ item, onPress }: NotificationCardProps) => {
  const iconName = getTypeIcon(item.type);
  const isUnread = !item.isRead;

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [
        styles.card,
        isUnread ? styles.cardUnread : styles.cardRead,
        pressed && styles.cardPressed,
      ]}
    >
      {/* Icon circle */}
      <View
        style={[
          styles.iconCircle,
          isUnread
            ? styles.iconCircleUnread
            : styles.iconCircleRead,
        ]}
      >
        <Ionicons
          name={iconName}
          size={24}
          color={isUnread ? C.secondary : C.primary}
        />
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        {/* Title row + timestamp */}
        <View style={styles.cardTopRow}>
          <Text
            style={[
              styles.cardTitle,
              isUnread ? styles.cardTitleUnread : styles.cardTitleRead,
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <View style={styles.timestampWrap}>
            {isUnread && <View style={styles.unreadDot} />}
            <Text
              style={[
                styles.cardTimestamp,
                !isUnread && styles.cardTimestampRead,
              ]}
            >
              {item.timestamp}
            </Text>
          </View>
        </View>

        {/* Description */}
        <Text
          style={[
            styles.cardDescription,
            !isUnread && styles.cardDescriptionRead,
          ]}
          numberOfLines={2}
        >
          {item.description}
        </Text>

        {/* Action button */}
        {item.actionLabel ? (
          <View style={styles.actionWrap}>
            <View style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>{item.actionLabel}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [notifications, setNotifications] =
    useState<AppNotification[]>(INITIAL_NOTIFICATIONS);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return notifications;
    const typeMap: Record<NotificationFilter, NotificationType | null> = {
      all: null,
      bookings: "booking",
      messages: "message",
      system: "system",
    };
    const t = typeMap[activeFilter];
    return t ? notifications.filter((n) => n.type === t) : notifications;
  }, [notifications, activeFilter]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const handlePress = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }, []);

  const keyExtractor = useCallback((item: AppNotification) => item.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<AppNotification> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT + SEPARATOR_HEIGHT,
      offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => (
      <NotificationCard item={item} onPress={handlePress} />
    ),
    [handlePress]
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />

      {/* ── TopAppBar: "Sanctuary" italic serif + notification bell ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.topBarBrand}>Sanctuary</Text>
        </View>
        <View style={styles.topBarRight}>
          <Pressable style={styles.bellBtn}>
            <Ionicons name="notifications-outline" size={22} color={C.primary} />
          </Pressable>
        </View>
      </View>

      {/* ── Editorial header: "Your Activity" overline + "Notifications" h1 ── */}
      <View style={styles.editorialHeader}>
        <View style={styles.editorialHeaderRow}>
          <View>
            <Text style={styles.overlineText}>Your Activity</Text>
            <Text style={styles.headlineText}>Notifications</Text>
          </View>
          {unreadCount > 0 && (
            <Pressable
              onPress={handleMarkAllRead}
              style={styles.markAllBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="checkmark-done-outline" size={16} color={C.primary} />
              <Text style={styles.markAllText}>Mark all as read</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Filter chips: "All Updates" active, others bg-surface-container-high ── */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={(f) => f.key}
        contentContainerStyle={styles.filtersList}
        style={styles.filtersWrap}
        renderItem={({ item: filter }) => {
          const isActive = activeFilter === filter.key;
          return (
            <Pressable
              onPress={() => setActiveFilter(filter.key)}
              style={({ pressed }) => [
                styles.filterChip,
                isActive && styles.filterChipActive,
                pressed && !isActive && { opacity: 0.7 },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isActive && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* ── Content ── */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name="notifications-off-outline"
              size={34}
              color={C.outlineVariant}
            />
          </View>
          <Text style={styles.emptyTitle}>Nessuna notifica</Text>
          <Text style={styles.emptySubtitle}>
            Le notifiche appariranno qui
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => (
            <View style={{ height: SEPARATOR_HEIGHT }} />
          )}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },

  // ── TopAppBar ─────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // "Sanctuary" — italic serif bold text-2xl
  topBarBrand: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 22,
    fontWeight: "700",
    fontStyle: "italic",
    color: C.primary,
    letterSpacing: -0.3,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Editorial header ──────────────────────────────────────────────────────────
  editorialHeader: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  editorialHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  // "Your Activity" — overline uppercase bold tracking-widest text-secondary
  overlineText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.secondary,
    textTransform: "uppercase",
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  // "Notifications" — font-headline text-4xl
  headlineText: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 36,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.8,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 4,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.primary,
  },

  // ── Filter chips ──────────────────────────────────────────────────────────────
  filtersWrap: {
    maxHeight: 52,
    marginBottom: 20,
  },
  filtersList: {
    paddingHorizontal: 24,
    gap: 10,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: C.surfaceContainerHigh,
  },
  filterChipActive: {
    backgroundColor: C.primary,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: C.primary,
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },

  // ── Notification card ─────────────────────────────────────────────────────────
  card: {
    flexDirection: "row",
    gap: 16,
    borderRadius: 16,
    padding: 20,
    minHeight: ITEM_HEIGHT,
  },
  // Unread: white bg + left border-l-4 border-secondary + shadow
  cardUnread: {
    backgroundColor: C.surface,
    borderLeftWidth: 4,
    borderLeftColor: C.secondary,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  // Read: surface-container-low, muted
  cardRead: {
    backgroundColor: C.surfaceLow,
  },
  cardPressed: {
    opacity: 0.85,
  },

  // Icon circle: w-14 h-14 rounded-full
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconCircleUnread: {
    backgroundColor: `${C.secondary}1A`,
  },
  iconCircleRead: {
    backgroundColor: C.surfaceVariant,
  },

  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  cardTitleUnread: {
    fontFamily: "NotoSerif_700Bold",
    color: C.primary,
  },
  cardTitleRead: {
    color: `${C.primary}99`,
  },
  timestampWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.secondary,
  },
  cardTimestamp: {
    fontSize: 11,
    fontWeight: "500",
    color: `${C.onSurfaceVariant}99`,
  },
  cardTimestampRead: {
    color: `${C.onSurfaceVariant}66`,
  },
  cardDescription: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    lineHeight: 20,
  },
  cardDescriptionRead: {
    opacity: 0.7,
  },
  actionWrap: {
    flexDirection: "row",
    marginTop: 8,
  },
  actionBtn: {
    backgroundColor: C.surfaceContainerHigh,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: 0.2,
  },

  // ── List ──────────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 20,
    backgroundColor: C.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: C.onSurface,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 21,
  },
});
