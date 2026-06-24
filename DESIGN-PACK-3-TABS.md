# CleanHome — Pack 3 — Tabs principali (Home, Profile, Bookings, Messages, Notifications)

Stack: React Native + Expo Router v3 + NativeWind + TypeScript
Vedi DESIGN-AUDIT-README.md per il contesto completo.

---

### `app/(tabs)/_layout.tsx`

```tsx
import { withLayoutContext } from "expo-router";
import { createNativeBottomTabNavigator } from "@bottom-tabs/react-navigation";
import { useAuth } from "../../lib/auth";

const { Navigator } = createNativeBottomTabNavigator();
const Tabs = withLayoutContext(Navigator);

const CLIENT_ACTIVE = "#006b55";
const CLEANER_ACTIVE = "#6f4627";

export default function TabsLayout() {
  const { profile } = useAuth();
  const isCleaner = profile?.active_role === "cleaner";

  // Naming convention from CLAUDE.md is intentionally inverted: cleaner mode
  // shows the "client" tint colors (verde) and vice versa. Don't "fix".
  const activeTint = isCleaner ? CLIENT_ACTIVE : CLEANER_ACTIVE;

  const UNREAD_NOTIFICATIONS = 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeTint,
      }}
    >
      <Tabs.Screen
        name={isCleaner ? "cleaner-home" : "home"}
        options={{
          title: isCleaner ? "Lavori" : "Esplora",
          tabBarIcon: () => ({
            sfSymbol: isCleaner ? "briefcase" : "map",
          }),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: isCleaner ? "Messaggi" : "Chat",
          tabBarIcon: () => ({ sfSymbol: "bubble.left.and.bubble.right" }),
          tabBarBadge:
            UNREAD_NOTIFICATIONS > 0 ? String(UNREAD_NOTIFICATIONS) : undefined,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: isCleaner ? "Incarichi" : "Prenotazioni",
          tabBarIcon: () => ({ sfSymbol: "doc.text" }),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profilo",
          tabBarIcon: () => ({ sfSymbol: "person" }),
        }}
      />
      <Tabs.Screen name="notifications" options={{ tabBarItemHidden: true }} />
      <Tabs.Screen
        name={isCleaner ? "home" : "cleaner-home"}
        options={{ tabBarItemHidden: true }}
      />
    </Tabs>
  );
}
```

---

### `app/(tabs)/home.tsx`

```tsx
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
```

---

### `app/(tabs)/cleaner-home.tsx`

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StatusBar,
  StyleSheet,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../lib/auth";
import CoachMarkOverlay, {
  CoachMarkStep,
} from "../../components/CoachMarks/CoachMarkOverlay";
import { START_TOUR_KEY } from "../(auth)/welcome-rocket";

const { width: SW, height: SH } = Dimensions.get("window");
import {
  fetchBookings,
  fetchPendingOffersForCleaner,
  cleanerOfferAction,
  subscribeToCleanerOffers,
} from "../../lib/api";
import {
  NotificationMessages,
  sendPushNotification,
} from "../../lib/notifications";
import { Booking, BookingOffer } from "../../lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCountdown } from "../../lib/hooks/useCountdown";
import { measureInWindow } from "../../lib/measureInWindow";
import { NotificationBell } from "../../components/NotificationBell";

// ─── Design tokens ────────────────────────────────────────────────────────────

const PRIMARY = "#006b55";
const PRIMARY_CONTAINER = "#022420";
const ON_SURFACE = "#181c1c";
const ON_SURFACE_VARIANT = "#414846";
const SURFACE = "#f6faf9";
const SURFACE_LOW = "#f0f4f3";
const OUTLINE = "#717976";
const CLEANER_LIGHT = "#e6f4f1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IT_DAY_ABBREV = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

function formatBookingDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${IT_DAY_ABBREV[d.getDay()]} ${d.getDate()}`;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  value: number;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
}

function StatCard({ value, label, iconName, iconColor, iconBg }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Request card — riceve un Booking direttamente ────────────────────────────

interface RequestCardProps {
  booking: Booking;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

function RequestCard({ booking, onAccept, onDecline }: RequestCardProps) {
  const handleAccept = useCallback(
    () => onAccept(booking.id),
    [booking.id, onAccept]
  );
  const handleDecline = useCallback(
    () => onDecline(booking.id),
    [booking.id, onDecline]
  );

  const dateLabel = formatBookingDate(booking.date);

  return (
    <View style={styles.requestCard}>
      {/* Top row: avatar + address/service + date/time */}
      <View style={styles.requestTop}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={20} color={OUTLINE} />
        </View>
        <View style={styles.requestInfo}>
          <Text style={styles.requestName} numberOfLines={1}>
            {booking.address
              ? `Prenotazione · ${booking.address}`
              : "Nuova prenotazione"}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={12} color={OUTLINE} />
            <Text style={styles.locationText} numberOfLines={1}>
              {booking.address ?? "Indirizzo non specificato"}
            </Text>
          </View>
        </View>
        <View style={styles.requestTimeWrap}>
          <Text style={styles.requestDate}>{dateLabel}</Text>
          <Text style={styles.requestTime}>{booking.time_slot}</Text>
        </View>
      </View>

      {/* Service badge */}
      <View style={styles.serviceBadgeRow}>
        <View style={styles.serviceBadge}>
          <Text style={styles.serviceBadgeText}>{booking.service_type}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            styles.btnDecline,
            pressed && { opacity: 0.75 },
          ]}
          onPress={handleDecline}
          accessibilityLabel={`Rifiuta prenotazione del ${dateLabel}`}
          accessibilityRole="button"
        >
          <Text style={styles.btnDeclineText}>Rifiuta</Text>
        </Pressable>
        <View style={styles.btnAccept}>
          <Pressable
            onPress={handleAccept}
            accessibilityLabel={`Accetta prenotazione del ${dateLabel}`}
            accessibilityRole="button"
            android_ripple={{ color: "rgba(255,255,255,0.18)" }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 13,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={styles.btnAcceptText}>Accetta</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Appointment row — riceve un Booking direttamente ────────────────────────

interface AppointmentRowProps {
  booking: Booking;
  onPress: () => void;
}

function AppointmentRow({ booking, onPress }: AppointmentRowProps) {
  const d = new Date(booking.date);
  const dayAbbrev = IT_DAY_ABBREV[d.getDay()];
  const dayNum = d.getDate();
  const title = `${booking.address ?? "Cliente"} — ${booking.service_type}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Prenotazione del ${dayAbbrev} ${dayNum}, ${title}`}
      style={({ pressed }) => [styles.appointmentRow, pressed && { opacity: 0.7 }]}
    >
      {/* Date card */}
      <View style={styles.appointmentDateCard}>
        <Text style={styles.appointmentDayAbbrev}>{dayAbbrev}</Text>
        <Text style={styles.appointmentDayNum}>{dayNum}</Text>
      </View>

      {/* Body */}
      <View style={styles.appointmentBody}>
        <Text style={styles.appointmentTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.appointmentTime}>{booking.time_slot}</Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={`${ON_SURFACE_VARIANT}66`}
      />
    </Pressable>
  );
}

// ─── Offer countdown pill ────────────────────────────────────────────────────

function CountdownPill({ expiresAt }: { expiresAt: string }) {
  const cd = useCountdown(expiresAt);
  return (
    <View
      style={[
        offerStyles.pill,
        cd.hours === 0 && cd.minutes < 30 ? offerStyles.pillUrgent : null,
      ]}
    >
      <Ionicons name="timer-outline" size={12} color={cd.hours === 0 && cd.minutes < 30 ? "#dc2626" : OUTLINE} />
      <Text style={[offerStyles.pillText, cd.hours === 0 && cd.minutes < 30 && { color: "#dc2626" }]}>
        {cd.formatted}
      </Text>
    </View>
  );
}

// ─── Offer card ───────────────────────────────────────────────────────────────

interface OfferCardProps {
  offer: BookingOffer;
  onAccept: (bookingId: string) => void;
  onDecline: (bookingId: string) => void;
}

function OfferCard({ offer, onAccept, onDecline }: OfferCardProps) {
  const booking = offer.booking;
  const handleAccept = useCallback(() => onAccept(offer.booking_id), [offer.booking_id, onAccept]);
  const handleDecline = useCallback(() => onDecline(offer.booking_id), [offer.booking_id, onDecline]);

  if (!booking) return null;

  const dateLabel = formatBookingDate(booking.date);
  const netEarnings = booking.base_price - (booking.cleaner_fee ?? 0);

  return (
    <View style={offerStyles.card}>
      {/* Header row */}
      <View style={offerStyles.cardHeader}>
        <View style={offerStyles.avatarCircle}>
          <Ionicons name="flash" size={18} color={PRIMARY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={offerStyles.cardTitle}>Nuova richiesta dispatch</Text>
          <Text style={offerStyles.cardSub} numberOfLines={1}>
            {booking.address ?? "Indirizzo non specificato"}
          </Text>
        </View>
        <CountdownPill expiresAt={offer.expires_at} />
      </View>

      {/* Details row */}
      <View style={offerStyles.detailRow}>
        <View style={offerStyles.detailItem}>
          <Ionicons name="calendar-outline" size={14} color={OUTLINE} />
          <Text style={offerStyles.detailText}>{dateLabel}</Text>
        </View>
        <View style={offerStyles.detailItem}>
          <Ionicons name="time-outline" size={14} color={OUTLINE} />
          <Text style={offerStyles.detailText}>{booking.time_slot}</Text>
        </View>
        <View style={[offerStyles.detailItem, offerStyles.earningsBadge]}>
          <Ionicons name="cash-outline" size={14} color={PRIMARY} />
          <Text style={[offerStyles.detailText, { color: PRIMARY, fontWeight: "700" }]}>
            €{netEarnings.toFixed(0)}
          </Text>
        </View>
      </View>

      {/* Service badge */}
      <View style={{ flexDirection: "row" }}>
        <View style={styles.serviceBadge}>
          <Text style={styles.serviceBadgeText}>{booking.service_type}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.btnDecline, pressed && { opacity: 0.75 }]}
          onPress={handleDecline}
          accessibilityLabel="Rifiuta offerta"
          accessibilityRole="button"
        >
          <Text style={styles.btnDeclineText}>Rifiuta</Text>
        </Pressable>
        <View style={styles.btnAccept}>
          <Pressable
            onPress={handleAccept}
            accessibilityLabel="Accetta offerta"
            accessibilityRole="button"
            android_ripple={{ color: "rgba(255,255,255,0.18)" }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 13,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={styles.btnAcceptText}>Accetta</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const offerStyles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: PRIMARY_CONTAINER,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    gap: 14,
    borderWidth: 1,
    borderColor: "#e0f0ed",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CLEANER_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: ON_SURFACE,
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 12,
    color: ON_SURFACE_VARIANT,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: SURFACE_LOW,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillUrgent: {
    backgroundColor: "#fee2e2",
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
    color: OUTLINE,
  },
  detailRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: ON_SURFACE_VARIANT,
    fontWeight: "500",
  },
  earningsBadge: {
    backgroundColor: CLEANER_LIGHT,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CleanerHomeScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pendingOffers, setPendingOffers] = useState<BookingOffer[]>([]);
  const offerChannelRef = useRef<RealtimeChannel | null>(null);

  // ── Coach marks ────────────────────────────────────────────────────────────
  const [showCoachMarks, setShowCoachMarks] = useState(false);
  const [coachSteps, setCoachSteps] = useState<CoachMarkStep[]>([]);

  // Refs for screen-absolute measurement via measureInWindow
  const requestsSectionRef = useRef<View>(null);
  const calendarSectionRef = useRef<View>(null);
  const profileTabRef = useRef<View>(null);

  // On focus: check if the welcome modal set the START_TOUR_KEY.
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

  // Coach mark for CLEANER — only one step now (requests section). The
  // profile-completion banner was removed, so its measurement target is
  // gone too.
  useEffect(() => {
    if (!showCoachMarks) return;
    const timer = setTimeout(async () => {
      const requestsRect = await measureInWindow(requestsSectionRef);
      const steps: CoachMarkStep[] = [];
      if (requestsRect) {
        steps.push({
          rect: requestsRect,
          title: "Verifica la tua identita",
          description:
            "Carica i tuoi documenti per ottenere il badge verificato e ricevere piu richieste dai clienti.",
        });
      }
      if (steps.length >= 1) setCoachSteps(steps);
    }, 400);
    return () => clearTimeout(timer);
  }, [showCoachMarks]);

  const handleCoachMarkDone = useCallback(() => {
    setShowCoachMarks(false);
  }, []);

  const firstName =
    profile?.full_name?.split(" ")[0] ??
    user?.user_metadata?.full_name?.split(" ")[0] ??
    "Professionista";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";

  const loadBookings = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchBookings(user.id, "cleaner");
      setBookings(data);
    } catch {
      setBookings([]);
    }
  }, [user]);

  const loadOffers = useCallback(async () => {
    if (!user) return;
    try {
      const offers = await fetchPendingOffersForCleaner(user.id);
      setPendingOffers(offers);
    } catch {
      setPendingOffers([]);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
      loadOffers();
    }, [loadBookings, loadOffers])
  );

  // Realtime: quando un'offerta viene cancellata (altro cleaner ha vinto),
  // rimuoviamola dalla lista senza ricaricare tutto
  useEffect(() => {
    if (!user) return;
    offerChannelRef.current = subscribeToCleanerOffers(user.id, (updatedOffer) => {
      if (updatedOffer.status === "cancelled" || updatedOffer.status === "expired") {
        setPendingOffers((prev) => prev.filter((o) => o.id !== updatedOffer.id));
      } else if (updatedOffer.status === "pending") {
        // new offer arrived — reload full list to get booking join data
        loadOffers();
      }
    });
    return () => {
      offerChannelRef.current?.unsubscribe();
    };
  }, [user, loadOffers]);

  const pendingBookings = useMemo(
    () => bookings.filter((b) => b.status === "pending" && !!b.cleaner_id),
    [bookings]
  );

  const upcomingBookings = useMemo(
    () =>
      bookings
        .filter((b) => ["accepted", "work_done"].includes(b.status))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3),
    [bookings]
  );

  const stats = useMemo(
    () => ({
      inAttesa: pendingBookings.length + pendingOffers.length,
      attive: bookings.filter((b) =>
        ["accepted", "work_done"].includes(b.status)
      ).length,
      completate: bookings.filter((b) => b.status === "completed").length,
    }),
    [bookings]
  );

  // Legacy single-cleaner accept (still uses stripe-booking-action with action="accept")
  const handleAccept = useCallback(
    async (id: string) => {
      try {
        const result = await cleanerOfferAction(id, "accept");
        if (!result.ok && result.error === "already_taken") {
          Alert.alert("Non disponibile", "Questa prenotazione non è più disponibile.");
          loadBookings();
          return;
        }
        Alert.alert("Accettato", "Il lavoro è stato aggiunto ai tuoi impegni");
        const booking = bookings.find((b) => b.id === id);
        if (booking) {
          const { title, body } = NotificationMessages.bookingAccepted(
            profile?.full_name ?? "Il professionista"
          );
          sendPushNotification(booking.client_id, title, body, {
            screen: "bookings",
            bookingId: id,
          }).catch(() => {});
        }
        loadBookings();
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Impossibile accettare la richiesta";
        Alert.alert("Errore", msg);
      }
    },
    [bookings, profile?.full_name, loadBookings]
  );

  const handleDecline = useCallback(
    (id: string) => {
      Alert.alert(
        "Rifiutare lavoro?",
        "Il cliente verrà rimborsato automaticamente e potrà scegliere un altro professionista.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Rifiuta",
            style: "destructive",
            onPress: async () => {
              try {
                await cleanerOfferAction(id, "decline");
                setPendingOffers((prev) => prev.filter((o) => o.booking_id !== id));
              } catch (err: unknown) {
                const msg =
                  err instanceof Error ? err.message : "Impossibile rifiutare";
                Alert.alert("Errore", msg);
              }
            },
          },
        ]
      );
    },
    []
  );

  const handleOfferAccept = useCallback(
    async (bookingId: string) => {
      try {
        const result = await cleanerOfferAction(bookingId, "accept");
        if (!result.ok && result.error === "already_taken") {
          Alert.alert(
            "Richiesta già presa",
            "Un altro professionista ha già accettato. Niente paura, arrivano altre richieste!"
          );
          setPendingOffers((prev) => prev.filter((o) => o.booking_id !== bookingId));
          return;
        }
        const offer = pendingOffers.find((o) => o.booking_id === bookingId);
        if (offer?.booking) {
          const { title, body } = NotificationMessages.bookingAccepted(
            profile?.full_name ?? "Il professionista"
          );
          sendPushNotification(offer.booking.client_id, title, body, {
            screen: "bookings",
            bookingId,
          }).catch(() => {});
        }
        setPendingOffers((prev) => prev.filter((o) => o.booking_id !== bookingId));
        loadBookings();
        router.push(`/booking/${bookingId}` as never);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Impossibile accettare";
        Alert.alert("Errore", msg);
      }
    },
    [pendingOffers, profile?.full_name, loadBookings, router]
  );

  const handleOfferDecline = useCallback(
    (bookingId: string) => {
      Alert.alert(
        "Rifiutare questa richiesta?",
        "Verranno contattati altri professionisti nella tua zona.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Rifiuta",
            style: "destructive",
            onPress: async () => {
              try {
                await cleanerOfferAction(bookingId, "decline");
                setPendingOffers((prev) =>
                  prev.filter((o) => o.booking_id !== bookingId)
                );
              } catch (err: unknown) {
                const msg =
                  err instanceof Error ? err.message : "Impossibile rifiutare";
                Alert.alert("Errore", msg);
              }
            },
          },
        ]
      );
    },
    []
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Image
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                source={require("../../assets/icon.png")}
                style={{ width: 22, height: 22, borderRadius: 6 }}
              />
              <Text style={styles.brandLogo}>CleanHome</Text>
            </View>
            <NotificationBell color={PRIMARY_CONTAINER} />
          </View>
          <Text style={styles.greeting}>
            {greeting}, {firstName}
          </Text>
          <Text style={styles.greetingSub}>La tua giornata</Text>
        </View>

        {/* ── Stats grid ── */}
        <View style={styles.statsRow}>
          <StatCard
            value={stats.inAttesa}
            label="In attesa"
            iconName="alert-circle-outline"
            iconColor="#006b55"
            iconBg="#e6f4f1"
          />
          <StatCard
            value={stats.attive}
            label="Attive"
            iconName="calendar-outline"
            iconColor={PRIMARY}
            iconBg={CLEANER_LIGHT}
          />
          <StatCard
            value={stats.completate}
            label="Completate"
            iconName="checkmark-circle-outline"
            iconColor="#16a34a"
            iconBg="#f0fdf4"
          />
        </View>

        {/* ── Richieste in arrivo ── */}
        <View
          ref={requestsSectionRef}
          style={styles.sectionHeader}
        >
          <Text style={styles.sectionTitle}>Richieste in arrivo</Text>
          <Pressable
            onPress={() => router.push("/cleaner/jobs" as never)}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            accessibilityLabel="Vedi tutte le richieste"
            accessibilityRole="button"
          >
            <View style={styles.sectionLinkRow}>
              <Text style={styles.sectionLink}>Vedi tutte</Text>
              <Ionicons name="arrow-forward" size={14} color={PRIMARY} />
            </View>
          </Pressable>
        </View>

        {/* Offerte dispatch (nuove) */}
        {pendingOffers.map((offer) => (
          <View key={offer.id} style={styles.cardWrapper}>
            <OfferCard
              offer={offer}
              onAccept={handleOfferAccept}
              onDecline={handleOfferDecline}
            />
          </View>
        ))}

        {/* Prenotazioni legacy single-cleaner */}
        {pendingBookings.map((booking) => (
          <View key={booking.id} style={styles.cardWrapper}>
            <RequestCard
              booking={booking}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          </View>
        ))}

        {pendingBookings.length === 0 && pendingOffers.length === 0 && (
          <View style={styles.emptyBlock}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="mail-open-outline" size={26} color={PRIMARY} />
            </View>
            <Text style={styles.emptyText}>Nessuna richiesta in attesa</Text>
            <Text style={styles.emptySubtext}>
              Le nuove richieste appariranno qui in tempo reale
            </Text>
            <Pressable
              onPress={() => router.push("/listing" as never)}
              style={({ pressed }) => [styles.emptyCtaBtn, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <Ionicons name="add-circle-outline" size={16} color="#ffffff" />
              <Text style={styles.emptyCtaText}>Crea un annuncio</Text>
            </Pressable>
          </View>
        )}

        {/* ── Prossimi appuntamenti ── */}
        <View
          ref={calendarSectionRef}
          style={styles.sectionHeader}
        >
          <Text style={styles.sectionTitle}>Prossimi appuntamenti</Text>
        </View>

        {upcomingBookings.length === 0 ? (
          <View style={styles.emptyBlock}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="calendar-outline" size={26} color={PRIMARY} />
            </View>
            <Text style={styles.emptyText}>Nessun appuntamento in programma</Text>
            <Text style={styles.emptySubtext}>
              Accetta una richiesta per vederla qui nel tuo calendario
            </Text>
            <Pressable
              onPress={() => router.push("/cleaner/jobs" as never)}
              style={({ pressed }) => [styles.emptyCtaBtn, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <Ionicons name="briefcase-outline" size={16} color="#ffffff" />
              <Text style={styles.emptyCtaText}>Vedi tutti i lavori</Text>
            </Pressable>
          </View>
        ) : (
          upcomingBookings.map((booking) => (
            <View key={booking.id} style={styles.cardWrapper}>
              <AppointmentRow
                booking={booking}
                onPress={() => router.push(`/booking/${booking.id}` as never)}
              />
            </View>
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ── Ghost View for profile tab measurement ───────────────────────────
          Transparent, non-interactive View positioned over the Profilo tab
          (index 3 of 4). Tab bar: height 88 iOS / 68 Android, paddingH 8.
          Each tab width = (SW - 16) / 4.                               ── */}
      {(() => {
        const tabBarHeight = Platform.OS === "ios" ? 88 : 68;
        const tabBarTop = SH - tabBarHeight;
        const tabW = (SW - 16) / 4;
        const tabLeft = 8 + tabW * 3; // Profilo = index 3
        return (
          <View
            ref={profileTabRef}
            pointerEvents="none"
            style={{
              position: "absolute",
              top: tabBarTop,
              left: tabLeft,
              width: tabW,
              height: tabBarHeight,
            }}
          />
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
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SURFACE,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  bottomSpacer: {
    height: 40,
  },
  emptyBlock: {
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 24,
    backgroundColor: "#fff",
    borderRadius: 20,
    alignItems: "center",
    gap: 8,
    shadowColor: PRIMARY_CONTAINER,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: CLEANER_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "700",
    color: ON_SURFACE,
    textAlign: "center",
    marginTop: 2,
  },
  emptySubtext: {
    fontSize: 12,
    color: ON_SURFACE_VARIANT,
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 8,
  },
  emptyCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PRIMARY_CONTAINER,
    borderRadius: 9999,
    paddingVertical: 11,
    paddingHorizontal: 20,
    marginTop: 8,
    shadowColor: PRIMARY_CONTAINER,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyCtaText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.1,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: "rgba(246,250,249,0.9)",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  brandLogo: {
    fontSize: 20,
    fontWeight: "700",
    fontStyle: "italic",
    color: "#181c1c",
    letterSpacing: -0.3,
  },
  avatarPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CLEANER_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: CLEANER_LIGHT,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    color: ON_SURFACE,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  greetingSub: {
    fontSize: 14,
    fontWeight: "500",
    color: ON_SURFACE_VARIANT,
    opacity: 0.7,
  },

  // ── Stats row ─────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: "center",
    shadowColor: "rgba(0,107,85,0.06)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: ON_SURFACE,
    letterSpacing: -0.8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: ON_SURFACE_VARIANT,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "center",
  },

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: ON_SURFACE,
    letterSpacing: -0.3,
  },
  sectionLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY,
  },

  // ── Card wrapper ──────────────────────────────────────────────────────────
  cardWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },

  // ── Request card ──────────────────────────────────────────────────────────
  requestCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: PRIMARY_CONTAINER,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
    gap: 14,
  },
  requestTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: CLEANER_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 15,
    fontWeight: "700",
    color: ON_SURFACE,
    marginBottom: 3,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    color: ON_SURFACE_VARIANT,
    flex: 1,
  },
  requestTimeWrap: {
    alignItems: "flex-end",
  },
  requestDate: {
    fontSize: 12,
    fontWeight: "600",
    color: ON_SURFACE,
    marginBottom: 2,
  },
  requestTime: {
    fontSize: 12,
    fontWeight: "500",
    color: ON_SURFACE_VARIANT,
  },
  serviceBadgeRow: {
    flexDirection: "row",
  },
  serviceBadge: {
    backgroundColor: CLEANER_LIGHT,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  serviceBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 4,
  },
  btnDecline: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: OUTLINE,
    backgroundColor: "transparent",
  },
  btnDeclineText: {
    fontSize: 14,
    fontWeight: "700",
    color: PRIMARY,
  },
  btnAccept: {
    flex: 1,
    borderRadius: 9999,
    backgroundColor: PRIMARY_CONTAINER,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  btnAcceptText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },

  // ── Appointment row ───────────────────────────────────────────────────────
  appointmentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE_LOW,
    borderRadius: 20,
    padding: 16,
    gap: 16,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  appointmentDateCard: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  appointmentDayAbbrev: {
    fontSize: 10,
    fontWeight: "700",
    color: PRIMARY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  appointmentDayNum: {
    fontSize: 20,
    fontWeight: "700",
    color: ON_SURFACE,
    lineHeight: 24,
  },
  appointmentBody: {
    flex: 1,
  },
  appointmentTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: ON_SURFACE,
    marginBottom: 3,
  },
  appointmentTime: {
    fontSize: 12,
    color: ON_SURFACE_VARIANT,
  },
});
```

