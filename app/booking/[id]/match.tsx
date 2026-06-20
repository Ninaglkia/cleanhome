import { useEffect, useState } from "react";
import { View, Text, StyleSheet, StatusBar, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import {
  PColor,
  PRadius,
  PShadow,
  PSpace,
  PType,
  PBorder,
} from "../../../lib/design/pulitori";
import { fetchBookingWithOffers } from "../../../lib/api";
import type { Booking, BookingOffer } from "../../../lib/types";

// ─── Month names for date formatting ─────────────────────────────────────────

const MONTH_NAMES_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function formatBookingDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"][d.getDay()];
  return `${dayName}, ${day} ${MONTH_NAMES_IT[month - 1]}`;
}

// ─── Pulse ring component ─────────────────────────────────────────────────────

interface PulseRingProps {
  delay: number;
}

function PulseRing({ delay }: PulseRingProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0.6, 0.3, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.6]) }],
  }));

  return <Animated.View style={[styles.pulseRing, animStyle]} />;
}

// ─── Info row ─────────────────────────────────────────────────────────────────

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={16} color={PColor.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [acceptedOffer, setAcceptedOffer] = useState<BookingOffer | null>(null);

  // Entrance animations
  const checkScale = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(20);

  useEffect(() => {
    if (!id) return;
    fetchBookingWithOffers(id)
      .then((result) => {
        setBooking(result.booking);
        const accepted = result.offers.find((o) => o.status === "accepted");
        setAcceptedOffer(accepted ?? null);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    // Check icon springs in
    checkScale.value = withSpring(1, { damping: 12, stiffness: 180 });
    // Content fades + slides up after short delay
    contentOpacity.value = withDelay(300, withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }));
    contentTranslateY.value = withDelay(300, withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) }));
  }, [checkScale, contentOpacity, contentTranslateY]);

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  const cleanerName = acceptedOffer?.cleaner_name ?? "Il pulitore";

  const handleConfirm = () => {
    router.replace(`/booking/${id}/tracking` as never);
  };

  const handleChat = () => {
    router.push(`/chat/${id}` as never);
  };

  // Press scale for CTA buttons
  const primaryScale = useSharedValue(1);
  const secondaryScale = useSharedValue(1);

  const primaryAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: primaryScale.value }],
  }));

  const secondaryAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: secondaryScale.value }],
  }));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero (dark green background — expo-linear-gradient not installed) */}
        <View style={styles.heroGradient}>
          <SafeAreaView edges={["top"]} style={styles.heroInner}>
            {/* Pulse rings + check icon */}
            <View style={styles.checkContainer}>
              <PulseRing delay={0} />
              <PulseRing delay={600} />
              <PulseRing delay={1200} />
              <Animated.View style={[styles.checkIconWrap, checkAnimStyle]}>
                <Ionicons name="checkmark" size={48} color={PColor.mint} />
              </Animated.View>
            </View>
          </SafeAreaView>
        </View>

        {/* White content sheet */}
        <Animated.View style={[styles.sheet, contentAnimStyle]}>
          {/* Match header text */}
          <Text style={styles.overline}>MATCH TROVATO</Text>
          <Text style={styles.matchTitle}>{cleanerName} ha accettato!</Text>
          <Text style={styles.matchSub}>
            Gli altri pulitori contattati sono stati avvisati. Il lavoro è assegnato.
          </Text>

          {/* Booking info card */}
          {booking && (
            <View style={styles.infoCard}>
              <InfoRow
                icon="calendar-outline"
                label="Data"
                value={formatBookingDate(booking.booking_date)}
              />
              {booking.time_slot ? (
                <InfoRow
                  icon="time-outline"
                  label="Orario"
                  value={booking.time_slot}
                />
              ) : null}
              {booking.address ? (
                <InfoRow
                  icon="location-outline"
                  label="Indirizzo"
                  value={booking.address}
                />
              ) : null}
            </View>
          )}

          {/* CTA buttons */}
          <View style={styles.ctaStack}>
            <Animated.View style={primaryAnimStyle}>
              <Pressable
                onPressIn={() => { primaryScale.value = withSpring(0.97, { damping: 15 }); }}
                onPressOut={() => { primaryScale.value = withSpring(1, { damping: 15 }); }}
                onPress={handleConfirm}
                accessibilityRole="button"
                accessibilityLabel="Conferma e paga"
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>Conferma e paga</Text>
              </Pressable>
            </Animated.View>

            <Animated.View style={secondaryAnimStyle}>
              <Pressable
                onPressIn={() => { secondaryScale.value = withSpring(0.97, { damping: 15 }); }}
                onPressOut={() => { secondaryScale.value = withSpring(1, { damping: 15 }); }}
                onPress={handleChat}
                accessibilityRole="button"
                accessibilityLabel={`Scrivi a ${cleanerName}`}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Scrivi a {cleanerName}</Text>
              </Pressable>
            </Animated.View>
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PColor.ink,
  },
  scroll: {
    flexGrow: 1,
  },

  // Hero (solid dark green — expo-linear-gradient not installed)
  heroGradient: {
    height: 280,
    backgroundColor: PColor.ink,
  },
  heroInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkContainer: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: "rgba(61,220,151,0.4)",
    backgroundColor: "rgba(61,220,151,0.08)",
  },
  checkIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(61,220,151,0.20)",
    borderWidth: 2,
    borderColor: "rgba(61,220,151,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Sheet
  sheet: {
    backgroundColor: PColor.white,
    borderTopLeftRadius: PRadius.sheet,
    borderTopRightRadius: PRadius.sheet,
    marginTop: -PRadius.sheet,
    paddingHorizontal: 28,
    paddingTop: 32,
    minHeight: 600,
  },
  overline: {
    ...PType.overline,
    color: PColor.accent,
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  matchTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: PColor.ink,
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  matchSub: {
    ...PType.body,
    color: PColor.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },

  // Info card
  infoCard: {
    backgroundColor: PColor.canvas,
    borderRadius: PRadius.card,
    padding: 20,
    marginBottom: 24,
    gap: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: PColor.mintPale,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: PColor.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: PColor.ink,
    lineHeight: 19,
  },

  // CTA stack
  ctaStack: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: PColor.ink,
    height: 52,
    borderRadius: PRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    ...PShadow.card,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: PColor.mint,
  },
  secondaryBtn: {
    height: 52,
    borderRadius: PRadius.pill,
    borderWidth: 1.5,
    borderColor: PBorder.card,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: PColor.ink,
  },
});
