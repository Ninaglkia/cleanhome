import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Dimensions,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { Marker, Region } from "react-native-maps";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import {
  searchCleaners,
  searchCleanersNearPoint,
  searchListingsNearPoint,
} from "../../lib/api";
import { CleanerProfile } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { Colors, Shadows, SpringConfig } from "../../lib/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Card dimensions — 260px wide with 16px gap, peek of next card visible
const CARD_WIDTH = 260;
const CARD_GAP = 12;
const CARD_SIDE_PADDING = 20;

// Default region — Rome, Italy
const DEFAULT_REGION: Region = {
  latitude: 41.9028,
  longitude: 12.4964,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

// ─── Stitch design tokens (client theme — dark green) ─────────────────────────

const C = {
  primary: "#022420",
  primaryContainer: "#1a3a35",
  secondary: "#006b55",
  onPrimary: "#ffffff",
  surface: "#f6faf9",
  surfaceContainerLowest: "#ffffff",
  surfaceContainer: "#ebefee",
  surfaceContainerHigh: "#e5e9e8",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outlineVariant: "#c1c8c5",
} as const;

// ─── Price Marker ────────────────────────────────────────────────────────────

interface PriceMarkerProps {
  price: number;
  selected: boolean;
  onPress: () => void;
}

function PriceMarker({ price, selected, onPress }: PriceMarkerProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92, SpringConfig.press);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SpringConfig.press);
  };

  // Stitch spec: bg-primary-container (#1a3a35) default, bg-secondary (#006b55) selected
  // rounded-full px-4 py-1.5, border-2 border-white, shadow-xl
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={animatedStyle}>
        <View
          style={{
            backgroundColor: selected ? C.secondary : C.primaryContainer,
            borderRadius: 9999,
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderWidth: 2,
            borderColor: "#ffffff",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: selected ? 0.28 : 0.18,
            shadowRadius: selected ? 10 : 6,
            elevation: selected ? 10 : 6,
            flexDirection: "row",
            alignItems: "center",
            gap: selected ? 6 : 0,
          }}
        >
          <Text
            style={{
              color: "#ffffff",
              fontSize: 13,
              fontWeight: "800",
              letterSpacing: 0.2,
            }}
          >
            €{price}/hr
          </Text>
          {selected && (
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: "#ffffff",
              }}
            />
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Cleaner Map Card ─────────────────────────────────────────────────────────
// Stitch spec: bg-surface-container-lowest (#fff) rounded-lg p-4
// photo 112x112 rounded-md, star rating, name font-headline, rate, "View Profile" button
// PREFERRED badge on avatar — bg-secondary (#006b55) text-white rounded-full

interface MapCleanerCardProps {
  cleaner: CleanerProfile;
  onPress: () => void;
  isSelected: boolean;
}

