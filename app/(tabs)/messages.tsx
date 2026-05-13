import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { fetchBookings } from "../../lib/api";
import { Booking } from "../../lib/types";
import { BookingStatusConfig } from "../../lib/theme";
import { NotificationBell } from "../../components/NotificationBell";

// ─── Design tokens (dal Stitch HTML live_chat_with_concierge) ─────────────────
const C = {
  background: "#f6faf9",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  surfaceHigh: "#e5e9e8",
  primary: "#022420",
  primaryContainer: "#1a3a35",
  secondary: "#006b55",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
  muted: "#8aaca6",
} as const;

const ITEM_HEIGHT = 88;
const SEPARATOR_HEIGHT = 10;

// ─── Conversation row ─────────────────────────────────────────────────────────

interface ConversationRowProps {
  item: Booking;
  onPress: (bookingId: string) => void;
}

const ConversationRow = ({ item, onPress }: ConversationRowProps) => {
  const cfg = BookingStatusConfig[item.status];

  const initials = item.service_type
    ? item.service_type.slice(0, 2).toUpperCase()
    : "CL";

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarInitials}>{initials}</Text>
      </View>

      {/* Content */}
      <View style={styles.rowContent}>
        <View style={styles.rowTopLine}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.service_type}
          </Text>
          {cfg && (
            <View style={[styles.statusChip, { backgroundColor: cfg.bgColor }]}>
              <Text style={[styles.statusChipText, { color: cfg.color }]}>
                {cfg.label}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.rowMeta}>
          <Ionicons name="calendar-outline" size={12} color={C.outline} />
          <Text style={styles.rowMetaText}>
            {item.date} · {item.time_slot}
          </Text>
        </View>
      </View>

      {/* Arrow */}
      <View style={styles.arrowWrap}>
        <Ionicons name="chevron-forward" size={16} color={C.onSurfaceVariant} />
      </View>
    </Pressable>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    if (!user || !profile) return;
    try {
      const data = await fetchBookings(user.id, profile.active_role);
      setBookings(
        data.filter((b) =>
          ["accepted", "work_done", "completed"].includes(b.status)
        )
      );
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Refresh on tab focus — catches new bookings / state changes
  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  const handlePress = useCallback(
    (bookingId: string) => {
      router.push(`/chat/${bookingId}`);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: Booking }) => (
      <ConversationRow item={item} onPress={handlePress} />
    ),
    [handlePress]
  );

  const keyExtractor = useCallback((item: Booking) => item.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<Booking> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT + SEPARATOR_HEIGHT,
      offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
      index,
    }),
    []
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Messaggi</Text>
          <NotificationBell color={C.primaryContainer} />
        </View>
        {!loading && bookings.length > 0 && (
          <Text style={styles.headerSubtitle}>
            {bookings.length} conversazion
            {bookings.length === 1 ? "e" : "i"} attiv
            {bookings.length === 1 ? "a" : "e"}
          </Text>
        )}
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.secondary} />
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="chatbubbles-outline" size={36} color={C.outline} />
          </View>
          <Text style={styles.emptyTitle}>Nessun messaggio</Text>
          <Text style={styles.emptySubtitle}>
            Le chat si aprono quando un professionista accetta la tua richiesta
            o quando hai una prenotazione attiva.
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => (
            <View style={{ height: SEPARATOR_HEIGHT }} />
          )}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={12}
          windowSize={5}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    fontStyle: "italic",
    color: C.primaryContainer,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: C.onSurfaceVariant,
  },

  // ── Conversation row ──────────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  rowPressed: {
    opacity: 0.88,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarInitials: {
    color: "#00c896",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  rowContent: {
    flex: 1,
    gap: 5,
  },
  rowTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.onSurface,
    flex: 1,
  },
  statusChip: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  rowMetaText: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    fontWeight: "500",
  },
  arrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: C.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── List ──────────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: C.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontStyle: "italic",
    color: C.onSurface,
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 21,
  },
});
