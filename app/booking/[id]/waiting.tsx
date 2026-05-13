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
