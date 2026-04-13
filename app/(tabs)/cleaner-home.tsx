import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StatusBar,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { fetchBookings, updateBookingStatus } from "../../lib/api";
import { Booking } from "../../lib/types";

// ─── Design tokens — tema verde/blu professionista ──────────────────────────

const PRIMARY = "#006b55";
const PRIMARY_CONTAINER = "#022420";
const ON_SURFACE = "#181c1c";
const ON_SURFACE_VARIANT = "#414846";
const SURFACE = "#f6faf9";
const SURFACE_LOW = "#f0f4f3";
const OUTLINE = "#717976";
const CLEANER_LIGHT = "#e6f4f1";

// ─── Static mock data ─────────────────────────────────────────────────────────

interface MockRequest {
  id: string;
  clientName: string;
  address: string;
  date: string;
  timeSlot: string;
  serviceType: string;
}

interface MockAppointment {
  id: string;
  dayAbbrev: string;
  dayNum: number;
  title: string;
  timeRange: string;
}

// Italian short day labels (Mon → Dom)
const IT_DAY_ABBREV = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

function bookingToRequest(b: Booking): MockRequest {
  const d = new Date(b.date);
  return {
    id: b.id,
    clientName: b.address ? `Prenotazione · ${b.address}` : `Cliente`,
    address: b.address ?? "Indirizzo non specificato",
    date: `${IT_DAY_ABBREV[d.getDay()]} ${d.getDate()}`,
    timeSlot: b.time_slot,
    serviceType: b.service_type,
  };
}

function bookingToAppointment(b: Booking): MockAppointment {
  const d = new Date(b.date);
  return {
    id: b.id,
    dayAbbrev: IT_DAY_ABBREV[d.getDay()],
    dayNum: d.getDate(),
    title: `${b.address ?? "Cliente"} — ${b.service_type}`,
    timeRange: b.time_slot,
  };
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  value: number;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
}

function StatCard({ value, label, iconName, iconColor, iconBg }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Request card ─────────────────────────────────────────────────────────────

interface RequestCardProps {
  item: MockRequest;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

function RequestCard({ item, onAccept, onDecline }: RequestCardProps) {
  const handleAccept = useCallback(() => onAccept(item.id), [item.id, onAccept]);
  const handleDecline = useCallback(() => onDecline(item.id), [item.id, onDecline]);

  return (
    <View style={styles.requestCard}>
      {/* Top row: avatar + name/location + time */}
      <View style={styles.requestTop}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={20} color={OUTLINE} />
        </View>
        <View style={styles.requestInfo}>
          <Text style={styles.requestName} numberOfLines={1}>
            {item.clientName}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={12} color={OUTLINE} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        </View>
        <View style={styles.requestTimeWrap}>
          <Text style={styles.requestDate}>{item.date}</Text>
          <Text style={styles.requestTime}>{item.timeSlot}</Text>
        </View>
      </View>

      {/* Service badge */}
      <View style={styles.serviceBadgeRow}>
        <View style={styles.serviceBadge}>
          <Text style={styles.serviceBadgeText}>{item.serviceType}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.btnDecline, pressed && { opacity: 0.75 }]}
          onPress={handleDecline}
        >
          <Text style={styles.btnDeclineText}>Rifiuta</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btnAccept, pressed && { opacity: 0.85 }]}
          onPress={handleAccept}
        >
          <Text style={styles.btnAcceptText}>Accetta</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Appointment row ──────────────────────────────────────────────────────────

interface AppointmentRowProps {
  item: MockAppointment;
}

