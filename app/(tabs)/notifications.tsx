import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";
import { useAuth } from "../../lib/auth";
import {
  useNotifications,
  type AppNotification,
  type NotificationType,
  type NotificationFilter,
} from "../../lib/hooks/useNotifications";

// ─── Design tokens (Stitch) ───────────────────────────────────────────────────

const C = {
  background: "#f6faf9",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  surfaceContainerHigh: "#e5e9e8",
  surfaceVariant: "#dfe3e2",
  primary: "#022420",
  secondary: "#006b55",
  error: "#ba1a1a",
  errorLight: "#fce8e8",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
} as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const SEPARATOR_HEIGHT = 12;

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: "all", label: "Tutte" },
  { key: "bookings", label: "Prenotazioni" },
  { key: "messages", label: "Messaggi" },
  { key: "system", label: "Sistema" },
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

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={[styles.card, styles.cardRead, { gap: 12 }]}>
      <View style={[styles.iconCircle, { backgroundColor: C.surfaceContainerHigh }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 14, width: "60%", backgroundColor: C.surfaceContainerHigh, borderRadius: 6 }} />
        <View style={{ height: 12, width: "85%", backgroundColor: C.surfaceLow, borderRadius: 6 }} />
        <View style={{ height: 12, width: "40%", backgroundColor: C.surfaceLow, borderRadius: 6 }} />
      </View>
    </View>
  );
}

// ─── Notification card ────────────────────────────────────────────────────────

interface NotificationCardProps {
  item: AppNotification;
  onPress: (id: string, linkPath: string | null) => void;
}

const NotificationCard = ({ item, onPress }: NotificationCardProps) => {
  const iconName = getTypeIcon(item.type);
  const isUnread = !item.read_at;

  const handlePress = useCallback(() => {
    onPress(item.id, item.link_path);
  }, [item.id, item.link_path, onPress]);

  return (
    <Animated.View entering={FadeInDown.springify().damping(20)} layout={Layout.springify()}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.card,
          isUnread ? styles.cardUnread : styles.cardRead,
          pressed && styles.cardPressed,
        ]}
        accessibilityLabel={`Notifica: ${item.title}`}
        accessibilityRole="button"
      >
        {/* Icon circle */}
        <View
          style={[
            styles.iconCircle,
            isUnread ? styles.iconCircleUnread : styles.iconCircleRead,
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
                {formatTimestamp(item.created_at)}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.cardDescription,
              !isUnread && styles.cardDescriptionRead,
            ]}
            numberOfLines={2}
          >
            {item.body}
          </Text>

          {item.link_path ? (
            <View style={styles.actionWrap}>
              <View style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Vai</Text>
              </View>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: NotificationFilter }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons
          name="notifications-off-outline"
          size={34}
          color={C.outlineVariant}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {filter === "all" ? "Nessuna notifica" : "Nessuna notifica in questa categoria"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {filter === "all"
          ? "Le notifiche appariranno qui quando ci saranno aggiornamenti sulle tue prenotazioni."
          : "Torna alla categoria \"Tutte\" per vedere tutte le notifiche."}
      </Text>
    </View>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle-outline" size={18} color={C.error} />
      <Text style={styles.errorText} numberOfLines={2}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.retryBtn}>
        <Text style={styles.retryText}>Riprova</Text>
      </Pressable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");

  const {
    data: notifications,
    isLoading,
    error,
    refetch,
    markAsRead,
    markAllAsRead,
  } = useNotifications(user?.id);

  const filtered = useMemo(() => {
    if (!notifications) return [];
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
    () => (notifications ?? []).filter((n) => !n.read_at).length,
    [notifications]
  );

  const handlePress = useCallback(
    (id: string, linkPath: string | null) => {
      markAsRead(id);
      if (linkPath) {
        router.push(linkPath as never);
      }
    },
    [markAsRead, router]
  );

  const keyExtractor = useCallback((item: AppNotification) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => (
      <NotificationCard item={item} onPress={handlePress} />
    ),
    [handlePress]
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />

      {/* ── TopAppBar ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Image
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            source={require("../../assets/icon.png")}
            style={{ width: 20, height: 20, borderRadius: 5 }}
          />
          <Text style={styles.topBarBrand}>CleanHome</Text>
        </View>
        <View style={styles.topBarRight}>
          <Pressable
            style={styles.bellBtn}
            accessibilityLabel="Notifiche"
            accessibilityRole="button"
          >
            <Ionicons name="notifications-outline" size={22} color={C.primary} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadCount > 9 ? "9+" : String(unreadCount)}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* ── Editorial header ── */}
      <View style={styles.editorialHeader}>
        <View style={styles.editorialHeaderRow}>
          <View>
            <Text style={styles.overlineText}>La tua attività</Text>
            <Text style={styles.headlineText}>Notifiche</Text>
          </View>
          {unreadCount > 0 && !isLoading && (
            <Pressable
              onPress={markAllAsRead}
              style={styles.markAllBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Segna tutte come lette"
              accessibilityRole="button"
            >
              <Ionicons name="checkmark-done-outline" size={16} color={C.primary} />
              <Text style={styles.markAllText}>Segna tutte lette</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Error banner ── */}
      {error && !isLoading && (
        <ErrorBanner message={error.message} onRetry={refetch} />
      )}

      {/* ── Filter chips ── */}
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
              accessibilityLabel={`Filtra: ${filter.label}`}
              accessibilityRole="button"
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
      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ marginBottom: SEPARATOR_HEIGHT }}>
              <SkeletonCard />
            </View>
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState filter={activeFilter} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => (
            <View style={{ height: SEPARATOR_HEIGHT }} />
          )}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={C.secondary}
              colors={[C.secondary]}
            />
          }
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
    gap: 8,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topBarBrand: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 20,
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
  bellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
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
  overlineText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.secondary,
    textTransform: "uppercase",
    letterSpacing: 2.5,
    marginBottom: 4,
  },
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

  // ── Error banner ──────────────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: "#fce8e8",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: C.error,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: C.error,
    lineHeight: 18,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.error,
  },
  retryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
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
    minHeight: 80,
  },
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
  cardRead: {
    backgroundColor: C.surfaceLow,
  },
  cardPressed: {
    opacity: 0.85,
  },
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
