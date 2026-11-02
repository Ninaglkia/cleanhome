import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  Region,
  PROVIDER_DEFAULT,
} from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { Pressable } from "../../../components/ui/AppPressable";
import { CleanerMarkerIcon } from "../../../components/tracking/CleanerMarkerIcon";
import { TrackingArrivalCard } from "../../../components/tracking/TrackingArrivalCard";
import {
  subscribeToLocation,
  haversineKm,
  estimateEtaMinutes,
  TrackingCoords,
} from "../../../lib/realtime-tracking";
import { fetchBooking, fetchProfile, subscribeToBooking } from "../../../lib/api";
import { RealtimeChannel } from "@supabase/supabase-js";
import { Colors, Shadows } from "../../../lib/theme";

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
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const [booking, setBooking] = useState<BookingTrackingData | null>(null);
  const [cleanerPos, setCleanerPos] = useState<TrackingCoords | null>(null);
  const [routePoints, setRoutePoints] = useState<TrackingCoords[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [terminalStatus, setTerminalStatus] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [following, setFollowing] = useState(true);
  const [cardHeight, setCardHeight] = useState(280);
  const [reloadKey, setReloadKey] = useState(0);
  const locationChannelRef = useRef<RealtimeChannel | null>(null);
  const hasFramedMap = useRef(false);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMapReady(false);
    hasFramedMap.current = false;

    (async () => {
      try {
        const data = await fetchBooking(bookingId);
        if (cancelled) return;
        if (!data) throw new Error("Prenotazione non trovata");

        // Reuse the detail-screen reads without depending on a
        // cleaner_profiles relationship in the Data API schema.
        const profile = data.cleaner_id ? await fetchProfile(data.cleaner_id) : null;
        if (cancelled) return;
        const lat = data.search_lat;
        const lng = data.search_lng;
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
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Errore nel caricamento");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingId, reloadKey]);

  useEffect(() => {
    if (!bookingId) return;
    setCleanerPos(null);
    setRoutePoints([]);
    setTerminalStatus(null);
    setFollowing(true);
    const channel = subscribeToLocation(bookingId, (coords) => {
      setCleanerPos(coords);
      setRoutePoints((prev) => {
        const next = [...prev, coords];
        return next.length > 200 ? next.slice(-200) : next;
      });
    });
    locationChannelRef.current = channel;
    return () => {
      channel.unsubscribe();
      locationChannelRef.current = null;
    };
  }, [bookingId]);

  // React to the booking leaving the "en route" phase: once the cleaner marks
  // the job done (or it's completed/cancelled) we stop listening for location
  // and show a terminal state instead of an empty, forever-waiting map.
  useEffect(() => {
    if (!bookingId) return;
    const channel = subscribeToBooking(bookingId, (updated) => {
      if (
        updated.status === "work_done" ||
        updated.status === "completed" ||
        updated.status === "cancelled"
      ) {
        setTerminalStatus(updated.status);
        locationChannelRef.current?.unsubscribe();
        locationChannelRef.current = null;
      }
    });
    return () => {
      channel.unsubscribe();
    };
  }, [bookingId]);

  const clientHouse = useMemo(() => {
    if (
      booking?.latitude == null ||
      booking.longitude == null ||
      !Number.isFinite(booking.latitude) ||
      !Number.isFinite(booking.longitude)
    ) return null;
    return { latitude: booking.latitude, longitude: booking.longitude };
  }, [booking?.latitude, booking?.longitude]);

  const distanceKm = cleanerPos && clientHouse
    ? haversineKm(cleanerPos, clientHouse)
    : null;
  const etaMinutes = distanceKm !== null ? estimateEtaMinutes(distanceKm) : null;

  const initialRegion: Region | null = clientHouse
    ? {
        latitude: clientHouse.latitude,
        longitude: clientHouse.longitude,
        latitudeDelta: 0.018,
        longitudeDelta: 0.018,
      }
    : null;

  const frameRoute = useCallback((animated: boolean) => {
    if (!mapReady || !mapRef.current || !clientHouse) return;
    const edgePadding = {
      top: insets.top + 112,
      right: 52,
      bottom: Math.min(cardHeight + insets.bottom + 44, windowHeight * 0.62),
      left: 52,
    };
    if (cleanerPos && haversineKm(cleanerPos, clientHouse) > 0.025) {
      mapRef.current.fitToCoordinates(
        [clientHouse, { latitude: cleanerPos.latitude, longitude: cleanerPos.longitude }],
        { edgePadding, animated: animated && !reducedMotion },
      );
    } else {
      mapRef.current.animateToRegion({
        ...clientHouse,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }, animated && !reducedMotion ? 300 : 0);
    }
  }, [mapReady, clientHouse, cleanerPos, insets.top, insets.bottom, cardHeight, windowHeight, reducedMotion]);

  useEffect(() => {
    if (!following || !mapReady) return;
    frameRoute(hasFramedMap.current);
    hasFramedMap.current = true;
  }, [following, mapReady, frameRoute]);

  const measureCard = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setCardHeight((height) => Math.abs(height - nextHeight) > 1 ? nextHeight : height);
  }, []);

  const openDetails = () => router.replace(`/booking/${bookingId}` as never);
  const cleanerName = booking?.cleaner_name?.trim() || "Il tuo professionista";

  const endedStatus = terminalStatus ?? (
    booking && ["work_done", "completed", "cancelled"].includes(booking.status)
      ? booking.status
      : null
  );

  if (loading || error || endedStatus || !clientHouse || !initialRegion) {
    const cancelled = endedStatus === "cancelled";
    const title = loading
      ? "Prepariamo il tuo percorso"
      : error
        ? "Tracciamento non disponibile"
        : endedStatus
          ? cancelled ? "Prenotazione annullata" : "Servizio terminato"
          : "Indirizzo non disponibile";
    const message = loading
      ? "Carichiamo l’appuntamento e la posizione della tua casa."
      : error
        ? "Non riusciamo a caricare il tuo appuntamento. Controlla la connessione e riprova."
        : endedStatus
          ? cancelled
            ? "Questo appuntamento è stato annullato. Puoi rivederlo dalle tue prenotazioni."
            : "Puoi vedere gli aggiornamenti del servizio nei dettagli della prenotazione."
          : "Per questo appuntamento non è stata salvata una posizione sulla mappa.";
    return (
      <View className="flex-1 bg-ch-background">
        <StatusBar barStyle="dark-content" />
        <View className="flex-row items-center gap-3 px-4" style={{ paddingTop: insets.top + 12 }}>
          <Pressable
            onPress={() => router.back()}
            className="h-12 w-12 items-center justify-center rounded-full bg-ch-surface-lowest"
            style={Shadows.sm}
            accessibilityRole="button"
            accessibilityLabel="Torna indietro"
          >
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </Pressable>
          <Text className="flex-1 text-base font-semibold text-ch-primary">Il tuo appuntamento</Text>
        </View>
        <View className="flex-1 items-center justify-center gap-5 px-8 pb-12">
          <View className="h-28 w-28 items-center justify-center rounded-[32px] bg-ch-secondary-container">
            {endedStatus ? (
              <Ionicons
                name={cancelled ? "close-outline" : "checkmark-outline"}
                size={52}
                color={cancelled ? Colors.error : Colors.secondary}
              />
            ) : (
              <CleanerMarkerIcon size={72} color={Colors.primary} accentColor={Colors.secondary} />
            )}
          </View>
          <Text className="text-center text-2xl font-bold text-ch-primary">{title}</Text>
          <Text className="text-center text-base leading-6 text-ch-on-surface-variant">{message}</Text>
          {loading ? (
            <ActivityIndicator size="small" color={Colors.secondary} accessibilityLabel="Caricamento appuntamento" />
          ) : (
            <View className="w-full gap-3">
              <Pressable
                onPress={error ? () => setReloadKey((key) => key + 1) : openDetails}
                className="min-h-12 items-center justify-center rounded-2xl bg-ch-primary px-5 py-3"
                accessibilityRole="button"
                accessibilityLabel={error ? "Riprova caricamento tracking" : "Apri dettagli prenotazione"}
              >
                <Text className="text-base font-semibold" style={{ color: Colors.textOnDark }}>
                  {error ? "Riprova" : "Dettagli prenotazione"}
                </Text>
              </Pressable>
              {error && (
                <Pressable
                  onPress={openDetails}
                  className="min-h-12 items-center justify-center px-4 py-3"
                  accessibilityRole="button"
                >
                  <Text className="text-sm font-semibold text-ch-primary">Torna alla prenotazione</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ch-background">
      <StatusBar barStyle="dark-content" />
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
        showsCompass={false}
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onMapReady={() => setMapReady(true)}
        onPanDrag={() => { if (following) setFollowing(false); }}
        legalLabelInsets={{ top: 0, left: 8, right: 8, bottom: cardHeight + insets.bottom + 24 }}
      >
        <Marker
          coordinate={clientHouse}
          anchor={{ x: 0.5, y: 0.35 }}
          title="La tua casa"
          description={booking?.address}
        >
          <View className="h-20 w-24 items-center">
            <View
              className="h-14 w-14 items-center justify-center rounded-full border-2 border-ch-primary bg-ch-surface-lowest"
              style={Shadows.sm}
            >
              <Ionicons name="home-outline" size={25} color={Colors.primary} />
            </View>
            <View className="mt-1 rounded-full bg-ch-surface-lowest px-2 py-1">
              <Text className="text-[10px] font-semibold text-ch-primary">La tua casa</Text>
            </View>
          </View>
        </Marker>
        {cleanerPos && (
          <Marker
            coordinate={{ latitude: cleanerPos.latitude, longitude: cleanerPos.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={cleanerName}
            description="Posizione del professionista"
            zIndex={2}
          >
            <View className="h-[88px] w-[88px] items-center justify-center">
              <View className="absolute h-20 w-20 rounded-full bg-ch-secondary-container" />
              <View
                className="h-16 w-16 items-center justify-center rounded-full border-[3px] border-ch-surface-lowest bg-ch-primary"
                style={Shadows.md}
              >
                <CleanerMarkerIcon size={44} />
              </View>
            </View>
          </Marker>
        )}
        {routePoints.length > 1 && (
          <Polyline
            coordinates={routePoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude }))}
            strokeColor={Colors.secondary}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>

      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 top-0 flex-row items-center gap-3 px-4"
        style={{ paddingTop: insets.top + 12 }}
      >
        <Pressable
          onPress={() => router.back()}
          className="h-12 w-12 items-center justify-center rounded-full bg-ch-surface-lowest"
          style={Shadows.sm}
          accessibilityLabel="Torna indietro"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={Colors.primary} />
        </Pressable>
        <View className="flex-1 rounded-[22px] bg-ch-surface-lowest px-4 py-3" style={Shadows.sm}>
          <Text className="text-base font-bold text-ch-primary">Il tuo appuntamento</Text>
          <View className="mt-1 flex-row items-center gap-2">
            <View className={`h-1.5 w-1.5 rounded-full ${cleanerPos ? "bg-ch-secondary" : "bg-ch-outline-variant"}`} />
            <Text className="flex-1 text-xs text-ch-on-surface-variant">
              {cleanerPos ? "Segui il professionista sulla mappa" : "Attendiamo la prima posizione"}
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => following ? frameRoute(true) : setFollowing(true)}
        className="absolute right-5 h-12 w-12 items-center justify-center rounded-2xl bg-ch-surface-lowest"
        style={[Shadows.sm, { bottom: cardHeight + Math.max(insets.bottom, 12) + 16 }]}
        accessibilityRole="button"
        accessibilityLabel="Centra pulitore e casa sulla mappa"
        accessibilityState={{ selected: following }}
      >
        <Ionicons name={following ? "locate" : "locate-outline"} size={23} color={Colors.primary} />
      </Pressable>

      <View
        pointerEvents="box-none"
        className="absolute bottom-0 left-0 right-0 px-4"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <View onLayout={measureCard}>
          <TrackingArrivalCard
            cleanerName={cleanerName}
            cleanerAvatarUrl={booking?.cleaner_avatar_url}
            address={booking?.address ?? ""}
            etaMinutes={etaMinutes}
            distanceKm={distanceKm}
            hasLocation={!!cleanerPos}
            lastUpdatedAt={cleanerPos?.timestamp}
            onChat={() => router.push({
              pathname: "/chat/[bookingId]",
              params: { bookingId: bookingId as string },
            })}
            onDetails={openDetails}
          />
        </View>
      </View>
    </View>
  );
}
