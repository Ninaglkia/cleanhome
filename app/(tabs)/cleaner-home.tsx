import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StatusBar,
  StyleSheet,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../lib/auth";
import CoachMarkOverlay, {
  CoachMarkStep,
} from "../../components/CoachMarks/CoachMarkOverlay";
import { START_TOUR_KEY } from "../(auth)/welcome-rocket";

const { width: SW, height: SH } = Dimensions.get("window");
import {
  fetchBookings,
  fetchPendingOffersForCleaner,
  cleanerOfferAction,
  subscribeToCleanerOffers,
} from "../../lib/api";
import {
  NotificationMessages,
  sendPushNotification,
} from "../../lib/notifications";
import { Booking, BookingOffer } from "../../lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCountdown } from "../../lib/hooks/useCountdown";
import { measureInWindow } from "../../lib/measureInWindow";
import { NotificationBell } from "../../components/NotificationBell";

// ─── Design tokens ────────────────────────────────────────────────────────────

const PRIMARY = "#006b55";
const PRIMARY_CONTAINER = "#022420";
const ON_SURFACE = "#181c1c";
const ON_SURFACE_VARIANT = "#414846";
const SURFACE = "#f6faf9";
const SURFACE_LOW = "#f0f4f3";
const OUTLINE = "#717976";
const CLEANER_LIGHT = "#e6f4f1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IT_DAY_ABBREV = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

function formatBookingDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${IT_DAY_ABBREV[d.getDay()]} ${d.getDate()}`;
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

// ─── Request card — riceve un Booking direttamente ────────────────────────────

interface RequestCardProps {
  booking: Booking;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

function RequestCard({ booking, onAccept, onDecline }: RequestCardProps) {
  const handleAccept = useCallback(
    () => onAccept(booking.id),
    [booking.id, onAccept]
  );
  const handleDecline = useCallback(
    () => onDecline(booking.id),
    [booking.id, onDecline]
  );

  const dateLabel = formatBookingDate(booking.date);

  return (
    <View style={styles.requestCard}>
      {/* Top row: avatar + address/service + date/time */}
      <View style={styles.requestTop}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={20} color={OUTLINE} />
        </View>
        <View style={styles.requestInfo}>
          <Text style={styles.requestName} numberOfLines={1}>
            {booking.address
              ? `Prenotazione · ${booking.address}`
              : "Nuova prenotazione"}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={12} color={OUTLINE} />
            <Text style={styles.locationText} numberOfLines={1}>
              {booking.address ?? "Indirizzo non specificato"}
            </Text>
          </View>
        </View>
        <View style={styles.requestTimeWrap}>
          <Text style={styles.requestDate}>{dateLabel}</Text>
          <Text style={styles.requestTime}>{booking.time_slot}</Text>
        </View>
      </View>

      {/* Service badge */}
      <View style={styles.serviceBadgeRow}>
        <View style={styles.serviceBadge}>
          <Text style={styles.serviceBadgeText}>{booking.service_type}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            styles.btnDecline,
            pressed && { opacity: 0.75 },
          ]}
          onPress={handleDecline}
          accessibilityLabel={`Rifiuta prenotazione del ${dateLabel}`}
          accessibilityRole="button"
        >
          <Text style={styles.btnDeclineText}>Rifiuta</Text>
        </Pressable>
        <View style={styles.btnAccept}>
          <Pressable
            onPress={handleAccept}
            accessibilityLabel={`Accetta prenotazione del ${dateLabel}`}
            accessibilityRole="button"
            android_ripple={{ color: "rgba(255,255,255,0.18)" }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 13,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={styles.btnAcceptText}>Accetta</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Appointment row — riceve un Booking direttamente ────────────────────────

interface AppointmentRowProps {
  booking: Booking;
  onPress: () => void;
}

function AppointmentRow({ booking, onPress }: AppointmentRowProps) {
  const d = new Date(booking.date);
  const dayAbbrev = IT_DAY_ABBREV[d.getDay()];
  const dayNum = d.getDate();
  const title = `${booking.address ?? "Cliente"} — ${booking.service_type}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Prenotazione del ${dayAbbrev} ${dayNum}, ${title}`}
      style={({ pressed }) => [styles.appointmentRow, pressed && { opacity: 0.7 }]}
    >
      {/* Date card */}
      <View style={styles.appointmentDateCard}>
        <Text style={styles.appointmentDayAbbrev}>{dayAbbrev}</Text>
        <Text style={styles.appointmentDayNum}>{dayNum}</Text>
      </View>

      {/* Body */}
      <View style={styles.appointmentBody}>
        <Text style={styles.appointmentTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.appointmentTime}>{booking.time_slot}</Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={`${ON_SURFACE_VARIANT}66`}
      />
    </Pressable>
  );
}

// ─── Offer countdown pill ────────────────────────────────────────────────────

function CountdownPill({ expiresAt }: { expiresAt: string }) {
  const cd = useCountdown(expiresAt);
  return (
    <View
      style={[
        offerStyles.pill,
        cd.hours === 0 && cd.minutes < 30 ? offerStyles.pillUrgent : null,
      ]}
    >
      <Ionicons name="timer-outline" size={12} color={cd.hours === 0 && cd.minutes < 30 ? "#dc2626" : OUTLINE} />
      <Text style={[offerStyles.pillText, cd.hours === 0 && cd.minutes < 30 && { color: "#dc2626" }]}>
        {cd.formatted}
      </Text>
    </View>
  );
}

// ─── Offer card ───────────────────────────────────────────────────────────────

interface OfferCardProps {
  offer: BookingOffer;
  onAccept: (bookingId: string) => void;
  onDecline: (bookingId: string) => void;
}

function OfferCard({ offer, onAccept, onDecline }: OfferCardProps) {
  const booking = offer.booking;
  const handleAccept = useCallback(() => onAccept(offer.booking_id), [offer.booking_id, onAccept]);
  const handleDecline = useCallback(() => onDecline(offer.booking_id), [offer.booking_id, onDecline]);

  if (!booking) return null;

  const dateLabel = formatBookingDate(booking.date);
  const netEarnings = booking.base_price - (booking.cleaner_fee ?? 0);

  return (
    <View style={offerStyles.card}>
      {/* Header row */}
      <View style={offerStyles.cardHeader}>
        <View style={offerStyles.avatarCircle}>
          <Ionicons name="flash" size={18} color={PRIMARY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={offerStyles.cardTitle}>Nuova richiesta dispatch</Text>
          <Text style={offerStyles.cardSub} numberOfLines={1}>
            {booking.address ?? "Indirizzo non specificato"}
          </Text>
        </View>
        <CountdownPill expiresAt={offer.expires_at} />
      </View>

      {/* Details row */}
      <View style={offerStyles.detailRow}>
        <View style={offerStyles.detailItem}>
          <Ionicons name="calendar-outline" size={14} color={OUTLINE} />
          <Text style={offerStyles.detailText}>{dateLabel}</Text>
        </View>
        <View style={offerStyles.detailItem}>
          <Ionicons name="time-outline" size={14} color={OUTLINE} />
          <Text style={offerStyles.detailText}>{booking.time_slot}</Text>
        </View>
        <View style={[offerStyles.detailItem, offerStyles.earningsBadge]}>
          <Ionicons name="cash-outline" size={14} color={PRIMARY} />
          <Text style={[offerStyles.detailText, { color: PRIMARY, fontWeight: "700" }]}>
            €{netEarnings.toFixed(0)}
          </Text>
        </View>
      </View>

      {/* Service badge */}
      <View style={{ flexDirection: "row" }}>
        <View style={styles.serviceBadge}>
          <Text style={styles.serviceBadgeText}>{booking.service_type}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.btnDecline, pressed && { opacity: 0.75 }]}
          onPress={handleDecline}
          accessibilityLabel="Rifiuta offerta"
          accessibilityRole="button"
        >
          <Text style={styles.btnDeclineText}>Rifiuta</Text>
        </Pressable>
        <View style={styles.btnAccept}>
          <Pressable
            onPress={handleAccept}
            accessibilityLabel="Accetta offerta"
            accessibilityRole="button"
            android_ripple={{ color: "rgba(255,255,255,0.18)" }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 13,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={styles.btnAcceptText}>Accetta</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const offerStyles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: PRIMARY_CONTAINER,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    gap: 14,
    borderWidth: 1,
    borderColor: "#e0f0ed",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CLEANER_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: ON_SURFACE,
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 12,
    color: ON_SURFACE_VARIANT,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: SURFACE_LOW,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillUrgent: {
    backgroundColor: "#fee2e2",
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
    color: OUTLINE,
  },
  detailRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: ON_SURFACE_VARIANT,
    fontWeight: "500",
  },
  earningsBadge: {
    backgroundColor: CLEANER_LIGHT,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CleanerHomeScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pendingOffers, setPendingOffers] = useState<BookingOffer[]>([]);
  const offerChannelRef = useRef<RealtimeChannel | null>(null);

  // ── Coach marks ────────────────────────────────────────────────────────────
  const [showCoachMarks, setShowCoachMarks] = useState(false);
  const [coachSteps, setCoachSteps] = useState<CoachMarkStep[]>([]);

  // Refs for screen-absolute measurement via measureInWindow
  const requestsSectionRef = useRef<View>(null);
  const calendarSectionRef = useRef<View>(null);
  const profileTabRef = useRef<View>(null);

  // On focus: check if the welcome modal set the START_TOUR_KEY.
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(START_TOUR_KEY).then((val) => {
        if (val === "1") {
          AsyncStorage.removeItem(START_TOUR_KEY).catch(() => {});
          setShowCoachMarks(true);
        }
      }).catch(() => {});
    }, [])
  );

  // Coach mark for CLEANER — only one step now (requests section). The
  // profile-completion banner was removed, so its measurement target is
  // gone too.
  useEffect(() => {
    if (!showCoachMarks) return;
    const timer = setTimeout(async () => {
      const requestsRect = await measureInWindow(requestsSectionRef);
      const steps: CoachMarkStep[] = [];
      if (requestsRect) {
        steps.push({
          rect: requestsRect,
          title: "Verifica la tua identita",
          description:
            "Carica i tuoi documenti per ottenere il badge verificato e ricevere piu richieste dai clienti.",
        });
      }
      if (steps.length >= 1) setCoachSteps(steps);
    }, 400);
    return () => clearTimeout(timer);
  }, [showCoachMarks]);

  const handleCoachMarkDone = useCallback(() => {
    setShowCoachMarks(false);
  }, []);

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

  const loadOffers = useCallback(async () => {
    if (!user) return;
    try {
      const offers = await fetchPendingOffersForCleaner(user.id);
      setPendingOffers(offers);
    } catch {
      setPendingOffers([]);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
      loadOffers();
    }, [loadBookings, loadOffers])
  );

  // Realtime: quando un'offerta viene cancellata (altro cleaner ha vinto),
  // rimuoviamola dalla lista senza ricaricare tutto
  useEffect(() => {
    if (!user) return;
    offerChannelRef.current = subscribeToCleanerOffers(user.id, (updatedOffer) => {
      if (updatedOffer.status === "cancelled" || updatedOffer.status === "expired") {
        setPendingOffers((prev) => prev.filter((o) => o.id !== updatedOffer.id));
      } else if (updatedOffer.status === "pending") {
        // new offer arrived — reload full list to get booking join data
        loadOffers();
      }
    });
    return () => {
      offerChannelRef.current?.unsubscribe();
    };
  }, [user, loadOffers]);

  const pendingBookings = useMemo(
    () => bookings.filter((b) => b.status === "pending" && !!b.cleaner_id),
    [bookings]
  );

  const upcomingBookings = useMemo(
    () =>
      bookings
        .filter((b) => ["accepted", "work_done"].includes(b.status))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3),
    [bookings]
  );

  const stats = useMemo(
    () => ({
      inAttesa: pendingBookings.length + pendingOffers.length,
      attive: bookings.filter((b) =>
        ["accepted", "work_done"].includes(b.status)
      ).length,
      completate: bookings.filter((b) => b.status === "completed").length,
    }),
    [bookings]
  );

  // Legacy single-cleaner accept (still uses stripe-booking-action with action="accept")
  const handleAccept = useCallback(
    async (id: string) => {
      try {
        const result = await cleanerOfferAction(id, "accept");
        if (!result.ok && result.error === "already_taken") {
          Alert.alert("Non disponibile", "Questa prenotazione non è più disponibile.");
          loadBookings();
          return;
        }
        Alert.alert("Accettato", "Il lavoro è stato aggiunto ai tuoi impegni");
        const booking = bookings.find((b) => b.id === id);
        if (booking) {
          const { title, body } = NotificationMessages.bookingAccepted(
            profile?.full_name ?? "Il professionista"
          );
          sendPushNotification(booking.client_id, title, body, {
            screen: "bookings",
            bookingId: id,
          }).catch(() => {});
        }
        loadBookings();
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Impossibile accettare la richiesta";
        Alert.alert("Errore", msg);
      }
    },
    [bookings, profile?.full_name, loadBookings]
  );

  const handleDecline = useCallback(
    (id: string) => {
      Alert.alert(
        "Rifiutare lavoro?",
        "Il cliente verrà rimborsato automaticamente e potrà scegliere un altro professionista.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Rifiuta",
            style: "destructive",
            onPress: async () => {
              try {
                await cleanerOfferAction(id, "decline");
                setPendingOffers((prev) => prev.filter((o) => o.booking_id !== id));
              } catch (err: unknown) {
                const msg =
                  err instanceof Error ? err.message : "Impossibile rifiutare";
                Alert.alert("Errore", msg);
              }
            },
          },
        ]
      );
    },
    []
  );

  const handleOfferAccept = useCallback(
    async (bookingId: string) => {
      try {
        const result = await cleanerOfferAction(bookingId, "accept");
        if (!result.ok && result.error === "already_taken") {
          Alert.alert(
            "Richiesta già presa",
            "Un altro professionista ha già accettato. Niente paura, arrivano altre richieste!"
          );
          setPendingOffers((prev) => prev.filter((o) => o.booking_id !== bookingId));
          return;
        }
        const offer = pendingOffers.find((o) => o.booking_id === bookingId);
        if (offer?.booking) {
          const { title, body } = NotificationMessages.bookingAccepted(
            profile?.full_name ?? "Il professionista"
          );
          sendPushNotification(offer.booking.client_id, title, body, {
            screen: "bookings",
            bookingId,
          }).catch(() => {});
        }
        setPendingOffers((prev) => prev.filter((o) => o.booking_id !== bookingId));
        loadBookings();
        router.push(`/booking/${bookingId}` as never);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Impossibile accettare";
        Alert.alert("Errore", msg);
      }
    },
    [pendingOffers, profile?.full_name, loadBookings, router]
  );

  const handleOfferDecline = useCallback(
    (bookingId: string) => {
      Alert.alert(
        "Rifiutare questa richiesta?",
        "Verranno contattati altri professionisti nella tua zona.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Rifiuta",
            style: "destructive",
            onPress: async () => {
              try {
                await cleanerOfferAction(bookingId, "decline");
                setPendingOffers((prev) =>
                  prev.filter((o) => o.booking_id !== bookingId)
                );
              } catch (err: unknown) {
                const msg =
                  err instanceof Error ? err.message : "Impossibile rifiutare";
                Alert.alert("Errore", msg);
              }
            },
          },
        ]
      );
    },
    []
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Image
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                source={require("../../assets/icon.png")}
                style={{ width: 22, height: 22, borderRadius: 6 }}
              />
              <Text style={styles.brandLogo}>CleanHome</Text>
            </View>
            <NotificationBell color={PRIMARY_CONTAINER} />
          </View>
          <Text style={styles.greeting}>
            {greeting}, {firstName}
          </Text>
          <Text style={styles.greetingSub}>La tua giornata</Text>
        </View>

        {/* ── Stats grid ── */}
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

        {/* ── Richieste in arrivo ── */}
        <View
          ref={requestsSectionRef}
          style={styles.sectionHeader}
        >
          <Text style={styles.sectionTitle}>Richieste in arrivo</Text>
          <Pressable
            onPress={() => router.push("/cleaner/jobs" as never)}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            accessibilityLabel="Vedi tutte le richieste"
            accessibilityRole="button"
          >
            <View style={styles.sectionLinkRow}>
              <Text style={styles.sectionLink}>Vedi tutte</Text>
              <Ionicons name="arrow-forward" size={14} color={PRIMARY} />
            </View>
          </Pressable>
        </View>

        {/* Offerte dispatch (nuove) */}
        {pendingOffers.map((offer) => (
          <View key={offer.id} style={styles.cardWrapper}>
            <OfferCard
              offer={offer}
              onAccept={handleOfferAccept}
              onDecline={handleOfferDecline}
            />
          </View>
        ))}

        {/* Prenotazioni legacy single-cleaner */}
        {pendingBookings.map((booking) => (
          <View key={booking.id} style={styles.cardWrapper}>
            <RequestCard
              booking={booking}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          </View>
        ))}

        {pendingBookings.length === 0 && pendingOffers.length === 0 && (
          <View style={styles.emptyBlock}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="mail-open-outline" size={26} color={PRIMARY} />
            </View>
            <Text style={styles.emptyText}>Nessuna richiesta in attesa</Text>
            <Text style={styles.emptySubtext}>
              Le nuove richieste appariranno qui in tempo reale
            </Text>
            <Pressable
              onPress={() => router.push("/listing" as never)}
              style={({ pressed }) => [styles.emptyCtaBtn, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <Ionicons name="add-circle-outline" size={16} color="#ffffff" />
              <Text style={styles.emptyCtaText}>Crea un annuncio</Text>
            </Pressable>
          </View>
        )}

        {/* ── Prossimi appuntamenti ── */}
        <View
          ref={calendarSectionRef}
          style={styles.sectionHeader}
        >
          <Text style={styles.sectionTitle}>Prossimi appuntamenti</Text>
        </View>

        {upcomingBookings.length === 0 ? (
          <View style={styles.emptyBlock}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="calendar-outline" size={26} color={PRIMARY} />
            </View>
            <Text style={styles.emptyText}>Nessun appuntamento in programma</Text>
            <Text style={styles.emptySubtext}>
              Accetta una richiesta per vederla qui nel tuo calendario
            </Text>
            <Pressable
              onPress={() => router.push("/cleaner/jobs" as never)}
              style={({ pressed }) => [styles.emptyCtaBtn, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <Ionicons name="briefcase-outline" size={16} color="#ffffff" />
              <Text style={styles.emptyCtaText}>Vedi tutti i lavori</Text>
            </Pressable>
          </View>
        ) : (
          upcomingBookings.map((booking) => (
            <View key={booking.id} style={styles.cardWrapper}>
              <AppointmentRow
                booking={booking}
                onPress={() => router.push(`/booking/${booking.id}` as never)}
              />
            </View>
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ── Ghost View for profile tab measurement ───────────────────────────
          Transparent, non-interactive View positioned over the Profilo tab
          (index 3 of 4). Tab bar: height 88 iOS / 68 Android, paddingH 8.
          Each tab width = (SW - 16) / 4.                               ── */}
      {(() => {
        const tabBarHeight = Platform.OS === "ios" ? 88 : 68;
        const tabBarTop = SH - tabBarHeight;
        const tabW = (SW - 16) / 4;
        const tabLeft = 8 + tabW * 3; // Profilo = index 3
        return (
          <View
            ref={profileTabRef}
            pointerEvents="none"
            style={{
              position: "absolute",
              top: tabBarTop,
              left: tabLeft,
              width: tabW,
              height: tabBarHeight,
            }}
          />
        );
      })()}

      {/* ── Coach mark first-run overlay ── */}
      {showCoachMarks && coachSteps.length >= 1 && (
        <CoachMarkOverlay
          steps={coachSteps}
          storageKey="cleanhome.first_run_tour_done"
          onDone={handleCoachMarkDone}
        />
      )}
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
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 24,
    backgroundColor: "#fff",
    borderRadius: 20,
    alignItems: "center",
    gap: 8,
    shadowColor: PRIMARY_CONTAINER,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: CLEANER_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "700",
    color: ON_SURFACE,
    textAlign: "center",
    marginTop: 2,
  },
  emptySubtext: {
    fontSize: 12,
    color: ON_SURFACE_VARIANT,
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 8,
  },
  emptyCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PRIMARY_CONTAINER,
    borderRadius: 9999,
    paddingVertical: 11,
    paddingHorizontal: 20,
    marginTop: 8,
    shadowColor: PRIMARY_CONTAINER,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyCtaText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.1,
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
    borderRadius: 9999,
    backgroundColor: PRIMARY_CONTAINER,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
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
