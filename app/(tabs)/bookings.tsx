import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { fetchBookings } from "../../lib/api";
import { Booking } from "../../lib/types";
import { BookingStatusConfig, Colors, Spacing, Radius, Shadows } from "../../lib/theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 190;
const SEPARATOR_HEIGHT = 14;

const FILTERS = [
  { key: "all", label: "Tutte" },
  { key: "pending", label: "In attesa" },
  { key: "accepted", label: "Attive" },
  { key: "completed", label: "Completate" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

// ─── Booking card ─────────────────────────────────────────────────────────────

interface BookingCardProps {
  item: Booking;
  onPress: (bookingId: string) => void;
  onReview: (bookingId: string) => void;
}

const BookingCard = ({ item, onPress, onReview }: BookingCardProps) => {
  const cfg = BookingStatusConfig[item.status] ?? {
    color: Colors.textTertiary,
    bgColor: Colors.backgroundAlt,
    label: item.status,
    icon: "help-outline",
  };

  // Derive cleaner initials from service type as fallback
  const avatarInitials = item.service_type
    ? item.service_type.slice(0, 2).toUpperCase()
    : "CL";

  const isCompleted = item.status === "completed";
  const isPending = item.status === "pending";
  const isAccepted = item.status === "accepted" || item.status === "work_done";

  // Service type badge abbreviation
  const serviceBadge = item.service_type.length > 16
    ? item.service_type.slice(0, 14).toUpperCase() + "…"
    : item.service_type.toUpperCase();

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* ── Top stripe based on status ── */}
      <View style={[styles.cardStripe, { backgroundColor: cfg.color }]} />

      <View style={styles.cardBody}>
        {/* ── Cleaner row ── */}
        <View style={styles.cleanerRow}>
          {/* Avatar circle */}
          <View style={[styles.avatar, isCompleted && styles.avatarCompleted]}>
            <Text style={styles.avatarText}>{avatarInitials}</Text>
          </View>

          {/* Name + service badge */}
          <View style={{ flex: 1 }}>
            <Text style={styles.cleanerName} numberOfLines={1}>
              {/* cleanerName would come from joined data; use service type as fallback */}
              {item.service_type}
            </Text>
            <View style={styles.serviceBadgeWrap}>
              <Text style={styles.serviceBadgeText}>{serviceBadge}</Text>
            </View>
          </View>

          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: cfg.bgColor }]}>
            <Ionicons
              name={cfg.icon as React.ComponentProps<typeof Ionicons>["name"]}
              size={11}
              color={cfg.color}
            />
            <Text style={[styles.statusBadgeText, { color: cfg.color }]}>
              {cfg.label.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── Meta rows ── */}
        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <View style={styles.metaIconWrap}>
              <Ionicons name="calendar-outline" size={13} color={Colors.secondary} />
            </View>
            <Text style={styles.metaText}>
              {item.date}
              {item.time_slot ? ` · ${item.time_slot}` : ""}
            </Text>
          </View>

          {item.address ? (
            <View style={styles.metaRow}>
              <View style={styles.metaIconWrap}>
                <Ionicons name="location-outline" size={13} color={Colors.secondary} />
              </View>
              <Text style={styles.metaText} numberOfLines={1}>
                {item.address}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Footer row ── */}
        <View style={styles.cardFooter}>
          {/* Price */}
          <View>
            <Text style={styles.priceLabel}>TOTALE</Text>
            <Text style={styles.priceValue}>€{item.total_price.toFixed(2)}</Text>
          </View>

          {/* Action button */}
          {isCompleted ? (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onReview(item.id); }}
              style={({ pressed }) => [styles.reviewBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="star-outline" size={14} color={Colors.textOnDark} />
              <Text style={styles.reviewBtnText}>Lascia recensione</Text>
            </Pressable>
          ) : isPending ? (
            <View style={styles.pendingChip}>
              <Ionicons name="time-outline" size={13} color={Colors.warning} />
              <Text style={styles.pendingChipText}>Risposta entro 24h</Text>
            </View>
          ) : isAccepted ? (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onPress(item.id); }}
              style={({ pressed }) => [styles.chatBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="chatbubble-outline" size={14} color={Colors.secondary} />
              <Text style={styles.chatBtnText}>Chat</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  useEffect(() => {
    if (!user || !profile) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBookings(user.id, profile.active_role);
        if (!cancelled) setBookings(data);
      } catch {
        if (!cancelled) setBookings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, profile]);

  const handleBookingPress = useCallback(
    (bookingId: string) => { router.push(`/chat/${bookingId}`); },
    [router]
  );

  const handleReview = useCallback(
    (bookingId: string) => {
      Alert.alert(
        "Lascia una recensione",
        "La funzionalità di recensione sarà disponibile a breve.",
        [{ text: "OK" }]
      );
    },
    []
  );

  const filteredBookings =
    activeFilter === "all"
      ? bookings
      : activeFilter === "accepted"
      ? bookings.filter((b) => ["accepted", "work_done"].includes(b.status))
      : bookings.filter((b) => b.status === activeFilter);

  const renderBooking = useCallback(
    ({ item }: { item: Booking }) => (
      <BookingCard
        item={item}
        onPress={handleBookingPress}
        onReview={handleReview}
      />
    ),
    [handleBookingPress, handleReview]
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
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>I TUOI SERVIZI</Text>
          <Text style={styles.headerTitle}>Prenotazioni</Text>
        </View>
        {!loading && bookings.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{bookings.length}</Text>
          </View>
        )}
      </View>

      {/* ── Filter pills ── */}
      <View style={styles.filtersWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.key}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item: filter }) => {
            const isActive = activeFilter === filter.key;
            // Count for each filter
            const count =
              filter.key === "all"
                ? bookings.length
                : filter.key === "accepted"
                ? bookings.filter((b) => ["accepted", "work_done"].includes(b.status)).length
                : bookings.filter((b) => b.status === filter.key).length;

            return (
              <Pressable
                onPress={() => setActiveFilter(filter.key)}
                style={({ pressed }) => [
                  styles.filterPill,
                  isActive && styles.filterPillActive,
                  pressed && !isActive && { opacity: 0.75 },
                ]}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {filter.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterCount, isActive && styles.filterCountActive]}>
                    <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.loadingText}>Caricamento prenotazioni…</Text>
        </View>
      ) : filteredBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="calendar-outline" size={36} color={Colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>Nessuna prenotazione</Text>
          <Text style={styles.emptySubtitle}>
            {profile?.active_role === "client"
              ? "Cerca un professionista e prenota il tuo primo servizio!"
              : "Le richieste dei clienti appariranno qui."}
          </Text>
          {profile?.active_role === "client" && (
            <Pressable
              onPress={() => router.push("/(tabs)/home" as never)}
              style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="search-outline" size={16} color={Colors.textOnDark} />
              <Text style={styles.emptyBtnText}>Cerca professionisti</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={keyExtractor}
          renderItem={renderBooking}
          getItemLayout={getItemLayout}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: SEPARATOR_HEIGHT }} />}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={8}
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: "500",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.lg,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.secondary,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: -0.6,
  },
  countBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.secondary,
  },

  // Filters
  filtersWrap: {
    marginBottom: Spacing.base,
  },
  filtersList: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.base,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    ...Shadows.sm,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: Colors.textOnDark,
  },
  filterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  filterCountActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  filterCountTextActive: {
    color: Colors.textOnDark,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: "hidden",
    ...Shadows.md,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  cardStripe: {
    height: 4,
  },
  cardBody: {
    padding: Spacing.base,
    gap: Spacing.md,
  },

  // Cleaner row
  cleanerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarCompleted: {
    backgroundColor: Colors.secondary,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  cleanerName: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 4,
  },
  serviceBadgeWrap: {
    alignSelf: "flex-start",
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  serviceBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
    gap: 4,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },

  // Meta
  metaBlock: {
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  metaIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500",
    flex: 1,
  },

  // Footer
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.secondary,
    letterSpacing: -0.4,
  },

  // Review button
  reviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    ...Shadows.sm,
  },
  reviewBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textOnDark,
  },

  // Pending chip
  pendingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  pendingChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.warning,
  },

  // Chat button
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
  },
  chatBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.secondary,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 32,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: Radius.xl,
    backgroundColor: Colors.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.base,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    ...Shadows.md,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textOnDark,
  },
});