---

### `app/(tabs)/bookings.tsx`

```tsx
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Alert,
  Dimensions,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
  useAnimatedScrollHandler,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import LottieView from "lottie-react-native";
import { useAuth } from "../../lib/auth";
import { fetchBookings, updateBookingStatus } from "../../lib/api";
import { sendPushNotification } from "../../lib/notifications";
import { Booking } from "../../lib/types";
import { NotificationBell } from "../../components/NotificationBell";

// ─── Static design tokens (non-role-specific) ────────────────────────────────

const C = {
  background: "#f6faf9",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outlineVariant: "#c1c8c5",
  outline: "#717976",
  amber50: "#fffbeb",
  amber700: "#b45309",
  green100: "#dcfce7",
  green700: "#15803d",
  error: "#ba1a1a",
} as const;

// ─── Role-based theme tokens ──────────────────────────────────────────────────

// CLEANER mode: dark forest green
const CLEANER_THEME = {
  primary: "#022420",
  primaryContainer: "#1a3a35",
  secondary: "#006b55",
  secondaryContainer: "#82f4d1",
  avatarFallbackText: "#abcec6",
  serviceTagBg: "#82f4d14D",
  confirmWorkBg: "#006b55",
  backgroundTint: "#f6faf9",
} as const;

// CLIENT mode: warm terra / amber — consistent with profile.tsx ClientView
const CLIENT_THEME = {
  primary: "#8B5E3C",
  primaryContainer: "#5C3D24",
  secondary: "#C2410C",
  secondaryContainer: "#F5EBE0",
  avatarFallbackText: "#ffffff",
  serviceTagBg: "#F5EBE04D",
  confirmWorkBg: "#C2410C",
  backgroundTint: "#fdf8f4",
} as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 220;
const SEPARATOR_HEIGHT = 16;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const FILTERS = [
  { key: "all", label: "Tutte" },
  { key: "pending", label: "In attesa" },
  { key: "accepted", label: "Attive" },
  { key: "completed", label: "Completate" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

// Spring configs
const SPRING_SNAPPY = { damping: 18, stiffness: 200, mass: 0.8 };
const SPRING_GENTLE = { damping: 22, stiffness: 160, mass: 1 };
const SPRING_BADGE = { damping: 12, stiffness: 280, mass: 0.6 };
const TIMING_PILL = { duration: 240, easing: Easing.bezier(0.34, 1.56, 0.64, 1) };

// ─── Status config (semantic — never role-tinted) ────────────────────────────

interface StatusConfig {
  label: string;
  textColor: string;
  bgColor: string;
}

function getStatusConfig(status: string): StatusConfig {
  switch (status) {
    case "pending":
      return { label: "In attesa", textColor: C.amber700, bgColor: C.amber50 };
    case "accepted":
      // "ACCETTATA" uses the secondary role color — injected via prop
      return { label: "ACCETTATA", textColor: "ROLE", bgColor: "#e6f9f4" };
    case "work_done":
      return { label: "DA CONFERMARE", textColor: C.amber700, bgColor: C.amber50 };
    case "completed":
      return { label: "COMPLETATA", textColor: C.green700, bgColor: C.green100 };
    case "declined":
      return { label: "RIFIUTATA", textColor: "#b3261e", bgColor: "#fee2e2" };
    case "cancelled":
    case "auto_cancelled":
      return { label: "ANNULLATA", textColor: C.outline, bgColor: C.surfaceLow };
    case "disputed":
      return { label: "CONTESTATA", textColor: "#b3261e", bgColor: "#fee2e2" };
    default:
      return { label: status.toUpperCase(), textColor: C.outline, bgColor: C.surfaceLow };
  }
}

function getServiceLabel(serviceType: string): string {
  const upper = serviceType.toUpperCase();
  return upper.length > 20 ? upper.slice(0, 18) + "…" : upper;
}

// ─── Animated CTA button — pulse glow on idle ────────────────────────────────

interface AnimatedCTAProps {
  onPress: () => void;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  primaryColor: string;
}

function AnimatedCTA({ onPress, label, icon, accessibilityLabel, primaryColor }: AnimatedCTAProps) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.35);
  const isPressing = useRef(false);

  // Pulse glow: shadow opacity cycles 0.35 → 0.7 → 0.35 every ~2s
  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(glowOpacity);
    };
  }, [glowOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Shadow wrapper — animates opacity independently
  const shadowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  const handlePressIn = () => {
    isPressing.current = true;
    cancelAnimation(glowOpacity);
    glowOpacity.value = 0.2;
    scale.value = withSpring(0.96, SPRING_SNAPPY);
  };

  const handlePressOut = () => {
    isPressing.current = false;
    scale.value = withSpring(1, SPRING_GENTLE);
    // Resume glow after press
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  };

  return (
    <Animated.View
      style={[
        animatedStyle,
        shadowStyle,
        {
          shadowColor: primaryColor,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 16,
          elevation: 8,
          borderRadius: 16,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        style={[styles.ctaBtn, { backgroundColor: primaryColor }]}
      >
        <View style={styles.ctaBtnOverlay} />
        <Ionicons name={icon} size={17} color="#fff" />
        <Text style={styles.ctaBtnText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Animated badge — bounces when count changes ──────────────────────────────

interface AnimatedBadgeProps {
  count: number;
  isActive: boolean;
}

function AnimatedBadge({ count, isActive }: AnimatedBadgeProps) {
  const scale = useSharedValue(1);
  const prevCount = useRef(count);

  useEffect(() => {
    if (prevCount.current !== count && count > 0) {
      scale.value = withSequence(
        withSpring(1.3, SPRING_BADGE),
        withSpring(1, SPRING_GENTLE)
      );
    }
    prevCount.current = count;
  }, [count, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        animStyle,
        styles.tabBadge,
        isActive && styles.tabBadgeActive,
      ]}
    >
      <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
        {count}
      </Text>
    </Animated.View>
  );
}

// ─── Ripple effect component ──────────────────────────────────────────────────

function TabRipple({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);

  useEffect(() => {
    if (visible) {
      opacity.value = 0.12;
      scale.value = 0.3;
      opacity.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) });
      scale.value = withTiming(1.4, { duration: 400, easing: Easing.out(Easing.ease) });
    }
  }, [visible, opacity, scale]);

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.ripple, rippleStyle]}
    />
  );
}

// ─── Animated filter pill selector ───────────────────────────────────────────

interface FilterTabsProps {
  activeFilter: FilterKey;
  onSelect: (key: FilterKey) => void;
  bookings: Booking[];
  pillColor: string;
}

function FilterTabs({ activeFilter, onSelect, bookings, pillColor }: FilterTabsProps) {
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const [layoutReady, setLayoutReady] = useState(false);
  // Track which tab last had a ripple triggered
  const [rippleKey, setRippleKey] = useState<string | null>(null);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillWidth.value,
    opacity: layoutReady ? 1 : 0,
    backgroundColor: pillColor,
    shadowColor: pillColor,
  }));

  const movePillTo = useCallback(
    (key: string) => {
      const layout = tabLayouts.current[key];
      if (!layout) return;
      pillX.value = withTiming(layout.x, TIMING_PILL);
      pillWidth.value = withTiming(layout.width, TIMING_PILL);
    },
    [pillX, pillWidth]
  );

  const getBadge = (key: string): number | null => {
    if (key === "all") return null;
    if (key === "accepted")
      return bookings.filter((b) => ["accepted", "work_done"].includes(b.status)).length || null;
    return bookings.filter((b) => b.status === key).length || null;
  };

  return (
    <View style={styles.tabsContainer}>
      {/* Sliding pill background */}
      <Animated.View style={[styles.tabPill, pillStyle]} pointerEvents="none" />

      {FILTERS.map((filter) => {
        const isActive = activeFilter === filter.key;
        const badge = getBadge(filter.key);

        return (
          <Pressable
            key={filter.key}
            accessibilityLabel={`Filtro ${filter.label}${badge ? `, ${badge} prenotazioni` : ""}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              tabLayouts.current[filter.key] = { x, width };
              if (Object.keys(tabLayouts.current).length === FILTERS.length) {
                setLayoutReady(true);
                const active = tabLayouts.current[activeFilter];
                if (active) {
                  pillX.value = active.x;
                  pillWidth.value = active.width;
                }
              }
            }}
            onPress={() => {
              if (!isActive) {
                // Trigger ripple on inactive tab press
                setRippleKey(filter.key);
                setTimeout(() => setRippleKey(null), 450);
              }
              onSelect(filter.key);
              movePillTo(filter.key);
            }}
            style={styles.tabItem}
          >
            {/* Ripple — only fires on inactive tab press */}
            <TabRipple visible={rippleKey === filter.key} />

            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {filter.label}
            </Text>
            {badge !== null && badge > 0 ? (
              <AnimatedBadge count={badge} isActive={isActive} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  isClient: boolean;
  onCTA: () => void;
  filterKey: FilterKey;
  primaryColor: string;
}

function EmptyState({ isClient, onCTA, filterKey, primaryColor }: EmptyStateProps) {
  const translateY = useSharedValue(24);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(60, withSpring(0, SPRING_GENTLE));
    opacity.value = withDelay(60, withTiming(1, { duration: 380 }));
  }, [opacity, translateY]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const isFiltered = filterKey !== "all";
  const title = isFiltered
    ? "Nessun risultato qui"
    : isClient
    ? "La tua casa ti aspetta"
    : "Nessuna richiesta ancora";

  const subtitle = isFiltered
    ? "Prova un altro filtro per vedere le tue prenotazioni."
    : isClient
    ? "Prenota il tuo primo servizio e lascia fare a noi il resto."
    : "Le richieste dei clienti appariranno qui non appena arrivano.";

  return (
    <Animated.View style={[styles.emptyState, containerStyle]}>
      <View style={styles.emptyLottieWrap}>
        <LottieView
          source={require("../../assets/lottie/cleaning.json")}
          autoPlay
          loop={true}
          style={styles.emptyLottie}
          resizeMode="contain"
          speed={0.85}
        />
      </View>

      <Text style={[styles.emptyTitle, { color: primaryColor }]}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>

      {isClient && !isFiltered ? (
        <View style={styles.emptyCTAWrap}>
          <AnimatedCTA
            onPress={onCTA}
            label="Trova un professionista"
            icon="sparkles-outline"
            accessibilityLabel="Cerca professionisti per prenotare un servizio"
            primaryColor={primaryColor}
          />
          <Text style={styles.emptyHint}>Migliaia di professionisti verificati in Italia</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

// ─── Booking card ─────────────────────────────────────────────────────────────

interface BookingCardProps {
  item: Booking;
  onPress: (bookingId: string) => void;
  onReview: (bookingId: string) => void;
  onConfirmWorkDone: (bookingId: string) => void;
  isClientView: boolean;
  theme: typeof CLEANER_THEME | typeof CLIENT_THEME;
}

const BookingCard = ({
  item,
  onPress,
  onReview,
  onConfirmWorkDone,
  isClientView,
  theme,
}: BookingCardProps) => {
  const statusCfg = getStatusConfig(item.status);
  // Resolve the "ROLE" placeholder for "accepted" status
  const resolvedStatusCfg: StatusConfig = {
    ...statusCfg,
    textColor: statusCfg.textColor === "ROLE" ? theme.secondary : statusCfg.textColor,
    bgColor: statusCfg.textColor === "ROLE" ? `${theme.secondary}15` : statusCfg.bgColor,
  };

  const isCompleted = item.status === "completed";
  const needsClientConfirm = isClientView && item.status === "work_done";

  const scale = useSharedValue(1);
  const cardAnimated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const initials = item.service_type
    ? item.service_type.slice(0, 2).toUpperCase()
    : "CL";

  const cardBaseStyle = isCompleted
    ? [styles.card, styles.cardCompleted]
    : styles.card;

  return (
    <Animated.View style={cardAnimated}>
      <Pressable
        onPress={() => onPress(item.id)}
        onPressIn={() => { scale.value = withSpring(0.97, SPRING_SNAPPY); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING_GENTLE); }}
        style={cardBaseStyle}
      >
        {/* ── Top row: avatar + name/rate + status badge ── */}
        <View style={styles.cardTopRow}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarFallback, { backgroundColor: theme.primaryContainer }]}>
              <Text style={[styles.avatarFallbackText, { color: theme.avatarFallbackText }]}>
                {initials}
              </Text>
            </View>
          </View>

          <View style={styles.cleanerInfo}>
            <Text style={[styles.cleanerName, { color: theme.primary }]} numberOfLines={1}>
              {item.service_type}
            </Text>
            <Text style={[styles.cleanerRate, { color: theme.secondary }]}>
              {item.total_price > 0 ? `€${item.total_price.toFixed(2)}` : "—"}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: resolvedStatusCfg.bgColor }]}>
            <Text style={[styles.statusBadgeText, { color: resolvedStatusCfg.textColor }]}>
              {resolvedStatusCfg.label}
            </Text>
          </View>
        </View>

        {/* ── Service type badge ── */}
        <View style={[styles.serviceTagWrap, { backgroundColor: theme.serviceTagBg }]}>
          <Text style={[styles.serviceTagText, { color: theme.secondary }]}>
            {getServiceLabel(item.service_type)}
          </Text>
        </View>

        {/* ── Meta rows ── */}
        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={C.onSurfaceVariant} />
            <Text style={[styles.metaText, isCompleted && styles.metaTextDim]}>
              {item.date}
              {item.time_slot ? ` · ${item.time_slot}` : ""}
            </Text>
          </View>

          {item.address ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={C.onSurfaceVariant} />
              <Text style={[styles.metaText, isCompleted && styles.metaTextDim]} numberOfLines={1}>
                {item.address}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Footer: price + action ── */}
        <View style={styles.cardFooter}>
          <Text style={[styles.priceText, { color: theme.primary }, isCompleted && styles.priceTextDim]}>
            €{item.total_price.toFixed(2)}
          </Text>

          {needsClientConfirm ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onConfirmWorkDone(item.id);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.confirmWorkBtn, { backgroundColor: theme.confirmWorkBg }]}
            >
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={styles.confirmWorkBtnText}>Conferma lavoro</Text>
            </Pressable>
          ) : isCompleted ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onReview(item.id);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.reviewLink, { color: theme.secondary }]}>Lascia Recensione</Text>
            </Pressable>
          ) : (
            <Ionicons name="chevron-forward" size={20} color={theme.primary} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ─── Custom refresh spinner overlay ──────────────────────────────────────────

interface RefreshSpinnerProps {
  refreshing: boolean;
  primaryColor: string;
}

function RefreshSpinner({ refreshing, primaryColor }: RefreshSpinnerProps) {
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (refreshing) {
      opacity.value = withTiming(1, { duration: 200 });
      rotation.value = withRepeat(
        withTiming(360, { duration: 800, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(rotation);
      opacity.value = withTiming(0, { duration: 200 });
      rotation.value = 0;
    }
  }, [refreshing, rotation, opacity]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    opacity: opacity.value,
  }));

  if (!refreshing) return null;

  return (
    <Animated.View style={[styles.refreshSpinnerWrap, spinStyle]}>
      <Ionicons name="reload-outline" size={22} color={primaryColor} />
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isCleaner = profile?.active_role === "cleaner";
  const isClientView = !isCleaner;
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  // ─── Role-based theme ───────────────────────────────────────────────────────
  const theme = useMemo(
    () => (isCleaner ? CLEANER_THEME : CLIENT_THEME),
    [isCleaner]
  );

  // ─── Entrance stagger: header → tabs → content ──────────────────────────────
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(-12);
  const tabsOpacity = useSharedValue(0);
  const tabsY = useSharedValue(8);
  const contentOpacity = useSharedValue(0);

  // ─── Parallax on header title ────────────────────────────────────────────────
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerParallaxStyle = useAnimatedStyle(() => {
    const translateY = interpolate(scrollY.value, [0, 80], [0, -4], "clamp");
    const scale = interpolate(scrollY.value, [0, 80], [1, 0.98], "clamp");
    return {
      transform: [{ translateY }, { scale }],
    };
  });

  const headerAnimStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));

  const tabsAnimStyle = useAnimatedStyle(() => ({
    opacity: tabsOpacity.value,
    transform: [{ translateY: tabsY.value }],
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const runEntranceAnimation = useCallback(() => {
    headerOpacity.value = withTiming(1, { duration: 320 });
    headerY.value = withSpring(0, SPRING_GENTLE);

    tabsOpacity.value = withDelay(80, withTiming(1, { duration: 280 }));
    tabsY.value = withDelay(80, withSpring(0, SPRING_GENTLE));

    contentOpacity.value = withDelay(160, withTiming(1, { duration: 300 }));
  }, [headerOpacity, headerY, tabsOpacity, tabsY, contentOpacity]);

  // ─── Data loading ────────────────────────────────────────────────────────────
  const loadBookings = useCallback(async () => {
    if (!user || !profile) return;
    try {
      const data = await fetchBookings(user.id, profile.active_role);
      setBookings(data);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  }, [loadBookings]);

  useEffect(() => {
    loadBookings();
    runEntranceAnimation();
  }, [loadBookings, runEntranceAnimation]);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  // ─── Navigation handlers ─────────────────────────────────────────────────────
  const handleBookingPress = useCallback(
    (bookingId: string) => {
      // Open booking detail — has chat shortcut + escrow action bar inside
      router.push(`/booking/${bookingId}` as never);
    },
    [router]
  );

  const handleReview = useCallback(
    (bookingId: string) => {
      router.push(`/review/${bookingId}`);
    },
    [router]
  );

  const handleConfirmWorkDone = useCallback(
    (bookingId: string) => {
      Alert.alert(
        "Confermare il lavoro?",
        "Confermando il lavoro rilasci il pagamento al professionista. Questa azione non può essere annullata.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Conferma",
            onPress: async () => {
              try {
                await updateBookingStatus(bookingId, "completed");
                const booking = bookings.find((b) => b.id === bookingId);
                if (booking) {
                  sendPushNotification(
                    booking.cleaner_id,
                    "Lavoro confermato",
                    "Il cliente ha confermato il lavoro. Il pagamento è in arrivo.",
                    { screen: "jobs", bookingId }
                  ).catch(() => {});
                }
                setBookings((prev) =>
                  prev.map((b) =>
                    b.id === bookingId ? { ...b, status: "completed" } : b
                  )
                );
              } catch {
                Alert.alert("Errore", "Impossibile confermare il lavoro");
              }
            },
          },
        ]
      );
    },
    [bookings]
  );

  // ─── Filtered data ───────────────────────────────────────────────────────────
  const filteredBookings =
    activeFilter === "all"
      ? bookings
      : activeFilter === "accepted"
      ? bookings.filter((b) => ["accepted", "work_done"].includes(b.status))
      : bookings.filter((b) => b.status === activeFilter);

  // ─── Header subtitle ─────────────────────────────────────────────────────────
  const activeCount = bookings.filter((b) =>
    ["accepted", "work_done"].includes(b.status)
  ).length;
  const completedCount = bookings.filter((b) => b.status === "completed").length;

  const headerSubtitle =
    bookings.length === 0
      ? isClientView
        ? "Inizia il tuo primo servizio"
        : "Le richieste appariranno qui"
      : [
          activeCount > 0 ? `${activeCount} ${activeCount === 1 ? "attiva" : "attive"}` : null,
          completedCount > 0 ? `${completedCount} completate` : null,
        ]
          .filter(Boolean)
          .join(" · ") || `${bookings.length} prenotazioni`;

  // ─── Render item ─────────────────────────────────────────────────────────────
  const renderBooking = useCallback(
    ({ item }: { item: Booking }) => (
      <BookingCard
        item={item}
        onPress={handleBookingPress}
        onReview={handleReview}
        onConfirmWorkDone={handleConfirmWorkDone}
        isClientView={isClientView}
        theme={theme}
      />
    ),
    [handleBookingPress, handleReview, handleConfirmWorkDone, isClientView, theme]
  );

  const keyExtractor = useCallback((item: Booking) => item.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<Booking> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT + SEPARATOR_HEIGHT,
      offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
      index,
    }),
    []
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.backgroundTint }]}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={theme.backgroundTint} />

      {/* ── Header — parallax on scroll ── */}
      <Animated.View style={[styles.header, headerAnimStyle]}>
        <View style={styles.headerRow}>
          <Animated.View style={[styles.headerTextBlock, headerParallaxStyle]}>
            <Text style={[styles.headerTitle, { color: theme.primary }]}>
              Le tue prenotazioni
            </Text>
            <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
          </Animated.View>
          <NotificationBell color={theme.primary} />
        </View>
      </Animated.View>

      {/* ── Animated pill filter tabs ── */}
      <Animated.View style={[styles.tabsWrapper, tabsAnimStyle]}>
        <FilterTabs
          activeFilter={activeFilter}
          onSelect={setActiveFilter}
          bookings={bookings}
          pillColor={theme.primary}
        />
      </Animated.View>

      {/* ── Content ── */}
      <Animated.View style={[styles.contentArea, contentAnimStyle]}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.secondary} />
            <Text style={styles.loadingText}>Caricamento prenotazioni…</Text>
          </View>
        ) : filteredBookings.length === 0 ? (
          <EmptyState
            isClient={isClientView}
            onCTA={() => router.push("/(tabs)/home" as never)}
            filterKey={activeFilter}
            primaryColor={theme.primary}
          />
        ) : (
          <>
            {/* Custom refresh indicator — sits above list, animated */}
            <RefreshSpinner refreshing={refreshing} primaryColor={theme.primary} />

            <Animated.FlatList
              data={filteredBookings}
              keyExtractor={keyExtractor}
              renderItem={renderBooking}
              getItemLayout={getItemLayout}
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              maxToRenderPerBatch={8}
              windowSize={5}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="transparent"
                  colors={["transparent"]}
                  style={{ backgroundColor: "transparent" }}
                />
              }
            />
          </>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: C.outline,
    fontWeight: "500",
  },
  separator: {
    height: SEPARATOR_HEIGHT,
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerTextBlock: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: C.outline,
    letterSpacing: 0.1,
  },

  // ── Animated pill tabs ────────────────────────────────────────────────────────
  tabsWrapper: {
    marginBottom: 8,
  },
  tabsContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 4,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: `${C.outlineVariant}22`,
  },
  tabPill: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 4,
    gap: 4,
    zIndex: 1,
    overflow: "hidden",
    borderRadius: 10,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: C.onSurfaceVariant,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: `${C.outlineVariant}55`,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: C.onSurfaceVariant,
  },
  tabBadgeTextActive: {
    color: "#ffffff",
  },
  ripple: {
    borderRadius: 10,
    backgroundColor: C.onSurface,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingBottom: 32,
    gap: 8,
  },
  emptyLottieWrap: {
    width: 220,
    height: 220,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLottie: {
    width: 220,
    height: 220,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
    fontFamily: "NotoSerif_700Bold",
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: C.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 260,
    marginBottom: 4,
  },
  emptyCTAWrap: {
    marginTop: 16,
    alignItems: "center",
    gap: 12,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  ctaBtnOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.2,
  },
  emptyHint: {
    fontSize: 12,
    color: C.outline,
    textAlign: "center",
    letterSpacing: 0.1,
  },

  // ── Card ──────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
    borderWidth: 1,
    borderColor: `${C.outlineVariant}1A`,
    gap: 14,
  },
  cardCompleted: {
    backgroundColor: `${C.surfaceLow}80`,
    opacity: 0.9,
  },

  // Card top row
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    flexShrink: 0,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cleanerInfo: {
    flex: 1,
  },
  cleanerName: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 2,
  },
  cleanerRate: {
    fontSize: 13,
    fontWeight: "600",
  },
  statusBadge: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  // Service type badge
  serviceTagWrap: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  serviceTagText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },

  // Meta rows
  metaBlock: {
    gap: 7,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    fontWeight: "400",
    flex: 1,
  },
  metaTextDim: {
    opacity: 0.7,
  },

  // Card footer
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: `${C.outlineVariant}1A`,
  },
  priceText: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  priceTextDim: {
    opacity: 0.6,
  },
  reviewLink: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  confirmWorkBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 6,
  },
  confirmWorkBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 4,
  },

  // ── Refresh spinner ───────────────────────────────────────────────────────────
  refreshSpinnerWrap: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
});
```

---

### `app/(tabs)/messages.tsx`

```tsx
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { fetchBookings } from "../../lib/api";
import { Booking } from "../../lib/types";
import { BookingStatusConfig } from "../../lib/theme";
import { NotificationBell } from "../../components/NotificationBell";

