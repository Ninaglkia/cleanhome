import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { fetchBookings, updateBookingStatus } from "../../lib/api";
import { sendPushNotification } from "../../lib/notifications";
import { Booking } from "../../lib/types";

// ─── Design tokens (Stitch) ───────────────────────────────────────────────────

const C = {
  background: "#f6faf9",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  primary: "#022420",
  primaryContainer: "#1a3a35",
  secondary: "#006b55",
  secondaryContainer: "#82f4d1",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outlineVariant: "#c1c8c5",
  outline: "#717976",
  amber50: "#fffbeb",
  amber700: "#b45309",
  green100: "#dcfce7",
  green700: "#15803d",
  error: "#ba1a1a",
} as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 220;
const SEPARATOR_HEIGHT = 16;

const FILTERS = [
  { key: "all", label: "Tutte" },
  { key: "pending", label: "In attesa" },
  { key: "accepted", label: "Attive" },
  { key: "completed", label: "Completate" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

// ─── Status config ────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string;
  textColor: string;
  bgColor: string;
}

function getStatusConfig(status: string): StatusConfig {
  switch (status) {
    case "pending":
      return { label: "In attesa", textColor: C.amber700, bgColor: C.amber50 };
    case "accepted":
    case "work_done":
      return { label: "ACCETTATA", textColor: C.secondary, bgColor: "#e6f9f4" };
    case "completed":
      return { label: "COMPLETATA", textColor: C.green700, bgColor: C.green100 };
    default:
      return { label: status.toUpperCase(), textColor: C.outline, bgColor: C.surfaceLow };
  }
}

function getServiceLabel(serviceType: string): string {
  const upper = serviceType.toUpperCase();
  return upper.length > 20 ? upper.slice(0, 18) + "…" : upper;
}

// ─── Booking card ─────────────────────────────────────────────────────────────

interface BookingCardProps {
  item: Booking;
  onPress: (bookingId: string) => void;
  onReview: (bookingId: string) => void;
  onConfirmWorkDone: (bookingId: string) => void;
  isClientView: boolean;
}

const BookingCard = ({
  item,
  onPress,
  onReview,
  onConfirmWorkDone,
  isClientView,
}: BookingCardProps) => {
  const statusCfg = getStatusConfig(item.status);
  const isCompleted = item.status === "completed";
  const needsClientConfirm = isClientView && item.status === "work_done";

  // Derive initials from service_type as avatar fallback
  const initials = item.service_type
    ? item.service_type.slice(0, 2).toUpperCase()
    : "CL";

  const cardStyle = isCompleted
    ? [styles.card, styles.cardCompleted]
    : styles.card;

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [cardStyle, pressed && styles.cardPressed]}
    >
      {/* ── Top row: avatar + name/rate + status badge ── */}
      <View style={styles.cardTopRow}>
        <View style={styles.avatarWrap}>
          {/* Avatar placeholder — real image would come from joined cleaner data */}
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>{initials}</Text>
          </View>
        </View>

        <View style={styles.cleanerInfo}>
          <Text style={styles.cleanerName} numberOfLines={1}>
            {item.service_type}
          </Text>
          <Text style={styles.cleanerRate}>
            {item.total_price > 0
              ? `${(item.total_price / 3).toFixed(0)}€/HR`
              : "—"}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bgColor }]}>
          <Text style={[styles.statusBadgeText, { color: statusCfg.textColor }]}>
            {statusCfg.label}
          </Text>
        </View>
      </View>

      {/* ── Service type badge ── */}
      <View style={styles.serviceTagWrap}>
        <Text style={styles.serviceTagText}>{getServiceLabel(item.service_type)}</Text>
      </View>

      {/* ── Meta rows ── */}
      <View style={styles.metaBlock}>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={C.onSurfaceVariant} />
          <Text style={[styles.metaText, isCompleted && styles.metaTextDim]}>
            {item.date}
            {item.time_slot ? ` · ${item.time_slot}` : ""}
          </Text>
        </View>

        {item.address ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={C.onSurfaceVariant} />
            <Text style={[styles.metaText, isCompleted && styles.metaTextDim]} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Footer: price + action ── */}
      <View style={styles.cardFooter}>
        <Text style={[styles.priceText, isCompleted && styles.priceTextDim]}>
          €{item.total_price.toFixed(2)}
        </Text>

        {needsClientConfirm ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onConfirmWorkDone(item.id);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.confirmWorkBtn}
          >
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.confirmWorkBtnText}>Conferma lavoro</Text>
          </Pressable>
        ) : isCompleted ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onReview(item.id);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.reviewLink}>Lascia Recensione</Text>
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={C.primary} />
        )}
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
  const isClientView = profile?.active_role === "client";
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
    return () => {
      cancelled = true;
    };
  }, [user, profile]);

  const handleBookingPress = useCallback(
    (bookingId: string) => {
      router.push(`/chat/${bookingId}`);
    },
    [router]
  );

  const handleReview = useCallback(
    (bookingId: string) => {
      router.push(`/review/${bookingId}`);
    },
    [router]
  );

  const handleConfirmWorkDone = useCallback(
    (bookingId: string) => {
      Alert.alert(
        "Confermare il lavoro?",
        "Confermando il lavoro rilasci il pagamento al professionista. Questa azione non può essere annullata.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Conferma",
            onPress: async () => {
              try {
                await updateBookingStatus(bookingId, "completed");
                // Notify the cleaner
                const booking = bookings.find((b) => b.id === bookingId);
                if (booking) {
                  sendPushNotification(
                    booking.cleaner_id,
                    "Lavoro confermato",
                    "Il cliente ha confermato il lavoro. Il pagamento è in arrivo.",
                    { screen: "jobs", bookingId }
                  ).catch(() => {});
                }
                setBookings((prev) =>
                  prev.map((b) =>
                    b.id === bookingId ? { ...b, status: "completed" } : b
                  )
                );
              } catch {
                Alert.alert("Errore", "Impossibile confermare il lavoro");
              }
            },
          },
        ]
      );
    },
    [bookings]
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
        onConfirmWorkDone={handleConfirmWorkDone}
        isClientView={isClientView}
      />
    ),
    [handleBookingPress, handleReview, handleConfirmWorkDone, isClientView]
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

      {/* ── Header: "Le tue prenotazioni" centered, Noto Serif ── */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Le tue prenotazioni</Text>
        <View style={styles.headerSpacer} />
      </View>

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
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.secondary} />
          <Text style={styles.loadingText}>Caricamento prenotazioni…</Text>
        </View>
      ) : filteredBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="calendar-outline" size={36} color={C.outlineVariant} />
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
              style={({ pressed }) => [
                styles.emptyBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="search-outline" size={16} color="#fff" />
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
          ItemSeparatorComponent={() => (
            <View style={{ height: SEPARATOR_HEIGHT }} />
          )}
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
    backgroundColor: C.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: C.outline,
    fontWeight: "500",
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerSpacer: {
    width: 24,
  },
  headerTitle: {
    // Noto Serif, centered, text-2xl bold
    fontFamily: "NotoSerif_700Bold",
    fontSize: 22,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.3,
    flex: 1,
    textAlign: "center",
  },

  // ── Filter chips ──────────────────────────────────────────────────────────────
  filtersWrap: {
    maxHeight: 56,
    marginBottom: 8,
  },
  filtersList: {
    paddingHorizontal: 24,
    gap: 10,
    paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: `${C.outlineVariant}33`,
  },
  filterChipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: C.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },

  // ── Card ──────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
    borderWidth: 1,
    borderColor: `${C.outlineVariant}1A`,
    gap: 14,
  },
  cardCompleted: {
    backgroundColor: `${C.surfaceLow}80`,
    opacity: 0.9,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.998 }],
  },

  // Card top row
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    flexShrink: 0,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#abcec6",
    letterSpacing: 0.5,
  },
  cleanerInfo: {
    flex: 1,
  },
  cleanerName: {
    fontSize: 17,
    fontWeight: "700",
    color: C.primary,
    marginBottom: 2,
  },
  cleanerRate: {
    fontSize: 13,
    fontWeight: "600",
    color: C.secondary,
  },
  statusBadge: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  // Service type badge
  serviceTagWrap: {
    alignSelf: "flex-start",
    backgroundColor: `${C.secondaryContainer}4D`,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  serviceTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.secondary,
    letterSpacing: 1.2,
  },

  // Meta rows
  metaBlock: {
    gap: 7,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    fontWeight: "400",
    flex: 1,
  },
  metaTextDim: {
    opacity: 0.7,
  },

  // Card footer
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: `${C.outlineVariant}1A`,
  },
  priceText: {
    fontSize: 20,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.3,
  },
  priceTextDim: {
    opacity: 0.6,
  },
  reviewLink: {
    fontSize: 12,
    fontWeight: "700",
    color: C.secondary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  confirmWorkBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.secondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 6,
  },
  confirmWorkBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  // Empty state
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
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: C.primary,
    borderRadius: 14,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
});
