import { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";
import { sendPushNotification, NotificationMessages } from "../../lib/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchClientProperties,
  searchListingsNearPoint,
  countAvailableCleaners,
} from "../../lib/api";
import type { ClientProperty, ListingSearchResult } from "../../lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_WINDOW_OPTIONS = [
  { key: "morning", label: "Mattina", subtitle: "08:00 – 12:00", icon: "sunny-outline" as const },
  { key: "afternoon", label: "Pomeriggio", subtitle: "12:00 – 17:00", icon: "partly-sunny-outline" as const },
  { key: "evening", label: "Sera", subtitle: "17:00 – 21:00", icon: "moon-outline" as const },
] as const;

type TimeWindow = (typeof TIME_WINDOW_OPTIONS)[number]["key"];

const ROOM_OPTIONS = [1, 2, 3, 4, 5, 6];
import { calculatePrice, FEE_RATE } from "../../lib/pricing";
const TOTAL_STEPS = 5; // 0:date 1:details 2:cleaners 3:summary → pay
const MAX_PREFERRED_CLEANERS = 6;

// Property size presets — lets the client pick their typical house
// without guessing the exact sqm. Custom option falls back to a
// numeric input. Numbers are Italian market averages.
const SIZE_PRESETS = [
  { key: "mono",  label: "Monolocale",    sqm: 35,  rooms: 1, icon: "home-outline" as const },
  { key: "bi",    label: "Bilocale",      sqm: 60,  rooms: 2, icon: "home-outline" as const },
  { key: "tri",   label: "Trilocale",     sqm: 90,  rooms: 3, icon: "home-outline" as const },
  { key: "quad",  label: "Quadrilocale",  sqm: 120, rooms: 4, icon: "home-outline" as const },
  { key: "villa", label: "Casa grande",   sqm: 160, rooms: 5, icon: "home-outline" as const },
] as const;

const SERVICE_OPTIONS: ReadonlyArray<{ key: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "Pulizia ordinaria", label: "Pulizia ordinaria", icon: "sparkles-outline" },
  { key: "Pulizia profonda", label: "Pulizia profonda", icon: "water-outline" },
  { key: "Stiratura", label: "Stiratura", icon: "shirt-outline" },
  { key: "Pulizia vetri", label: "Pulizia vetri", icon: "square-outline" },
  { key: "Pulizia uffici", label: "Pulizia uffici", icon: "business-outline" },
] as const;

const MONTH_NAMES_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
const DAY_NAMES_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

// ─── Calendar component ───────────────────────────────────────────────────────

interface CalendarProps {
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
}