// ─── Design tokens (dal Stitch HTML live_chat_with_concierge) ─────────────────
const C = {
  background: "#f6faf9",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  surfaceHigh: "#e5e9e8",
  primary: "#022420",
  primaryContainer: "#1a3a35",
  secondary: "#006b55",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
  muted: "#8aaca6",
} as const;

const ITEM_HEIGHT = 88;
const SEPARATOR_HEIGHT = 10;

// ─── Conversation row ─────────────────────────────────────────────────────────

interface ConversationRowProps {
  item: Booking;
  onPress: (bookingId: string) => void;
}

const ConversationRow = ({ item, onPress }: ConversationRowProps) => {
  const cfg = BookingStatusConfig[item.status];

  const initials = item.service_type
    ? item.service_type.slice(0, 2).toUpperCase()
    : "CL";

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarInitials}>{initials}</Text>
      </View>

      {/* Content */}
      <View style={styles.rowContent}>
        <View style={styles.rowTopLine}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.service_type}
          </Text>
          {cfg && (
            <View style={[styles.statusChip, { backgroundColor: cfg.bgColor }]}>
              <Text style={[styles.statusChipText, { color: cfg.color }]}>
                {cfg.label}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.rowMeta}>
          <Ionicons name="calendar-outline" size={12} color={C.outline} />
          <Text style={styles.rowMetaText}>
            {item.date} · {item.time_slot}
          </Text>
        </View>
      </View>

      {/* Arrow */}
      <View style={styles.arrowWrap}>
        <Ionicons name="chevron-forward" size={16} color={C.onSurfaceVariant} />
      </View>
    </Pressable>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    if (!user || !profile) return;
    try {
      const data = await fetchBookings(user.id, profile.active_role);
      setBookings(
        data.filter((b) =>
          ["accepted", "work_done", "completed"].includes(b.status)
        )
      );
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Refresh on tab focus — catches new bookings / state changes
  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  const handlePress = useCallback(
    (bookingId: string) => {
      router.push(`/chat/${bookingId}`);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: Booking }) => (
      <ConversationRow item={item} onPress={handlePress} />
    ),
    [handlePress]
  );

  const keyExtractor = useCallback((item: Booking) => item.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<Booking> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT + SEPARATOR_HEIGHT,
      offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
      index,
    }),
    []
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Messaggi</Text>
          <NotificationBell color={C.primaryContainer} />
        </View>
        {!loading && bookings.length > 0 && (
          <Text style={styles.headerSubtitle}>
            {bookings.length} conversazion
            {bookings.length === 1 ? "e" : "i"} attiv
            {bookings.length === 1 ? "a" : "e"}
          </Text>
        )}
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.secondary} />
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="chatbubbles-outline" size={36} color={C.outline} />
          </View>
          <Text style={styles.emptyTitle}>Nessun messaggio</Text>
          <Text style={styles.emptySubtitle}>
            Le chat si aprono quando un professionista accetta la tua richiesta
            o quando hai una prenotazione attiva.
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => (
            <View style={{ height: SEPARATOR_HEIGHT }} />
          )}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={12}
          windowSize={5}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    fontStyle: "italic",
    color: C.primaryContainer,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: C.onSurfaceVariant,
  },

  // ── Conversation row ──────────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  rowPressed: {
    opacity: 0.88,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarInitials: {
    color: "#00c896",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  rowContent: {
    flex: 1,
    gap: 5,
  },
  rowTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.onSurface,
    flex: 1,
  },
  statusChip: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  rowMetaText: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    fontWeight: "500",
  },
  arrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: C.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── List ──────────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: C.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontStyle: "italic",
    color: C.onSurface,
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 21,
  },
});
```

---

### `app/(tabs)/notifications.tsx`

```tsx
import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";
import { useAuth } from "../../lib/auth";
import {
  useNotifications,
  type AppNotification,
  type NotificationType,
  type NotificationFilter,
} from "../../lib/hooks/useNotifications";

