# CleanHome — Pack 4 — Booking flow

Stack: React Native + Expo Router v3 + NativeWind + TypeScript
Vedi DESIGN-AUDIT-README.md per il contesto completo.

---

### `app/booking/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function BookingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]/tracking" />
    </Stack>
  );
}
```

---

### `app/booking/new.tsx`

```tsx
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
  { key: "morning", label: "Mattina", subtitle: "08:00 – 12:00", icon: "sunny-outline" as const, endHour: 12 },
  { key: "afternoon", label: "Pomeriggio", subtitle: "12:00 – 17:00", icon: "partly-sunny-outline" as const, endHour: 17 },
  { key: "evening", label: "Sera", subtitle: "17:00 – 21:00", icon: "moon-outline" as const, endHour: 21 },
] as const;

type TimeWindow = (typeof TIME_WINDOW_OPTIONS)[number]["key"];

// Minimum lead time (hours) between booking submission and the END of the
// chosen window — so cleaners have time to accept and arrive. If "now" is
// closer than this to the window's end, the slot is disabled.
const MIN_LEAD_HOURS = 1;

// Returns YYYY-MM-DD for today in local time. Used to compare against the
// selected date string to decide whether to apply same-day filtering.
function todayDateStr(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

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

// Service type is no longer a UI choice — the booking always represents a
// standard cleaning. Backend still wants service_type so we keep this as a
// constant and send it in the submit body.
const SERVICE_NAME = "Pulizia ordinaria";

// Optional add-ons the client can stack on top of the base cleaning.
// Multi-select; each adds a flat fee to the base price (still subject to the
// 9% client + 9% cleaner fee split, applied in the booking screen).
const EXTRA_PRICE = 15;
const EXTRAS_OPTIONS: ReadonlyArray<{ key: string; label: string; icon: keyof typeof Ionicons.glyphMap; price: number }> = [
  { key: "finestre", label: "Finestre", icon: "square-outline", price: EXTRA_PRICE },
  { key: "persiane", label: "Persiane", icon: "browsers-outline", price: EXTRA_PRICE },
];

// Map a square-meter value to a human-readable category. Used in the
// read-only summary when a saved property is selected so the client sees
// a friendly "Bilocale" rather than the raw mq number.
function categoryLabelFromSqm(sqm: number): string {
  if (sqm <= 45) return "Monolocale";
  if (sqm <= 75) return "Bilocale";
  if (sqm <= 105) return "Trilocale";
  if (sqm <= 140) return "Quadrilocale";
  return "Casa grande";
}

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
  // Optional add-ons (Finestre, Persiane). Multi-select. Stored as an
  // array of EXTRAS_OPTIONS keys.
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
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

        // home.tsx writes a comma-separated list of property IDs (it
        // supports multi-select on the map). The booking flow only needs
        // one property, so pick the first ID and look it up.
        const firstStoredId = storedId ? storedId.split(",")[0] : null;
        const fromStorage = firstStoredId
          ? data.find((p) => p.id === firstStoredId)
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
        if (__DEV__) {
          console.error("[booking] properties load", err);
        }
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

  // Extras (Finestre, Persiane) stack on top of the base price. We apply the
  // same 9% client + 9% cleaner fee split to the total base+extras so the
  // pricing model stays consistent.
  const extrasTotal = useMemo(
    () => selectedExtras.length * EXTRA_PRICE,
    [selectedExtras]
  );
  const basePrice = breakdown.basePrice + extrasTotal;
  const clientFee = Math.round(basePrice * 0.09 * 100) / 100;
  const cleanerFee = Math.round(basePrice * 0.09 * 100) / 100;
  const totalPrice = basePrice + clientFee;
  const cleanerReceives = basePrice - cleanerFee;
  const estimatedHours = Math.max(1.5, Math.round((sqm / 25) * 2) / 2);

  // Bug 1: filter out past time windows when the booking is for today.
  // We use the window's endHour minus a lead buffer — booking "Mattina"
  // (ends 12:00) at 11:30 is still useless, so we cut off at endHour - 1h.
  const isWindowDisabled = useCallback(
    (windowKey: TimeWindow): boolean => {
      if (!selectedDate) return false;
      if (selectedDate !== todayDateStr()) return false;
      const opt = TIME_WINDOW_OPTIONS.find((w) => w.key === windowKey);
      if (!opt) return false;
      const now = new Date();
      return now.getHours() >= opt.endHour - MIN_LEAD_HOURS;
    },
    [selectedDate]
  );

  // Auto-clear selection if the chosen window became disabled (e.g. user
  // switched to today after picking tomorrow, or the clock ticked past).
  useEffect(() => {
    if (selectedWindow && isWindowDisabled(selectedWindow)) {
      setSelectedWindow(null);
    }
  }, [selectedDate, selectedWindow, isWindowDisabled]);

  const allWindowsDisabledToday = useMemo(() => {
    if (!selectedDate || selectedDate !== todayDateStr()) return false;
    return TIME_WINDOW_OPTIONS.every((w) => isWindowDisabled(w.key));
  }, [selectedDate, isWindowDisabled]);

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
      .catch((err) => {
        if (__DEV__) {
          console.error("[booking] nearby listings", err);
        }
      })
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

      // Validate: if a property was selected it must resolve to a row
      if (selectedPropertyId && !prop) {
        throw new Error("Casa non trovata. Riprova.");
      }

      // Build body — backward compat: single cleanerId param preserved
      // when arriving from a cleaner profile page
      const body: Record<string, unknown> = {
        service_type: SERVICE_NAME,
        date: selectedDate,
        time_slot: timeSlotString,
        num_rooms: numRooms,
        estimated_hours: estimatedHours,
        base_price: basePrice,
        address,
        notes: notes || undefined,
        property_id: selectedPropertyId ?? undefined,
        extras: selectedExtras,
      };

      if (cleanerId) {
        // Legacy single-cleaner flow (arrived from cleaner profile)
        body.cleaner_id = cleanerId;
      } else {
        // Dispatch flow — address is mandatory when no property pre-fills it
        if (!address.trim()) {
          throw new Error("Indirizzo richiesto");
        }
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
        const { title: notifTitle, body: notifBody } = NotificationMessages.newBooking(SERVICE_NAME);
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
    numRooms, estimatedHours, basePrice, selectedExtras,
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
        {allWindowsDisabledToday && (
          <View style={[s.selectionSummary, { marginBottom: Spacing.sm }]}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.secondary} />
            <Text style={s.selectionSummaryText}>
              Oggi non ci sono più orari. Scegli un&apos;altra data.
            </Text>
          </View>
        )}
        <View style={{ gap: Spacing.sm }}>
          {TIME_WINDOW_OPTIONS.map((opt) => {
            const selected = selectedWindow === opt.key;
            const disabled = isWindowDisabled(opt.key);
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={disabled ? undefined : () => setSelectedWindow(opt.key)}
                disabled={disabled}
                activeOpacity={disabled ? 1 : 0.8}
                style={[
                  s.windowPill,
                  selected && s.windowPillSelected,
                  disabled && { opacity: 0.4 },
                ]}
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
                    {disabled ? `${opt.subtitle} (non disponibile oggi)` : opt.subtitle}
                  </Text>
                </View>
                {selected && !disabled && (
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
        <Text style={s.sectionLabel}>Servizi extra (opzionali)</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
        >
          {EXTRAS_OPTIONS.map((extra) => {
            const selected = selectedExtras.includes(extra.key);
            return (
              <TouchableOpacity
                key={extra.key}
                onPress={() =>
                  setSelectedExtras((prev) =>
                    prev.includes(extra.key)
                      ? prev.filter((k) => k !== extra.key)
                      : [...prev, extra.key]
                  )
                }
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
                  name={extra.icon}
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
                  {extra.label} +€{extra.price}
                </Text>
                {selected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={Colors.textOnDark}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* If a saved property is selected, skip re-asking sqm/address —
          we already have them. Show a compact read-only summary instead.
          Manual editors only render for "Nuovo indirizzo" (id === null). */}
      {selectedPropertyId !== null ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 14,
            borderRadius: Radius.lg,
            backgroundColor: Colors.accentLight,
            borderWidth: 1,
            borderColor: Colors.accent,
          }}
        >
          <Ionicons name="checkmark-circle" size={22} color={Colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: Colors.text }}>
              {categoryLabelFromSqm(sqm)} · {numRooms} {numRooms === 1 ? "stanza" : "stanze"} · ~{estimatedHours.toFixed(1)}h
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: Colors.textSecondary,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {address}
            </Text>
          </View>
        </View>
      ) : (
        <>
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

            {/* Helper line summarising the selected size — replaces the
                old manual mq input. The category picker above is now the
                only way to choose the apartment size. */}
            <Text style={[s.roomHint, { marginTop: 8 }]}>
              Durata stimata: {estimatedHours.toFixed(1)}h · Cleaner riceve €{cleanerReceives.toFixed(2)}
            </Text>
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
        </>
      )}

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
            <Text style={s.summaryCleanerSub}>{SERVICE_NAME}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {[
          { icon: "calendar-outline" as const, label: "Data", value: formatDateIT(selectedDate) },
          { icon: "time-outline" as const, label: "Fascia", value: `${windowLabel} (${timeSlotString})` },
          { icon: "home-outline" as const, label: "Casa", value: `${categoryLabelFromSqm(sqm)} · ${numRooms} ${numRooms === 1 ? "stanza" : "stanze"} · ${estimatedHours.toFixed(1)}h stimate` },
          { icon: "location-outline" as const, label: "Indirizzo", value: address },
          ...(selectedExtras.length > 0
            ? [{
                icon: "add-circle-outline" as const,
                label: "Extra",
                value: selectedExtras
                  .map((k) => EXTRAS_OPTIONS.find((e) => e.key === k)?.label)
                  .filter(Boolean)
                  .join(", "),
              }]
            : []),
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
                    {listing.review_count} {listing.review_count === 1 ? "recensione" : "recensioni"}
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
          <Text style={s.headerSubtitle}>
            {cleanerId ? `Prenota con ${displayName}` : "Nuova prenotazione"}
          </Text>
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
        <Text style={s.priceBarValue}>€{totalPrice.toFixed(2)}</Text>
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
```

---

### `app/booking/[id]/index.tsx`

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../lib/auth";
import {
  fetchBooking,
  fetchProfile,
  fetchBookingPhotos,
  confirmBookingCompletion,
  subscribeToBooking,
} from "../../../lib/api";
import { Booking, UserProfile } from "../../../lib/types";
import { Colors, Spacing, Radius, Shadows, BookingStatusConfig } from "../../../lib/theme";
import { MarkDoneModal } from "../../../components/escrow/MarkDoneModal";
import { DisputeModal } from "../../../components/escrow/DisputeModal";

interface BookingPhoto {
  id: string;
  photo_url: string;
  type: string;
  room_label: string | null;
  uploaded_by: string;
  created_at: string;
}

export default function BookingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [cleanerProfile, setCleanerProfile] = useState<UserProfile | null>(null);
  const [clientProfile, setClientProfile] = useState<UserProfile | null>(null);
  const [photos, setPhotos] = useState<BookingPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showMarkDone, setShowMarkDone] = useState(false);
  const [showDispute, setShowDispute] = useState(false);

  const isCleaner = user?.id === booking?.cleaner_id;
  const isClient = user?.id === booking?.client_id;

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const b = await fetchBooking(id);
      if (!b) {
        Alert.alert("Errore", "Prenotazione non trovata", [
          { text: "Indietro", onPress: () => router.back() },
        ]);
        return;
      }
      setBooking(b);

      const [cleaner, client, allPhotos] = await Promise.all([
        b.cleaner_id ? fetchProfile(b.cleaner_id) : Promise.resolve(null),
        fetchProfile(b.client_id),
        fetchBookingPhotos(id),
      ]);
      setCleanerProfile(cleaner);
      setClientProfile(client);
      setPhotos(allPhotos as BookingPhoto[]);
    } catch (err: any) {
      if (__DEV__) {
        console.error("[BookingDetail]", err?.message ?? err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time updates: re-fetch when booking row changes
  useEffect(() => {
    if (!id) return;
    const sub = subscribeToBooking(id, () => {
      loadData();
    });
    return () => {
      sub.unsubscribe?.();
    };
  }, [id, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleConfirm = async () => {
    if (!booking) return;
    Alert.alert(
      "Confermare il servizio?",
      "Confermi che il cleaner ha eseguito il servizio correttamente. Il pagamento verrà rilasciato immediatamente.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Conferma",
          style: "default",
          onPress: async () => {
            setConfirming(true);
            try {
              await confirmBookingCompletion(booking.id);
              await loadData();
              Alert.alert("Servizio confermato", "Il pagamento è stato rilasciato al cleaner.");
            } catch (err: any) {
              Alert.alert("Errore", err?.message ?? "Riprova più tardi");
            } finally {
              setConfirming(false);
            }
          },
        },
      ]
    );
  };

  const statusConfig = useMemo(() => {
    if (!booking) return null;
    return BookingStatusConfig[booking.status] ?? BookingStatusConfig.pending;
  }, [booking]);

  const cleanerPhotos = photos.filter((p) => p.type === "after_cleaner");
  const disputePhotos = photos.filter((p) => p.type === "dispute_client");

  if (loading || !booking) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Dettagli prenotazione</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.loadingBody}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Action bar logic ──────────────────────────────────────────────
  const canCleanerMarkDone =
    isCleaner && booking.status === "accepted" && !booking.work_done_at;

  const canClientReview =
    isClient &&
    booking.status === "accepted" &&
    !!booking.work_done_at &&
    !booking.client_confirmed_at &&
    !booking.client_dispute_opened_at;

  const formattedDate = new Date(booking.date).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Dettagli prenotazione</Text>
        <Pressable onPress={() => router.push(`/chat/${booking.id}` as never)} hitSlop={12}>
          <Ionicons name="chatbubbles-outline" size={24} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Status badge */}
        {statusConfig && (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusConfig.bgColor },
            ]}
          >
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        )}

        {/* Escrow timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.cardTitle}>Stato del pagamento</Text>
          <TimelineRow
            done={true}
            label="Pagamento ricevuto"
            sublabel={`€${booking.total_price.toFixed(2)}`}
          />
          <TimelineRow
            done={booking.status === "accepted" || !!booking.work_done_at || booking.status === "completed"}
            label="Cleaner accettato"
            sublabel={cleanerProfile?.full_name ?? "—"}
          />
          <TimelineRow
            done={!!booking.work_done_at}
            label="Lavoro completato"
            sublabel={
              booking.work_done_at
                ? new Date(booking.work_done_at).toLocaleString("it-IT")
                : booking.status === "accepted"
                ? "In corso"
                : "—"
            }
          />
          <TimelineRow
            done={!!booking.client_confirmed_at}
            label={
              booking.client_dispute_opened_at
                ? "In contestazione"
                : "Pagamento al cleaner"
            }
            sublabel={
              booking.client_dispute_opened_at
                ? "Sospeso fino a risoluzione"
                : booking.client_confirmed_at
                ? new Date(booking.client_confirmed_at).toLocaleString("it-IT")
                : booking.work_done_at
                ? "Conferma entro 48h o auto-rilascio"
                : "—"
            }
            warning={!!booking.client_dispute_opened_at}
          />
        </View>

        {/* Service info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Servizio</Text>
          <InfoRow icon="calendar-outline" label="Data" value={formattedDate} />
          <InfoRow icon="time-outline" label="Orario" value={booking.time_slot} />
          <InfoRow icon="home-outline" label="Stanze" value={String(booking.num_rooms)} />
          {booking.address && (
            <InfoRow icon="location-outline" label="Indirizzo" value={booking.address} />
          )}
          {booking.notes && (
            <InfoRow icon="document-text-outline" label="Note" value={booking.notes} />
          )}
        </View>

        {/* Pricing */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pagamento</Text>
          <PriceRow label="Servizio base" value={booking.base_price} />
          {isClient && <PriceRow label="Commissione" value={booking.client_fee} />}
          {isCleaner && <PriceRow label="Commissione cleaner (9%)" value={-booking.cleaner_fee} />}
          <View style={styles.priceTotalRow}>
            <Text style={styles.priceTotalLabel}>
              {isClient ? "Hai pagato" : "Riceverai"}
            </Text>
            <Text style={styles.priceTotalValue}>
              €
              {(isClient
                ? booking.total_price
                : booking.base_price - booking.cleaner_fee
              ).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Cleaner photos */}
        {cleanerPhotos.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Foto del lavoro completato</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
              {cleanerPhotos.map((p) => (
                <View key={p.id} style={styles.photoStripItem}>
                  <Image source={{ uri: p.photo_url }} style={styles.photoStripImg} />
                  {p.room_label && (
                    <Text style={styles.photoStripLabel}>{p.room_label}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Dispute */}
        {booking.client_dispute_opened_at && (
          <View style={[styles.card, styles.disputeCard]}>
            <View style={styles.disputeHeader}>
              <Ionicons name="alert-circle" size={20} color={Colors.warning} />
              <Text style={styles.disputeTitle}>Contestazione aperta</Text>
            </View>
            <Text style={styles.disputeDate}>
              Aperta il{" "}
              {new Date(booking.client_dispute_opened_at).toLocaleDateString("it-IT")}
            </Text>
            {booking.client_dispute_reason && (
              <Text style={styles.disputeReason}>{booking.client_dispute_reason}</Text>
            )}
            {disputePhotos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                {disputePhotos.map((p) => (
                  <View key={p.id} style={styles.photoStripItem}>
                    <Image source={{ uri: p.photo_url }} style={styles.photoStripImg} />
                  </View>
                ))}
              </ScrollView>
            )}
            <Text style={styles.disputeFooter}>
              Il nostro team esaminerà la segnalazione il prima possibile.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Dynamic action bar */}
      {(canCleanerMarkDone || canClientReview) && (
        <View style={styles.actionBar}>
          {canCleanerMarkDone && (
            <View style={styles.primaryBtn}>
              <Pressable
                onPress={() => setShowMarkDone(true)}
                android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="checkmark-circle" size={20} color="#fff" pointerEvents="none" />
              <Text style={styles.primaryBtnText} pointerEvents="none">Lavoro completato</Text>
            </View>
          )}
          {canClientReview && (
            <View style={styles.dualBtn}>
              <View style={[styles.actionBtn, styles.disputeBtn]}>
                <Pressable
                  onPress={() => setShowDispute(true)}
                  disabled={confirming}
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="alert-circle-outline" size={18} color={Colors.error} pointerEvents="none" />
                <Text style={styles.disputeBtnText} pointerEvents="none">Segnala problema</Text>
              </View>
              <View style={[styles.actionBtn, styles.confirmBtn, confirming && { opacity: 0.6 }]}>
                <Pressable
                  onPress={handleConfirm}
                  disabled={confirming}
                  android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                  style={StyleSheet.absoluteFill}
                />
                {confirming ? (
                  <ActivityIndicator color="#fff" size="small" pointerEvents="none" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" pointerEvents="none" />
                    <Text style={styles.confirmBtnText} pointerEvents="none">Conferma</Text>
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      <MarkDoneModal
        visible={showMarkDone}
        bookingId={booking.id}
        onClose={() => setShowMarkDone(false)}
        onSuccess={() => {
          setShowMarkDone(false);
          loadData();
        }}
      />
      <DisputeModal
        visible={showDispute}
        bookingId={booking.id}
        onClose={() => setShowDispute(false)}
        onSuccess={() => {
          setShowDispute(false);
          loadData();
        }}
      />
    </SafeAreaView>
  );
}

// ─── Sub components ───────────────────────────────────────────────────

function TimelineRow({
  done,
  label,
  sublabel,
  warning = false,
}: {
  done: boolean;
  label: string;
  sublabel?: string;
  warning?: boolean;
}) {
  const iconColor = warning ? Colors.warning : done ? Colors.success : Colors.textTertiary;
  const iconName = warning
    ? "alert-circle"
    : done
    ? "checkmark-circle"
    : "ellipse-outline";

  return (
    <View style={styles.timelineRow}>
      <Ionicons name={iconName as any} size={22} color={iconColor} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.timelineLabel, !done && !warning && styles.timelineLabelMuted]}>
          {label}
        </Text>
        {sublabel && <Text style={styles.timelineSublabel}>{sublabel}</Text>}
      </View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.textSecondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function PriceRow({ label, value }: { label: string; value: number }) {
  const isNegative = value < 0;
  return (
    <View style={styles.priceRow}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={[styles.priceValue, isNegative && { color: Colors.textSecondary }]}>
        {isNegative ? "−" : ""}€{Math.abs(value).toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: Colors.text },
  body: { padding: Spacing.lg, paddingBottom: 120, gap: Spacing.md },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full ?? 999,
  },
  statusText: { fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  timelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  timelineLabel: { fontSize: 15, fontWeight: "600", color: Colors.text },
  timelineLabelMuted: { color: Colors.textSecondary, fontWeight: "500" },
  timelineSublabel: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  infoLabel: { fontSize: 13, color: Colors.textSecondary, width: 90 },
  infoValue: { fontSize: 14, color: Colors.text, flex: 1, fontWeight: "500" },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  priceLabel: { fontSize: 14, color: Colors.textSecondary },
  priceValue: { fontSize: 14, color: Colors.text, fontWeight: "500" },
  priceTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  priceTotalLabel: { fontSize: 16, color: Colors.text, fontWeight: "600" },
  priceTotalValue: { fontSize: 18, color: Colors.primary, fontWeight: "700" },
  photoStrip: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  photoStripItem: { marginRight: 8 },
  photoStripImg: {
    width: 120,
    height: 120,
    borderRadius: Radius.sm,
    backgroundColor: Colors.borderLight,
  },
  photoStripLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  disputeCard: { borderWidth: 1, borderColor: Colors.warning, backgroundColor: Colors.warningLight },
  disputeHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  disputeTitle: { fontSize: 15, fontWeight: "600", color: Colors.warning },
  disputeDate: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  disputeReason: { fontSize: 14, color: Colors.text, lineHeight: 20, marginBottom: 12 },
  disputeFooter: { fontSize: 12, color: Colors.textSecondary, marginTop: 8, fontStyle: "italic" },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  dualBtn: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    borderRadius: Radius.md,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: 6,
  },
  disputeBtn: { backgroundColor: Colors.errorLight, borderWidth: 1, borderColor: Colors.error },
  disputeBtnText: { color: Colors.error, fontWeight: "600", fontSize: 14 },
  confirmBtn: { backgroundColor: Colors.success },
  confirmBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
```

---

### `app/booking/[id]/waiting.tsx`

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
  cancelAnimation,
} from "react-native-reanimated";
import { Colors, Spacing, Radius, Shadows } from "../../../lib/theme";
import {
  fetchBookingWithOffers,
  subscribeToBooking,
  subscribeToBookingOffers,
} from "../../../lib/api";
import { useCountdown } from "../../../lib/hooks/useCountdown";
import type { Booking, BookingOffer, BookingOfferStatus } from "../../../lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_WAIT_HOURS = 24;

// ─── Radar animation component ────────────────────────────────────────────────

function RadarAnimation() {
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    const duration = 2200;
    ring1.value = withRepeat(
      withTiming(1, { duration, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    ring2.value = withRepeat(
      withSequence(
        withTiming(0, { duration: duration * 0.33 }),
        withTiming(1, { duration: duration * 0.67, easing: Easing.out(Easing.ease) })
      ),
      -1,
      false
    );
    ring3.value = withRepeat(
      withSequence(
        withTiming(0, { duration: duration * 0.66 }),
        withTiming(1, { duration: duration * 0.34, easing: Easing.out(Easing.ease) })
      ),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(ring1);
      cancelAnimation(ring2);
      cancelAnimation(ring3);
      cancelAnimation(pulse);
    };
  }, [ring1, ring2, ring3, pulse]);

  const ring1Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring1.value, [0, 0.7, 1], [0.6, 0.3, 0]),
    transform: [{ scale: interpolate(ring1.value, [0, 1], [1, 2.4]) }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring2.value, [0, 0.7, 1], [0.5, 0.2, 0]),
    transform: [{ scale: interpolate(ring2.value, [0, 1], [1, 2.4]) }],
  }));
  const ring3Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring3.value, [0, 0.7, 1], [0.4, 0.15, 0]),
    transform: [{ scale: interpolate(ring3.value, [0, 1], [1, 2.4]) }],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={radar.container}>
      <Animated.View style={[radar.ring, ring1Style]} />
      <Animated.View style={[radar.ring, ring2Style]} />
      <Animated.View style={[radar.ring, ring3Style]} />
      <Animated.View style={[radar.core, coreStyle]}>
        <Ionicons name="search" size={32} color={Colors.textOnDark} />
      </Animated.View>
    </View>
  );
}

const radar = StyleSheet.create({
  container: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  ring: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  core: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
});

// ─── Offer status dot ─────────────────────────────────────────────────────────

const STATUS_DOT_COLOR: Record<BookingOfferStatus, string> = {
  pending: Colors.textTertiary,
  accepted: Colors.success,
  declined: Colors.error,
  expired: Colors.textTertiary,
  cancelled: Colors.textTertiary,
};

interface OfferRowProps {
  offer: BookingOffer;
}

function OfferRow({ offer }: OfferRowProps) {
  const dotColor = STATUS_DOT_COLOR[offer.status];
  const initials = (offer.cleaner_name ?? "?").slice(0, 2).toUpperCase();

  const statusLabel: Record<BookingOfferStatus, string> = {
    pending: "In attesa",
    accepted: "Accettato",
    declined: "Rifiutato",
    expired: "Scaduto",
    cancelled: "Annullato",
  };

  return (
    <View style={offerStyles.row}>
      <View style={offerStyles.avatar}>
        <Text style={offerStyles.avatarText}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={offerStyles.name} numberOfLines={1}>
          {offer.cleaner_name ?? "Professionista"}
        </Text>
        <Text style={[offerStyles.statusText, { color: dotColor }]}>
          {statusLabel[offer.status]}
        </Text>
      </View>
      <View style={[offerStyles.dot, { backgroundColor: dotColor }]} />
    </View>
  );
}

const offerStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.accent,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WaitingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [offers, setOffers] = useState<BookingOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const bookingChannelRef = useRef<RealtimeChannel | null>(null);
  const offersChannelRef = useRef<RealtimeChannel | null>(null);

  // Deadline = created_at + 24h (backend sets cleaner_deadline)
  const deadline = booking?.cleaner_deadline ?? null;
  const countdown = useCountdown(deadline);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const result = await fetchBookingWithOffers(id);
      setBooking(result.booking);
      setOffers(result.offers);
    } catch {
      // leave loading state, show empty
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Subscribe to booking status changes (backend accepts → navigate)
  useEffect(() => {
    if (!id) return;

    bookingChannelRef.current = subscribeToBooking(id, (updatedBooking) => {
      setBooking(updatedBooking);
      if (updatedBooking.status === "accepted") {
        router.replace(`/booking/${id}/tracking` as never);
      }
    });

    offersChannelRef.current = subscribeToBookingOffers(id, (updatedOffer) => {
      setOffers((prev) => {
        const exists = prev.find((o) => o.id === updatedOffer.id);
        if (exists) {
          return prev.map((o) => (o.id === updatedOffer.id ? { ...o, ...updatedOffer } : o));
        }
        return [...prev, updatedOffer];
      });
    });

    return () => {
      bookingChannelRef.current?.unsubscribe();
      offersChannelRef.current?.unsubscribe();
    };
  }, [id, router]);

  const isExpiredWithNoWinner =
    countdown.isExpired && booking?.status !== "accepted";

  if (isExpiredWithNoWinner) {
    return (
      <SafeAreaView style={s.root} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={s.expiredContainer}>
          <Ionicons name="sad-outline" size={64} color={Colors.textTertiary} />
          <Text style={s.expiredTitle}>Nessun cleaner disponibile</Text>
          <Text style={s.expiredSub}>
            Nessun professionista ha accettato entro le 24 ore. Prova a selezionare
            un orario diverso o ad ampliare la zona di ricerca.
          </Text>
          <View style={s.retryBtn}>
            <Pressable
              onPress={() => router.replace("/booking/new" as never)}
              accessibilityRole="button"
              accessibilityLabel="Riprova prenotazione"
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={({ pressed }) => ({
                paddingVertical: 16,
                paddingHorizontal: 36,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={s.retryBtnText}>Riprova</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Escape hatch — the wait window can be up to 24h. Without a back
          button the user is trapped on this screen until a cleaner
          accepts or the request expires. Tapping the chevron routes to
          the bookings tab so they can keep using the app; the request
          stays open in the background. */}
      <View style={s.topBar}>
        <Pressable
          onPress={() => router.replace("/(tabs)/bookings" as never)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Torna alle prenotazioni"
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={s.topBarTitle}>Richiesta in corso</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>In attesa di un cleaner...</Text>
          <Text style={s.headerSub}>
            Abbiamo inviato la richiesta ai professionisti disponibili nella tua zona.
          </Text>
        </View>

        {/* Radar animation */}
        <View style={s.radarWrap}>
          <RadarAnimation />
        </View>

        {/* Countdown */}
        <View style={s.countdownCard}>
          <Text style={s.countdownLabel}>Tempo rimanente</Text>
          <Text style={s.countdownValue}>{countdown.formatted}</Text>
          <Text style={s.countdownSub}>
            Un professionista ha {MAX_WAIT_HOURS} ore per accettare la tua richiesta
          </Text>
        </View>

        {/* Offer list */}
        {offers.length > 0 && (
          <View style={s.offersSection}>
            <Text style={s.offersTitle}>Richieste inviate</Text>
            <View style={s.offersCard}>
              {offers.map((offer) => (
                <OfferRow key={offer.id} offer={offer} />
              ))}
            </View>
          </View>
        )}

        {isLoading && offers.length === 0 && (
          <View style={s.offersSection}>
            <Text style={s.offersTitle}>Ricerca in corso...</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.15,
  },
  scroll: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
  },

  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  headerSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: Spacing.xl,
  },

  radarWrap: {
    alignItems: "center",
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.base,
  },

  countdownCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  countdownLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textOnDarkTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  countdownValue: {
    fontSize: 40,
    fontWeight: "800",
    color: Colors.textOnDarkSecondary,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  countdownSub: {
    fontSize: 12,
    color: Colors.textOnDarkTertiary,
    textAlign: "center",
    lineHeight: 17,
  },

  offersSection: {
    gap: Spacing.md,
  },
  offersTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  offersCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    ...Shadows.sm,
  },

  // Expired state
  expiredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: Spacing.base,
  },
  expiredTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  expiredSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  retryBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.secondary,
    borderRadius: Radius.lg,
    overflow: "hidden",
    ...Shadows.md,
  },
  retryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textOnDark,
  },
});
```

---

### `app/booking/[id]/tracking.tsx`

```tsx
import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  Region,
  PROVIDER_DEFAULT,
} from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import {
  subscribeToLocation,
  haversineKm,
  estimateEtaMinutes,
  TrackingCoords,
} from "../../../lib/realtime-tracking";
import { supabase } from "../../../lib/supabase";

