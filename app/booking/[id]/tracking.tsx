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
  }, []);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error: dbError } = await supabase
          .from("bookings")
          .select(
            `
            id, cleaner_id, address, status, latitude, longitude,
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
        setBooking({
          id: data.id,
          cleaner_id: data.cleaner_id,
          address: data.address ?? "",
          latitude: null,
          longitude: null,
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

  const fallbackHouse = { latitude: 45.4642, longitude: 9.19 };
  const clientHouse =
    booking?.latitude && booking?.longitude
      ? { latitude: booking.latitude, longitude: booking.longitude }
      : fallbackHouse;

  const distanceKm = cleanerPos
    ? haversineKm(cleanerPos, clientHouse)
    : null;
  const etaMinutes = distanceKm !== null ? estimateEtaMinutes(distanceKm) : null;

  const initialRegion: Region = {
    latitude: clientHouse.latitude,
    longitude: clientHouse.longitude,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

  const cleanerInitial = (booking?.cleaner_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
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