// ─── Design tokens (Stitch) ───────────────────────────────────────────────────

const C = {
  background: "#f6faf9",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  surfaceContainerHigh: "#e5e9e8",
  surfaceVariant: "#dfe3e2",
  primary: "#022420",
  secondary: "#006b55",
  error: "#ba1a1a",
  errorLight: "#fce8e8",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
} as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const SEPARATOR_HEIGHT = 12;

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: "all", label: "Tutte" },
  { key: "bookings", label: "Prenotazioni" },
  { key: "messages", label: "Messaggi" },
  { key: "system", label: "Sistema" },
];

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function getTypeIcon(
  type: NotificationType
): React.ComponentProps<typeof Ionicons>["name"] {
  switch (type) {
    case "booking":
      return "calendar-outline";
    case "message":
      return "chatbubble-outline";
    case "system":
      return "shield-checkmark-outline";
  }
}

function formatTimestamp(created_at: string): string {
  const date = new Date(created_at);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Adesso";
  if (diffMin < 60) return `${diffMin} min fa`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h fa`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}g fa`;
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={[styles.card, styles.cardRead, { gap: 12 }]}>
      <View style={[styles.iconCircle, { backgroundColor: C.surfaceContainerHigh }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 14, width: "60%", backgroundColor: C.surfaceContainerHigh, borderRadius: 6 }} />
        <View style={{ height: 12, width: "85%", backgroundColor: C.surfaceLow, borderRadius: 6 }} />
        <View style={{ height: 12, width: "40%", backgroundColor: C.surfaceLow, borderRadius: 6 }} />
      </View>
    </View>
  );
}

// ─── Notification card ────────────────────────────────────────────────────────

interface NotificationCardProps {
  item: AppNotification;
  onPress: (id: string, linkPath: string | null) => void;
}

const NotificationCard = ({ item, onPress }: NotificationCardProps) => {
  const iconName = getTypeIcon(item.type);
  const isUnread = !item.read_at;

  const handlePress = useCallback(() => {
    onPress(item.id, item.link_path);
  }, [item.id, item.link_path, onPress]);

  return (
    <Animated.View entering={FadeInDown.springify().damping(20)} layout={Layout.springify()}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.card,
          isUnread ? styles.cardUnread : styles.cardRead,
          pressed && styles.cardPressed,
        ]}
        accessibilityLabel={`Notifica: ${item.title}`}
        accessibilityRole="button"
      >
        {/* Icon circle */}
        <View
          style={[
            styles.iconCircle,
            isUnread ? styles.iconCircleUnread : styles.iconCircleRead,
          ]}
        >
          <Ionicons
            name={iconName}
            size={24}
            color={isUnread ? C.secondary : C.primary}
          />
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <Text
              style={[
                styles.cardTitle,
                isUnread ? styles.cardTitleUnread : styles.cardTitleRead,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <View style={styles.timestampWrap}>
              {isUnread && <View style={styles.unreadDot} />}
              <Text
                style={[
                  styles.cardTimestamp,
                  !isUnread && styles.cardTimestampRead,
                ]}
              >
                {formatTimestamp(item.created_at)}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.cardDescription,
              !isUnread && styles.cardDescriptionRead,
            ]}
            numberOfLines={2}
          >
            {item.body}
          </Text>

          {item.link_path ? (
            <View style={styles.actionWrap}>
              <View style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Vai</Text>
              </View>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: NotificationFilter }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons
          name="notifications-off-outline"
          size={34}
          color={C.outlineVariant}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {filter === "all" ? "Nessuna notifica" : "Nessuna notifica in questa categoria"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {filter === "all"
          ? "Le notifiche appariranno qui quando ci saranno aggiornamenti sulle tue prenotazioni."
          : "Torna alla categoria \"Tutte\" per vedere tutte le notifiche."}
      </Text>
    </View>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle-outline" size={18} color={C.error} />
      <Text style={styles.errorText} numberOfLines={2}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.retryBtn}>
        <Text style={styles.retryText}>Riprova</Text>
      </Pressable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");

  const {
    data: notifications,
    isLoading,
    error,
    refetch,
    markAsRead,
    markAllAsRead,
  } = useNotifications(user?.id);

  const filtered = useMemo(() => {
    if (!notifications) return [];
    if (activeFilter === "all") return notifications;
    const typeMap: Record<NotificationFilter, NotificationType | null> = {
      all: null,
      bookings: "booking",
      messages: "message",
      system: "system",
    };
    const t = typeMap[activeFilter];
    return t ? notifications.filter((n) => n.type === t) : notifications;
  }, [notifications, activeFilter]);

  const unreadCount = useMemo(
    () => (notifications ?? []).filter((n) => !n.read_at).length,
    [notifications]
  );

  const handlePress = useCallback(
    (id: string, linkPath: string | null) => {
      markAsRead(id);
      if (!linkPath) return;
      // Whitelist routable prefixes — link_path comes from a DB column
      // populated by edge functions / triggers, so an unexpected value
      // (typo, manual SQL update, future schema change) would otherwise
      // crash Expo Router. Reject anything that doesn't start with a
      // known in-app path or the app's deep-link scheme.
      const isInAppPath =
        linkPath.startsWith("/booking/") ||
        linkPath.startsWith("/chat/") ||
        linkPath.startsWith("/listings") ||
        linkPath.startsWith("/listing") ||
        linkPath.startsWith("/payments") ||
        linkPath.startsWith("/documents") ||
        linkPath.startsWith("/(tabs)") ||
        linkPath.startsWith("/support") ||
        linkPath.startsWith("/cleaner/") ||
        linkPath.startsWith("/properties") ||
        linkPath.startsWith("/profile") ||
        linkPath.startsWith("cleanhome://");
      if (!isInAppPath) {
        if (__DEV__) {
          console.warn("[notifications] ignored unrecognised link_path:", linkPath);
        }
        return;
      }
      try {
        router.push(linkPath as never);
      } catch (err) {
        if (__DEV__) console.warn("[notifications] router.push failed:", err);
      }
    },
    [markAsRead, router]
  );

  const keyExtractor = useCallback((item: AppNotification) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => (
      <NotificationCard item={item} onPress={handlePress} />
    ),
    [handlePress]
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />

      {/* ── TopAppBar ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Image
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            source={require("../../assets/icon.png")}
            style={{ width: 20, height: 20, borderRadius: 5 }}
          />
          <Text style={styles.topBarBrand}>CleanHome</Text>
        </View>
        <View style={styles.topBarRight} />
      </View>

      {/* ── Editorial header ── */}
      <View style={styles.editorialHeader}>
        <View style={styles.editorialHeaderRow}>
          <View>
            <Text style={styles.overlineText}>La tua attività</Text>
            <Text style={styles.headlineText}>Notifiche</Text>
          </View>
          {unreadCount > 0 && !isLoading && (
            <Pressable
              onPress={markAllAsRead}
              style={styles.markAllBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Segna tutte come lette"
              accessibilityRole="button"
            >
              <Ionicons name="checkmark-done-outline" size={16} color={C.primary} />
              <Text style={styles.markAllText}>Segna tutte lette</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Error banner ── */}
      {error && !isLoading && (
        <ErrorBanner message={error.message} onRetry={refetch} />
      )}

      {/* ── Filter chips ── */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={(f) => f.key}
        contentContainerStyle={styles.filtersList}
        style={styles.filtersWrap}
        renderItem={({ item: filter }) => {
          const isActive = activeFilter === filter.key;
          return (
            <Pressable
              onPress={() => setActiveFilter(filter.key)}
              style={({ pressed }) => [
                styles.filterChip,
                isActive && styles.filterChipActive,
                pressed && !isActive && { opacity: 0.7 },
              ]}
              accessibilityLabel={`Filtra: ${filter.label}`}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.filterChipText,
                  isActive && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* ── Content ── */}
      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ marginBottom: SEPARATOR_HEIGHT }}>
              <SkeletonCard />
            </View>
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState filter={activeFilter} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => (
            <View style={{ height: SEPARATOR_HEIGHT }} />
          )}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={C.secondary}
              colors={[C.secondary]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },

  // ── TopAppBar ─────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topBarBrand: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 20,
    fontWeight: "700",
    fontStyle: "italic",
    color: C.primary,
    letterSpacing: -0.3,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
  },

  // ── Editorial header ──────────────────────────────────────────────────────────
  editorialHeader: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  editorialHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  overlineText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.secondary,
    textTransform: "uppercase",
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  headlineText: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 36,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.8,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 4,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.primary,
  },

  // ── Error banner ──────────────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: "#fce8e8",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: C.error,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: C.error,
    lineHeight: 18,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.error,
  },
  retryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },

  // ── Filter chips ──────────────────────────────────────────────────────────────
  filtersWrap: {
    maxHeight: 52,
    marginBottom: 20,
  },
  filtersList: {
    paddingHorizontal: 24,
    gap: 10,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: C.surfaceContainerHigh,
  },
  filterChipActive: {
    backgroundColor: C.primary,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: C.primary,
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },

  // ── Notification card ─────────────────────────────────────────────────────────
  card: {
    flexDirection: "row",
    gap: 16,
    borderRadius: 16,
    padding: 20,
    minHeight: 80,
  },
  cardUnread: {
    backgroundColor: C.surface,
    borderLeftWidth: 4,
    borderLeftColor: C.secondary,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  cardRead: {
    backgroundColor: C.surfaceLow,
  },
  cardPressed: {
    opacity: 0.85,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconCircleUnread: {
    backgroundColor: `${C.secondary}1A`,
  },
  iconCircleRead: {
    backgroundColor: C.surfaceVariant,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  cardTitleUnread: {
    fontFamily: "NotoSerif_700Bold",
    color: C.primary,
  },
  cardTitleRead: {
    color: `${C.primary}99`,
  },
  timestampWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.secondary,
  },
  cardTimestamp: {
    fontSize: 11,
    fontWeight: "500",
    color: `${C.onSurfaceVariant}99`,
  },
  cardTimestampRead: {
    color: `${C.onSurfaceVariant}66`,
  },
  cardDescription: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    lineHeight: 20,
  },
  cardDescriptionRead: {
    opacity: 0.7,
  },
  actionWrap: {
    flexDirection: "row",
    marginTop: 8,
  },
  actionBtn: {
    backgroundColor: C.surfaceContainerHigh,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: 0.2,
  },

  // ── List ──────────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 20,
    backgroundColor: C.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: C.onSurface,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 21,
  },
});
```

---

### `app/(tabs)/profile.tsx`

```tsx
import { useState, useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LottieView from "lottie-react-native";
import {
  View,
  Text,
  Pressable,
  Alert,
  StatusBar,
  ScrollView,
  // Switch nativo rimosso — usiamo AnimatedToggle
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import CoachMarkOverlay, {
  CoachMarkStep,
} from "../../components/CoachMarks/CoachMarkOverlay";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedToggle } from "../../components/AnimatedToggle";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { UserProfile } from "../../lib/types";
import { uploadAvatar, removeAvatar, deleteOwnAccount } from "../../lib/api";
import { measureInWindow } from "../../lib/measureInWindow";
import { NotificationBell } from "../../components/NotificationBell";
import { CleanerPayoutSection } from "../../components/CleanerPayoutSection";
import { ProfileStatsStrip } from "../../components/profile/ProfileStatsStrip";
import { useIdentityVerification } from "../../lib/hooks/useIdentityVerification";

const { width: SCREEN_W, height: SH } = Dimensions.get("window");

// ─── Avatar logic ─────────────────────────────────────────────────────────────

function useAvatarActions(
  userId: string | undefined,
  avatarUrl: string | undefined | null,
  refreshProfile: () => Promise<UserProfile | null>
) {
  const [uploading, setUploading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  const requestPermission = async (type: "camera" | "gallery"): Promise<boolean> => {
    if (type === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permesso negato", "Abilita l'accesso alla fotocamera nelle impostazioni.");
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permesso negato", "Abilita l'accesso alla libreria foto nelle impostazioni.");
        return false;
      }
    }
    return true;
  };

  const handlePickResult = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.length || !userId) return;
    const uri = result.assets[0].uri;
    setUploading(true);
    try {
      await uploadAvatar(userId, uri);
      await refreshProfile();
    } catch (err: unknown) {
      Alert.alert("Errore upload", err instanceof Error ? err.message : "Riprova.");
    } finally {
      setUploading(false);
    }
  };

  const openCamera = async () => {
    if (!(await requestPermission("camera"))) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      await handlePickResult(result);
    } catch (err) {
      console.warn("[camera] launchCameraAsync error", err);
      Alert.alert("Fotocamera non disponibile", err instanceof Error ? err.message : "Prova a scegliere dalla libreria.");
    }
  };

  const openGallery = async () => {
    if (!(await requestPermission("gallery"))) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    await handlePickResult(result);
  };

  const handleRemove = async () => {
    if (!userId || !avatarUrl) return;
    Alert.alert("Rimuovi foto", "Sei sicuro di voler rimuovere la foto profilo?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Rimuovi",
        style: "destructive",
        onPress: async () => {
          setUploading(true);
          try {
            await removeAvatar(userId, avatarUrl);
            await refreshProfile();
          } catch (err: unknown) {
            Alert.alert("Errore", err instanceof Error ? err.message : "Riprova.");
          } finally {
            setUploading(false);
          }
        },
      },
    ]);
  };

  const showOptions = () => {
    const options: Parameters<typeof Alert.alert>[2] = [
      ...(avatarUrl
        ? [{ text: "Visualizza foto", onPress: () => setPreviewVisible(true) }]
        : []),
      { text: "Scatta foto", onPress: openCamera },
      { text: "Scegli dalla libreria", onPress: openGallery },
      ...(avatarUrl
        ? [{ text: "Rimuovi foto", style: "destructive" as const, onPress: handleRemove }]
        : []),
      { text: "Annulla", style: "cancel" as const },
    ];
    Alert.alert("Foto profilo", "Cosa vuoi fare?", options);
  };

  return { uploading, previewVisible, setPreviewVisible, showOptions };
}