interface BookingTrackingData {
  id: string;
  cleaner_id: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  cleaner_name?: string | null;
  cleaner_avatar_url?: string | null;
  status: string;
}

export default function LiveBookingTracking() {
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const [booking, setBooking] = useState<BookingTrackingData | null>(null);
  const [cleanerPos, setCleanerPos] = useState<TrackingCoords | null>(null);
  const [routePoints, setRoutePoints] = useState<TrackingCoords[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 1000, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 1000, easing: Easing.in(Easing.quad) })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(pulse);
    };
  }, [pulse]);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error: dbError } = await supabase
          .from("bookings")
          .select(
            `
            id, cleaner_id, address, status, search_lat, search_lng,
            cleaner_profiles!bookings_cleaner_id_fkey (
              id,
              profiles:id ( full_name, avatar_url )
            )
          `
          )
          .eq("id", bookingId)
          .maybeSingle();

        if (cancelled) return;
        if (dbError) throw dbError;
        if (!data) throw new Error("Prenotazione non trovata");

        const profile = (data as any).cleaner_profiles?.profiles;
        // Schema uses search_lat / search_lng — there is no latitude /
        // longitude column on bookings. Falling back to Milan was wrong
        // for every booking; pull the real coords here.
        const lat = (data as any).search_lat as number | null;
        const lng = (data as any).search_lng as number | null;
        setBooking({
          id: data.id,
          cleaner_id: data.cleaner_id,
          address: data.address ?? "",
          latitude: typeof lat === "number" ? lat : null,
          longitude: typeof lng === "number" ? lng : null,
          cleaner_name: profile?.full_name,
          cleaner_avatar_url: profile?.avatar_url,
          status: data.status,
        });
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? "Errore nel caricamento");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;
    const channel = subscribeToLocation(bookingId, (coords) => {
      setCleanerPos(coords);
      setRoutePoints((prev) => {
        const next = [...prev, coords];
        return next.length > 200 ? next.slice(-200) : next;
      });
    });
    return () => {
      channel.unsubscribe();
    };
  }, [bookingId]);

  useEffect(() => {
    if (cleanerPos && mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: {
            latitude: cleanerPos.latitude,
            longitude: cleanerPos.longitude,
          },
          zoom: 15,
        },
        { duration: 700 }
      );
    }
  }, [cleanerPos]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  const clientHouse =
    booking?.latitude && booking?.longitude
      ? { latitude: booking.latitude, longitude: booking.longitude }
      : null;

  const distanceKm = cleanerPos && clientHouse
    ? haversineKm(cleanerPos, clientHouse)
    : null;
  const etaMinutes = distanceKm !== null ? estimateEtaMinutes(distanceKm) : null;

  const initialRegion: Region | null = clientHouse
    ? {
        latitude: clientHouse.latitude,
        longitude: clientHouse.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }
    : null;

  const cleanerInitial = (booking?.cleaner_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <SafeAreaView edges={["top"]} style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.7}
            accessibilityLabel="Torna indietro"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={22} color="#022420" />
          </TouchableOpacity>
          <View style={styles.topBarTitle}>
            <Text style={styles.topBarTitleText}>Caricamento...</Text>
          </View>
          <View style={{ width: 40 }} />
        </SafeAreaView>
        <ActivityIndicator size="large" color="#006b55" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.resetBtn} onPress={() => router.back()}>
          <Text style={styles.resetBtnText}>Torna indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!clientHouse || !initialRegion) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>
          Indirizzo non disponibile per questa prenotazione.
        </Text>
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={() => router.replace("/(tabs)/bookings")}
        >
          <Text style={styles.resetBtnText}>Torna alla prenotazione</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        <Marker coordinate={clientHouse} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.houseMarker}>
            <View style={styles.houseBubble}>
              <Ionicons name="home" size={20} color="#ffffff" />
            </View>
            <View style={styles.houseTail} />
          </View>
        </Marker>

        {cleanerPos && (
          <Marker
            coordinate={{
              latitude: cleanerPos.latitude,
              longitude: cleanerPos.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={cleanerPos.heading ?? 0}
          >
            <View style={styles.cleanerMarker}>
              <Animated.View style={[styles.cleanerPulse, pulseStyle]} />
              <View style={styles.cleanerDot}>
                <Ionicons name="car" size={14} color="#ffffff" />
              </View>
            </View>
          </Marker>
        )}

        {routePoints.length > 1 && (
          <Polyline
            coordinates={routePoints.map((p) => ({
              latitude: p.latitude,
              longitude: p.longitude,
            }))}
            strokeColor="#006b55"
            strokeWidth={4}
          />
        )}
      </MapView>

      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color="#022420" />
        </TouchableOpacity>
        <View style={styles.topBarTitle}>
          <Text style={styles.topBarTitleText}>
            {booking?.cleaner_name
              ? `${booking.cleaner_name} sta arrivando`
              : "Professionista in arrivo"}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      <SafeAreaView edges={["bottom"]} style={styles.bottomCardWrap}>
        <View style={styles.bottomCard}>
          {!cleanerPos ? (
            <View style={styles.waitingWrap}>
              <ActivityIndicator size="small" color="#006b55" />
              <View style={{ flex: 1 }}>
                <Text style={styles.waitingTitle}>
                  In attesa della posizione...
                </Text>
                <Text style={styles.waitingSub}>
                  Il professionista condividerà la posizione quando parte
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.etaRow}>
                <View>
                  <Text style={styles.etaLabel}>ARRIVO STIMATO</Text>
                  <Text style={styles.etaValue}>
                    {etaMinutes !== null ? `${etaMinutes} min` : "—"}
                  </Text>
                </View>
                <View style={styles.distanceBadge}>
                  <Ionicons name="location" size={14} color="#006b55" />
                  <Text style={styles.distanceText}>
                    {distanceKm !== null ? `${distanceKm.toFixed(1)} km` : "—"}
                  </Text>
                </View>
              </View>

              <View style={styles.cleanerRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{cleanerInitial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cleanerName}>
                    {booking?.cleaner_name ?? "Professionista"}
                  </Text>
                  <Text style={styles.ratingText}>
                    In viaggio verso la tua casa
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.chatBtn}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname: "/chat/[bookingId]",
                      params: { bookingId: bookingId as string },
                    })
                  }
                >
                  <Ionicons name="chatbubble" size={18} color="#006b55" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6faf9" },
  center: { alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { color: "#022420", fontSize: 15, textAlign: "center", padding: 24 },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  topBarTitle: { flex: 1, alignItems: "center" },
  topBarTitleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#022420",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: "hidden",
  },
  houseMarker: { alignItems: "center" },
  houseBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#006b55",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  houseTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#006b55",
    marginTop: -2,
  },
  cleanerMarker: {
    alignItems: "center",
    justifyContent: "center",
    width: 60,
    height: 60,
  },
  cleanerPulse: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0, 107, 85, 0.25)",
  },
  cleanerDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#022420",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  bottomCardWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    gap: 16,
  },
  waitingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  waitingTitle: { fontSize: 15, fontWeight: "700", color: "#022420" },
  waitingSub: {
    fontSize: 12,
    color: "rgba(2,36,32,0.6)",
    marginTop: 2,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  etaLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "rgba(2,36,32,0.5)",
    marginBottom: 4,
  },
  etaValue: {
    fontSize: 32,
    fontWeight: "800",
    color: "#022420",
    letterSpacing: -0.5,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e8f5f1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },
  distanceText: { fontSize: 13, fontWeight: "700", color: "#006b55" },
  cleanerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#006b55",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  cleanerName: { fontSize: 16, fontWeight: "700", color: "#022420" },
  ratingText: { fontSize: 12, color: "rgba(2,36,32,0.6)", marginTop: 2 },
  chatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e8f5f1",
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtn: {
    backgroundColor: "#022420",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  resetBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
});
```

---

### `app/chat/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function ChatLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[bookingId]" />
    </Stack>
  );
}
```

---

### `app/chat/[bookingId].tsx`

```tsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Alert,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import {
  fetchBooking,
  fetchMessages,
  fetchProfile,
  MessageBlockedError,
  sendMessage,
  subscribeToMessages,
} from "../../lib/api";
import {
  NotificationMessages,
  sendPushNotification,
} from "../../lib/notifications";
import { Booking, Message } from "../../lib/types";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_REPLIES = [
  "Sì, perfetto grazie",
  "Posso cambiare l'orario?",
  "Ho una domanda",
  "Arrivo tra poco",
  "Confermo la prenotazione",
] as const;

