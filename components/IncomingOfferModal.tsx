import React, { useEffect } from "react";
import { Modal, View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSpring,
  withDelay,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import type { BookingOffer } from "../lib/types";

// Optional haptics — guarded so a missing module never crashes the screen.
let Haptics: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Haptics = require("expo-haptics");
} catch {
  Haptics = null;
}

// ── Palette (cleaner / green identity) ────────────────────────────────────────
const PRIMARY = "#006b55";
const PRIMARY_DEEP = "#022420";
const MINT = "#3ee0a8";
const ON_SURFACE = "#181c1c";
const ON_VARIANT = "#414846";
const SURFACE = "#ffffff";
const DANGER = "#c4344b";

const { width: SCREEN_W } = Dimensions.get("window");

const RING = 68;
const RING_STROKE = 5;
const RING_R = (RING - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DAYS = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
function fmtDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return `${DAYS[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

interface Props {
  offer: BookingOffer | null;
  onAccept: (bookingId: string) => void;
  onDecline: (bookingId: string) => void;
  onLater?: () => void;
}

export default function IncomingOfferModal({ offer, onAccept, onDecline, onLater }: Props) {
  const visible = !!offer?.booking;

  // entrance
  const backdrop = useSharedValue(0);
  const cardY = useSharedValue(80);
  const cardScale = useSharedValue(0.9);
  const cardOpacity = useSharedValue(0);
  // attention pulses
  const ringPulse = useSharedValue(0);
  const acceptPulse = useSharedValue(0);
  // countdown progress (1 = full time left, 0 = expired)
  const progress = useSharedValue(1);
  // urgency 0..1 (drives ring color toward red near the end)
  const urgency = useSharedValue(0);

  useEffect(() => {
    if (!visible || !offer) return;

    // haptic punch on appear
    Haptics?.notificationAsync?.(Haptics?.NotificationFeedbackType?.Warning).catch?.(() => {});

    backdrop.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
    cardOpacity.value = withTiming(1, { duration: 220 });
    cardY.value = withSpring(0, { damping: 15, stiffness: 180, mass: 0.9 });
    cardScale.value = withSpring(1, { damping: 14, stiffness: 200 });

    ringPulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }),
      -1,
      false
    );
    acceptPulse.value = withDelay(
      400,
      withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true)
    );

    // countdown ring: deplete from current remaining fraction to 0 over the live window
    const created = offer.created_at ? new Date(offer.created_at).getTime() : Date.now();
    const expires = new Date(offer.expires_at).getTime();
    const now = Date.now();
    const total = Math.max(1, expires - created);
    const remaining = Math.max(0, expires - now);
    const frac = Math.min(1, remaining / total);
    progress.value = frac;
    urgency.value = 1 - frac;
    if (remaining > 0) {
      progress.value = withTiming(0, { duration: remaining, easing: Easing.linear });
      urgency.value = withTiming(1, { duration: remaining, easing: Easing.linear });
    }

    return () => {
      cancelAnimation(ringPulse);
      cancelAnimation(acceptPulse);
      cancelAnimation(progress);
      cancelAnimation(urgency);
      backdrop.value = 0;
      cardY.value = 80;
      cardScale.value = 0.9;
      cardOpacity.value = 0;
      ringPulse.value = 0;
      acceptPulse.value = 0;
    };
    // re-run when a different offer comes in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer?.id, visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }, { scale: cardScale.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ringPulse.value),
    transform: [{ scale: 1 + ringPulse.value * 0.9 }],
  }));
  const acceptBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + acceptPulse.value * 0.035 }],
  }));
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * (1 - progress.value),
    stroke:
      urgency.value > 0.8 ? DANGER : urgency.value > 0.55 ? "#e6a700" : MINT,
  }));

  if (!visible || !offer?.booking) return null;

  const b = offer.booking;
  const net = (b.base_price ?? 0) - (b.cleaner_fee ?? 0);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => onLater?.()}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />

        <Animated.View style={[styles.card, cardStyle]}>
          {/* pulsing flash badge */}
          <View style={styles.badgeWrap}>
            <Animated.View style={[styles.badgePulse, pulseStyle]} />
            <View style={styles.badge}>
              <Ionicons name="flash" size={26} color="#ffffff" />
            </View>
          </View>

          <Text style={styles.kicker}>NUOVA RICHIESTA</Text>
          <Text style={styles.title}>Un cliente ti vuole</Text>

          {/* BIG earnings */}
          <View style={styles.earnRow}>
            <Text style={styles.earnCurrency}>€</Text>
            <Text style={styles.earnValue}>{net.toFixed(2).replace(".", ",")}</Text>
          </View>
          <Text style={styles.earnSub}>guadagno netto per te</Text>

          {/* countdown ring */}
          <View style={styles.ringWrap}>
            <Svg width={RING} height={RING}>
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={RING_R}
                stroke="#e7efed"
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <AnimatedCircle
                cx={RING / 2}
                cy={RING / 2}
                r={RING_R}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                animatedProps={ringProps}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            </Svg>
            <View style={styles.ringCenter} pointerEvents="none">
              <Ionicons name="timer-outline" size={16} color={ON_VARIANT} />
            </View>
          </View>
          <Text style={styles.ringHint}>Accetta prima che scada</Text>

          {/* job details */}
          <View style={styles.details}>
            <Row icon="location-outline" text={b.address ?? "Indirizzo non specificato"} bold />
            <Row icon="calendar-outline" text={`${fmtDate(b.booking_date)} · ${b.time_slot ?? ""}`} />
            <Row
              icon="home-outline"
              text={`${b.service_type ?? "Pulizia"} · ${b.num_rooms ?? 1} ${
                (b.num_rooms ?? 1) === 1 ? "stanza" : "stanze"
              }`}
            />
          </View>

          {/* actions */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.decline, pressed && { opacity: 0.7 }]}
              onPress={() => onDecline(offer.booking_id)}
              accessibilityRole="button"
              accessibilityLabel="Rifiuta richiesta"
            >
              <Ionicons name="close" size={20} color={ON_VARIANT} />
              <Text style={styles.declineText}>Rifiuta</Text>
            </Pressable>

            <Animated.View style={[styles.acceptWrap, acceptBtnStyle]}>
              <Pressable
                style={({ pressed }) => [styles.accept, pressed && { opacity: 0.9 }]}
                onPress={() => onAccept(offer.booking_id)}
                accessibilityRole="button"
                accessibilityLabel="Accetta richiesta"
                android_ripple={{ color: "rgba(255,255,255,0.2)" }}
              >
                <Ionicons name="checkmark-circle" size={22} color="#ffffff" />
                <Text style={styles.acceptText}>Accetta</Text>
              </Pressable>
            </Animated.View>
          </View>

          {onLater && (
            <Pressable onPress={onLater} style={styles.later} hitSlop={8}>
              <Text style={styles.laterText}>Più tardi</Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function Row({ icon, text, bold }: { icon: any; text: string; bold?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={16} color={PRIMARY} />
      </View>
      <Text style={[styles.detailText, bold && { fontWeight: "700", color: ON_SURFACE }]} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22 },
  backdrop: { backgroundColor: "rgba(2,36,32,0.62)" },
  card: {
    width: Math.min(SCREEN_W - 44, 380),
    backgroundColor: SURFACE,
    borderRadius: 28,
    paddingTop: 30,
    paddingBottom: 18,
    paddingHorizontal: 22,
    alignItems: "center",
    shadowColor: PRIMARY_DEEP,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 34,
    elevation: 16,
  },
  badgeWrap: { width: 60, height: 60, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  badgePulse: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: MINT,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    color: PRIMARY,
    marginTop: 4,
  },
  title: { fontSize: 20, fontWeight: "800", color: ON_SURFACE, marginTop: 2 },
  earnRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 14 },
  earnCurrency: { fontSize: 26, fontWeight: "800", color: ON_SURFACE, marginTop: 7, marginRight: 2 },
  earnValue: { fontSize: 54, fontWeight: "900", color: ON_SURFACE, letterSpacing: -1.5 },
  earnSub: { fontSize: 13, color: ON_VARIANT, marginTop: -2 },
  ringWrap: { marginTop: 16, width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  ringCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ringHint: { fontSize: 12, color: ON_VARIANT, marginTop: 8 },
  details: {
    alignSelf: "stretch",
    marginTop: 18,
    gap: 10,
    backgroundColor: "#f5faf8",
    borderRadius: 16,
    padding: 14,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#e6f4f1",
    alignItems: "center",
    justifyContent: "center",
  },
  detailText: { flex: 1, fontSize: 14, color: ON_VARIANT },
  actions: { flexDirection: "row", alignSelf: "stretch", gap: 12, marginTop: 20 },
  decline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#f0f4f3",
  },
  declineText: { fontSize: 15, fontWeight: "700", color: ON_VARIANT },
  acceptWrap: { flex: 1 },
  accept: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  acceptText: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
  later: { marginTop: 12, padding: 6 },
  laterText: { fontSize: 13, color: ON_VARIANT, textDecorationLine: "underline" },
});