function MapCleanerCard({ cleaner, onPress, isSelected }: MapCleanerCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, SpringConfig.press);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SpringConfig.press);
  };

  const initials = cleaner.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Show PREFERRED badge on every 3rd cleaner (index-agnostic: use rating >= 4.8 as proxy)
  const isPreferred = cleaner.avg_rating >= 4.8;

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={{ width: CARD_WIDTH }}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            backgroundColor: C.surfaceContainerLowest,
            borderRadius: 12,
            overflow: "visible",
            shadowColor: C.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isSelected ? 0.18 : 0.08,
            shadowRadius: 20,
            elevation: isSelected ? 12 : 5,
            borderWidth: 1,
            borderColor: isSelected ? C.secondary : `${C.outlineVariant}1a`,
          },
        ]}
      >
        <View style={{ padding: 16, borderRadius: 12, overflow: "hidden" }}>
          {/* Photo + info row */}
          <View style={{ flexDirection: "row", gap: 16 }}>
            {/* Square photo — 112x112 rounded-md */}
            <View style={{ position: "relative", width: 112, height: 112, flexShrink: 0 }}>
              {cleaner.avatar_url ? (
                <Image
                  source={{ uri: cleaner.avatar_url }}
                  style={{ width: 112, height: 112, borderRadius: 8 }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    width: 112,
                    height: 112,
                    borderRadius: 8,
                    backgroundColor: C.surfaceContainerHigh,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: C.onSurfaceVariant,
                      fontSize: 28,
                      fontWeight: "800",
                    }}
                  >
                    {initials}
                  </Text>
                </View>
              )}
              {/* PREFERRED badge */}
              {isPreferred && (
                <View
                  style={{
                    position: "absolute",
                    bottom: -10,
                    right: -10,
                    backgroundColor: C.secondary,
                    borderRadius: 9999,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderWidth: 2,
                    borderColor: "#ffffff",
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 8,
                      fontWeight: "800",
                      letterSpacing: 0.5,
                    }}
                  >
                    PREFERRED
                  </Text>
                </View>
              )}
            </View>

            {/* Info column */}
            <View style={{ flex: 1, justifyContent: "center" }}>
              {/* Star rating */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  marginBottom: 4,
                }}
              >
                <Ionicons name="star" size={13} color={C.secondary} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: C.secondary,
                  }}
                >
                  {cleaner.avg_rating.toFixed(1)}
                </Text>
              </View>

              {/* Name — font-headline style */}
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: C.primary,
                  letterSpacing: -0.3,
                  marginBottom: 2,
                  lineHeight: 22,
                }}
                numberOfLines={1}
              >
                {cleaner.full_name}
              </Text>

              {/* Specialty / bio */}
              <Text
                style={{
                  fontSize: 12,
                  color: C.onSurfaceVariant,
                  lineHeight: 16,
                }}
                numberOfLines={1}
              >
                {cleaner.bio ??
                  (cleaner.city
                    ? `Professionista a ${cleaner.city}`
                    : "Pulizie professionali")}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: C.surfaceContainer,
              marginTop: 16,
              marginBottom: 14,
            }}
          />

          {/* Rate + CTA row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  color: C.onSurfaceVariant,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  marginBottom: 2,
                }}
              >
                Tariffa oraria
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: C.primary,
                  letterSpacing: -0.3,
                }}
              >
                €{cleaner.hourly_rate?.toFixed(2) ?? "—"}
              </Text>
            </View>

            {/* "View Profile" CTA — bg-primary when selected, bg-surface-container-high otherwise */}
            <TouchableOpacity
              onPress={onPress}
              activeOpacity={0.85}
              style={{
                backgroundColor: isSelected ? C.primary : C.surfaceContainerHigh,
                borderRadius: 10,
                paddingVertical: 12,
                paddingHorizontal: 20,
              }}
            >
              <Text
                style={{
                  color: isSelected ? "#ffffff" : C.primary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Vedi profilo
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const flatListRef = useRef<FlatList>(null);
  const searchInputRef = useRef<TextInput>(null);

  const [cleaners, setCleaners] = useState<CleanerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);

  // Animated value for search bar expansion
  const searchExpanded = useSharedValue(0);

  const searchBarStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(searchExpanded.value, [0, 1], [0.08, 0.18], Extrapolation.CLAMP),
  }));

  // ── Data loading ──────────────────────────────────────────────────────────

  // Geocode a free-text city name to { lat, lng } via Google Geocoding
  // API. Used when the user types a city in the header search bar.
  const geocodeCityWithGoogle = useCallback(
    async (
      city: string
    ): Promise<{ lat: number; lng: number } | null> => {
      const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || "";
      if (!key) return null;
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            city + ", Italia"
          )}&language=it&region=it&key=${key}`
        );
        const data = (await res.json()) as {
          status: string;
          results: Array<{
            geometry: { location: { lat: number; lng: number } };
          }>;
        };
        if (data.status !== "OK" || data.results.length === 0) return null;
        return data.results[0].geometry.location;
      } catch {
        return null;
      }
    },
    []
  );

  // Fetch all listings whose declared coverage zone contains the given
  // point, via the PostGIS `search_listings_by_point` RPC. The rows
  // returned are listings JOINed with their cleaner profile fields.
  // We adapt them into the legacy `CleanerProfile` shape so the rest
  // of this screen (which still binds to cleaner.* fields) keeps
  // working unchanged.
  const loadCleanersAtPoint = useCallback(
    async (lat: number, lng: number) => {
      setLoading(true);
      try {
        const rows = await searchListingsNearPoint(lat, lng);
        const adapted: CleanerProfile[] = rows.map((r) => ({
          // Keep the LISTING id on `id` so navigation can target the
          // specific listing card the customer clicked.
          id: r.cleaner_id,
          full_name: r.cleaner_name,
          bio: r.cleaner_bio ?? undefined,
          city: r.city ?? undefined,
          cleaner_type: r.cleaner_type ?? undefined,
          hourly_rate: r.hourly_rate ?? undefined,
          services: r.services ?? undefined,
          is_available: true,
          avg_rating: r.avg_rating ?? 0,
          review_count: r.review_count ?? 0,
          distance_km: 0,
          // Fields used by the map marker positioning
          coverage_center_lat: r.coverage_center_lat,
          coverage_center_lng: r.coverage_center_lng,
          // Use the listing cover as the visible avatar/card image
          avatar_url: r.cover_url ?? undefined,
        }));
        setCleaners(adapted);
        setSelectedIndex(0);
      } catch {
        setCleaners([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    (async () => {
      // Request GPS permission and use the client's real location as the
      // anchor for the cleaner search.
      let lat = DEFAULT_REGION.latitude;
      let lng = DEFAULT_REGION.longitude;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        try {
          const loc = await Location.getCurrentPositionAsync({});
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
          setRegion({
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          });
        } catch {}
      }
      await loadCleanersAtPoint(lat, lng);
    })();
  }, [loadCleanersAtPoint]);

  const handleSearch = useCallback(
    async (city: string) => {
      setSearchText(city);
      setSearchFocused(false);
      if (!city.trim()) return;
      // Resolve the typed city to coordinates, then do the spatial search.
      const geo = await geocodeCityWithGoogle(city);
      if (geo) {
        setRegion((r) => ({
          ...r,
          latitude: geo.lat,
          longitude: geo.lng,
        }));
        await loadCleanersAtPoint(geo.lat, geo.lng);
      } else {
        // Fallback: keep legacy text-based search so users still see
        // something if geocoding fails (e.g. no API key set in dev).
        try {
          const results = await searchCleaners(city);
          setCleaners(results);
          setSelectedIndex(0);
        } catch {
          setCleaners([]);
        }
      }
    },
    [geocodeCityWithGoogle, loadCleanersAtPoint]
  );

  // ── Marker <-> Card sync ──────────────────────────────────────────────────

  // Place each cleaner marker at the center of their declared coverage
  // zone (from the DB). Fallback to a golden-angle spread around the
  // customer if a cleaner has no zone yet (legacy rows).
  const getCleanerPosition = useCallback(
    (index: number) => {
      const cleaner = cleaners[index];
      if (
        cleaner?.coverage_center_lat != null &&
        cleaner?.coverage_center_lng != null
      ) {
        return {
          latitude: Number(cleaner.coverage_center_lat),
          longitude: Number(cleaner.coverage_center_lng),
        };
      }
      const angle = (index * 137.5 * Math.PI) / 180;
      const radius = 0.005 + index * 0.003;
      return {
        latitude: region.latitude + radius * Math.cos(angle),
        longitude: region.longitude + radius * Math.sin(angle),
      };
    },
    [cleaners, region]
  );

  const scrollToIndex = (index: number) => {
    flatListRef.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0,
    });
  };

  const handleMarkerPress = (index: number) => {
    setSelectedIndex(index);
    scrollToIndex(index);
    // Pan map toward that cleaner
    const pos = getCleanerPosition(index);
    mapRef.current?.animateToRegion(
      {
        latitude: pos.latitude - 0.012, // offset so card doesn't cover it
        longitude: pos.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      350
    );
  };

  const handleCardScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / (CARD_WIDTH + CARD_GAP));
      if (index !== selectedIndex && index >= 0 && index < cleaners.length) {
        setSelectedIndex(index);
        // Animate map marker into view
        const pos = getCleanerPosition(index);
        mapRef.current?.animateToRegion(
          {
            latitude: pos.latitude - 0.012,
            longitude: pos.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          },
          300
        );
      }
    },
    [selectedIndex, cleaners.length, getCleanerPosition]
  );

  const handleCleanerPress = useCallback(
    (cleanerId: string) => {
      router.push(`/cleaner/${cleanerId}`);
    },
    [router]
  );

  // ── Layout constants ──────────────────────────────────────────────────────

  const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 84 : 64;
  // Card carousel sits above the tab bar
  const CAROUSEL_BOTTOM = TAB_BAR_HEIGHT + 8;

  const avatarInitials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "ME";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* ── Full-screen map ── */}
      <MapView
        ref={mapRef}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        initialRegion={DEFAULT_REGION}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={false}
      >
        {cleaners.map((cleaner, index) => (
          <Marker
            key={cleaner.id}
            coordinate={getCleanerPosition(index)}
            onPress={() => handleMarkerPress(index)}
            tracksViewChanges={false}
          >
            <PriceMarker
              price={cleaner.hourly_rate ?? 15}
              selected={selectedIndex === index}
              onPress={() => handleMarkerPress(index)}
            />
          </Marker>
        ))}
      </MapView>

      {/* ── Floating header pill (Stitch spec) ── */}
      {/* bg-white/80 backdrop-blur rounded-full mx-4 mt-4 shadow-2xl */}
      <Animated.View
        style={[
          searchBarStyle,
          {
            position: "absolute",
            top: insets.top + 8,
            left: 16,
            right: 16,
            zIndex: 20,
            backgroundColor: "rgba(255, 255, 255, 0.88)",
            borderRadius: 9999,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 8,
            paddingVertical: 8,
            shadowColor: "#022420",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.07,
            shadowRadius: 24,
            elevation: 12,
          },
        ]}
      >
        {/* Left: search icon + Discovery/Explore label */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {/* Search icon button — focuses the TextInput next to it */}
          <TouchableOpacity
            onPress={() => searchInputRef.current?.focus()}
            activeOpacity={0.75}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="search" size={20} color="#022420" />
          </TouchableOpacity>

          {/* Discovery / Explore text stack */}
          <View style={{ flexDirection: "column" }}>
            <Text
              style={{
                fontSize: 9,
                fontWeight: "700",
                color: "rgba(2,36,32,0.4)",
                letterSpacing: 2,
                textTransform: "uppercase",
                lineHeight: 12,
              }}
            >
              Scopri
            </Text>
            <TextInput
              ref={searchInputRef}
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#022420",
                padding: 0,
                margin: 0,
                lineHeight: 22,
                minWidth: 120,
              }}
              placeholder="Cerca città"
              placeholderTextColor="#022420"
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={() => handleSearch(searchText)}
              onFocus={() => {
                setSearchFocused(true);
                searchExpanded.value = withTiming(1, { duration: 200 });
              }}
              onBlur={() => {
                setSearchFocused(false);
                searchExpanded.value = withTiming(0, { duration: 200 });
              }}
              returnKeyType="search"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Right: clear (if text) + tune filter icon */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => handleSearch("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* ── My location button ── */}
      <TouchableOpacity
        style={{
          position: "absolute",
          right: 20,
          bottom: CAROUSEL_BOTTOM + 300 + 12,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: Colors.surface,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 15,
          shadowColor: Colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.14,
          shadowRadius: 10,
          elevation: 6,
        }}
        activeOpacity={0.85}
        onPress={async () => {
          try {
            const loc = await Location.getCurrentPositionAsync({});
            const newRegion = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            };
            setRegion(newRegion);
            mapRef.current?.animateToRegion(newRegion, 400);
          } catch {}
        }}
      >
        <Ionicons name="navigate" size={20} color={Colors.secondary} />
      </TouchableOpacity>

      {/* ── Bottom carousel ── */}
      <View
        style={{
          position: "absolute",
          bottom: CAROUSEL_BOTTOM,
          left: 0,
          right: 0,
          zIndex: 15,
        }}
      >
        {/* "Redo search in this area" pill — Stitch spec */}
        {!loading && (
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => loadCleanersAtPoint(region.latitude, region.longitude)}
              activeOpacity={0.85}
              style={{
                backgroundColor: C.surfaceContainerLowest,
                borderRadius: 9999,
                paddingHorizontal: 24,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 6,
                borderWidth: 1,
                borderColor: `${C.outlineVariant}33`,
              }}
            >
              <Ionicons name="refresh" size={14} color={C.secondary} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: C.primary,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {cleaners.length > 0
                  ? `${cleaners.length} professionisti · aggiorna`
                  : "Cerca in questa zona"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          // Skeleton cards — match new card layout: photo left + info right
          <FlatList
            data={[1, 2, 3]}
            keyExtractor={(item) => String(item)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingLeft: CARD_SIDE_PADDING,
              paddingRight: CARD_SIDE_PADDING,
            }}
            ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
            scrollEnabled={false}
            renderItem={() => (
              <View
                style={{
                  width: CARD_WIDTH,
                  backgroundColor: C.surfaceContainerLowest,
                  borderRadius: 12,
                  padding: 16,
                  shadowColor: C.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.06,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                {/* Photo + info row skeleton */}
                <View style={{ flexDirection: "row", gap: 16, marginBottom: 16 }}>
                  <View
                    style={{
                      width: 112,
                      height: 112,
                      borderRadius: 8,
                      backgroundColor: C.surfaceContainerHigh,
                      flexShrink: 0,
                    }}
                  />
                  <View style={{ flex: 1, justifyContent: "center", gap: 8 }}>
                    <View
                      style={{
                        height: 10,
                        width: "50%",
                        backgroundColor: C.surfaceContainerHigh,
                        borderRadius: 5,
                      }}
                    />
                    <View
                      style={{
                        height: 18,
                        width: "80%",
                        backgroundColor: C.surfaceContainer,
                        borderRadius: 6,
                      }}
                    />
                    <View
                      style={{
                        height: 12,
                        width: "65%",
                        backgroundColor: C.surfaceContainerHigh,
                        borderRadius: 5,
                      }}
                    />
                  </View>
                </View>
                {/* Divider skeleton */}
                <View
                  style={{
                    height: 1,
                    backgroundColor: C.surfaceContainer,
                    marginBottom: 14,
                  }}
                />
                {/* Rate + button row skeleton */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ gap: 4 }}>
                    <View
                      style={{
                        height: 9,
                        width: 60,
                        backgroundColor: C.surfaceContainerHigh,
                        borderRadius: 4,
                      }}
                    />
                    <View
                      style={{
                        height: 18,
                        width: 70,
                        backgroundColor: C.surfaceContainer,
                        borderRadius: 5,
                      }}
                    />
                  </View>
                  <View
                    style={{
                      height: 40,
                      width: 100,
                      backgroundColor: C.surfaceContainerHigh,
                      borderRadius: 10,
                    }}
                  />
                </View>
              </View>
            )}
          />
        ) : cleaners.length === 0 ? (
          // Empty state card
          <View
            style={{
              marginHorizontal: 20,
              backgroundColor: Colors.surface,
              borderRadius: 20,
              padding: 24,
              alignItems: "center",
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                backgroundColor: Colors.accentLight,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Ionicons name="search-outline" size={26} color={Colors.secondary} />
            </View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: Colors.text,
                textAlign: "center",
                marginBottom: 6,
              }}
            >
              Nessun pulitore trovato
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: Colors.textSecondary,
                textAlign: "center",
                lineHeight: 18,
                marginBottom: 16,
              }}
            >
              Prova a cercare in un'altra zona o rimuovi i filtri
            </Text>
            <TouchableOpacity
              onPress={() => handleSearch("")}
              activeOpacity={0.85}
              style={{
                backgroundColor: Colors.primary,
                borderRadius: 12,
                paddingVertical: 11,
                paddingHorizontal: 24,
              }}
            >
              <Text
                style={{
                  color: Colors.accent,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                Mostra tutti
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Cleaner cards carousel
          <FlatList
            ref={flatListRef}
            data={cleaners}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_GAP}
            snapToAlignment="start"
            decelerationRate="fast"
            contentContainerStyle={{
              paddingLeft: CARD_SIDE_PADDING,
              paddingRight: CARD_SIDE_PADDING,
            }}
            ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
            onScroll={handleCardScroll}
            scrollEventThrottle={16}
            onScrollToIndexFailed={(info) => {
              // FlatList couldn't measure the target index yet — retry
              // after a frame once layout has settled. Prevents the
              // "cannot scroll to index" crash on iOS when the user
              // taps a marker before the card rendered.
              setTimeout(() => {
                flatListRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: true,
                });
              }, 50);
            }}
            renderItem={({ item, index }) => (
              <MapCleanerCard
                cleaner={item}
                isSelected={selectedIndex === index}
                onPress={() => handleCleanerPress(item.id)}
              />
            )}
          />
        )}
      </View>
    </View>
  );
}