// ─── Time grouping helper ─────────────────────────────────────────────────────

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateGroup(isoString: string): string {
  const d = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  if (sameDay(d, today)) return "Oggi";
  if (sameDay(d, yesterday)) return "Ieri";
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
}

// ─── Message bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  item: Message;
  isMe: boolean;
  showAvatar: boolean;
}

const MessageBubble = ({ item, isMe, showAvatar }: BubbleProps) => {
  const time = formatTime(item.created_at);

  if (isMe) {
    return (
      <View style={bStyles.rowRight}>
        <View style={bStyles.bubbleMe}>
          <Text style={bStyles.bubbleMeText}>{item.content}</Text>
          <Text style={bStyles.bubbleTimeMe}>{time}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={bStyles.rowLeft}>
      {showAvatar ? (
        <View style={bStyles.avatarConcierge}>
          <Ionicons name="headset" size={16} color={Colors.textOnDark} />
        </View>
      ) : (
        <View style={bStyles.avatarSpacer} />
      )}
      <View style={bStyles.bubbleOtherWrap}>
        <View style={bStyles.bubbleOther}>
          <Text style={bStyles.bubbleOtherText}>{item.content}</Text>
          <Text style={bStyles.bubbleTimeOther}>{time}</Text>
        </View>
      </View>
    </View>
  );
};

const bStyles = StyleSheet.create({
  rowRight: {
    alignSelf: "flex-end",
    maxWidth: "78%",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    alignSelf: "flex-start",
    maxWidth: "82%",
  },
  avatarConcierge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarSpacer: {
    width: 32,
    flexShrink: 0,
  },
  bubbleMe: {
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    ...Shadows.sm,
  },
  bubbleMeText: {
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.93)",
    marginBottom: 4,
  },
  bubbleTimeMe: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    alignSelf: "flex-end",
  },
  bubbleOtherWrap: {
    flex: 1,
  },
  bubbleOther: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 18,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  bubbleOtherText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
    marginBottom: 4,
  },
  bubbleTimeOther: {
    fontSize: 10,
    color: Colors.textTertiary,
    alignSelf: "flex-end",
  },
});