function AppointmentRow({ item }: AppointmentRowProps) {
  return (
    <View style={styles.appointmentRow}>
      {/* Date card */}
      <View style={styles.appointmentDateCard}>
        <Text style={styles.appointmentDayAbbrev}>{item.dayAbbrev}</Text>
        <Text style={styles.appointmentDayNum}>{item.dayNum}</Text>
      </View>

      {/* Body */}
      <View style={styles.appointmentBody}>
        <Text style={styles.appointmentTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.appointmentTime}>{item.timeRange}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={`${ON_SURFACE_VARIANT}66`} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CleanerHomeScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);

  const firstName =
    profile?.full_name?.split(" ")[0] ??
    user?.user_metadata?.full_name?.split(" ")[0] ??
    "Professionista";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";

  const loadBookings = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchBookings(user.id, "cleaner");
      setBookings(data);
    } catch {
      setBookings([]);
    }
  }, [user]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const pendingRequests = useMemo(
    () => bookings.filter((b) => b.status === "pending").map(bookingToRequest),
    [bookings]
  );
  const upcomingAppointments = useMemo(
    () =>
      bookings
        .filter((b) => ["accepted", "work_done"].includes(b.status))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3)
        .map(bookingToAppointment),
    [bookings]
  );
  const stats = useMemo(
    () => ({
      inAttesa: bookings.filter((b) => b.status === "pending").length,
      attive: bookings.filter((b) => ["accepted", "work_done"].includes(b.status))
        .length,
      completate: bookings.filter((b) => b.status === "completed").length,
    }),
    [bookings]
  );

  const handleAccept = useCallback(
    async (id: string) => {
      try {
        await updateBookingStatus(id, "accepted");
        Alert.alert("Accettato", "Il lavoro è stato aggiunto ai tuoi impegni");
        loadBookings();
      } catch {
        Alert.alert("Errore", "Impossibile accettare la richiesta");
      }
    },
    [loadBookings]
  );

  const handleDecline = useCallback(
    (id: string) => {
      Alert.alert(
        "Rifiutare lavoro?",
        "Il cliente verrà notificato e potrà scegliere un altro professionista.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Rifiuta",
            style: "destructive",
            onPress: async () => {
              try {
                await updateBookingStatus(id, "declined");
                loadBookings();
              } catch {
                Alert.alert("Errore", "Impossibile rifiutare la richiesta");
              }
            },
          },
        ]
      );
    },
    [loadBookings]
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          {/* Top bar: CleanHome logo + avatar */}
          <View style={styles.headerTop}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="leaf" size={22} color="#022420" />
              <Text style={styles.brandLogo}>CleanHome</Text>
            </View>
            <View style={styles.avatarPhoto}>
              <Ionicons name="person" size={18} color={PRIMARY_CONTAINER} />
            </View>
          </View>
          {/* Greeting */}
          <Text style={styles.greeting}>
            {greeting}, {firstName}
          </Text>
          <Text style={styles.greetingSub}>La tua giornata</Text>
        </View>

        {/* ── Stats grid ──────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            value={stats.inAttesa}
            label="In attesa"
            iconName="alert-circle-outline"
            iconColor="#006b55"
            iconBg="#e6f4f1"
          />
          <StatCard
            value={stats.attive}
            label="Attive"
            iconName="calendar-outline"
            iconColor={PRIMARY}
            iconBg={CLEANER_LIGHT}
          />
          <StatCard
            value={stats.completate}
            label="Completate"
            iconName="checkmark-circle-outline"
            iconColor="#16a34a"
            iconBg="#f0fdf4"
          />
        </View>

        {/* ── Richieste in arrivo ──────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Richieste in arrivo</Text>
          <Pressable
            onPress={() => router.push("/cleaner/jobs" as never)}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <View style={styles.sectionLinkRow}>
              <Text style={styles.sectionLink}>Vedi tutte</Text>
              <Ionicons name="arrow-forward" size={14} color={PRIMARY} />
            </View>
          </Pressable>
        </View>

        {pendingRequests.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Ionicons name="mail-open-outline" size={28} color={OUTLINE} />
            <Text style={styles.emptyText}>
              Nessuna richiesta in attesa
            </Text>
            <Text style={styles.emptySubtext}>
              Le nuove richieste appariranno qui in tempo reale
            </Text>
          </View>
        ) : (
          pendingRequests.map((req) => (
            <View key={req.id} style={styles.cardWrapper}>
              <RequestCard
                item={req}
                onAccept={handleAccept}
                onDecline={handleDecline}
              />
            </View>
          ))
        )}

        {/* ── Prossimi appuntamenti ────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Prossimi appuntamenti</Text>
        </View>

        {upcomingAppointments.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Ionicons name="calendar-outline" size={28} color={OUTLINE} />
            <Text style={styles.emptyText}>
              Nessun appuntamento in programma
            </Text>
          </View>
        ) : (
          upcomingAppointments.map((apt) => (
            <View key={apt.id} style={styles.cardWrapper}>
              <AppointmentRow item={apt} />
            </View>
          ))
        )}

        {/* Bottom spacer for tab bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SURFACE,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  bottomSpacer: {
    height: 40,
  },
  emptyBlock: {
    marginHorizontal: 24,
    marginVertical: 8,
    padding: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#414846",
    marginTop: 6,
  },
  emptySubtext: {
    fontSize: 12,
    color: "#717976",
    textAlign: "center",
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: "rgba(246,250,249,0.9)",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  brandLogo: {
    fontSize: 20,
    fontWeight: "700",
    fontStyle: "italic",
    color: "#181c1c",
    letterSpacing: -0.3,
  },
  avatarPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CLEANER_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: CLEANER_LIGHT,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    color: ON_SURFACE,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  greetingSub: {
    fontSize: 14,
    fontWeight: "500",
    color: ON_SURFACE_VARIANT,
    opacity: 0.7,
  },

  // ── Stats row ─────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: "center",
    shadowColor: "rgba(0,107,85,0.06)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: ON_SURFACE,
    letterSpacing: -0.8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: ON_SURFACE_VARIANT,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "center",
  },

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: ON_SURFACE,
    letterSpacing: -0.3,
  },
  sectionLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY,
  },

  // ── Card wrapper ──────────────────────────────────────────────────────────
  cardWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },

  // ── Request card ──────────────────────────────────────────────────────────
  requestCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: PRIMARY_CONTAINER,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
    gap: 14,
  },
  requestTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: CLEANER_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 15,
    fontWeight: "700",
    color: ON_SURFACE,
    marginBottom: 3,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    color: ON_SURFACE_VARIANT,
    flex: 1,
  },
  requestTimeWrap: {
    alignItems: "flex-end",
  },
  requestDate: {
    fontSize: 12,
    fontWeight: "600",
    color: ON_SURFACE,
    marginBottom: 2,
  },
  requestTime: {
    fontSize: 12,
    fontWeight: "500",
    color: ON_SURFACE_VARIANT,
  },
  serviceBadgeRow: {
    flexDirection: "row",
  },
  serviceBadge: {
    backgroundColor: CLEANER_LIGHT,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  serviceBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 4,
  },
  btnDecline: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: OUTLINE,
    backgroundColor: "transparent",
  },
  btnDeclineText: {
    fontSize: 14,
    fontWeight: "700",
    color: PRIMARY,
  },
  btnAccept: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 9999,
    // soul-gradient fallback: solid primary-container
    // (LinearGradient richiederebbe expo-linear-gradient — non installato)
    backgroundColor: PRIMARY_CONTAINER,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnAcceptText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },

  // ── Appointment row ───────────────────────────────────────────────────────
  appointmentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE_LOW,
    borderRadius: 20,
    padding: 16,
    gap: 16,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  appointmentDateCard: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  appointmentDayAbbrev: {
    fontSize: 10,
    fontWeight: "700",
    color: PRIMARY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  appointmentDayNum: {
    fontSize: 20,
    fontWeight: "700",
    color: ON_SURFACE,
    lineHeight: 24,
  },
  appointmentBody: {
    flex: 1,
  },
  appointmentTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: ON_SURFACE,
    marginBottom: 3,
  },
  appointmentTime: {
    fontSize: 12,
    color: ON_SURFACE_VARIANT,
  },
});
