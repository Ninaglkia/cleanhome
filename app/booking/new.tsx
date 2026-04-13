import { useState, useCallback, useMemo } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";
import { sendPushNotification, NotificationMessages } from "../../lib/notifications";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_WINDOW_OPTIONS = [
  { key: "morning", label: "Mattina", subtitle: "08:00 – 12:00", icon: "sunny-outline" as const },
  { key: "afternoon", label: "Pomeriggio", subtitle: "12:00 – 17:00", icon: "partly-sunny-outline" as const },
  { key: "evening", label: "Sera", subtitle: "17:00 – 21:00", icon: "moon-outline" as const },
] as const;

type TimeWindow = (typeof TIME_WINDOW_OPTIONS)[number]["key"];

const ROOM_OPTIONS = [1, 2, 3, 4, 5, 6];
const FEE_RATE = 0.09;
const TOTAL_STEPS = 4;

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
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  const rate = parseFloat(hourlyRate || "25");
  const estimatedHours = Math.max(1, numRooms * 0.75);
  const basePrice = rate * estimatedHours;
  const clientFee = Math.round(basePrice * FEE_RATE * 100) / 100;
  const cleanerFee = Math.round(basePrice * FEE_RATE * 100) / 100;
  const totalPrice = basePrice + clientFee;

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

  const canProceed = useCallback((): boolean => {
    if (step === 0) return !!selectedDate && !!selectedWindow;
    if (step === 1) return numRooms > 0 && !!address.trim();
    return true;
  }, [step, selectedDate, selectedWindow, numRooms, address]);

  const handleSubmit = useCallback(async () => {
    if (!user || !cleanerId || !selectedDate || !selectedWindow) return;
    setLoading(true);
    try {
      // 1) Call Edge Function to create PaymentIntent with destination
      //    charge (platform fee split). The server recalculates fees
      //    so the client can't tamper with amounts.
      const { data: invokeData, error: invokeError } =
        await supabase.functions.invoke("stripe-booking-payment", {
          body: {
            cleaner_id: cleanerId,
            service_type: selectedService,
            date: selectedDate,
            time_slot: timeSlotString,
            num_rooms: numRooms,
            estimated_hours: estimatedHours,
            base_price: basePrice,
            address,
            notes,
          },
        });

      if (invokeError) {
        const ctx = (invokeError as any).context;
        let details = invokeError.message;
        if (ctx && typeof ctx === "object" && "text" in ctx) {
          try { details = await (ctx as any).text(); } catch {}
        }
        throw new Error(details);
      }

      const payload = (invokeData ?? {}) as {
        customer?: string;
        ephemeralKey?: string;
        paymentIntent?: string;
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

      // 3) Payment succeeded — the webhook will create the booking
      //    row in the DB. Send push notification to the cleaner.
      const { title, body } = NotificationMessages.newBooking(selectedService);
      await sendPushNotification(cleanerId, title, body, { screen: "cleaner-home" }).catch(() => {});

      Alert.alert(
        "Prenotazione confermata!",
        `Il pagamento è andato a buon fine. ${displayName} riceverà la tua richiesta.`,
        [{ text: "OK", onPress: () => router.replace("/(tabs)/bookings") }]
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Impossibile creare la prenotazione";
      Alert.alert("Errore", message);
    } finally {
      setLoading(false);
    }
  }, [
    user, cleanerId, selectedDate, selectedWindow, timeSlotString,
    numRooms, estimatedHours, basePrice, selectedService,
    address, notes, displayName, router,
    initPaymentSheet, presentPaymentSheet,
  ]);

  const handleContinue = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  }, [step, handleSubmit]);

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
        <Text style={s.sectionLabel}>Numero di stanze</Text>
        <View style={s.roomRow}>
          {ROOM_OPTIONS.map((n) => {
            const selected = numRooms === n;
            return (
              <TouchableOpacity
                key={n}
                onPress={() => setNumRooms(n)}
                activeOpacity={0.8}
                style={[s.roomChip, selected && s.roomChipSelected]}
              >
                <Text style={[s.roomChipText, selected && s.roomChipTextSelected]}>
                  {n}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={s.roomHint}>
          Durata stimata: {estimatedHours.toFixed(1)}h
        </Text>
      </View>

      <View>
        <Text style={s.sectionLabel}>Indirizzo</Text>
        <View style={s.inputWrap}>
          <Ionicons name="location-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            style={s.input}
            placeholder="Via Roma 1, Milano"
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
          { icon: "home-outline" as const, label: "Stanze", value: `${numRooms} stanze · ${estimatedHours.toFixed(1)}h stimate` },
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

  const stepContent = [renderDateStep, renderDetailsStep, renderSummaryStep];
  const stepTitles = ["Quando?", "Dettagli", "Riepilogo"];
  const ctaLabel = step < TOTAL_STEPS - 2 ? "Continua ai dettagli" : step === TOTAL_STEPS - 2 ? "Vedi riepilogo" : "Conferma e paga";

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => (step > 0 ? setStep((prev) => prev - 1) : router.back())}
          activeOpacity={0.8}
          style={s.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerSubtitle}>Prenota con {displayName}</Text>
          <Text style={s.headerTitle}>{stepTitles[step]}</Text>
        </View>
        <View style={s.stepCounter}>
          <Text style={s.stepCounterText}>{step + 1}/{TOTAL_STEPS - 1}</Text>
        </View>
      </View>

      {/* ── Progress bar ── */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${((step + 1) / (TOTAL_STEPS - 1)) * 100}%` }]} />
      </View>

      {/* Price indicator */}
      <View style={s.priceBar}>
        <Text style={s.priceBarLabel}>Stima totale</Text>
        <Text style={s.priceBarValue}>€{totalPrice.toFixed(0)}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {(stepContent[step] ?? renderSummaryStep)()}
        <View style={{ height: 32 }} />
      </ScrollView>

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
                name={step === TOTAL_STEPS - 2 ? "card-outline" : "arrow-forward"}
                size={18}
                color={Colors.textOnDark}
              />
            </>
          )}
        </TouchableOpacity>
      </View>
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