// ─── List item (bubble + optional date separator) ─────────────────────────────

interface ListItemData {
  type: "message";
  message: Message;
  isMe: boolean;
  showAvatar: boolean;
  showDateSeparator: boolean;
  dateLabel: string;
}

const ChatListItem = ({ data }: { data: ListItemData }) => (
  <View>
    {data.showDateSeparator && (
      <View style={styles.dateSeparator}>
        <View style={styles.dateSeparatorLine} />
        <Text style={styles.dateSeparatorText}>{data.dateLabel}</Text>
        <View style={styles.dateSeparatorLine} />
      </View>
    )}
    <MessageBubble
      item={data.message}
      isMe={data.isMe}
      showAvatar={data.showAvatar}
    />
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { user, profile } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  // Name + avatar of the OTHER person in the conversation. If the
  // current user is the client, this is the cleaner — and vice versa.
  // Drives the chat header so it shows the actual counterparty instead
  // of the old hard-coded "Concierge CleanHome" placeholder.
  const [counterpartyName, setCounterpartyName] = useState<string>("");
  const [counterpartyAvatar, setCounterpartyAvatar] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<ListItemData>>(null);

  // Load messages + subscribe to real-time updates
  useEffect(() => {
    if (!bookingId) return;
    let mounted = true;

    (async () => {
      try {
        const [msgs, bk] = await Promise.all([
          fetchMessages(bookingId),
          fetchBooking(bookingId).catch(() => null),
        ]);
        if (mounted) {
          setMessages(msgs);
          setBooking(bk);
        }

        // Resolve the counterparty profile so the header can show
        // their real name + avatar. We pick the id that ISN'T the
        // current user: cleaner_id if user is the client, client_id
        // if user is the cleaner.
        if (bk && user?.id && mounted) {
          const otherId =
            bk.client_id === user.id ? bk.cleaner_id : bk.client_id;
          if (otherId) {
            try {
              const otherProfile = await fetchProfile(otherId);
              if (mounted && otherProfile) {
                setCounterpartyName(otherProfile.full_name ?? "");
                setCounterpartyAvatar(otherProfile.avatar_url ?? null);
              }
            } catch {
              // Non-fatal — fall back to generic label below.
            }
          }
        }
      } catch {
        if (mounted) setMessages([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const channel = subscribeToMessages(bookingId, (newMsg) => {
      if (!mounted) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });

    return () => {
      mounted = false;
      channel.unsubscribe();
    };
  }, [bookingId]);

  // Scroll to end on new messages
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        80
      );
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [messages.length]);

  // Build list items with date separators + avatar grouping
  const listItems = useMemo<ListItemData[]>(() => {
    return messages.map((msg, idx) => {
      const isMe = msg.sender_id === user?.id;
      const prev = messages[idx - 1];

      // Show date separator when day changes
      const currentDay = formatDateGroup(msg.created_at);
      const prevDay = prev ? formatDateGroup(prev.created_at) : null;
      const showDateSeparator = currentDay !== prevDay;

      // Show avatar for consecutive messages from same sender (only on first in group)
      const nextMsg = messages[idx + 1];
      const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id;
      const showAvatar = !isMe && isLastInGroup;

      return {
        type: "message",
        message: msg,
        isMe,
        showAvatar,
        showDateSeparator,
        dateLabel: currentDay,
      };
    });
  }, [messages, user?.id]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !user || !bookingId) return;
    const content = text.trim();
    setText("");
    setSending(true);
    try {
      await sendMessage(bookingId, user.id, content);
      // Notify the recipient — the other party in this booking
      if (booking) {
        const recipientId =
          user.id === booking.client_id ? booking.cleaner_id : booking.client_id;
        const senderName = profile?.full_name ?? "Qualcuno";
        const { title, body } = NotificationMessages.newMessage(senderName);
        sendPushNotification(recipientId, title, body, {
          screen: "chat",
          bookingId,
        }).catch(() => {});
      }
    } catch (err) {
      // Restore the draft so the user can retry without retyping
      setText(content);
      if (err instanceof MessageBlockedError) {
        Alert.alert(
          "Messaggio non inviato",
          err.friendlyMessage,
          [{ text: "Ho capito", style: "default" }]
        );
      } else {
        // Network / generic failure — surface it instead of failing silently
        const msg =
          err instanceof Error && err.message
            ? err.message
            : "Connessione assente o lenta. Riprova.";
        Alert.alert("Messaggio non inviato", msg, [
          { text: "Ho capito", style: "default" },
        ]);
      }
    } finally {
      setSending(false);
    }
  }, [text, user, bookingId, booking, profile?.full_name]);

  const handleQuickReply = useCallback((reply: string) => {
    setText(reply);
  }, []);

  const keyExtractor = useCallback(
    (item: ListItemData) => item.message.id,
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItemData }) => <ChatListItem data={item} />,
    []
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>

        {/* Counterparty avatar + name — pulled from the profiles table */}
        <View style={styles.headerAvatar}>
          {counterpartyAvatar ? (
            <Image
              source={{ uri: counterpartyAvatar }}
              style={{ width: "100%", height: "100%", borderRadius: 999 }}
            />
          ) : (
            <Text
              style={{
                color: Colors.textOnDark,
                fontSize: 13,
                fontWeight: "800",
              }}
            >
              {counterpartyName
                ? counterpartyName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                : "?"}
            </Text>
          )}
        </View>

        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {counterpartyName || "Caricamento..."}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {booking?.service_type ?? "Conversazione"}
          </Text>
        </View>

        {/* Right side kept empty for now — the old call/menu buttons were
            non-functional placeholders that confused users. Re-add real
            actions (dispute, report, mute) once the backend wires are in. */}
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* ── Content ── */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.secondary} />
          </View>
        ) : listItems.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={36} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>Nessun messaggio</Text>
            <Text style={styles.emptySubtitle}>
              {(() => {
                const viewerIsCleaner = !!(user && booking && user.id === booking.cleaner_id);
                const name = counterpartyName?.trim();
                if (viewerIsCleaner) {
                  return name
                    ? `Inizia a scrivere a ${name} per coordinare l'arrivo.`
                    : "Inizia a scrivere al cliente per coordinare l'arrivo.";
                }
                return name
                  ? `Inizia a scrivere a ${name} per coordinare l'arrivo del cleaner.`
                  : "Inizia a scrivere per coordinare l'arrivo del servizio.";
              })()}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={listItems}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            removeClippedSubviews
            maxToRenderPerBatch={20}
            windowSize={10}
          />
        )}

        {/* ── Input area ── */}
        <View style={styles.inputArea}>
          {/* Quick reply chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRepliesContent}
            style={styles.quickRepliesScroll}
          >
            {QUICK_REPLIES.map((reply) => (
              <Pressable
                key={reply}
                onPress={() => handleQuickReply(reply)}
                style={({ pressed }) => [
                  styles.quickChip,
                  pressed && { backgroundColor: Colors.accentLight },
                ]}
              >
                <Text style={styles.quickChipText}>{reply}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Input row */}
          <View style={styles.inputRow}>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.textInput}
                placeholder="Scrivi un messaggio…"
                placeholderTextColor={Colors.textTertiary}
                value={text}
                onChangeText={setText}
                multiline
                returnKeyType="default"
              />
            </View>

            <View style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}>
              <Pressable
                onPress={handleSend}
                disabled={!text.trim() || sending}
                accessibilityLabel="Invia messaggio"
                accessibilityRole="button"
                accessibilityState={{ disabled: !text.trim() || sending }}
                android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                style={StyleSheet.absoluteFill}
              />
              {sending ? (
                <ActivityIndicator size="small" color={Colors.textOnDark} pointerEvents="none" />
              ) : (
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={text.trim() ? Colors.textOnDark : Colors.textTertiary}
                  pointerEvents="none"
                />
              )}
            </View>
          </View>

          {/* Trust footer */}
          <View style={styles.trustRow}>
            <Ionicons name="lock-closed" size={10} color={Colors.textTertiary} />
            <Text style={styles.trustText}>SICURO E PRIVATO · CLEANHOME</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.backgroundAlt,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    position: "relative",
  },
  headerOnlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  headerTitleGroup: {
    flex: 1,
    gap: 3,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.2,
  },
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  onlineDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.secondary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.base,
    gap: Spacing.sm,
  },

  // Date separator
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginVertical: Spacing.base,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
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

  // Input area
  inputArea: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Platform.OS === "ios" ? 24 : Spacing.base,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    ...Shadows.sm,
  },
  quickRepliesScroll: {
    flexGrow: 0,
  },
  quickRepliesContent: {
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  quickChip: {
    paddingHorizontal: Spacing.base,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.lg,
    paddingLeft: Spacing.base,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  inputWrap: {
    flex: 1,
    maxHeight: 110,
    paddingVertical: 4,
  },
  textInput: {
    fontSize: 15,
    color: Colors.text,
    padding: 0,
    lineHeight: 21,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
    flexShrink: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.sm,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.backgroundAlt,
    shadowOpacity: 0,
    elevation: 0,
  },

  // Trust footer
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  trustText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
```

---

### `app/review/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function ReviewLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[bookingId]" />
    </Stack>
  );
}
```

---

### `app/review/[bookingId].tsx`

```tsx
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchBooking, submitReview } from "../../lib/api";
import { sendPushNotification } from "../../lib/notifications";
import { Booking } from "../../lib/types";
import { Colors } from "../../lib/theme";
import { useAuth } from "../../lib/auth";

