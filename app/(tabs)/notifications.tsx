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
import { Colors, Radius, Shadows, Spacing } from "../../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationType = "booking" | "message" | "service";
type NotificationTab = "bookings" | "messages";

interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  tab: NotificationTab;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: "1",
    type: "booking",
    title: "Prenotazione Confermata",
    description: "La tua pulizia ordinaria per il 15 aprile è stata confermata da Elena R.",
    timestamp: "2 min fa",
    isRead: false,
    tab: "bookings",
  },
  {
    id: "2",
    type: "booking",
    title: "Aggiornamento Servizio",
    description: "Il tuo appuntamento del 12 aprile è stato completato. Lascia una recensione!",
    timestamp: "1 ora fa",
    isRead: false,
    tab: "bookings",
  },
  {
    id: "3",
    type: "booking",
    title: "Promemoria Prenotazione",
    description: "Domani alle 10:00 hai la pulizia profonda. Assicurati di essere a casa.",
    timestamp: "3 ore fa",
    isRead: true,
    tab: "bookings",
  },
  {
    id: "4",
    type: "booking",
    title: "Richiesta Accettata",
    description: "Marco B. ha accettato la tua richiesta per il servizio di stiratura.",
    timestamp: "ieri",
    isRead: true,
    tab: "bookings",
  },
  {
    id: "5",
    type: "message",
    title: "Nuovo Messaggio da Elena R.",
    description: "Ciao! Confermo la mia presenza per domani mattina alle 10:00.",
    timestamp: "5 min fa",
    isRead: false,
    tab: "messages",
  },
  {
    id: "6",
    type: "message",
    title: "Nuovo Messaggio da Marco B.",
    description: "Ho portato tutti i prodotti necessari. Ci vediamo giovedì!",
    timestamp: "2 ore fa",
    isRead: false,
    tab: "messages",
  },
  {
    id: "7",
    type: "message",
    title: "Nuovo Messaggio da Sofia G.",
    description: "Potresti indicarmi il codice del palazzo? Grazie mille.",
    timestamp: "ieri",
    isRead: true,
    tab: "messages",
  },
  {
    id: "8",
    type: "service",
    title: "Aggiornamento Servizio",
    description: "CleanHome ha aggiunto nuovi professionisti nella tua zona. Scoprili ora!",
    timestamp: "2 giorni fa",
    isRead: true,
    tab: "messages",
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 90;
const SEPARATOR_HEIGHT = 8;

// ─── Notification Card ────────────────────────────────────────────────────────

interface NotificationCardProps {
  item: AppNotification;
  onPress: (id: string) => void;
}

function getTypeIcon(type: NotificationType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "booking":
      return "calendar-outline";
    case "message":
      return "chatbubble-outline";
    case "service":
      return "information-circle-outline";
  }
}

function getTypeColor(type: NotificationType): string {
  switch (type) {
    case "booking":
      return Colors.secondary;
    case "message":
      return Colors.accent;
    case "service":
      return Colors.info;
  }
}

const NotificationCard = ({ item, onPress }: NotificationCardProps) => {
  const iconName = getTypeIcon(item.type);
  const iconColor = getTypeColor(item.type);

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [
        styles.card,
        !item.isRead && styles.cardUnread,
        pressed && styles.cardPressed,
      ]}
    >
      {/* Icon bubble */}
      <View style={[styles.iconBubble, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.cardTitle, !item.isRead && styles.cardTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardTimestamp}>{item.timestamp}</Text>
        </View>
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description}
        </Text>
      </View>

      {/* Unread dot */}
      {!item.isRead && <View style={styles.unreadDot} />}
    </Pressable>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const [activeTab, setActiveTab] = useState<NotificationTab>("bookings");
  const [notifications, setNotifications] = useState<AppNotification[]>(MOCK_NOTIFICATIONS);

  const filtered = useMemo(
    () => notifications.filter((n) => n.tab === activeTab),
    [notifications, activeTab]
  );

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
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Notifiche</Text>
          {unreadCount > 0 && (
            <Pressable onPress={handleMarkAllRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.markAllRead}>Segna tutte lette</Text>
            </Pressable>
          )}
        </View>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <View style={styles.unreadBadgeDot} />
            <Text style={styles.unreadBadgeText}>{unreadCount} non lette</Text>
          </View>
        )}
      </View>

      {/* ── Tab pills ── */}
      <View style={styles.tabsRow}>
        <Pressable
          style={[styles.tabPill, activeTab === "bookings" && styles.tabPillActive]}
          onPress={() => setActiveTab("bookings")}
        >
          <Text style={[styles.tabPillText, activeTab === "bookings" && styles.tabPillTextActive]}>
            Prenotazioni
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabPill, activeTab === "messages" && styles.tabPillActive]}
          onPress={() => setActiveTab("messages")}
        >
          <Text style={[styles.tabPillText, activeTab === "messages" && styles.tabPillTextActive]}>
            Messaggi
          </Text>
        </Pressable>
      </View>

      {/* ── Content ── */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="notifications-off-outline" size={34} color={Colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>Nessuna notifica</Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === "bookings"
              ? "Le notifiche sulle prenotazioni appariranno qui"
              : "I nuovi messaggi appariranno qui"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: SEPARATOR_HEIGHT }} />}
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
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    fontStyle: "italic",
    color: Colors.primary,
    letterSpacing: -0.4,
  },
  markAllRead: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.secondary,
  },
  unreadBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  unreadBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  unreadBadgeText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textSecondary,
  },

  // Tabs
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  tabPill: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  tabPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  tabPillTextActive: {
    color: Colors.textOnDark,
  },

  // Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    minHeight: ITEM_HEIGHT,
    ...Shadows.sm,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  cardPressed: {
    opacity: 0.85,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    flex: 1,
  },
  cardTitleUnread: {
    fontWeight: "700",
    color: Colors.primary,
  },
  cardTimestamp: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: "500",
    flexShrink: 0,
  },
  cardDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    flexShrink: 0,
    alignSelf: "center",
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: Radius.xxl,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "700",
    fontStyle: "italic",
    color: Colors.text,
    textAlign: "center",
    marginBottom: Spacing.sm,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
});