// ─── Avatar display component ─────────────────────────────────────────────────

interface AvatarDisplayProps {
  avatarUrl?: string | null;
  initials: string;
  size?: number;
  backgroundColor?: string;
  initialsColor?: string;
  borderRadius?: number;
  uploading?: boolean;
}

function AvatarDisplay({
  avatarUrl,
  initials,
  size = 96,
  backgroundColor,
  initialsColor,
  borderRadius = 999,
  uploading = false,
}: AvatarDisplayProps) {
  const containerStyle = {
    width: size,
    height: size,
    borderRadius,
    overflow: "hidden" as const,
    backgroundColor: backgroundColor ?? C.primaryContainer,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: "#022420",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  };

  if (uploading) {
    return (
      <View style={containerStyle}>
        <ActivityIndicator color={initialsColor ?? "#abcec6"} />
      </View>
    );
  }

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={containerStyle}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={containerStyle}>
      <Text
        style={{
          fontSize: size * 0.33,
          fontWeight: "800",
          color: initialsColor ?? "#abcec6",
          letterSpacing: 1,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

// ─── Photo preview modal ──────────────────────────────────────────────────────

function PhotoPreviewModal({
  uri,
  visible,
  onClose,
}: {
  uri: string;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" }}
        onPress={onClose}
      >
        <Image
          source={{ uri }}
          style={{ width: SCREEN_W, height: SCREEN_W }}
          resizeMode="contain"
        />
      </Pressable>
    </Modal>
  );
}

// ─── Design tokens (Stitch) ───────────────────────────────────────────────────

const C = {
  background: "#f8fbfa",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  primary: "#022420",
  primaryContainer: "#022420",
  secondary: "#006b55",
  secondaryContainer: "#82f4d1",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  // Cleaner role palette
  cleanerPrimary: "#8B5E3C",
  cleanerDark: "#5C3D24",
  cleanerAmber: "#D4A574",
  cleanerLight: "#F5EBE0",
  cleanerIconBg: "#F5EBE0",
} as const;

// ─── Menu row ─────────────────────────────────────────────────────────────────

interface MenuRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
  loading?: boolean;
  iconBgColor?: string;
  iconColor?: string;
}

function MenuRow({
  icon,
  label,
  sublabel,
  onPress,
  danger = false,
  loading = false,
  iconBgColor,
  iconColor,
  cardStyle = false,
}: MenuRowProps & { cardStyle?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}. ${sublabel}` : label}
      accessibilityHint={danger ? "Azione irreversibile" : undefined}
      style={({ pressed }) => [
        styles.menuRow,
        cardStyle && styles.menuRowCard,
        pressed && (cardStyle ? styles.menuRowCardPressed : styles.menuRowPressed),
      ]}
    >
      <View
        style={[
          styles.menuRowIconBox,
          { backgroundColor: danger ? C.errorContainer : (iconBgColor || C.surfaceLow) },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={danger ? C.error : (iconColor || C.primary)}
        />
      </View>

      <View style={styles.menuRowBody}>
        <Text
          style={[
            styles.menuRowLabel,
            { color: danger ? C.error : C.primary },
          ]}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text style={styles.menuRowSublabel}>{sublabel}</Text>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={C.outline} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={C.outlineVariant} />
      )}
    </Pressable>
  );
}

// ─── Client profile view ──────────────────────────────────────────────────────

interface CleanerViewProps {
  cleanerId: string | null | undefined;
  initials: string;
  fullName: string;
  avatarUrl?: string | null;
  avatarUploading?: boolean;
  previewVisible?: boolean;
  onAvatarPress: () => void;
  onPreviewClose: () => void;
  onEditProfile: () => void;
  onListing: () => void;
  onDocuments: () => void;
  onLegal: () => void;
  onPrivacy: () => void;
  onSwitchRole: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  // Coach mark refs — measureInWindow gives screen-absolute coords for the Modal overlay
  avatarSectionRef?: React.RefObject<View | null>;
  editProfileRef?: React.RefObject<View | null>;
  listingRef?: React.RefObject<View | null>;
  documentsRef?: React.RefObject<View | null>;
  payoutSectionRef?: React.RefObject<View | null>;
  highlightStripe?: boolean;
}

function CleanerView({
  cleanerId,
  initials,
  fullName,
  avatarUrl,
  avatarUploading,
  previewVisible,
  onAvatarPress,
  onPreviewClose,
  onEditProfile,
  onListing,
  onDocuments,
  onLegal,
  onPrivacy,
  onSwitchRole,
  onSignOut,
  onDeleteAccount,
  avatarSectionRef,
  editProfileRef,
  listingRef,
  documentsRef,
  payoutSectionRef,
  highlightStripe,
}: CleanerViewProps) {
  const { isVerified: isIdentityVerified } = useIdentityVerification(cleanerId);
  const stripeHighlightOpacity = useSharedValue(0);

  useEffect(() => {
    if (highlightStripe) {
      stripeHighlightOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0, { duration: 300 })
        ),
        6,
        false
      );
    }
  }, [highlightStripe, stripeHighlightOpacity]);

  const stripeHighlightStyle = useAnimatedStyle(() => ({
    borderWidth: 2,
    borderColor: `rgba(79, 196, 163, ${stripeHighlightOpacity.value})`,
    borderRadius: 12,
  }));
  return (
    <>
      {/* ── Photo preview modal ── */}
      {avatarUrl && previewVisible ? (
        <PhotoPreviewModal uri={avatarUrl} visible={previewVisible} onClose={onPreviewClose} />
      ) : null}

      {/* ── Hero ── */}
      <View
        ref={avatarSectionRef}
        style={clientStyles.heroSection}
      >
        <Pressable
          style={clientStyles.avatarWrapper}
          onPress={onAvatarPress}
          disabled={avatarUploading}
          accessibilityLabel="Cambia foto profilo"
          accessibilityRole="button"
        >
          <AvatarDisplay
            avatarUrl={avatarUrl}
            initials={initials}
            size={88}
            backgroundColor="#006b55"
            initialsColor="#ffffff"
            borderRadius={999}
            uploading={avatarUploading}
          />
          <View style={clientStyles.editBadge}>
            <Ionicons name="camera-outline" size={12} color="#022420" />
          </View>
        </Pressable>
        <View style={clientStyles.heroNameRow}>
          <Text style={clientStyles.heroName}>{fullName}</Text>
          {isIdentityVerified && (
            <Ionicons
              name="checkmark-circle"
              size={18}
              color="#006b55"
              accessibilityLabel="Identità verificata da Stripe"
            />
          )}
        </View>
        <Text style={clientStyles.heroRole}>PROFESSIONISTA</Text>
      </View>

      {/* ── Stats strip ── */}
      <ProfileStatsStrip userId={cleanerId} role="cleaner" />

      {/* ── Toggle compatto ── */}
      <View style={compactToggleStyles.row}>
        <Text style={compactToggleStyles.label}>Modalità Professionista</Text>
        <AnimatedToggle
          value={false}
          onValueChange={() => onSwitchRole()}
          activeColor="#D4A574"
          inactiveColor="#4fc4a3"
        />
      </View>

      {/* ── Sezione pagamenti / Stripe Connect ── */}
      <View ref={payoutSectionRef} style={payoutStyles.section}>
        <Animated.View style={highlightStripe ? stripeHighlightStyle : undefined}>
          <CleanerPayoutSection cleanerId={cleanerId} />
        </Animated.View>
      </View>

      {/* ── Menu rows con sezioni ── */}
      <View style={sectionStyles.container}>
        {/* GESTIONE */}
        <Text style={sectionStyles.header}>GESTIONE</Text>
        <View style={clientStyles.menuSection}>
          <View ref={editProfileRef}>
            <MenuRow
              icon="person-outline"
              label="Modifica Profilo"
              sublabel="Gestisci le tue informazioni personali"
              onPress={onEditProfile}
              iconBgColor={C.surfaceLow}
              cardStyle
            />
          </View>
          <View ref={listingRef}>
            <MenuRow
              icon="megaphone-outline"
              label="I miei annunci"
              sublabel="Gestisci i tuoi annunci e zone di copertura"
              onPress={onListing}
              iconBgColor={C.surfaceLow}
              cardStyle
            />
          </View>
        </View>

        {/* VERIFICHE */}
        <Text style={sectionStyles.header}>VERIFICHE</Text>
        <View style={clientStyles.menuSection}>
          <View ref={documentsRef}>
            <MenuRow
              icon="shield-checkmark-outline"
              label="Verifica identità"
              sublabel={
                isIdentityVerified
                  ? "Identità verificata da Stripe"
                  : "Completa la verifica per ricevere pagamenti"
              }
              onPress={onDocuments}
              iconBgColor={isIdentityVerified ? "#dcfce7" : C.surfaceLow}
              iconColor={isIdentityVerified ? "#16a34a" : C.primary}
              cardStyle
            />
          </View>
        </View>

        {/* LEGALE */}
        <Text style={sectionStyles.header}>LEGALE</Text>
        <View style={clientStyles.menuSection}>
          <MenuRow
            icon="shield-checkmark-outline"
            label="Privacy e Legale"
            sublabel="Termini, condizioni e gestione dati"
            onPress={onPrivacy}
            iconBgColor={C.surfaceLow}
            cardStyle
          />
        </View>
      </View>

      {/* ── Zona Account ── */}
      <View style={dangerStyles.section}>
        <Text style={dangerStyles.sectionLabel}>ACCOUNT</Text>

        <MenuRow
          icon="log-out-outline"
          label="Esci dall'account"
          sublabel="Termina la sessione su questo dispositivo"
          onPress={onSignOut}
          danger
          cardStyle
        />

        <MenuRow
          icon="trash-outline"
          label="Elimina account"
          sublabel="Cancellazione definitiva e irreversibile dei tuoi dati"
          onPress={onDeleteAccount}
          danger
          cardStyle
        />
      </View>

    </>
  );
}

// ─── Cleaner profile view ─────────────────────────────────────────────────────

interface ClientViewProps {
  clientId: string | null | undefined;
  initials: string;
  fullName: string;
  avatarUrl?: string | null;
  avatarUploading?: boolean;
  previewVisible?: boolean;
  onAvatarPress: () => void;
  onPreviewClose: () => void;
  onEditProfile: () => void;
  onBankData: () => void;
  onDocuments: () => void;
  onPrivacy: () => void;
  onBookings: () => void;
  onProperties: () => void;
  onSwitchRole: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  onViewListing: () => void;
  // Coach mark refs — measureInWindow gives screen-absolute coords for the Modal overlay
  avatarSectionRef?: React.RefObject<View | null>;
  editProfileRef?: React.RefObject<View | null>;
  propertiesRef?: React.RefObject<View | null>;
  paymentRef?: React.RefObject<View | null>;
}

function ClientView({
  clientId,
  initials,
  fullName,
  avatarUrl,
  avatarUploading,
  previewVisible,
  onAvatarPress,
  onPreviewClose,
  onEditProfile,
  onBankData,
  onDocuments,
  onProperties,
  onPrivacy,
  onBookings,
  onSwitchRole,
  onSignOut,
  onDeleteAccount,
  onViewListing,
  avatarSectionRef,
  editProfileRef,
  propertiesRef,
  paymentRef,
}: ClientViewProps) {
  const services = [
    "Pulizia Standard",
    "Pulizia Profonda",
    "Stiratura",
    "Pulizia Vetri",
  ];

  return (
    <>
      {/* ── Photo preview modal ── */}
      {avatarUrl && previewVisible ? (
        <PhotoPreviewModal uri={avatarUrl} visible={previewVisible} onClose={onPreviewClose} />
      ) : null}

      <View
        ref={avatarSectionRef}
        style={styles.heroSection}
      >
        <Pressable
          style={styles.avatarWrapper}
          onPress={onAvatarPress}
          disabled={avatarUploading}
          accessibilityLabel="Cambia foto profilo"
          accessibilityRole="button"
        >
          <AvatarDisplay
            avatarUrl={avatarUrl}
            initials={initials}
            size={88}
            backgroundColor="#6f4627"
            initialsColor="#ffffff"
            borderRadius={999}
            uploading={avatarUploading}
          />
          <View style={styles.editBadge}>
            <Ionicons name="camera-outline" size={12} color="#6f4627" />
          </View>
        </Pressable>
        <Text style={styles.heroName}>{fullName}</Text>
        <Text style={[styles.heroRole, { color: C.cleanerPrimary }]}>
          CLIENTE PREMIUM
        </Text>
      </View>

      {/* ── Stats strip ── */}
      <ProfileStatsStrip userId={clientId} role="client" />

      {/* ── Toggle compatto ── */}
      <View style={[compactToggleStyles.row, { backgroundColor: "#f5ebe0" }]}>
        <Text style={[compactToggleStyles.label, { color: C.cleanerPrimary }]}>Modalità Cliente</Text>
        <AnimatedToggle
          value={true}
          onValueChange={() => onSwitchRole()}
          activeColor="#D4A574"
          inactiveColor="#4fc4a3"
        />
      </View>

      {/* ── Menu CLIENTE con sezioni ── */}
      <View style={sectionStyles.container}>
        {/* GESTIONE */}
        <Text style={[sectionStyles.header, { color: C.cleanerPrimary }]}>GESTIONE</Text>
        <View style={clientStyles.menuSection}>
          <View ref={editProfileRef}>
            <MenuRow
              icon="person-outline"
              label="Modifica Profilo"
              sublabel="Gestisci le tue informazioni personali"
              onPress={onEditProfile}
              iconBgColor={C.cleanerIconBg}
              iconColor={C.cleanerPrimary}
              cardStyle
            />
          </View>
          <View ref={propertiesRef}>
            <MenuRow
              icon="home-outline"
              label="Le mie case"
              sublabel="Salva gli indirizzi che usi più spesso"
              onPress={onProperties}
              iconBgColor={C.cleanerIconBg}
              iconColor={C.cleanerPrimary}
              cardStyle
            />
          </View>
          <View ref={paymentRef}>
            <MenuRow
              icon="card-outline"
              label="Metodo di Pagamento"
              sublabel="Gestisci le tue carte di pagamento"
              onPress={onBankData}
              iconBgColor={C.cleanerIconBg}
              iconColor={C.cleanerPrimary}
              cardStyle
            />
          </View>
        </View>

        {/* LEGALE */}
        <Text style={[sectionStyles.header, { color: C.cleanerPrimary }]}>LEGALE</Text>
        <View style={clientStyles.menuSection}>
          <MenuRow
            icon="shield-checkmark-outline"
            label="Privacy e Legale"
            sublabel="Termini, condizioni e gestione dati"
            onPress={onPrivacy}
            iconBgColor={C.cleanerIconBg}
            iconColor={C.cleanerPrimary}
            cardStyle
          />
        </View>
      </View>

      {/* ── Zona Account ── */}
      <View style={dangerStyles.section}>
        <Text style={dangerStyles.sectionLabel}>ACCOUNT</Text>

        <MenuRow
          icon="log-out-outline"
          label="Esci dall'account"
          sublabel="Termina la sessione su questo dispositivo"
          onPress={onSignOut}
          danger
          cardStyle
        />

        <MenuRow
          icon="trash-outline"
          label="Elimina account"
          sublabel="Cancellazione definitiva e irreversibile dei tuoi dati"
          onPress={onDeleteAccount}
          danger
          cardStyle
        />
      </View>

    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, profile, signOut, setActiveRole, refreshProfile } = useAuth();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const isCleaner = profile?.active_role === "cleaner";

  const scrollViewRef = useRef<ScrollView>(null);

  const [showLogoutAnim, setShowLogoutAnim] = useState(false);
  // Track the logout setTimeout so it can be cleared on unmount and
  // avoid setState-after-unmount + stuck animation if user navigates away.
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stripe focus highlight ─────────────────────────────────────────────────
  const [highlightStripe, setHighlightStripe] = useState(false);
  const payoutSectionRef = useRef<View>(null);

  useEffect(() => {
    if (focus === "stripe" && isCleaner) {
      const timer = setTimeout(() => {
        payoutSectionRef.current?.measureInWindow((_x, y) => {
          scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
          setHighlightStripe(true);
          setTimeout(() => setHighlightStripe(false), 3600);
        });
      }, 400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [focus, isCleaner]);

  // ── Profile coach marks ────────────────────────────────────────────────────
  const [showProfileCoach, setShowProfileCoach] = useState(false);
  const [profileCoachSteps, setProfileCoachSteps] = useState<CoachMarkStep[]>([]);

  // Refs passed directly to sub-components. measureInWindow gives screen-absolute
  // coordinates that work correctly in the Modal-based CoachMarkOverlay.
  const avatarSectionRef = useRef<View>(null);
  const editProfileRef = useRef<View>(null);
  const paymentRef = useRef<View>(null);
  const propertiesRef = useRef<View>(null);
  const listingRef = useRef<View>(null);
  const documentsRef = useRef<View>(null);

  // Coach marks DISABLED while we rework them. Re-enable when ready.
  useEffect(() => {
    setShowProfileCoach(false);
  }, []);

  // Gate logic disabled — kept here for when we re-enable
  useEffect(() => {
    AsyncStorage.getItem("cleanhome.first_profile_tour_done")
      .then(() => {
        // setShowProfileCoach(false); // disabled
      })
      .catch(() => {});
  }, []);

  // Build profile coach steps by measuring real screen positions.
  //
  // For elements that live inside a ScrollView (menu rows), we scroll to
  // ensure they are visible before measuring — otherwise they may be
  // off-screen and measureInWindow returns y outside the viewport.
  // Strategy: scroll to top first so the hero/avatar is in view, then for
  // lower rows scroll incrementally and re-measure after a short settle.
  useEffect(() => {
    if (!showProfileCoach) return;
    const timer = setTimeout(async () => {
      // Step 1 — scroll to top so the avatar hero is fully visible
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });

      // Step 2 — allow one frame for scroll to settle, then measure
      await new Promise<void>((r) => setTimeout(r, 80));

      const avatarRect = await measureInWindow(avatarSectionRef);
      const editRect = await measureInWindow(editProfileRef);

      // For lower rows we may need to scroll them into view.
      // measureInWindow on a ref that is outside the visible viewport
      // returns a y larger than SH, making the spotlight invisible.
      // We scroll to bring the element near the center, wait, then remeasure.
      const scrollAndMeasure = async (ref: React.RefObject<View | null>) => {
        const preliminary = await measureInWindow(ref);
        if (!preliminary) return null;
        if (preliminary.y > SH * 0.75 || preliminary.y < 0) {
          // Element is below (or above) the visible area — scroll to expose it
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, preliminary.y - SH / 3),
            animated: true,
          });
          await new Promise<void>((r) => setTimeout(r, 260));
          return measureInWindow(ref); // re-measure after scroll settles
        }
        return preliminary;
      };

      const steps: CoachMarkStep[] = [];

      if (isCleaner) {
        if (avatarRect) {
          steps.push({
            rect: avatarRect,
            title: "Carica la tua foto",
            description:
              "Un profilo con foto riceve il 3x più richieste. Tocca l'avatar per aggiungerne una.",
          });
        }
        if (editRect) {
          steps.push({
            rect: editRect,
            title: "Completa info personali",
            description:
              "Aggiungi una bio, la tua specializzazione e i tuoi contatti per presentarti ai clienti.",
          });
        }
        const listingMeasured = await scrollAndMeasure(listingRef);
        if (listingMeasured) {
          steps.push({
            rect: listingMeasured,
            title: "Aggiungi servizi e tariffe",
            description:
              "Crea il tuo annuncio con i servizi offerti, la tariffa oraria e la zona di copertura.",
          });
        }
        const docsMeasured = await scrollAndMeasure(documentsRef);
        if (docsMeasured) {
          steps.push({
            rect: docsMeasured,
            title: "Verifica la tua identità",
            description:
              "Carica un documento d'identità per ricevere il badge Verificato e accedere a più richieste.",
          });
        }
      } else {
        if (avatarRect) {
          steps.push({
            rect: avatarRect,
            title: "Personalizza il tuo profilo",
            description:
              "Aggiungi una foto profilo per essere riconoscibile dai professionisti.",
          });
        }
        if (editRect) {
          steps.push({
            rect: editRect,
            title: "Completa le info personali",
            description:
              "Inserisci nome, numero di telefono e preferenze per un'esperienza su misura.",
          });
        }
        const propsMeasured = await scrollAndMeasure(propertiesRef);
        if (propsMeasured) {
          steps.push({
            rect: propsMeasured,
            title: "Aggiungi indirizzo casa",
            description:
              "Salva l'indirizzo della tua casa per trovare subito i professionisti vicini a te.",
          });
        }
        const payMeasured = await scrollAndMeasure(paymentRef);
        if (payMeasured) {
          steps.push({
            rect: payMeasured,
            title: "Aggiungi metodo di pagamento",
            description:
              "Collega una carta per prenotare in un tap. Sicuro e protetto da Stripe.",
          });
        }
      }

      // After all measurements, scroll back to top so the first spotlight is visible
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });

      if (steps.length >= 1) {
        setProfileCoachSteps(steps);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [showProfileCoach, isCleaner]);

  const handleProfileCoachDone = useCallback(() => {
    setShowProfileCoach(false);
  }, []);

  useEffect(() => {
    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, []);

  const { uploading: avatarUploading, previewVisible, setPreviewVisible, showOptions: handleAvatarPress } =
    useAvatarActions(user?.id, profile?.avatar_url, refreshProfile);

  const handleSwitchRole = useCallback(async () => {
    const newRole: UserProfile["active_role"] = isCleaner ? "client" : "cleaner";
    try {
      await setActiveRole(newRole);
    } catch {
      // silently handle
    }
  }, [isCleaner, setActiveRole]);

  const handleSignOut = useCallback(() => {
    Alert.alert("Esci dall'account", "Sei sicuro di voler uscire?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Esci",
        style: "destructive",
        onPress: () => {
          setShowLogoutAnim(true);
          logoutTimerRef.current = setTimeout(async () => {
            logoutTimerRef.current = null;
            // Mark the marketing onboarding as seen so logout sends the
            // user straight to login instead of the welcome tour again.
            try {
              await AsyncStorage.setItem("cleanhome.onboarding_seen", "true");
            } catch {
              // non-fatal
            }
            await signOut();
            setShowLogoutAnim(false);
            router.replace("/(auth)/login");
          }, 1800);
        },
      },
    ]);
  }, [signOut, router]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Eliminare il tuo account?",
      "Questa azione è IRREVERSIBILE. Verranno cancellati definitivamente:\n\n• Il tuo profilo\n• Le tue prenotazioni passate e future\n• I tuoi annunci (se sei un professionista)\n• Le tue conversazioni e recensioni\n\nNon potrai recuperare i dati. Sei sicuro?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina definitivamente",
          style: "destructive",
          onPress: () => {
            // Second confirmation for irreversible action
            Alert.alert(
              "Conferma finale",
              "Tocca 'Sì, elimina' per procedere. Non potrai più accedere a questo account.",
              [
                { text: "Annulla", style: "cancel" },
                {
                  text: "Sì, elimina",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteOwnAccount();
                      await signOut();
                      router.replace("/(auth)/login");
                    } catch (err: unknown) {
                      const msg =
                        err instanceof Error
                          ? err.message
                          : "Impossibile eliminare l'account";
                      Alert.alert("Errore", msg);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [signOut, router]);

  const handleEditProfile = useCallback(() => {
    router.push("/profile/edit");
  }, [router]);

  const handlePayments = useCallback(() => {
    router.push("/payments");
  }, [router]);

  const handleDocuments = useCallback(() => {
    router.push("/documents");
  }, [router]);

  const handleLegal = useCallback(() => {
    router.push("/legal/terms");
  }, [router]);

  const handlePrivacy = useCallback(() => {
    router.push("/legal/privacy");
  }, [router]);

  // Used by ClientView "Metodo di Pagamento" row
  const handleBankData = useCallback(() => {
    router.push("/payments");
  }, [router]);

  const handleViewListing = useCallback(() => {
    router.push("/cleaner/profile-view");
  }, [router]);

  const handleListing = useCallback(() => {
    router.push("/listings");
  }, [router]);

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── TopAppBar ── */}
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Image
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                source={require("../../assets/icon.png")}
                style={{ width: 28, height: 28, borderRadius: 6 }}
              />
              <Text style={styles.topBarBrand}>CleanHome</Text>
            </View>
          </View>
          <NotificationBell
            color={isCleaner ? C.cleanerPrimary : C.primary}
          />
        </View>

        <Animated.View
          key={isCleaner ? "cleaner" : "client"}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(150)}
          layout={Layout.duration(300)}
        >
          {isCleaner ? (
            <CleanerView
              cleanerId={user?.id}
              initials={initials}
              fullName={profile?.full_name ?? "Utente"}
              avatarUrl={profile?.avatar_url}
              avatarUploading={avatarUploading}
              previewVisible={previewVisible}
              onAvatarPress={handleAvatarPress}
              onPreviewClose={() => setPreviewVisible(false)}
              onEditProfile={handleEditProfile}
              onListing={handleListing}
              onDocuments={handleDocuments}
              onLegal={handleLegal}
              onPrivacy={handlePrivacy}
              onSwitchRole={handleSwitchRole}
              onSignOut={handleSignOut}
              onDeleteAccount={handleDeleteAccount}
              avatarSectionRef={avatarSectionRef}
              editProfileRef={editProfileRef}
              listingRef={listingRef}
              documentsRef={documentsRef}
              payoutSectionRef={payoutSectionRef}
              highlightStripe={highlightStripe}
            />
          ) : (
            <ClientView
              clientId={user?.id}
              initials={initials}
              fullName={profile?.full_name ?? "Utente"}
              avatarUrl={profile?.avatar_url}
              avatarUploading={avatarUploading}
              previewVisible={previewVisible}
              onAvatarPress={handleAvatarPress}
              onPreviewClose={() => setPreviewVisible(false)}
              onEditProfile={handleEditProfile}
              onBankData={handleBankData}
              onDocuments={handleDocuments}
              onPrivacy={handlePrivacy}
              onBookings={() => router.push("/(tabs)/bookings")}
              onProperties={() => router.push("/properties")}
              onSwitchRole={handleSwitchRole}
              onSignOut={handleSignOut}
              onDeleteAccount={handleDeleteAccount}
              onViewListing={handleViewListing}
              avatarSectionRef={avatarSectionRef}
              editProfileRef={editProfileRef}
              propertiesRef={propertiesRef}
              paymentRef={paymentRef}
            />
          )}
        </Animated.View>

        <Text style={styles.versionText}>CleanHome v1.0.0</Text>
      </ScrollView>

      {/* ── Profile coach mark tour (first visit only) ── */}
      {showProfileCoach && profileCoachSteps.length >= 1 && (
        <CoachMarkOverlay
          steps={profileCoachSteps}
          storageKey="cleanhome.first_profile_tour_done"
          onDone={handleProfileCoachDone}
        />
      )}

      {/* ── Logout animation modal ── */}
      <Modal
        visible={showLogoutAnim}
        animationType="fade"
        transparent={false}
        statusBarTranslucent
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#022420",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LottieView
            source={require("../../assets/lottie/cleaning.json")}
            autoPlay
            loop
            speed={1}
            style={{ width: 280, height: 280 }}
          />
          <Animated.Text
            entering={FadeIn.delay(400).duration(600)}
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: "#ffffff",
              marginTop: 16,
              letterSpacing: -0.5,
            }}
          >
            A presto! 👋
          </Animated.Text>
          <Animated.Text
            entering={FadeIn.delay(800).duration(600)}
            style={{
              fontSize: 15,
              color: "rgba(255,255,255,0.6)",
              marginTop: 8,
            }}
          >
            Ci rivediamo su CleanHome
          </Animated.Text>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  scroll: {
    paddingBottom: 56,
  },

  // ── TopAppBar ─────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topBarCleanerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topBarName: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 22,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.4,
  },
  topBarAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surfaceLow,
    borderWidth: 1,
    borderColor: `${C.outlineVariant}26`,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarAvatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.primary,
  },
  topBarBrand: {
    fontSize: 20,
    fontWeight: "700",
    fontStyle: "italic",
    color: "#181c1c",
    letterSpacing: -0.3,
  },
  bellWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // ── Profile hero ──────────────────────────────────────────────────────────────
  heroSection: {
    alignItems: "center",
    paddingTop: 19,
    paddingBottom: 6,
    paddingHorizontal: 24,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  // Square avatar: w-22 h-22 rounded-lg
  avatarSquare: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: "#6f4627",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarInitials: {
    fontSize: 29,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 1,
  },
  // Edit badge: bottom-right, white circle with camera icon
  editBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#022420",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  // name: font-headline text-2xl bold
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  heroName: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 23,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  // role: uppercase small tracking-wide
  heroRole: {
    fontSize: 12,
    fontWeight: "600",
    color: C.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },

  // ── Menu section ──────────────────────────────────────────────────────────────
  menuSection: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  menuCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: `${C.outlineVariant}26`,
    marginLeft: 72,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  menuRowPressed: {
    backgroundColor: C.surfaceLow,
  },
  // Card-style variant: ogni row è una card bianca indipendente
  menuRowCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuRowCardPressed: {
    backgroundColor: C.surfaceLow,
    opacity: 0.92,
  },
  // w-12 h-12 rounded-md bg-surface-container-low
  menuRowIconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  menuRowBody: {
    flex: 1,
  },
  menuRowLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  menuRowSublabel: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    marginTop: 2,
  },

  // ── Sign out ──────────────────────────────────────────────────────────────────
  signOutButton: {
    alignItems: "center",
    paddingVertical: 18,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 14,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.error,
  },

  // ── Listing card (cleaner) ────────────────────────────────────────────────────
  listingCardContainer: {
    backgroundColor: C.surface,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  listingBanner: {
    width: "100%",
    height: 320,
    backgroundColor: C.surfaceLow,
  },
  listingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 320,
    padding: 24,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  listingOverlayText: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 34,
    fontWeight: "700",
    color: "#ffffff",
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  listingContent: {
    padding: 20,
  },
  listingTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  listingRateLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: C.outline,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  listingRate: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  viewListingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.cleanerLight,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  viewListingBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.cleanerPrimary,
  },
  servicesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  serviceTag: {
    backgroundColor: C.cleanerLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  serviceTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.cleanerPrimary,
  },

  // ── Version ───────────────────────────────────────────────────────────────────
  versionText: {
    textAlign: "center",
    fontSize: 11,
    color: `${C.outline}99`,
    letterSpacing: 0.3,
    marginTop: 28,
  },
});

// ─── Client profile styles (Stitch client_profile_dashboard) ─────────────────
// Separati per non toccare gli stili condivisi usati da ClientView.

const clientStyles = StyleSheet.create({
  // ── Hero ────────────────────────────────────────────────────────────────────
  heroSection: {
    alignItems: "center",
    paddingTop: 22,
    paddingBottom: 6,
    paddingHorizontal: 24,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  // 88x88, rounded-lg (12px), bg surface-container-low
  avatarSquare: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: C.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarInitials: {
    fontSize: 29,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 1,
  },
  // edit badge: bottom-right, white circle with camera icon
  editBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#022420",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  // name row: flex row for name + verified badge
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  // name: 25px bold, primary dark green
  heroName: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 25,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  // role: uppercase, letter-spacing 2, 12px, on-surface-variant
  heroRole: {
    fontSize: 12,
    fontWeight: "600",
    color: C.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },

  // ── Menu section (rows indipendenti) ────────────────────────────────────────
  menuSection: {
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },

  // ── Sign out ────────────────────────────────────────────────────────────────
  signOutButton: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderTopWidth: 1,
    borderTopColor: `${C.outlineVariant}40`,
    backgroundColor: `${C.error}08`,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.error,
  },
});

// ─── Payout section container ─────────────────────────────────────────────────
const payoutStyles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
});

// ─── Danger zone styles (logout + delete account) ───────────────────────────
const dangerStyles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginTop: 28,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.outline,
    letterSpacing: 1.4,
    marginLeft: 4,
    marginBottom: 4,
  },
});

// ─── Compact toggle row ────────────────────────────────────────────────────────
const compactToggleStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: C.surfaceLow,
    borderRadius: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: C.primary,
  },
});

// ─── Section headers (menu hierarchy) ─────────────────────────────────────────
const sectionStyles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#64748b",
  },
});
```
