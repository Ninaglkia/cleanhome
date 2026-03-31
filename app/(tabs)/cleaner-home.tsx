import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  StatusBar,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { fetchBookings, updateBookingStatus } from "../../lib/api";
import { Booking } from "../../lib/types";
import { Colors, BookingStatusConfig } from "../../lib/theme";
import { useFocusEffect } from "expo-router";

// ─── Constants ────────────────────────────────────────────────────────────────

const CLEANER_BROWN = "#8B5E3C";
const CLEANER_AMBER = "#D4A574";
const CLEANER_WASH = "#F5EBE0";
const CLEANER_DARK = "#5C3D24";

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  value: number;
  label: string;
  color: string;
  bgColor: string;
}

function StatCard({ value, label, color, bgColor }: StatCardProps) {
  return (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Request card ─────────────────────────────────────────────────────────────

interface RequestCardProps {
  item: Booking;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

function RequestCard({ item, onAccept, onDecline }: RequestCardProps) {
  const serviceTypeLabel = item.service_type?.toUpperCase() ?? "SERVIZIO";

  return (
    <View style={styles.requestCard}>
      {/* Top row: avatar + info */}
      <View style={styles.requestTop}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={18} color={CLEANER_BROWN} />
        </View>
        <View style={styles.requestInfo}>
          <Text style={styles.requestName} numberOfLines={1}>
            Cliente
          </Text>
          <Text style={styles.requestTime}>
            Oggi {item.time_slot ?? "—"}
          </Text>
        </View>
        {/* Service type badge */}
        <View style={styles.serviceBadge}>
          <Text style={styles.serviceBadgeText} numberOfLines={1}>
            {serviceTypeLabel}
          </Text>
        </View>
      </View>

      {/* Location row */}
      {item.address ? (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
      ) : null}

      {/* Date row */}
      <View style={styles.locationRow}>
        <Ionicons name="calendar-outline" size={13} color={Colors.textTertiary} />
        <Text style={styles.locationText}>{item.date}</Text>
      </View>

      {/* Earnings */}
      <Text style={styles.earningsText}>
        €{(item.base_price - item.cleaner_fee).toFixed(0)}
      </Text>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.btnDecline, pressed && { opacity: 0.75 }]}
          onPress={() => onDecline(item.id)}
        >
          <Text style={styles.btnDeclineText}>Rifiuta</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btnAccept, pressed && { opacity: 0.85 }]}
          onPress={() => onAccept(item.id)}
        >
          <Text style={styles.btnAcceptText}>Accetta</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Appointment row ──────────────────────────────────────────────────────────

interface AppointmentRowProps {
  item: Booking;
}

function AppointmentRow({ item }: AppointmentRowProps) {
  const cfg = BookingStatusConfig[item.status];

  return (
    <View style={styles.appointmentRow}>
      <View style={[styles.appointmentAccent, { backgroundColor: CLEANER_BROWN }]} />
      <View style={styles.appointmentMeta}>
        <Text style={styles.appointmentTime}>{item.time_slot ?? "—"}</Text>
        <Text style={styles.appointmentDate}>{item.date}</Text>
      </View>
      <View style={styles.appointmentBody}>
        <Text style={styles.appointmentService} numberOfLines={1}>
          {item.service_type}
        </Text>
        {item.address ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.statusDot, { backgroundColor: cfg?.color ?? Colors.muted }]} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type ListItem =
  | { key: "header" }
  | { key: "stats" }
  | { key: "section-incoming" }
  | { key: "section-upcoming" }
  | { key: "empty" }
  | { key: string; booking: Booking };

export default function CleanerHomeScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBookings = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);
      try {
        const data = await fetchBookings(user.id, "cleaner");
        setBookings(data);
      } catch {
        setBookings([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadBookings(true);
  }, [loadBookings]);

  const handleAction = useCallback(
    async (bookingId: string, status: string) => {
      try {
        await updateBookingStatus(bookingId, status);
        loadBookings(true);
      } catch {
        Alert.alert("Errore", "Impossibile aggiornare la prenotazione");
      }
    },
    [loadBookings]
  );

  const handleAccept = useCallback(
    (id: string) => handleAction(id, "accepted"),
    [handleAction]
  );
  const handleDecline = useCallback(
    (id: string) => handleAction(id, "declined"),
    [handleAction]
  );

  const pendingBookings = bookings.filter((b) => b.status === "pending");
  const activeBookings = bookings.filter((b) =>
    ["accepted", "work_done"].includes(b.status)
  );
  const completedCount = bookings.filter((b) => b.status === "completed").length;

  const firstName = profile?.full_name?.split(" ")[0] ?? "Professionista";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";

  const listData: ListItem[] = [
    { key: "header" },
    { key: "stats" },
    ...(pendingBookings.length > 0
      ? [
          { key: "section-incoming" } as ListItem,
          ...pendingBookings.map(
            (b): ListItem => ({ key: `req-${b.id}`, booking: b })
          ),
        ]
      : []),
    ...(activeBookings.length > 0
      ? [
          { key: "section-upcoming" } as ListItem,
          ...activeBookings.map(
            (b): ListItem => ({ key: `apt-${b.id}`, booking: b })
          ),
        ]
      : []),
    ...(pendingBookings.length === 0 && activeBookings.length === 0 && !loading
      ? [{ key: "empty" } as ListItem]
      : []),
  ];

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.key === "header") {
        return (
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.brandLogo}>CleanHome</Text>
              <Pressable
                style={styles.bellButton}
                onPress={() => Alert.alert("Notifiche", "Prossimamente")}
              >
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color={Colors.text}
                />
              </Pressable>
            </View>
            <Text style={styles.greeting}>
              {greeting}, {firstName}
            </Text>
            <Text style={styles.greetingSub}>La tua giornata</Text>
          </View>
        );
      }

      if (item.key === "stats") {
        return (
          <View style={styles.statsRow}>
            <StatCard
              value={pendingBookings.length}
              label="OGGI"
              color={CLEANER_BROWN}
              bgColor={CLEANER_WASH}
            />
            <StatCard
              value={activeBookings.length}
              label="ATTIVA"
              color={Colors.secondary}
              bgColor={Colors.accentLight}
            />
            <StatCard
              value={completedCount}
              label="COMPLETATE"
              color={Colors.success}
              bgColor={Colors.successLight}
            />
          </View>
        );
      }

      if (item.key === "section-incoming") {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Richieste in arrivo</Text>
            <Pressable
              onPress={() => router.push("/cleaner/jobs")}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.sectionLink}>Vedi tutte &gt;</Text>
            </Pressable>
          </View>
        );
      }

      if (item.key === "section-upcoming") {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Prossimi appuntamenti</Text>
          </View>
        );
      }

      if (item.key === "empty") {
        return (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="briefcase-outline"
                size={36}
                color={CLEANER_BROWN}
              />
            </View>
            <Text style={styles.emptyTitle}>Nessuna prenotazione</Text>
            <Text style={styles.emptySubtitle}>
              Le richieste dei clienti appariranno qui.{"\n"}Assicurati che il
              tuo profilo sia attivo!
            </Text>
          </View>
        );
      }

      if ("booking" in item) {
        if (item.key.startsWith("req-")) {
          return (
            <View style={styles.cardWrapper}>
              <RequestCard
                item={item.booking}
                onAccept={handleAccept}
                onDecline={handleDecline}
              />
            </View>
          );
        }
        if (item.key.startsWith("apt-")) {
          return (
            <View style={styles.cardWrapper}>
              <AppointmentRow item={item.booking} />
            </View>
          );
        }
      }

      return null;
    },
    [
      pendingBookings,
      activeBookings,
      completedCount,
      handleAccept,
      handleDecline,
      firstName,
      greeting,
      loading,
      router,
    ]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={CLEANER_BROWN} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={listData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={CLEANER_BROWN}
            colors={[CLEANER_BROWN]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 40,
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  brandLogo: {
    fontSize: 18,
    fontWeight: "800",
    fontStyle: "italic",
    color: CLEANER_DARK,
    letterSpacing: 0.2,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "700",
    fontStyle: "italic",
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  greetingSub: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // ── Stats row ─────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    opacity: 0.75,
  },

  // ── Section header ────────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.2,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: "600",
    color: CLEANER_BROWN,
  },

  // ── Card wrapper ──────────────────────────────────────────────────────────────
  cardWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },

  // ── Request card ──────────────────────────────────────────────────────────────
  requestCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    shadowColor: CLEANER_BROWN,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  requestTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CLEANER_WASH,
    alignItems: "center",
    justifyContent: "center",
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 2,
  },
  requestTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  serviceBadge: {
    backgroundColor: CLEANER_WASH,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 110,
  },
  serviceBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: CLEANER_BROWN,
    letterSpacing: 0.6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  earningsText: {
    fontSize: 22,
    fontWeight: "800",
    color: CLEANER_BROWN,
    letterSpacing: -0.5,
    marginTop: 6,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  btnDecline: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  btnDeclineText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  btnAccept: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.secondary,
  },
  btnAcceptText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },

  // ── Appointment row ───────────────────────────────────────────────────────────
  appointmentRow: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  appointmentAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  appointmentMeta: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: "center",
    minWidth: 60,
  },
  appointmentTime: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  appointmentDate: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  appointmentBody: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 12,
  },
  appointmentService: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 14,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: CLEANER_WASH,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
