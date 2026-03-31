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
import { searchCleaners } from "../../lib/api";
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
            backgroundColor: selected ? Colors.secondary : Colors.primary,
            borderRadius: 20,
            paddingHorizontal: 10,
            paddingVertical: 5,
            // Outer glow when selected
            ...(selected && {
              shadowColor: Colors.secondary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 8,
              elevation: 8,
            }),
          }}
        >
          <Text
            style={{
              color: selected ? "#ffffff" : Colors.accent,
              fontSize: 12,
              fontWeight: "800",
              letterSpacing: 0.2,
            }}
          >
            {price}€
          </Text>
        </View>
        {/* Pointer triangle */}
        <View
          style={{
            width: 8,
            height: 8,
            backgroundColor: selected ? Colors.secondary : Colors.primary,
            alignSelf: "center",
            marginTop: -4,
            transform: [{ rotate: "45deg" }],
          }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Cleaner Map Card ─────────────────────────────────────────────────────────

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
            backgroundColor: Colors.surface,
            borderRadius: 20,
            overflow: "hidden",
            // Premium multi-layer shadow
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isSelected ? 0.22 : 0.12,
            shadowRadius: 20,
            elevation: isSelected ? 12 : 6,
            // Selected border accent
            borderWidth: isSelected ? 1.5 : 0,
            borderColor: isSelected ? Colors.secondary : "transparent",
          },
        ]}
      >
        {/* Avatar area */}
        <View
          style={{
            height: 160,
            backgroundColor: Colors.primary,
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {cleaner.avatar_url ? (
            <Image
              source={{ uri: cleaner.avatar_url }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: Colors.primaryMid,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: Colors.accent,
                  fontSize: 26,
                  fontWeight: "800",
                  letterSpacing: 1,
                }}
              >
                {initials}
              </Text>
            </View>
          )}

          {/* Rating badge — top right corner */}
          <View
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              backgroundColor: Colors.surface,
              borderRadius: 20,
              paddingHorizontal: 8,
              paddingVertical: 4,
              flexDirection: "row",
              alignItems: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            <Ionicons name="star" size={12} color={Colors.warning} />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: Colors.text,
                marginLeft: 3,
              }}
            >
              {cleaner.avg_rating.toFixed(1)}
            </Text>
          </View>

          {/* Availability dot */}
          <View
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: cleaner.is_available ? Colors.success : Colors.error,
              borderWidth: 2,
              borderColor: Colors.surface,
            }}
          />
        </View>

        {/* Card body */}
        <View style={{ padding: 14 }}>
          {/* Name + price row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "800",
                color: Colors.text,
                flex: 1,
                letterSpacing: -0.3,
              }}
              numberOfLines={1}
            >
              {cleaner.full_name}
            </Text>
            {cleaner.hourly_rate && (
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: Colors.secondary,
                  marginLeft: 8,
                }}
              >
                {cleaner.hourly_rate}€/h
              </Text>
            )}
          </View>

          {/* Bio / city */}
          <Text
            style={{
              fontSize: 12,
              color: Colors.textSecondary,
              lineHeight: 16,
              marginBottom: 12,
            }}
            numberOfLines={2}
          >
            {cleaner.bio ??
              (cleaner.city
                ? `Professionista a ${cleaner.city}`
                : "Pulizie professionali")}
          </Text>

          {/* CTA button */}
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            style={{
              backgroundColor: Colors.primary,
              borderRadius: 12,
              paddingVertical: 11,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: Colors.accent,
                fontSize: 13,
                fontWeight: "700",
                letterSpacing: 0.3,
              }}
            >
              Vedi profilo
            </Text>
          </TouchableOpacity>
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

  useEffect(() => {
    (async () => {
      // Request location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        try {
          const loc = await Location.getCurrentPositionAsync({});
          setRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          });
        } catch {}
      }
      // Load cleaners
      await loadCleaners();
    })();
  }, []);

  const loadCleaners = async (city?: string) => {
    setLoading(true);
    try {
      const results = await searchCleaners(city);
      setCleaners(results);
      setSelectedIndex(0);
    } catch {
      setCleaners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(
    (city: string) => {
      setSearchText(city);
      setSearchFocused(false);
      loadCleaners(city);
    },
    []
  );

  // ── Marker <-> Card sync ──────────────────────────────────────────────────

  // Spread cleaners around the map center with golden angle distribution
  const getCleanerPosition = useCallback(
    (index: number) => {
      const angle = (index * 137.5 * Math.PI) / 180;
      const radius = 0.005 + index * 0.003;
      return {
        latitude: region.latitude + radius * Math.cos(angle),
        longitude: region.longitude + radius * Math.sin(angle),
      };
    },
    [region]
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

      {/* ── Floating header ── */}
      <View
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 20,
          right: 20,
          zIndex: 20,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {/* Avatar bubble */}
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/profile")}
          activeOpacity={0.85}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: Colors.primary,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 8,
            // White border ring
            borderWidth: 2,
            borderColor: Colors.surface,
          }}
        >
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={{ width: 38, height: 38, borderRadius: 19 }}
            />
          ) : (
            <Text
              style={{
                color: Colors.accent,
                fontSize: 13,
                fontWeight: "800",
              }}
            >
              {avatarInitials}
            </Text>
          )}
        </TouchableOpacity>

        {/* App title — editorial serif style per spec */}
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: Colors.primary,
              letterSpacing: 0.2,
              fontStyle: "italic",
              // Text shadow for legibility over map
              textShadowColor: "rgba(255,255,255,0.95)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 8,
            }}
          >
            CleanHome
          </Text>
        </View>

        {/* Notification bell — taps to bookings, red badge for unread */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/(tabs)/bookings")}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: Colors.surface,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.14,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
          {/* Red badge dot */}
          <View
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: Colors.error,
              borderWidth: 1.5,
              borderColor: Colors.surface,
            }}
          />
        </TouchableOpacity>
      </View>

      {/* ── Floating search bar ── */}
      <Animated.View
        style={[
          searchBarStyle,
          {
            position: "absolute",
            top: insets.top + 62,
            left: 20,
            right: 20,
            zIndex: 20,
            backgroundColor: Colors.surface,
            borderRadius: 30,
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: 16,
            paddingRight: 6,
            height: 50,
            // Base shadow
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 6,
          },
        ]}
      >
        <Ionicons name="search" size={17} color={Colors.textTertiary} />
        <TextInput
          style={{
            flex: 1,
            marginLeft: 10,
            fontSize: 14,
            color: Colors.text,
            paddingVertical: 0,
          }}
          placeholder="Cerca pulitori..."
          placeholderTextColor={Colors.textTertiary}
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

        {/* Clear button */}
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => handleSearch("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginRight: 6 }}
          >
            <Ionicons name="close-circle" size={17} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}

        {/* Filter button */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: Colors.secondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="options-outline" size={17} color="#ffffff" />
        </TouchableOpacity>
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
        {/* Cleaners count pill */}
        {!loading && cleaners.length > 0 && (
          <View
            style={{
              alignSelf: "center",
              backgroundColor: Colors.primary,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 6,
              marginBottom: 12,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <Text
              style={{
                color: Colors.accent,
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 0.3,
              }}
            >
              {cleaners.length} professionisti vicino a te
            </Text>
          </View>
        )}

        {loading ? (
          // Skeleton cards while loading
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
                  height: 300,
                  backgroundColor: Colors.surface,
                  borderRadius: 20,
                  overflow: "hidden",
                }}
              >
                {/* Shimmer avatar area */}
                <View
                  style={{
                    height: 160,
                    backgroundColor: Colors.surfaceElevated,
                  }}
                />
                <View style={{ padding: 14, gap: 8 }}>
                  <View
                    style={{
                      height: 14,
                      width: "60%",
                      backgroundColor: Colors.surfaceElevated,
                      borderRadius: 7,
                    }}
                  />
                  <View
                    style={{
                      height: 12,
                      width: "90%",
                      backgroundColor: Colors.borderLight,
                      borderRadius: 6,
                    }}
                  />
                  <View
                    style={{
                      height: 12,
                      width: "70%",
                      backgroundColor: Colors.borderLight,
                      borderRadius: 6,
                    }}
                  />
                  <View
                    style={{
                      height: 40,
                      backgroundColor: Colors.surfaceElevated,
                      borderRadius: 12,
                      marginTop: 4,
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
            onScrollToIndexFailed={() => {}}
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
