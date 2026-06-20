import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  Pressable,
  Alert,
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
import {
  fetchBookingWithOffers,
  subscribeToBooking,
  subscribeToBookingOffers,
  updateBookingStatus,
} from "../../../lib/api";
import { PColor, PBorder, PShadow, PSpace, PType, PRadius } from "../../../lib/design/pulitori";
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
    const duration = 2500;
    ring1.value = withRepeat(
      withTiming(1, { duration, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    ring2.value = withRepeat(
      withSequence(
        withTiming(0, { duration: Math.floor(duration / 3) }),
        withTiming(1, { duration: Math.ceil(duration * 2 / 3), easing: Easing.out(Easing.ease) })
      ),
      -1,
      false
    );
    ring3.value = withRepeat(
      withSequence(
        withTiming(0, { duration: Math.floor(duration * 2 / 3) }),
        withTiming(1, { duration: Math.ceil(duration / 3), easing: Easing.out(Easing.ease) })
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

  // scale 0.7→2.1, opacity 0.55→0
  const ring1Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring1.value, [0, 0.7, 1], [0.55, 0.2, 0]),
    transform: [{ scale: interpolate(ring1.value, [0, 1], [0.7, 2.1]) }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring2.value, [0, 0.7, 1], [0.55, 0.2, 0]),
    transform: [{ scale: interpolate(ring2.value, [0, 1], [0.7, 2.1]) }],
  }));
  const ring3Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring3.value, [0, 0.7, 1], [0.55, 0.2, 0]),
    transform: [{ scale: interpolate(ring3.value, [0, 1], [0.7, 2.1]) }],
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
        <Ionicons name="paper-plane-outline" size={28} color={PColor.mint} />
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
    borderColor: PColor.accent,
  },
  core: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PColor.ink,
    alignItems: "center",
    justifyContent: "center",
    ...PShadow.card,
  },
});

// ─── Offer status dot ─────────────────────────────────────────────────────────

const STATUS_DOT_COLOR: Record<BookingOfferStatus, string> = {
  pending: PColor.muted,
  accepted: PColor.success,
  declined: PColor.error,
  expired: PColor.error,
  cancelled: PColor.muted,
};

interface OfferRowProps {
  offer: BookingOffer;
}

function OfferRow({ offer }: OfferRowProps) {
  const dotColor = STATUS_DOT_COLOR[offer.status];
  const initials = (offer.cleaner_name ?? "?").slice(0, 2).toUpperCase();
  const isPending = offer.status === "pending";

  // Blinking dot for pending offers
  const dotOpacity = useSharedValue(1);
  useEffect(() => {
    if (isPending) {
      dotOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(dotOpacity);
      dotOpacity.value = 1;
    }
    return () => cancelAnimation(dotOpacity);
  }, [isPending, dotOpacity]);

  const animatedDotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }));

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
      <Animated.View style={[offerStyles.dot, { backgroundColor: dotColor }, animatedDotStyle]} />
    </View>
  );
}

const offerStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: PBorder.card,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: PColor.mintPale,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: PColor.accent,
  },
  name: {
    ...PType.cleanerName,
    color: PColor.ink,
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
  const [loadError, setLoadError] = useState<string | null>(null);

  const bookingChannelRef = useRef<RealtimeChannel | null>(null);
  const offersChannelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);

  // Elapsed timer instead of countdown
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!booking?.created_at) return;
    const start = new Date(booking.created_at).getTime();
    const update = () => setElapsedSec(Math.floor((Date.now() - start) / 1000));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [booking?.created_at]);

  const elapsedLabel =
    elapsedSec < 60 ? "Pochi secondi" : `${Math.floor(elapsedSec / 60)}m in attesa`;

  // Expired check: no winner after 24h
  const isExpiredWithNoWinner =
    !isLoading &&
    booking !== null &&
    elapsedSec >= MAX_WAIT_HOURS * 3600 &&
    booking.status !== "accepted";

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    try {
      const result = await fetchBookingWithOffers(id);
      setBooking(result.booking);
      setOffers(result.offers);
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : "Impossibile caricare la prenotazione"
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Subscribe to booking status changes
  useEffect(() => {
    if (!id) return;

    bookingChannelRef.current = subscribeToBooking(id, (updatedBooking) => {
      setBooking(updatedBooking);
      // Navigate to match screen (celebration) when a cleaner accepts
      if (updatedBooking.status === "accepted" && isMountedRef.current) {
        router.replace(`/booking/${id}/match` as never);
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

  const handleCancel = useCallback(() => {
    if (!id) return;
    Alert.alert(
      "Annulla richiesta",
      "Sei sicuro di voler annullare? L'operazione è irreversibile.",
      [
        { text: "No, continua", style: "cancel" },
        {
          text: "Sì, annulla",
          style: "destructive",
          onPress: () => {
            updateBookingStatus(id, "cancelled")
              .then(() => router.replace("/(tabs)/bookings" as never))
              .catch(() => Alert.alert("Errore", "Impossibile annullare. Riprova."));
          },
        },
      ]
    );
  }, [id, router]);

  // ─── Error state ──────────────────────────────────────────────────────────

  if (!isLoading && loadError) {
    return (
      <SafeAreaView style={s.root} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={s.expiredContainer}>
          <Ionicons name="wifi-outline" size={64} color={PColor.muted} />
          <Text style={s.expiredTitle}>Errore di rete</Text>
          <Text style={s.expiredSub}>{loadError}</Text>
          <Pressable
            onPress={load}
            accessibilityRole="button"
            accessibilityLabel="Riprova caricamento"
            style={s.retryBtn}
          >
            <Text style={s.retryBtnText}>Riprova</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(tabs)/bookings" as never)}
            accessibilityRole="button"
            style={{ marginTop: 12 }}
          >
            <Text style={{ color: PColor.accent, fontSize: 14, fontWeight: "600" }}>
              Vai alle prenotazioni
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Expired state ────────────────────────────────────────────────────────

  if (isExpiredWithNoWinner) {
    return (
      <SafeAreaView style={s.root} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={s.expiredContainer}>
          <Ionicons name="moon-outline" size={64} color={PColor.muted} />
          <Text style={s.expiredTitle}>Nessun cleaner disponibile</Text>
          <Text style={s.expiredSub}>
            Nessun professionista ha accettato entro le {MAX_WAIT_HOURS} ore. Prova a selezionare
            un orario diverso o ad ampliare la zona di ricerca.
          </Text>
          <Pressable
            onPress={() => router.replace("/booking/new" as never)}
            accessibilityRole="button"
            style={s.retryBtn}
          >
            <Text style={s.retryBtnText}>Riprova</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main content ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Top bar */}
      <View style={s.topBar}>
        <Pressable
          onPress={() => router.replace("/(tabs)/bookings" as never)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Torna alle prenotazioni"
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={24} color={PColor.ink} />
        </Pressable>
        <Text style={s.topBarTitle}>Ricerca in corso</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Stiamo cercando il tuo pulitore...</Text>
          <Text style={s.headerSub}>
            Abbiamo inviato la richiesta ai professionisti disponibili nella tua zona.
          </Text>
        </View>

        {/* Radar animation */}
        <View style={s.radarWrap}>
          <RadarAnimation />
        </View>

        {/* Elapsed timer card */}
        <View style={s.elapsedCard}>
          <Text style={s.elapsedOverline}>TEMPO ATTESA</Text>
          <Text style={s.elapsedValue}>{elapsedLabel}</Text>
          <Text style={s.elapsedSub}>Max {MAX_WAIT_HOURS} ore · notificheremo subito il match</Text>
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

        {/* Cancel button */}
        <View style={s.cancelWrap}>
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Annulla richiesta"
            style={({ pressed }) => [s.cancelBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.cancelBtnText}>Annulla richiesta</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PColor.canvas,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PSpace.screen,
    paddingVertical: 10,
    backgroundColor: PColor.canvas,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: PColor.mintPale,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    ...PType.cardTitle,
    color: PColor.ink,
  },

  scroll: {
    paddingHorizontal: PSpace.screen,
    paddingTop: 24,
  },

  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    ...PType.screenTitle,
    color: PColor.ink,
    textAlign: "center",
    marginBottom: 10,
  },
  headerSub: {
    ...PType.body,
    color: PColor.muted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },

  radarWrap: {
    alignItems: "center",
    marginBottom: 28,
    paddingVertical: 12,
  },

  // Elapsed timer card
  elapsedCard: {
    backgroundColor: PColor.white,
    borderRadius: PRadius.card,
    padding: 20,
    borderWidth: 1,
    borderColor: PBorder.card,
    alignItems: "center",
    marginBottom: 24,
    ...PShadow.card,
  },
  elapsedOverline: {
    ...PType.overline,
    color: PColor.muted,
    marginBottom: 8,
  },
  elapsedValue: {
    ...PType.timerMono,
    color: PColor.ink,
    fontVariant: ["tabular-nums"],
    marginBottom: 8,
  },
  elapsedSub: {
    fontSize: 11,
    color: PColor.muted,
    textAlign: "center",
    lineHeight: 16,
  },

  offersSection: {
    gap: 10,
    marginBottom: 24,
  },
  offersTitle: {
    ...PType.overline,
    color: PColor.muted,
    textTransform: "uppercase",
  },
  offersCard: {
    backgroundColor: PColor.white,
    borderRadius: PRadius.card,
    paddingHorizontal: PSpace.screen,
    borderWidth: 1,
    borderColor: PBorder.card,
    ...PShadow.card,
  },

  // Cancel button
  cancelWrap: {
    marginTop: 32,
    marginBottom: 16,
  },
  cancelBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: PRadius.pill,
    borderWidth: 1.5,
    borderColor: PColor.error,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: PColor.error,
    textAlign: "center",
  },

  // Expired / error states
  expiredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  expiredTitle: {
    ...PType.screenTitle,
    color: PColor.ink,
    textAlign: "center",
  },
  expiredSub: {
    ...PType.body,
    color: PColor.muted,
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: PColor.ink,
    borderRadius: PRadius.card,
    paddingVertical: 16,
    paddingHorizontal: 36,
    alignItems: "center",
  },
  retryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: PColor.mint,
  },
});
