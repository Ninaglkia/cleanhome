import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import CoachMarkOverlay, {
  CoachMarkStep,
} from "../../components/CoachMarks/CoachMarkOverlay";
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
  fetchClientProperties,
  searchCleaners,
  searchCleanersNearPoint,
  searchListingsNearPoint,
} from "../../lib/api";
import { CleanerProfile, ClientProperty } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { Colors, Shadows, SpringConfig } from "../../lib/theme";
import { measureInWindow } from "../../lib/measureInWindow";
import { START_TOUR_KEY } from "../(auth)/welcome-rocket";
import { NotificationBell } from "../../components/NotificationBell";

// AsyncStorage key for caching the last map region the user was on.
// Used to restore the map to the correct position instantly on cold start,
// avoiding the 1-3s flash on Rome before GPS resolves.
const LAST_KNOWN_REGION_KEY = "cleanhome.last_known_region";

const { width: SCREEN_WIDTH, width: SW, height: SH } = Dimensions.get("window");

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
            shadowColor: "#022420",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: selected ? 0.22 : 0.12,
            shadowRadius: selected ? 10 : 6,
            elevation: selected ? 8 : 4,
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
                  {(cleaner.avg_rating ?? 0).toFixed(1)}
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

// ─── Property Marker (client's saved houses) ─────────────────────────────
// Amber/gold house pin that visually distinguishes the client's saved
// properties from the cleaner price markers. Default property gets a
// thicker gold glow so it stands out. Only the owning client ever sees
// these pins (enforced by RLS on client_properties).