const RATING_LABELS: Record<number, string> = {
  1: "Pessimo",
  2: "Scarso",
  3: "Nella media",
  4: "Buono",
  5: "Eccellente",
};

// Formats a YYYY-MM-DD booking date into a friendly Italian string.
// Falls back to the raw value if parsing fails so we never show "Invalid Date".
function formatBookingDate(raw: string): string {
  if (!raw) return "—";
  const parts = raw.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return raw;
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ReviewScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    (async () => {
      try {
        const data = await fetchBooking(bookingId);
        if (!data) {
          Alert.alert("Errore", "Prenotazione non trovata");
          router.back();
          return;
        }
        setBooking(data);
      } catch {
        Alert.alert("Errore", "Impossibile caricare la prenotazione");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingId, router]);

  const handleSubmit = async () => {
    if (!user || !booking) return;
    if (rating === 0) {
      Alert.alert("Valutazione mancante", "Seleziona da 1 a 5 stelle");
      return;
    }
    // Defensive client check — RLS does its own server-side check.
    if (user.id !== booking.client_id) {
      Alert.alert(
        "Non autorizzato",
        "Solo il cliente che ha effettuato la prenotazione può lasciare una recensione."
      );
      return;
    }
    if (booking.status !== "completed" && booking.status !== "work_done") {
      Alert.alert(
        "Lavoro non completato",
        "Puoi lasciare una recensione solo dopo che il lavoro è stato completato."
      );
      return;
    }
    setSubmitting(true);
    try {
      await submitReview(
        booking.id,
        user.id,
        booking.cleaner_id,
        rating,
        comment.trim() || undefined
      );
      // Notify the cleaner of the new review
      sendPushNotification(
        booking.cleaner_id,
        "Nuova recensione ricevuta",
        `Hai ricevuto ${rating} ${rating === 1 ? "stella" : "stelle"} per "${booking.service_type}"`,
        { screen: "reviews", bookingId: booking.id }
      ).catch(() => {});
      Alert.alert(
        "Grazie!",
        "La tua recensione è stata inviata",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        Alert.alert("Già recensito", "Hai già lasciato una recensione per questa prenotazione");
        router.back();
      } else {
        Alert.alert("Errore", "Impossibile inviare la recensione. Riprova.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  if (!booking) return null;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" />

      {/* Nav bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          accessibilityLabel="Chiudi"
          accessibilityRole="button"
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: Colors.surface,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Ionicons name="close" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "700",
            color: Colors.text,
          }}
        >
          Lascia una recensione
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Booking summary card */}
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 18,
              padding: 18,
              marginBottom: 24,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: Colors.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              Servizio completato
            </Text>
            <Text
              style={{
                fontSize: 17,
                fontWeight: "800",
                color: Colors.text,
                marginBottom: 4,
              }}
            >
              {booking.service_type}
            </Text>
            <Text
              style={{ fontSize: 13, color: Colors.textSecondary }}
            >
              {formatBookingDate(booking.date)} · {booking.time_slot}
            </Text>
          </View>

          {/* Rating */}
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: Colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            Valutazione
          </Text>
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 18,
              padding: 22,
              alignItems: "center",
              marginBottom: 24,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setRating(star)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={44}
                    color={star <= rating ? Colors.warning : Colors.textTertiary}
                  />
                </Pressable>
              ))}
            </View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: rating > 0 ? Colors.text : Colors.textTertiary,
                marginTop: 14,
                minHeight: 20,
              }}
            >
              {rating > 0 ? RATING_LABELS[rating] : "Tocca per valutare"}
            </Text>
          </View>

          {/* Comment */}
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: Colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            Commento (opzionale)
          </Text>
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 18,
              padding: 4,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Racconta la tua esperienza..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              textAlignVertical="top"
              maxLength={500}
              style={{
                minHeight: 120,
                padding: 14,
                fontSize: 15,
                color: Colors.text,
                lineHeight: 22,
              }}
            />
          </View>
          <Text
            style={{
              fontSize: 11,
              color: Colors.textTertiary,
              textAlign: "right",
              marginTop: 6,
              marginRight: 4,
            }}
          >
            {comment.length}/500
          </Text>
        </ScrollView>

        {/* Submit CTA */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 24,
            backgroundColor: Colors.background,
            borderTopWidth: 1,
            borderTopColor: Colors.borderLight,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={submitting || rating === 0}
            onPress={handleSubmit}
            style={{
              backgroundColor:
                rating === 0 || submitting
                  ? Colors.textTertiary
                  : Colors.secondary,
              borderRadius: 16,
              height: 56,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  Invia recensione
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```