function Calendar({ selectedDate, onSelectDate }: CalendarProps) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const goToPrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  // Compute grid cells: leading empty slots + day numbers
  const { cells, firstWeekday } = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // getDay() returns 0=Sun..6=Sat; convert to Mon-first
    const rawDay = firstDay.getDay();
    const leading = rawDay === 0 ? 6 : rawDay - 1;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    return {
      cells: [
        ...Array.from({ length: leading }, () => null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
      ],
      firstWeekday: leading,
    };
  }, [viewYear, viewMonth]);

  const todayStr = useMemo(
    () => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
    [today]
  );

  const isPast = useCallback(
    (day: number) => {
      const d = new Date(viewYear, viewMonth, day);
      d.setHours(0, 0, 0, 0);
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      return d < t;
    },
    [viewYear, viewMonth]
  );

  const toDateStr = useCallback(
    (day: number) =>
      `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    [viewYear, viewMonth]
  );

  // Prevent navigating to months before current
  const canGoPrev = useMemo(() => {
    return !(viewYear === today.getFullYear() && viewMonth <= today.getMonth());
  }, [viewYear, viewMonth, today]);

  return (
    <View style={calStyles.container}>
      {/* Month nav */}
      <View style={calStyles.navRow}>
        <TouchableOpacity
          onPress={goToPrevMonth}
          disabled={!canGoPrev}
          style={[calStyles.navBtn, !canGoPrev && { opacity: 0.3 }]}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={18} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={calStyles.monthLabel}>
          {MONTH_NAMES_IT[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={goToNextMonth} style={calStyles.navBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={calStyles.dayHeaderRow}>
        {DAY_NAMES_SHORT.map((d) => (
          <View key={d} style={calStyles.dayHeaderCell}>
            <Text style={calStyles.dayHeaderText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      <View style={calStyles.grid}>
        {cells.map((day, idx) => {
          if (day === null) {
            return <View key={`empty-${idx}`} style={calStyles.dayCell} />;
          }
          const dateStr = toDateStr(day);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const past = isPast(day);

          return (
            <TouchableOpacity
              key={dateStr}
              onPress={() => !past && onSelectDate(dateStr)}
              disabled={past}
              activeOpacity={0.7}
              style={[
                calStyles.dayCell,
                isSelected && calStyles.dayCellSelected,
                isToday && !isSelected && calStyles.dayCellToday,
                past && calStyles.dayCellPast,
              ]}
            >
              <Text
                style={[
                  calStyles.dayText,
                  isSelected && calStyles.dayTextSelected,
                  isToday && !isSelected && calStyles.dayTextToday,
                  past && calStyles.dayTextPast,
                ]}
              >
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    ...Shadows.sm,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.2,
  },
  dayHeaderRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  dayHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
  },
  dayCellSelected: {
    backgroundColor: Colors.secondary,
  },
  dayCellToday: {
    backgroundColor: Colors.accentLight,
  },
  dayCellPast: {
    opacity: 0.35,
  },
  dayText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.text,
  },
  dayTextSelected: {
    color: Colors.textOnDark,
    fontWeight: "700",
  },
  dayTextToday: {
    color: Colors.secondary,
    fontWeight: "700",
  },
  dayTextPast: {
    color: Colors.textTertiary,
  },
});

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatDateIT(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"][d.getDay()];
  return `${dayName}, ${day} ${MONTH_NAMES_IT[month - 1]} ${year}`;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function NewBookingScreen() {
  const { cleanerId, cleanerName, hourlyRate } = useLocalSearchParams<{
    cleanerId: string;
    cleanerName: string;
    hourlyRate: string;
  }>();
  const { user } = useAuth();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Booking state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<TimeWindow | null>(null);
  const [selectedService, setSelectedService] = useState<string>(
    SERVICE_OPTIONS[0].key
  );
  const [numRooms, setNumRooms] = useState(2);
  const [sqm, setSqm] = useState(50);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  // Dispatch multi-cleaner state
  const [nearbyListings, setNearbyListings] = useState<ListingSearchResult[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  // Pre-validation: # of cleaners covering this lat/lng (15km), checked before payment
  const [availableCount, setAvailableCount] = useState<number | null>(null);
  const [availableCountLoading, setAvailableCountLoading] = useState(false);
  const [preferredCleanerIds, setPreferredCleanerIds] = useState<string[]>([]);

  // Saved properties ("Le mie case") — lets the client pick a pre-filled
  // address/rooms/notes instead of retyping everything. `propertyId` is
  // null when the user chose to enter a new address manually.
  const [properties, setProperties] = useState<ClientProperty[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null
  );
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        // Load the properties list and — in parallel — read the house
        // the client last picked on the home map from AsyncStorage.
        // Priority order for auto-selection:
        //   1. The property the user explicitly picked on the map (the
        //      Amazon-style picker in home.tsx). This is usually what
        //      they just booked for.
        //   2. The default property (is_default=true).
        //   3. The only property in the list if there's exactly one.
        const [data, storedId] = await Promise.all([
          fetchClientProperties(user.id),
          AsyncStorage.getItem("cleanhome.selected_property_id").catch(() => null),
        ]);
        if (cancelled) return;
        setProperties(data);

        const fromStorage = storedId
          ? data.find((p) => p.id === storedId)
          : null;
        const preferred =
          fromStorage ??
          data.find((p) => p.is_default) ??
          (data.length === 1 ? data[0] : null);

        if (preferred) {
          setSelectedPropertyId(preferred.id);
          setAddress(preferred.address);
          setNumRooms(preferred.num_rooms);
          // Pre-load surface from the saved property so the pricing
          // engine quotes against the user's real apartment, not the
          // 50 mq default. Falls back silently if the column is null.
          if (preferred.sqm) setSqm(preferred.sqm);
          if (preferred.notes) setNotes(preferred.notes);
        }
      } catch (err) {
        console.error("[booking] properties load", err);
      } finally {
        if (!cancelled) setPropertiesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSelectProperty = useCallback(
    (id: string | null) => {
      setSelectedPropertyId(id);
      if (id === null) {
        // "Nuovo indirizzo" — clear pre-filled values so the user can type
        setAddress("");
        setNotes("");
        return;
      }
      const p = properties.find((pp) => pp.id === id);
      if (!p) return;
      setAddress(p.address);
      setNumRooms(p.num_rooms);
      if (p.sqm) setSqm(p.sqm);
      if (p.notes) setNotes(p.notes);
    },
    [properties]
  );

  // Block the booking flow up-front if the cleaner doesn't have an
  // active Stripe Connect account. Without it the payment intent
  // can't have a transfer destination and the edge function fails
  // mid-flow with a confusing error. Better to fail fast and tell
  // the user to choose another cleaner.
  const [cleanerStripeReady, setCleanerStripeReady] = useState<
    boolean | null
  >(null); // null = checking
  useEffect(() => {
    if (!cleanerId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("cleaner_profiles")
          .select("stripe_onboarding_complete, stripe_charges_enabled")
          .eq("id", cleanerId)
          .maybeSingle();
        if (cancelled) return;
        setCleanerStripeReady(
          !!data?.stripe_onboarding_complete && !!data?.stripe_charges_enabled
        );
      } catch {
        if (!cancelled) setCleanerStripeReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cleanerId]);

  // Pricing now driven by square meters (sqm), not hours.
  // Formula: max(€50, sqm × €1.30). Server re-validates.
  // Hours shown are only an estimate for the cleaner (~25 mq/h).
  const breakdown = useMemo(() => calculatePrice(sqm), [sqm]);
  const basePrice = breakdown.basePrice;
  const clientFee = breakdown.clientFee;
  const cleanerFee = breakdown.cleanerFee;
  const totalPrice = breakdown.totalClient;
  const estimatedHours = Math.max(1.5, Math.round((sqm / 25) * 2) / 2);

  const displayName = cleanerName || "Professionista";

  const windowLabel = useMemo(() => {
    if (!selectedWindow) return null;
    return TIME_WINDOW_OPTIONS.find((w) => w.key === selectedWindow)?.label ?? null;
  }, [selectedWindow]);

  const timeSlotString = useMemo(() => {
    if (!selectedWindow) return "";
    const opt = TIME_WINDOW_OPTIONS.find((w) => w.key === selectedWindow);
    return opt ? opt.subtitle : "";
  }, [selectedWindow]);

  // Load nearby listings when entering step 2 (cleaner picker)
  // Uses coordinates from the selected property if available, else skips spatial search
  useEffect(() => {
    if (step !== 2 || cleanerId) return; // skip for single-cleaner backward-compat flow
    const prop = properties.find((p) => p.id === selectedPropertyId);
    const lat = prop?.latitude;
    const lng = prop?.longitude;
    if (!lat || !lng) return;
    let cancelled = false;
    setListingsLoading(true);
    searchListingsNearPoint(lat, lng)
      .then((results) => {
        if (!cancelled) setNearbyListings(results.slice(0, 20));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setListingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, cleanerId, properties, selectedPropertyId]);

  // Pre-validation: count cleaners covering the area (15km) before payment.
  // Triggered when user reaches the summary/payment step with valid coords.
  useEffect(() => {
    if (cleanerId) return; // single-cleaner flow doesn't need the count
    if (step < 1) return; // wait until property is chosen
    const prop = properties.find((p) => p.id === selectedPropertyId);
    const lat = prop?.latitude;
    const lng = prop?.longitude;
    if (!lat || !lng) {
      setAvailableCount(null);
      return;
    }
    let cancelled = false;
    setAvailableCountLoading(true);
    countAvailableCleaners(lat, lng, 15)
      .then((res) => {
        if (!cancelled) setAvailableCount(res.total);
      })
      .catch(() => {
        if (!cancelled) setAvailableCount(null);
      })
      .finally(() => {
        if (!cancelled) setAvailableCountLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, cleanerId, properties, selectedPropertyId]);

  const handleToggleCleaner = useCallback(
    (cleanerIdToToggle: string) => {
      setPreferredCleanerIds((prev) => {
        if (prev.includes(cleanerIdToToggle)) {
          return prev.filter((id) => id !== cleanerIdToToggle);
        }
        if (prev.length >= MAX_PREFERRED_CLEANERS) {
          Alert.alert(
            "Limite raggiunto",
            `Puoi selezionare al massimo ${MAX_PREFERRED_CLEANERS} preferiti.`
          );
          return prev;
        }
        return [...prev, cleanerIdToToggle];
      });
    },
    []
  );

  const canProceed = useCallback((): boolean => {
    // Block the entire flow if the cleaner can't accept payments
    if (cleanerStripeReady === false) return false;
    if (step === 0) return !!selectedDate && !!selectedWindow;
    if (step === 1) return sqm >= 15 && !!address.trim();
    // step 2 = cleaner picker — always can proceed (0 selected is valid)
    return true;
  }, [step, selectedDate, selectedWindow, sqm, address, cleanerStripeReady]);

  const handleSubmit = useCallback(async () => {
    if (!user || !selectedDate || !selectedWindow) return;
    setLoading(true);
    try {
      // Resolve property coordinates for dispatch mode
      const prop = properties.find((p) => p.id === selectedPropertyId);

      // Build body — backward compat: single cleanerId param preserved
      // when arriving from a cleaner profile page
      const body: Record<string, unknown> = {
        service_type: selectedService,
        date: selectedDate,
        time_slot: timeSlotString,
        num_rooms: numRooms,
        estimated_hours: estimatedHours,
        base_price: basePrice,
        address,
        notes: notes || undefined,
        property_id: selectedPropertyId ?? undefined,
      };

      if (cleanerId) {
        // Legacy single-cleaner flow (arrived from cleaner profile)
        body.cleaner_id = cleanerId;
      } else {
        // Dispatch flow
        if (preferredCleanerIds.length > 0) {
          body.preferred_cleaner_ids = preferredCleanerIds;
        } else {
          // Auto-dispatch: send property coords so backend finds nearest
          if (prop?.latitude) body.search_lat = prop.latitude;
          if (prop?.longitude) body.search_lng = prop.longitude;
        }
      }

      // 1) Call Edge Function to create PaymentIntent with destination
      //    charge (platform fee split). The server recalculates fees
      //    so the client can't tamper with amounts.
      const { data: invokeData, error: invokeError } =
        await supabase.functions.invoke("stripe-booking-payment", { body });

      if (invokeError) {
        type EdgeFnError = Error & { context?: { text?: () => Promise<string> } };
        const ctx = (invokeError as EdgeFnError).context;
        let details = invokeError.message;
        if (ctx && typeof ctx.text === "function") {
          try { details = await ctx.text(); } catch {}
        }
        throw new Error(details);
      }

      const payload = (invokeData ?? {}) as {
        customer?: string;
        ephemeralKey?: string;
        paymentIntent?: string;
        paymentIntentId?: string;
        booking_id?: string;
        error?: string;
      };

      if (!payload.paymentIntent) {
        throw new Error(
          payload.error || "Impossibile avviare il pagamento"
        );
      }

      // 2) Present Stripe Payment Sheet
      const { error: initErr } = await initPaymentSheet({
        merchantDisplayName: "CleanHome",
        customerId: payload.customer,
        customerEphemeralKeySecret: payload.ephemeralKey,
        paymentIntentClientSecret: payload.paymentIntent,
        allowsDelayedPaymentMethods: false,
        returnURL: "cleanhome://stripe-redirect",
      });
      if (initErr) throw new Error(initErr.message);

      const { error: presentErr } = await presentPaymentSheet();
      if (presentErr) {
        if (presentErr.code !== "Canceled") {
          Alert.alert("Pagamento non riuscito", presentErr.message);
        }
        return; // User cancelled — no booking created
      }

      // 3) Payment succeeded
      const bookingId = payload.booking_id;

      if (cleanerId) {
        // Legacy single-cleaner: send push and go to bookings
        const { title: notifTitle, body: notifBody } = NotificationMessages.newBooking(selectedService);
        await sendPushNotification(cleanerId, notifTitle, notifBody, { screen: "cleaner-home" }).catch(() => {});
        Alert.alert(
          "Prenotazione confermata!",
          `Il pagamento è andato a buon fine. ${displayName} riceverà la tua richiesta.`,
          [{ text: "OK", onPress: () => router.replace("/(tabs)/bookings") }]
        );
      } else if (bookingId) {
        // Dispatch flow: navigate to waiting screen
        router.replace(`/booking/${bookingId}/waiting` as never);
      } else {
        router.replace("/(tabs)/bookings");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Impossibile creare la prenotazione";
      Alert.alert("Errore", message);
    } finally {
      setLoading(false);
    }
  }, [
    user, cleanerId, selectedDate, selectedWindow, timeSlotString,
    numRooms, estimatedHours, basePrice, selectedService,
    address, notes, selectedPropertyId, properties,
    preferredCleanerIds, displayName, router,
    initPaymentSheet, presentPaymentSheet,
  ]);

  const handleContinue = useCallback(() => {
    // 4 steps in dispatch flow (no preselected cleaner), 3 otherwise.
    const stepsCount = !cleanerId ? 4 : 3;
    if (step < stepsCount - 1) {
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  }, [step, cleanerId, handleSubmit]);

  // ── Step 0: Date & Time ───────────────────────────────────────────────────────
  const renderDateStep = () => (
    <View style={{ gap: Spacing.xl }}>
      {/* Calendar */}
      <View>
        <Text style={s.sectionLabel}>Seleziona la data</Text>
        <Calendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      </View>

      {/* Time window */}
      <View>
        <Text style={s.sectionLabel}>Fascia oraria preferita</Text>
        <View style={{ gap: Spacing.sm }}>
          {TIME_WINDOW_OPTIONS.map((opt) => {
            const selected = selectedWindow === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setSelectedWindow(opt.key)}
                activeOpacity={0.8}
                style={[s.windowPill, selected && s.windowPillSelected]}
              >
                <View style={[s.windowIcon, selected && s.windowIconSelected]}>
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={selected ? Colors.textOnDark : Colors.secondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.windowLabel, selected && s.windowLabelSelected]}>
                    {opt.label}
                  </Text>
                  <Text style={[s.windowSub, selected && { color: "rgba(255,255,255,0.75)" }]}>
                    {opt.subtitle}
                  </Text>
                </View>
                {selected && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.textOnDark} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Summary pill — appears when both date and window selected */}
      {selectedDate && selectedWindow && (
        <View style={s.selectionSummary}>
          <Ionicons name="calendar-outline" size={16} color={Colors.secondary} />
          <Text style={s.selectionSummaryText}>
            {formatDateIT(selectedDate)} · {windowLabel}
          </Text>
        </View>
      )}
    </View>
  );

  // ── Step 1: Details ───────────────────────────────────────────────────────────
  const renderDetailsStep = () => (
    <View style={{ gap: Spacing.xl }}>
      {/* ── Property picker — only shown when the client has saved houses ── */}
      {propertiesLoaded && properties.length > 0 && (
        <View>
          <Text style={s.sectionLabel}>Quale casa vuoi far pulire?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 4 }}
          >
            {properties.map((p) => {
              const selected = selectedPropertyId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => handleSelectProperty(p.id)}
                  activeOpacity={0.85}
                  style={{
                    minWidth: 170,
                    maxWidth: 220,
                    padding: 14,
                    borderRadius: Radius.lg,
                    backgroundColor: selected ? Colors.secondary : Colors.surface,
                    borderWidth: 1.5,
                    borderColor: selected ? Colors.secondary : Colors.border,
                    ...Shadows.sm,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <Ionicons
                      name="home"
                      size={16}
                      color={selected ? "#fff" : Colors.secondary}
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: selected ? "#fff" : Colors.text,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                    {p.is_default && !selected && (
                      <Ionicons name="star" size={11} color={Colors.secondary} />
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      color: selected ? "#d7fff1" : Colors.textSecondary,
                      lineHeight: 16,
                    }}
                    numberOfLines={2}
                  >
                    {p.address}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* "Nuovo indirizzo" card — lets the user skip saved properties */}
            <TouchableOpacity
              onPress={() => handleSelectProperty(null)}
              activeOpacity={0.85}
              style={{
                width: 130,
                padding: 14,
                borderRadius: Radius.lg,
                backgroundColor:
                  selectedPropertyId === null ? Colors.accentLight : "transparent",
                borderWidth: 1.5,
                borderColor:
                  selectedPropertyId === null ? Colors.secondary : Colors.border,
                borderStyle: "dashed",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Ionicons
                name="add-circle-outline"
                size={22}
                color={Colors.secondary}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: Colors.secondary,
                  textAlign: "center",
                }}
              >
                Nuovo indirizzo
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Empty-state hint — invites clients with zero saved houses to use
          the new Le mie case feature without forcing them. */}
      {propertiesLoaded && properties.length === 0 && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/properties/new")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 14,
            borderRadius: Radius.lg,
            backgroundColor: Colors.accentLight,
            borderWidth: 1,
            borderColor: Colors.accent,
          }}
        >
          <Ionicons name="bulb-outline" size={20} color={Colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: Colors.text }}>
              Hai più di una casa?
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: Colors.textSecondary,
                marginTop: 2,
              }}
            >
              Salvale una volta e prenota in un tocco la prossima volta.
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={Colors.textTertiary}
          />
        </TouchableOpacity>
      )}

      <View>
        <Text style={s.sectionLabel}>Tipo di servizio</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
        >
          {SERVICE_OPTIONS.map((svc) => {
            const selected = selectedService === svc.key;
            return (
              <TouchableOpacity
                key={svc.key}
                onPress={() => setSelectedService(svc.key)}
                activeOpacity={0.8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: selected
                    ? Colors.secondary
                    : Colors.backgroundAlt,
                  borderWidth: 1,
                  borderColor: selected ? Colors.secondary : Colors.border,
                }}
              >
                <Ionicons
                  name={svc.icon}
                  size={16}
                  color={selected ? Colors.textOnDark : Colors.secondary}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: selected ? Colors.textOnDark : Colors.text,
                  }}
                >
                  {svc.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View>
        <Text style={s.sectionLabel}>Dimensione casa</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 4 }}
        >
          {SIZE_PRESETS.map((p) => {
            const selected = sqm === p.sqm;
            return (
              <TouchableOpacity
                key={p.key}
                onPress={() => {
                  setSqm(p.sqm);
                  setNumRooms(p.rooms);
                }}
                activeOpacity={0.85}
                style={{
                  minWidth: 120,
                  padding: 14,
                  borderRadius: Radius.lg,
                  backgroundColor: selected ? Colors.secondary : Colors.surface,
                  borderWidth: 1.5,
                  borderColor: selected ? Colors.secondary : Colors.border,
                  alignItems: "center",
                  ...Shadows.sm,
                }}
              >
                <Ionicons
                  name={p.icon}
                  size={22}
                  color={selected ? "#fff" : Colors.secondary}
                  style={{ marginBottom: 6 }}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: selected ? "#fff" : Colors.text,
                    marginBottom: 2,
                  }}
                >
                  {p.label}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: selected ? "rgba(255,255,255,0.85)" : Colors.textTertiary,
                  }}
                >
                  ~{p.sqm} mq
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Custom mq input — lets the user tweak to the exact value */}
        <View style={{ marginTop: Spacing.md }}>
          <Text style={[s.sectionLabel, { marginBottom: 6 }]}>Metri quadri esatti</Text>
          <View style={s.inputWrap}>
            <Ionicons name="resize-outline" size={18} color={Colors.textTertiary} />
            <TextInput
              style={s.input}
              placeholder="es. 75"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
              value={String(sqm)}
              onChangeText={(t) => {
                const n = parseInt(t.replace(/[^0-9]/g, ""), 10);
                setSqm(Number.isNaN(n) ? 0 : Math.min(500, n));
              }}
            />
            <Text style={{ fontSize: 13, color: Colors.textSecondary, fontWeight: "600" }}>mq</Text>
          </View>
          <Text style={[s.roomHint, { marginTop: 8 }]}>
            Durata stimata: {estimatedHours.toFixed(1)}h · Cleaner riceve €{breakdown.cleanerReceives.toFixed(2)}
          </Text>
        </View>
      </View>

      <View>
        <Text style={s.sectionLabel}>Indirizzo</Text>
        <View style={s.inputWrap}>
          <Ionicons name="location-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            style={s.input}
            placeholder="Indirizzo completo"
            placeholderTextColor={Colors.textTertiary}
            value={address}
            onChangeText={setAddress}
          />
        </View>
      </View>

      <View>
        <Text style={s.sectionLabel}>Note (opzionale)</Text>
        <View style={[s.inputWrap, { alignItems: "flex-start", minHeight: 90, paddingTop: 14 }]}>
          <Ionicons name="create-outline" size={18} color={Colors.textTertiary} style={{ marginTop: 2 }} />
          <TextInput
            style={[s.input, { textAlignVertical: "top", flex: 1 }]}
            placeholder="Istruzioni particolari..."
            placeholderTextColor={Colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>
      </View>
    </View>
  );

  // ── Step 2: Summary ───────────────────────────────────────────────────────────
  const renderSummaryStep = () => (
    <View style={{ gap: Spacing.base }}>
      <Text style={s.stepTitle}>Riepilogo prenotazione</Text>
      <Text style={[s.stepSubtitle, { marginBottom: 8 }]}>
        Controlla i dettagli prima di confermare
      </Text>

      <View style={s.summaryCard}>
        {/* Cleaner row */}
        <View style={s.summaryCleanerRow}>
          <View style={s.summaryAvatar}>
            <Text style={s.summaryAvatarText}>
              {displayName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={s.summaryCleanerName}>{displayName}</Text>
            <Text style={s.summaryCleanerSub}>{selectedService}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {[
          { icon: "calendar-outline" as const, label: "Data", value: formatDateIT(selectedDate) },
          { icon: "time-outline" as const, label: "Fascia", value: `${windowLabel} (${timeSlotString})` },
          { icon: "home-outline" as const, label: "Casa", value: `${sqm} mq · ${numRooms} stanze · ${estimatedHours.toFixed(1)}h stimate` },
          { icon: "location-outline" as const, label: "Indirizzo", value: address },
        ].map((row) => (
          <View key={row.label} style={s.summaryRow}>
            <View style={s.summaryRowIcon}>
              <Ionicons name={row.icon} size={16} color={Colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.summaryRowLabel}>{row.label}</Text>
              <Text style={s.summaryRowValue}>{row.value}</Text>
            </View>
          </View>
        ))}

        <View style={s.divider} />

        {/* Price breakdown */}
        <View style={{ gap: 8 }}>
          <View style={s.priceRow}>
            <Text style={s.priceLabelSec}>Servizio</Text>
            <Text style={s.priceValueSec}>€{basePrice.toFixed(2)}</Text>
          </View>
          <View style={s.priceRow}>
            <Text style={s.priceLabelSec}>Commissione (9%)</Text>
            <Text style={s.priceValueSec}>€{clientFee.toFixed(2)}</Text>
          </View>
        </View>

        <View style={s.totalBox}>
          <Text style={s.totalLabel}>Totale</Text>
          <Text style={s.totalValue}>€{totalPrice.toFixed(2)}</Text>
        </View>
      </View>

      {notes.trim() ? (
        <View style={s.notesBox}>
          <Text style={s.notesLabel}>Note</Text>
          <Text style={s.notesText}>{notes}</Text>
        </View>
      ) : null}
    </View>
  );

  // ── Step 2: Cleaner picker (dispatch flow only) ───────────────────────────────
  const renderCleanerPickerStep = () => {
    const prop = properties.find((p) => p.id === selectedPropertyId);
    const hasCoords = !!(prop?.latitude && prop?.longitude);

    return (
      <View style={{ gap: Spacing.xl }}>
        {/* Skip link */}
        <TouchableOpacity
          onPress={() => {
            setPreferredCleanerIds([]);
            setStep((s) => s + 1);
          }}
          activeOpacity={0.75}
          style={s.skipLink}
        >
          <Text style={s.skipLinkText}>Lascia decidere a CleanHome</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.secondary} />
        </TouchableOpacity>

        {/* Info about auto-dispatch */}
        {preferredCleanerIds.length === 0 && (
          <View style={s.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.secondary} />
            <Text style={s.infoBoxText}>
              Invieremo la richiesta ai 6 cleaner più vicini disponibili nella tua zona
            </Text>
          </View>
        )}

        <Text style={s.sectionLabel}>
          Scegli i tuoi preferiti{preferredCleanerIds.length > 0 ? ` (${preferredCleanerIds.length}/${MAX_PREFERRED_CLEANERS})` : " (opzionale)"}
        </Text>

        {!hasCoords && (
          <View style={s.infoBox}>
            <Ionicons name="warning-outline" size={18} color={Colors.warning} />
            <Text style={[s.infoBoxText, { color: Colors.warning }]}>
              Salva la posizione della tua casa per vedere i professionisti vicini
            </Text>
          </View>
        )}

        {listingsLoading && (
          <ActivityIndicator color={Colors.secondary} size="small" />
        )}

        {!listingsLoading && nearbyListings.length === 0 && hasCoords && (
          <View style={s.emptyListings}>
            <Ionicons name="person-outline" size={28} color={Colors.textTertiary} />
            <Text style={s.emptyListingsText}>
              Nessun professionista trovato nella tua zona.{"\n"}CleanHome cercherà automaticamente.
            </Text>
          </View>
        )}

        {nearbyListings.map((listing) => {
          const isSelected = preferredCleanerIds.includes(listing.cleaner_id);
          const stars = listing.avg_rating.toFixed(1);
          const initials = listing.cleaner_name.slice(0, 2).toUpperCase();
          return (
            <TouchableOpacity
              key={listing.listing_id}
              onPress={() => handleToggleCleaner(listing.cleaner_id)}
              activeOpacity={0.85}
              style={[s.cleanerCard, isSelected && s.cleanerCardSelected]}
            >
              {/* Checkbox top-right */}
              <View style={[s.checkCircle, isSelected && s.checkCircleSelected]}>
                {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>

              {/* Avatar */}
              {listing.cover_url ? (
                <Image
                  source={{ uri: listing.cover_url }}
                  style={s.cleanerAvatar}
                />
              ) : (
                <View style={[s.cleanerAvatar, s.cleanerAvatarFallback]}>
                  <Text style={s.cleanerAvatarText}>{initials}</Text>
                </View>
              )}

              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text style={[s.cleanerName, isSelected && { color: Colors.secondary }]} numberOfLines={1}>
                  {listing.cleaner_name}
                </Text>
                <View style={s.cleanerMeta}>
                  <Ionicons name="star" size={12} color="#f59e0b" />
                  <Text style={s.cleanerMetaText}>{stars}</Text>
                  <Text style={s.cleanerMetaDot}>·</Text>
                  <Text style={s.cleanerMetaText}>
                    {listing.review_count} rec.
                  </Text>
                  {listing.city && (
                    <>
                      <Text style={s.cleanerMetaDot}>·</Text>
                      <Text style={s.cleanerMetaText} numberOfLines={1}>{listing.city}</Text>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // In single-cleaner backward-compat mode, skip the picker step entirely
  const isDispatchFlow = !cleanerId;
  const stepRenderers = isDispatchFlow
    ? [renderDateStep, renderDetailsStep, renderCleanerPickerStep, renderSummaryStep]
    : [renderDateStep, renderDetailsStep, renderSummaryStep];
  const stepTitlesList = isDispatchFlow
    ? ["Quando?", "Dettagli", "Scegli cleaner", "Riepilogo"]
    : ["Quando?", "Dettagli", "Riepilogo"];
  const totalDisplaySteps = stepRenderers.length;

  const stepContent = stepRenderers;
  const stepTitles = stepTitlesList;
  const ctaLabel =
    step < totalDisplaySteps - 1
      ? step === 0
        ? "Continua ai dettagli"
        : step === 1
        ? isDispatchFlow
          ? "Scegli i tuoi cleaner"
          : "Vedi riepilogo"
        : step === 2 && isDispatchFlow
        ? "Vedi riepilogo"
        : "Conferma e paga"
      : "Conferma e paga";

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => (step > 0 ? setStep((prev) => prev - 1) : router.back())}
          activeOpacity={0.8}
          accessibilityLabel={step > 0 ? "Passo precedente" : "Indietro"}
          accessibilityRole="button"
          style={s.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerSubtitle}>Prenota con {displayName}</Text>
          <Text style={s.headerTitle}>{stepTitles[step]}</Text>
        </View>
        <View style={s.stepCounter}>
          <Text style={s.stepCounterText}>{step + 1}/{totalDisplaySteps}</Text>
        </View>
      </View>

      {/* ── Progress bar ── */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${((step + 1) / totalDisplaySteps) * 100}%` }]} />
      </View>

      {/* Price indicator */}
      <View style={s.priceBar}>
        <Text style={s.priceBarLabel}>Stima totale</Text>
        <Text style={s.priceBarValue}>€{totalPrice.toFixed(0)}</Text>
      </View>

      {/* Cleaner-not-payable banner */}
      {cleanerStripeReady === false && (
        <View
          style={{
            marginHorizontal: 20,
            marginTop: 12,
            padding: 14,
            borderRadius: 14,
            backgroundColor: "#fef3c7",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <Ionicons
            name="alert-circle"
            size={20}
            color="#b45309"
            style={{ marginTop: 1 }}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 13, fontWeight: "800", color: "#b45309", marginBottom: 2 }}
            >
              Questo professionista non può ancora ricevere pagamenti
            </Text>
            <Text style={{ fontSize: 12, color: "#92400e", lineHeight: 17 }}>
              Sta completando la verifica Stripe. Riprova più tardi o scegli un
              altro professionista nella mappa.
            </Text>
          </View>
        </View>
      )}

      {/* KeyboardAvoidingView lifts the scroll + CTA above the software
          keyboard when the user focuses the address or notes fields on
          step 1. Without this the keyboard covers those inputs on
          notched iPhones and the user can't see what they're typing. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {(stepContent[step] ?? stepContent[stepContent.length - 1])()}
          <View style={{ height: 32 }} />
        </ScrollView>

        {/* ── Pre-validation banner: cleaner availability (only on summary step, dispatch flow) ── */}
        {!cleanerId && step === totalDisplaySteps - 1 && availableCount !== null && (
          <View style={[
            s.availabilityBanner,
            availableCount === 0 ? s.availabilityBannerEmpty :
              availableCount < 3 ? s.availabilityBannerWarn :
                s.availabilityBannerOk,
          ]}>
            <Ionicons
              name={availableCount === 0 ? "alert-circle" : availableCount < 3 ? "warning" : "checkmark-circle"}
              size={18}
              color={
                availableCount === 0 ? "#dc2626" :
                  availableCount < 3 ? "#9a6c00" :
                    Colors.success
              }
            />
            <Text style={s.availabilityBannerText}>
              {availableCount === 0
                ? "Nessun cleaner disponibile nella tua zona oggi. Riceverai il rimborso completo se nessuno accetta."
                : availableCount < 3
                  ? `Solo ${availableCount} cleaner ${availableCount === 1 ? "disponibile" : "disponibili"} nella zona. Tempo di attesa più lungo.`
                  : `${availableCount} cleaner disponibili nella tua zona`}
            </Text>
          </View>
        )}
        {!cleanerId && step === totalDisplaySteps - 1 && availableCountLoading && (
          <View style={s.availabilityBannerLoading}>
            <ActivityIndicator size="small" color={Colors.textSecondary} />
            <Text style={s.availabilityBannerText}>Verifica disponibilità...</Text>
          </View>
        )}

        {/* ── CTA ── */}
        <View style={s.ctaWrap}>
          <TouchableOpacity
            onPress={handleContinue}
            disabled={!canProceed() || loading}
            activeOpacity={0.85}
            style={[s.ctaBtn, (!canProceed() || loading) && s.ctaBtnDisabled]}
          >
            {loading ? (
              <ActivityIndicator color={Colors.textOnDark} />
            ) : (
              <>
                <Text style={s.ctaBtnText}>{ctaLabel}</Text>
                <Ionicons
                  name={step === totalDisplaySteps - 1 ? "card-outline" : "arrow-forward"}
                  size={18}
                  color={Colors.textOnDark}
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.sm,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.secondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.4,
  },
  stepCounter: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
  },
  stepCounterText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.secondary,
  },

  // Progress
  progressTrack: {
    marginHorizontal: Spacing.base,
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.secondary,
    borderRadius: 4,
  },

  // Price bar
  priceBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  priceBarLabel: {
    fontSize: 12,
    color: Colors.textOnDarkTertiary,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  priceBarValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.textOnDarkSecondary,
    letterSpacing: -0.5,
  },

  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },

  // Time window pills
  windowPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  windowPillSelected: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  windowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  windowIconSelected: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  windowLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 2,
  },
  windowLabelSelected: {
    color: Colors.textOnDark,
  },
  windowSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },

  // Selection summary
  selectionSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  selectionSummaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.secondary,
    flex: 1,
  },

  // Room chips
  roomRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  roomChip: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  roomChipSelected: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  roomChipText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  roomChipTextSelected: {
    color: Colors.textOnDark,
  },
  roomHint: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: "500",
  },

  // Text inputs
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    height: "100%",
  },

  // Summary card
  stepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadows.md,
  },
  summaryCleanerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  summaryAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryAvatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  summaryCleanerName: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 2,
  },
  summaryCleanerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  summaryRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  summaryRowLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryRowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  priceLabelSec: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  priceValueSec: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: "500",
  },
  totalBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  totalValue: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.secondary,
    letterSpacing: -0.5,
  },
  notesBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
    ...Shadows.sm,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Cleaner picker
  skipLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  skipLinkText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.secondary,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: Colors.secondary,
    lineHeight: 18,
    fontWeight: "500",
  },
  cleanerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  cleanerCardSelected: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.accentLight,
  },
  checkCircle: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleSelected: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  cleanerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  cleanerAvatarFallback: {
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cleanerAvatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.accent,
  },
  cleanerName: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 4,
  },
  cleanerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cleanerMetaText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  cleanerMetaDot: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  emptyListings: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  emptyListingsText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: "center",
    lineHeight: 19,
  },

  // Availability banner (pre-validation)
  availabilityBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    marginHorizontal: Spacing.base,
    marginBottom: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  availabilityBannerOk: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  availabilityBannerWarn: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warning,
  },
  availabilityBannerEmpty: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.error,
  },
  availabilityBannerLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    marginHorizontal: Spacing.base,
    marginBottom: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceElevated,
  },
  availabilityBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },

  // CTA
  ctaWrap: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: Spacing.base,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  ctaBtn: {
    height: 58,
    borderRadius: Radius.lg,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    ...Shadows.md,
  },
  ctaBtnDisabled: {
    backgroundColor: Colors.border,
    ...Shadows.sm,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textOnDark,
    letterSpacing: 0.2,
  },
});