function PropertyMarker({ isDefault }: { isDefault: boolean }) {
  return (
    <View
      style={{
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "#ffffff",
          borderWidth: 3,
          borderColor: isDefault ? "#f59e0b" : "#d97706",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#d97706",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDefault ? 0.45 : 0.28,
          shadowRadius: 10,
          elevation: 8,
        }}
      >
        <Ionicons name="home" size={20} color="#d97706" />
        {isDefault && (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: "#f59e0b",
              borderWidth: 2,
              borderColor: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="star" size={8} color="#ffffff" />
          </View>
        )}
      </View>
      {/* Pointer triangle */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderTopWidth: 8,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: isDefault ? "#f59e0b" : "#d97706",
          marginTop: -2,
        }}
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, profile } = useAuth();
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
  // True when the user has explicitly denied foreground location permission.
  // Drives the "Attiva GPS" banner so they can navigate to Settings.
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);

  // Persist a real (non-Rome) region to AsyncStorage so the next cold
  // start can restore it instantly without waiting for GPS.
  const persistRegion = useCallback((r: Region) => {
    if (
      r.latitude === DEFAULT_REGION.latitude &&
      r.longitude === DEFAULT_REGION.longitude
    ) {
      return; // Never persist the Rome fallback
    }
    AsyncStorage.setItem(LAST_KNOWN_REGION_KEY, JSON.stringify(r)).catch(() => {});
  }, []);

  // ── Coach marks ────────────────────────────────────────────────────────────
  const [showCoachMarks, setShowCoachMarks] = useState(false);
  const [coachSteps, setCoachSteps] = useState<CoachMarkStep[]>([]);

  // Refs for measureInWindow — gives screen-absolute coordinates for the Modal overlay
  const searchBarRef = useRef<View>(null);
  // Ghost Views that sit exactly over the tab bar buttons.
  const bookingsTabRef = useRef<View>(null);
  const profileTabRef = useRef<View>(null);

  // On mount: check if the welcome modal set the START_TOUR_KEY.
  // If yes, show the 2-step focused coach marks and clear the flag.
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(START_TOUR_KEY).then((val) => {
        if (val === "1") {
          AsyncStorage.removeItem(START_TOUR_KEY).catch(() => {});
          setShowCoachMarks(true);
        }
      }).catch(() => {});
    }, [])
  );

  // Coach mark for CLIENT — single step (map search bar) now that the
  // profile-completion banner has been removed.
  useEffect(() => {
    if (!showCoachMarks) return;
    const timer = setTimeout(async () => {
      const searchRect = await measureInWindow(searchBarRef);
      const steps: CoachMarkStep[] = [];
      if (searchRect) {
        steps.push({
          rect: searchRect,
          title: "Trova pulitori nella tua zona",
          description:
            "Inserisci la tua citta o lascia attiva la posizione GPS per vedere i professionisti vicini.",
        });
      }
      if (steps.length >= 1) setCoachSteps(steps);
    }, 400);
    return () => clearTimeout(timer);
  }, [showCoachMarks]);

  const handleCoachMarkDone = useCallback(() => {
    setShowCoachMarks(false);
  }, []);

  // The client's saved houses rendered as distinct pins on the map.
  // Only shown to the owning client (RLS on client_properties enforces
  // this server-side). Refreshed on screen focus so a house added from
  // /properties immediately appears here without a manual reload.
  const [properties, setProperties] = useState<ClientProperty[]>([]);
  // Multi-selection: client can pick several houses to be cleaned in the
  // same booking. The first id in the array is the "primary" used for
  // map centering and the spatial cleaner search; the others ride along
  // and are passed to the booking wizard.
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [propertyPickerOpen, setPropertyPickerOpen] = useState(false);

  const loadProperties = useCallback(async () => {
    if (!user?.id) return;
    try {
      const rows = await fetchClientProperties(user.id);
      setProperties(rows.filter((p) => p.latitude != null && p.longitude != null));
    } catch {
      setProperties([]);
    }
  }, [user?.id]);
  useFocusEffect(
    useCallback(() => {
      loadProperties();
    }, [loadProperties])
  );

  // Restore the last picked properties from AsyncStorage on mount so the
  // client doesn't have to re-pick every cold start. We persist the
  // entire selection (comma-separated) — single selections written by
  // earlier app versions are still backwards-compatible.
  useEffect(() => {
    AsyncStorage.getItem("cleanhome.selected_property_id")
      .then((raw) => {
        if (!raw) return;
        const ids = raw.split(",").filter(Boolean);
        if (ids.length) setSelectedPropertyIds(ids);
      })
      .catch(() => {});
  }, []);

  // Reconcile selection with the loaded list. Drops ids that no longer
  // exist (e.g. the user deleted a property elsewhere). If the list
  // becomes non-empty and nothing is selected, auto-pick the default
  // (or first) property as a sensible primary.
  useEffect(() => {
    if (properties.length === 0) {
      if (selectedPropertyIds.length) setSelectedPropertyIds([]);
      return;
    }
    const validIds = selectedPropertyIds.filter((id) =>
      properties.some((p) => p.id === id)
    );
    if (validIds.length === 0) {
      const defaultP = properties.find((p) => p.is_default) ?? properties[0];
      setSelectedPropertyIds([defaultP.id]);
    } else if (validIds.length !== selectedPropertyIds.length) {
      setSelectedPropertyIds(validIds);
    }
  }, [properties, selectedPropertyIds]);

  // Primary = first picked, used for map centering and search anchor.
  const primaryPropertyId = selectedPropertyIds[0] ?? null;
  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === primaryPropertyId) ?? null,
    [properties, primaryPropertyId]
  );
  const selectedProperties = useMemo(
    () =>
      selectedPropertyIds
        .map((id) => properties.find((p) => p.id === id))
        .filter((p): p is ClientProperty => !!p),
    [properties, selectedPropertyIds]
  );

  const handleToggleProperty = useCallback(
    async (property: ClientProperty) => {
      const isCurrentlySelected = selectedPropertyIds.includes(property.id);
      const nextIds = isCurrentlySelected
        ? selectedPropertyIds.filter((id) => id !== property.id)
        : [...selectedPropertyIds, property.id];
      setSelectedPropertyIds(nextIds);
      try {
        await AsyncStorage.setItem(
          "cleanhome.selected_property_id",
          nextIds.join(",")
        );
      } catch {}
      // Recenter the map only when this toggle changed the primary
      // (the first id) — otherwise the map jumps surprisingly when
      // the user toggles a non-primary house in/out.
      const newPrimaryId = nextIds[0] ?? null;
      if (newPrimaryId !== primaryPropertyId && property.id === newPrimaryId) {
        if (property.latitude != null && property.longitude != null) {
          setRegion({
            latitude: property.latitude,
            longitude: property.longitude,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          });
          await loadCleanersAtPoint(property.latitude, property.longitude);
        }
      }
    },
    [selectedPropertyIds, primaryPropertyId]
  );

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
    // Multi-phase location strategy — fastest visible result wins:
    //
    // Phase A) AsyncStorage last-known region  → applied in <50ms (sync read)
    // Phase B) Location.getLastKnownPositionAsync (cached OS fix, ~0ms)
    // Phase C) Location.getCurrentPositionAsync  (precise, but 1-3s)
    // Phase D) DEFAULT_REGION (Rome) → only if GPS never available / denied
    //
    // Phases A and B run in parallel immediately after mount; C follows once
    // we know the permission is granted. The first valid non-Rome coordinate
    // wins for the initial search anchor. C updates the map when it resolves.
    (async () => {
      let searchLat = DEFAULT_REGION.latitude;
      let searchLng = DEFAULT_REGION.longitude;
      let gotRealPosition = false;

      // ── Phase A: AsyncStorage last-known (fastest) ──────────────────────
      // Read in parallel with the permission request so we don't block.
      const [cachedRaw, { status }] = await Promise.all([
        AsyncStorage.getItem(LAST_KNOWN_REGION_KEY).catch(() => null),
        Location.requestForegroundPermissionsAsync(),
      ]);

      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as Region;
          if (cached.latitude && cached.longitude) {
            setRegion(cached);
            searchLat = cached.latitude;
            searchLng = cached.longitude;
            gotRealPosition = true;
            // Kick off the search immediately with the cached position so
            // the user sees nearby cleaners before GPS even resolves.
            void loadCleanersAtPoint(searchLat, searchLng);
          }
        } catch {}
      }

      if (status !== "granted") {
        setGpsPermissionDenied(true);
        // If we have a cached region use it, otherwise fall back to Rome.
        if (!gotRealPosition) {
          await loadCleanersAtPoint(searchLat, searchLng);
        }
        return;
      }

      setGpsPermissionDenied(false);

      // ── Phase B: getLastKnownPositionAsync (near-instant OS cache) ──────
      if (!gotRealPosition) {
        try {
          const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: 60_000, // accept a fix up to 60s old
          });
          if (lastKnown) {
            const r: Region = {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
              latitudeDelta: 0.06,
              longitudeDelta: 0.06,
            };
            setRegion(r);
            persistRegion(r);
            searchLat = r.latitude;
            searchLng = r.longitude;
            gotRealPosition = true;
            void loadCleanersAtPoint(searchLat, searchLng);
          }
        } catch {}
      }

      // ── Phase C: getCurrentPositionAsync (precise, replaces B when ready)
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const r: Region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        };
        setRegion(r);
        persistRegion(r);
        // Only re-search if the position changed meaningfully (>~500m)
        // or we had no real position yet, to avoid a redundant API call.
        const latDiff = Math.abs(loc.coords.latitude - searchLat);
        const lngDiff = Math.abs(loc.coords.longitude - searchLng);
        if (!gotRealPosition || latDiff > 0.005 || lngDiff > 0.005) {
          await loadCleanersAtPoint(loc.coords.latitude, loc.coords.longitude);
        }
      } catch {
        // Phase C failed (timeout, etc.) — the Phase A/B result is already shown.
        if (!gotRealPosition) {
          // Nothing worked — use Rome fallback.
          await loadCleanersAtPoint(DEFAULT_REGION.latitude, DEFAULT_REGION.longitude);
        }
      }
    })();
  }, [loadCleanersAtPoint, persistRegion]);

  // ── Property-wins-over-GPS ─────────────────────────────────────────────────
  // Marketplace logic: if the client has a saved house, the cleaners shown
  // must be near that house — NOT where the phone is right now. (A client
  // in Sardegna with a house in Milano wants Milano cleaners, not Sardinian
  // ones.) This effect fires when the primary property resolves and shifts
  // the map + search anchor onto it, overriding the GPS-based initial load.
  // Manual city search (handleSearch) and direct toggle (handleToggleProperty)
  // remain authoritative — this only triggers when selectedProperty?.id
  // itself changes, so typing a city or panning the map does not re-snap.
  useEffect(() => {
    if (!selectedProperty) return;
    const { latitude, longitude } = selectedProperty;
    if (latitude == null || longitude == null) return;
    setRegion({
      latitude,
      longitude,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    });
    void loadCleanersAtPoint(latitude, longitude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty?.id]);

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

        {/* ── Client-owned property markers ── */}
        {/* Rendered AFTER the cleaner pins so they draw on top and are
            tappable even when overlapping. Private to the owning client
            via RLS. Tapping shows a quick action sheet that lets them
            either open the booking flow pre-filled or edit the house. */}
        {properties.map((p) => (
          <Marker
            key={`prop-${p.id}`}
            coordinate={{
              latitude: p.latitude as number,
              longitude: p.longitude as number,
            }}
            tracksViewChanges={false}
            onPress={() => {
              Alert.alert(
                p.name,
                p.address,
                [
                  { text: "Chiudi", style: "cancel" },
                  {
                    text: "Modifica casa",
                    onPress: () =>
                      router.push({
                        pathname: "/properties/edit",
                        params: { id: p.id },
                      }),
                  },
                ],
                { cancelable: true }
              );
            }}
          >
            <PropertyMarker isDefault={p.is_default} />
          </Marker>
        ))}
      </MapView>

      {/* ── Floating header pill (Stitch spec) ── */}
      {/* bg-white/80 backdrop-blur rounded-full mx-4 mt-4 shadow-2xl */}
      <Animated.View
        ref={searchBarRef}
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
            accessibilityLabel="Cerca città"
            accessibilityRole="button"
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
              placeholderTextColor="rgba(2,36,32,0.4)"
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

        {/* Right: clear (if text) + notification bell */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => handleSearch("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
          <NotificationBell color="#022420" size={36} />
        </View>
      </Animated.View>

      {/* ── Amazon-style property picker pill ── */}
      {/* Sits right under the search bar. Tapping opens a sheet with the
          full property list. */}
      {properties.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setPropertyPickerOpen(true)}
          style={{
            position: "absolute",
            top: insets.top + 72,
            left: 16,
            right: 16,
            zIndex: 19,
            backgroundColor: "#ffffff",
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            shadowColor: "#022420",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 10,
            borderWidth: 1,
            borderColor: "rgba(0, 107, 85, 0.10)",
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: "#fef3c7",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="home" size={18} color="#d97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 9,
                fontWeight: "800",
                color: "rgba(2,36,32,0.45)",
                letterSpacing: 1.3,
                textTransform: "uppercase",
                marginBottom: 1,
              }}
            >
              Pulisci a
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "800",
                color: "#022420",
                letterSpacing: -0.2,
              }}
              numberOfLines={1}
            >
              {selectedProperties.length === 0
                ? "Scegli una casa"
                : selectedProperties.length === 1
                ? selectedProperties[0].name
                : `${selectedProperties.length} case selezionate`}
            </Text>
            {selectedProperties.length === 1 && selectedProperties[0].address && (
              <Text
                style={{
                  fontSize: 11,
                  color: "rgba(2,36,32,0.55)",
                  marginTop: 1,
                }}
                numberOfLines={1}
              >
                {selectedProperties[0].address}
              </Text>
            )}
            {selectedProperties.length > 1 && (
              <Text
                style={{
                  fontSize: 11,
                  color: "rgba(2,36,32,0.55)",
                  marginTop: 1,
                }}
                numberOfLines={1}
              >
                {selectedProperties.map((p) => p.name).join(" · ")}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={18} color="#022420" />
        </TouchableOpacity>
      )}

      {/* ── Property picker modal sheet ── */}
      <Modal
        visible={propertyPickerOpen}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setPropertyPickerOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(2, 36, 32, 0.4)",
            justifyContent: "flex-end",
          }}
          onPress={() => setPropertyPickerOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#ffffff",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 12,
              paddingBottom: 32 + insets.bottom,
              maxHeight: "80%",
            }}
          >
            {/* drag handle */}
            <View
              style={{
                alignSelf: "center",
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#d4e4e0",
                marginBottom: 12,
              }}
            />
            <View
              style={{
                paddingHorizontal: 24,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "900",
                  color: "#022420",
                  letterSpacing: -0.4,
                }}
              >
                Dove vuoi pulire?
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: "rgba(2,36,32,0.6)",
                  lineHeight: 18,
                }}
              >
                Scegli una delle tue case. La mappa cerca i pulitori vicini
                e la prenotazione si aggancia a questa proprietà.
              </Text>
            </View>
            <ScrollView
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {properties.map((p) => {
                const selected = selectedPropertyIds.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => handleToggleProperty(p)}
                    style={({ pressed }) => [
                      {
                        borderRadius: 18,
                        marginBottom: 10,
                        backgroundColor: selected ? "#e8fdf7" : "#f6faf9",
                        borderWidth: 1.5,
                        borderColor: selected
                          ? "#006b55"
                          : "rgba(193,200,197,0.3)",
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    {/* Inner View owns the row layout — iOS-safe pattern */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 14,
                      }}
                    >
                      {/* Left: house icon — fixed 48×48, no flex */}
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          backgroundColor: "#fef3c7",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        <Ionicons name="home" size={22} color="#d97706" />
                      </View>

                      {/* Center: text content — flex:1 absorbs remaining space */}
                      <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flexWrap: "nowrap",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "800",
                              color: "#022420",
                              flexShrink: 1,
                            }}
                            numberOfLines={1}
                          >
                            {p.name}
                          </Text>
                          {p.is_default && (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 7,
                                paddingVertical: 2,
                                borderRadius: 999,
                                backgroundColor: "#fef3c7",
                                marginLeft: 6,
                              }}
                            >
                              <Ionicons name="star" size={9} color="#d97706" />
                              <Text
                                style={{
                                  fontSize: 9,
                                  fontWeight: "900",
                                  color: "#d97706",
                                  letterSpacing: 0.4,
                                  textTransform: "uppercase",
                                  marginLeft: 3,
                                }}
                              >
                                Predefinita
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={{
                            marginTop: 3,
                            fontSize: 12,
                            color: "rgba(2,36,32,0.6)",
                            lineHeight: 16,
                          }}
                          numberOfLines={1}
                        >
                          {p.address}
                        </Text>
                        <Text
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: "rgba(2,36,32,0.45)",
                          }}
                        >
                          {p.num_rooms} {p.num_rooms === 1 ? "stanza" : "stanze"}
                          {p.sqm ? `  ·  ${p.sqm} m²` : ""}
                        </Text>
                      </View>

                      {/* Right: switch — fixed width column, never squeezed */}
                      <View style={{ width: 52, alignItems: "center" }}>
                        <Switch
                          value={selected}
                          onValueChange={() => handleToggleProperty(p)}
                          trackColor={{ false: "#d4e4e0", true: "#006b55" }}
                          thumbColor="#ffffff"
                          ios_backgroundColor="#d4e4e0"
                        />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Add new house button — uses the multi-step wizard */}
            <Pressable
              onPress={() => {
                setPropertyPickerOpen(false);
                router.push("/properties/new");
              }}
              style={({ pressed }) => [
                {
                  marginHorizontal: 20,
                  marginTop: 8,
                  paddingVertical: 14,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: "#d4e4e0",
                  borderStyle: "dashed",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Ionicons name="add-circle-outline" size={18} color="#006b55" />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: "#006b55",
                }}
              >
                Aggiungi una casa
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── My location button ── */}
      <TouchableOpacity
        accessibilityLabel="La mia posizione"
        accessibilityRole="button"
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
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            setGpsPermissionDenied(true);
            return;
          }
          setGpsPermissionDenied(false);
          try {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            const newRegion: Region = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            };
            setRegion(newRegion);
            persistRegion(newRegion);
            mapRef.current?.animateToRegion(newRegion, 400);
          } catch {}
        }}
      >
        <Ionicons name="navigate" size={20} color={Colors.secondary} />
      </TouchableOpacity>

      {/* ── GPS permission denied banner ── */}
      {gpsPermissionDenied && (
        <Pressable
          onPress={() => Linking.openSettings()}
          style={{
            position: "absolute",
            bottom: CAROUSEL_BOTTOM + 12,
            left: 16,
            right: 16,
            zIndex: 20,
            backgroundColor: "#022420",
            borderRadius: 14,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            gap: 12,
            shadowColor: "#022420",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.14,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Ionicons name="location-outline" size={20} color="#ffffff" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
              Attiva GPS per vedere i cleaner vicini
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 2 }}>
              Tocca per aprire le Impostazioni
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
        </Pressable>
      )}

      {/* ── Ghost Views for tab bar measurement ──────────────────────────────
          These transparent Views are positioned exactly over the tab bar
          buttons (Prenotazioni = tab index 2, Profilo = tab index 3).
          Tab bar: height 88 iOS / 68 Android, paddingHorizontal 8.
          Each of the 4 tabs occupies (SW - 16) / 4 width.
          We use pointerEvents="none" so they never steal touches.      ── */}
      {(() => {
        const tabBarHeight = Platform.OS === "ios" ? 88 : 68;
        const tabBarTop = SH - tabBarHeight;
        const tabW = (SW - 16) / 4; // tabBar paddingHorizontal: 8 on each side
        const tabLeft = (idx: number) => 8 + tabW * idx;
        return (
          <>
            <View
              ref={bookingsTabRef}
              pointerEvents="none"
              style={{
                position: "absolute",
                top: tabBarTop,
                left: tabLeft(2),
                width: tabW,
                height: tabBarHeight,
              }}
            />
            <View
              ref={profileTabRef}
              pointerEvents="none"
              style={{
                position: "absolute",
                top: tabBarTop,
                left: tabLeft(3),
                width: tabW,
                height: tabBarHeight,
              }}
            />
          </>
        );
      })()}

      {/* ── Coach mark first-run overlay ── */}
      {showCoachMarks && coachSteps.length >= 1 && (
        <CoachMarkOverlay
          steps={coachSteps}
          storageKey="cleanhome.first_run_tour_done"
          onDone={handleCoachMarkDone}
        />
      )}

      {/* ── Bottom carousel ── */}
      {/* pointerEvents="box-none" lets the map receive drag/pan gestures in
          the empty space around the cards (e.g. to the right of the visible
          card). Without this the absolute full-width container swallows every
          touch in the bottom region even where it looks empty. */}
      <View
        pointerEvents="box-none"
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
                shadowColor: "#022420",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
                elevation: 4,
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
              onPress={() =>
                loadCleanersAtPoint(region.latitude, region.longitude)
              }
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
                Cerca in questa zona
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Cleaner cards carousel
          // pointerEvents="box-none" ensures the FlatList scroll container does
          // not swallow touches in the empty horizontal space to the right of
          // the last visible card. Touches on actual card children still work
          // because box-none only suppresses self-hit-testing, not children.
          <FlatList
            ref={flatListRef}
            data={cleaners}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_GAP}
            snapToAlignment="start"
            decelerationRate="fast"
            pointerEvents="box-none"
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
