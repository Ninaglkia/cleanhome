import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StatusBar,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { fetchBookings, markWorkDone } from "../../lib/api";
import {
  NotificationMessages,
  sendPushNotification,
} from "../../lib/notifications";
import { Booking } from "../../lib/types";
import { Colors } from "../../lib/theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = "#022420";
const PRIMARY_CONTAINER = "#1a3a35";
const SECONDARY = "#006b55";
const SECONDARY_CONTAINER = "#82f4d1";
const SURFACE = "#f6faf9";
const SURFACE_LOW = "#f0f4f3";
const ON_SURFACE = "#181c1c";
const ON_SURFACE_VARIANT = "#414846";
const OUTLINE = "#717976";
const OUTLINE_VARIANT = "#c1c8c5";

type FilterTab = "active" | "cancelled" | "history";

// ─── Job card ─────────────────────────────────────────────────────────────────

interface JobCardProps {
  booking: Booking;
  onViewDetails: (id: string) => void;
  onMarkWorkDone?: (id: string) => void;
}

function JobCard({ booking, onViewDetails, onMarkWorkDone }: JobCardProps) {
  const earnings = (booking.base_price - booking.cleaner_fee).toFixed(2);
  const hourlyRate = booking.estimated_hours > 0
    ? (booking.base_price / booking.estimated_hours).toFixed(0)
    : "—";

  const canMarkDone = booking.status === "accepted";
  const isWaitingConfirm = booking.status === "work_done";

  return (
    <View style={styles.jobCard}>
      {/* Card header */}
      <View style={styles.jobCardTop}>
        <View style={styles.jobIconWrap}>
          <Ionicons
            name={isWaitingConfirm ? "hourglass-outline" : "checkmark-circle"}
            size={22}
            color={Colors.secondary}
          />
        </View>
        <View style={styles.jobTitleBlock}>
          <Text style={styles.jobTitle} numberOfLines={1}>
            {booking.service_type}
          </Text>
          <Text style={styles.jobRate}>€{hourlyRate}/ora</Text>
        </View>
        <View style={styles.jobEarningsBadge}>
          <Text style={styles.jobEarningsText}>€{earnings}</Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.jobDetailsBlock}>
        {booking.address ? (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.detailText} numberOfLines={1}>
              {booking.address}
            </Text>
          </View>
        ) : null}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.detailText}>
            {booking.date} — {booking.time_slot}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.detailText}>
            {booking.estimated_hours}h · {booking.num_rooms} stanze
          </Text>
        </View>
      </View>

      {isWaitingConfirm ? (
        <View
          style={[
            styles.viewDetailsBtn,
            { backgroundColor: Colors.warningLight, flexDirection: "row" },
          ]}
        >
          <Ionicons name="time-outline" size={14} color={Colors.warning} />
          <Text
            style={[
              styles.viewDetailsBtnText,
              { color: Colors.warning, marginLeft: 6 },
            ]}
          >
            In attesa di conferma cliente
          </Text>
        </View>
      ) : canMarkDone && onMarkWorkDone ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={[styles.viewDetailsBtn, { flex: 1 }]}>
            <Pressable
              onPress={() => onMarkWorkDone(booking.id)}
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 12,
                gap: 6,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={styles.viewDetailsBtnText}>Segna completato</Text>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </Pressable>
          </View>
          <Pressable
            style={({ pressed }) => [
              {
                width: 44,
                borderRadius: 12,
                backgroundColor: Colors.backgroundAlt,
                alignItems: "center",
                justifyContent: "center",
              },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => onViewDetails(booking.id)}
          >
            <Ionicons name="chatbubble-outline" size={16} color={Colors.secondary} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.viewDetailsBtn}>
          <Pressable
            onPress={() => onViewDetails(booking.id)}
            android_ripple={{ color: "rgba(255,255,255,0.18)" }}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 12,
              gap: 6,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={styles.viewDetailsBtnText}>Vedi Dettagli</Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Payment row ──────────────────────────────────────────────────────────────

interface PaymentRowProps {
  booking: Booking;
}

function PaymentRow({ booking }: PaymentRowProps) {
  const earnings = (booking.base_price - booking.cleaner_fee).toFixed(2);

  return (
    <View style={styles.paymentRow}>
      <View style={styles.paymentIconWrap}>
        <Ionicons name="cash-outline" size={18} color={Colors.secondary} />
      </View>
      <View style={styles.paymentInfo}>
        <Text style={styles.paymentService} numberOfLines={1}>
          {booking.service_type}
        </Text>
        <Text style={styles.paymentDate}>{booking.date}</Text>
      </View>
      <Text style={styles.paymentAmount}>€{earnings}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CleanerJobsScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("active");

  const loadBookings = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);
      try {
        const data = await fetchBookings(user.id, "cleaner");
        setBookings(data);
      } catch {
        Alert.alert("Errore", "Impossibile caricare i lavori");
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

  const handleViewDetails = useCallback(
    (id: string) => {
      router.push(`/chat/${id}`);
    },
    [router]
  );

  const handleMarkWorkDone = useCallback(
    (id: string) => {
      Alert.alert(
        "Segnare come completato?",
        "Il cliente verrà notificato per confermare il lavoro e rilasciare il pagamento.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Conferma",
            style: "default",
            onPress: async () => {
              try {
                await markWorkDone(id);
                // Notify the client so they can review and release payment
                const booking = bookings.find((b) => b.id === id);
                if (booking) {
                  const { title, body } = NotificationMessages.workDone(
                    profile?.full_name ?? "Il professionista"
                  );
                  sendPushNotification(booking.client_id, title, body, {
                    screen: "bookings",
                    bookingId: id,
                  }).catch(() => {});
                }
                loadBookings();
              } catch {
                Alert.alert("Errore", "Impossibile aggiornare il lavoro");
              }
            },
          },
        ]
      );
    },
    [bookings, profile?.full_name, loadBookings]
  );

  const handleBrowseMarket = useCallback(() => {
    router.push("/(tabs)/cleaner-home");
  }, [router]);

  // Filter bookings by tab
  const activeJobs = bookings.filter((b) =>
    ["accepted", "work_done"].includes(b.status)
  );
  const cancelledJobs = bookings.filter((b) =>
    ["declined", "cancelled", "auto_cancelled"].includes(b.status)
  );
  const historyJobs = bookings.filter((b) => b.status === "completed");
  const recentPayments = bookings
    .filter((b) => b.status === "completed")
    .slice(0, 5);

  const displayedJobs =
    activeTab === "active"
      ? activeJobs
      : activeTab === "cancelled"
      ? cancelledJobs
      : historyJobs;

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: "active", label: "Attivi" },
    { id: "cancelled", label: "Annullati" },
    { id: "history", label: "Storico" },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={SECONDARY} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={SECONDARY}
            colors={[SECONDARY]}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>I miei lavori</Text>
          <Pressable
            accessibilityLabel="Calendario"
            accessibilityRole="button"
            style={styles.calendarButton}
          >
            <Ionicons name="calendar-outline" size={22} color={SECONDARY} />
          </Pressable>
        </View>

        {/* ── Motivational banner ── */}
        <View style={styles.motivationBanner}>
          <View style={styles.motivationContent}>
            <Text style={styles.motivationTitle}>Cura nei dettagli</Text>
            <Text style={styles.motivationSub}>
              {activeJobs.length === 0
                ? "Nessun incarico attivo al momento. Ricaricale dall'elenco."
                : activeJobs.length === 1
                ? "Hai 1 incarico oggi. Dai il massimo!"
                : `Hai ${activeJobs.length} incarichi oggi. Dai il massimo!`}
            </Text>
          </View>
          <View style={styles.motivationIllustration}>
            <Ionicons name="star" size={32} color={SECONDARY_CONTAINER} />
          </View>
        </View>

        {/* ── Filter pills ── */}
        <View style={styles.filterRow}>
          {filterTabs.map((tab) => (
            <Pressable
              key={tab.id}
              style={[
                styles.filterPill,
                activeTab === tab.id && styles.filterPillActive,
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeTab === tab.id && styles.filterPillTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Active assignments section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {activeTab === "active"
              ? "INCARICHI ATTIVI"
              : activeTab === "cancelled"
              ? "ANNULLATI"
              : "STORICO"}
          </Text>

          {displayedJobs.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons
                name="briefcase-outline"
                size={32}
                color={Colors.textTertiary}
              />
              <Text style={styles.emptySectionText}>
                Nessun lavoro in questa categoria
              </Text>
            </View>
          ) : (
            displayedJobs.map((booking) => (
              <JobCard
                key={booking.id}
                booking={booking}
                onViewDetails={handleViewDetails}
                onMarkWorkDone={handleMarkWorkDone}
              />
            ))
          )}
        </View>

        {/* ── Recent payments ── */}
        {recentPayments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PAGAMENTI RECENTI</Text>
            <View style={styles.paymentsCard}>
              {recentPayments.map((booking, index) => (
                <View key={booking.id}>
                  <PaymentRow booking={booking} />
                  {index < recentPayments.length - 1 && (
                    <View style={styles.paymentDivider} />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── CTA: Browse market ── */}
        <View style={styles.ctaCard}>
          <View style={styles.ctaIllustration}>
            <Ionicons name="search" size={40} color={SECONDARY_CONTAINER} />
          </View>
          <Text style={styles.ctaTitle}>Hai bisogno di più ore?</Text>
          <Text style={styles.ctaSub}>
            Esplora le richieste disponibili nella tua area
          </Text>
          <View style={styles.ctaButton}>
            <Pressable
              onPress={handleBrowseMarket}
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 14,
                paddingHorizontal: 28,
                gap: 8,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={styles.ctaButtonText}>Sfoglia il Mercato</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 48,
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
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
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: PRIMARY,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  calendarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SURFACE_LOW,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Motivation banner ─────────────────────────────────────────────────────────
  motivationBanner: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: PRIMARY_CONTAINER,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  motivationContent: {
    flex: 1,
  },
  motivationTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  motivationSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 18,
  },
  motivationIllustration: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
  },

  // ── Filter pills ──────────────────────────────────────────────────────────────
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: "#fff",
  },

  // ── Section ───────────────────────────────────────────────────────────────────
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: Colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 14,
  },

  // ── Job card ──────────────────────────────────────────────────────────────────
  jobCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  jobCardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  jobIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  jobTitleBlock: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 3,
  },
  jobRate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  jobEarningsBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  jobEarningsText: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.secondary,
  },
  jobDetailsBlock: {
    gap: 6,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  detailText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  viewDetailsBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    overflow: "hidden",
  },
  viewDetailsBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },

  // ── Empty section ─────────────────────────────────────────────────────────────
  emptySection: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  emptySectionText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: "center",
  },

  // ── Payments card ─────────────────────────────────────────────────────────────
  paymentsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  paymentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentInfo: {
    flex: 1,
  },
  paymentService: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 2,
  },
  paymentDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.success,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 70,
  },

  // ── CTA card ──────────────────────────────────────────────────────────────────
  ctaCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  ctaIllustration: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SURFACE_LOW,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  ctaSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  ctaButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    overflow: "hidden",
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
