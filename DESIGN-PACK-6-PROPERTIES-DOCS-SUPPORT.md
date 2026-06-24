# CleanHome — Pack 6 — Properties + Docs + Support + Legal + Payments

Stack: React Native + Expo Router v3 + NativeWind + TypeScript
Vedi DESIGN-AUDIT-README.md per il contesto completo.

---

### `app/properties/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function PropertiesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="edit" />
    </Stack>
  );
}
```

---

### `app/properties/index.tsx`

```tsx
// ============================================================================
// Screen: Le mie case — list of saved client properties
// ----------------------------------------------------------------------------
// Entry point for the multi-property feature. Shows a list of all houses the
// client has saved, with a FAB that opens the add/edit form and a card-tap
// that opens the same form in edit mode. The default property floats to the
// top with a green chip. Empty state invites first-time users to add a house.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { fetchClientProperties } from "../../lib/api";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";
import type { ClientProperty } from "../../lib/types";
import { NotificationBell } from "../../components/NotificationBell";

export default function PropertiesListScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ClientProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchClientProperties(user.id);
      setItems(data);
    } catch (err) {
      console.error("[properties] load error", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Refresh each time the screen gains focus so edits/adds from the form
  // bubble back up without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAdd = useCallback(() => {
    // New properties go through the multi-step wizard; only edits
    // (with an id param) still hit /properties/edit.
    router.push("/properties/new");
  }, [router]);

  const handleEdit = useCallback(
    (id: string) => {
      router.push({ pathname: "/properties/edit", params: { id } });
    },
    [router]
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={10}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Le mie case</Text>
        <NotificationBell color={Colors.text} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.secondary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── Intro block ── */}
          <View style={styles.introBlock}>
            <Text style={styles.introTitle}>Le tue case salvate</Text>
            <Text style={styles.introSub}>
              Salva gli indirizzi che usi spesso. Potrai prenotare una pulizia
              in un tocco — niente più indirizzo da riscrivere ogni volta.
            </Text>
          </View>

          {items.length === 0 ? (
            <EmptyState onAdd={handleAdd} />
          ) : (
            <View style={{ gap: Spacing.md }}>
              {items.map((item) => (
                <PropertyCard
                  key={item.id}
                  item={item}
                  onPress={() => handleEdit(item.id)}
                />
              ))}
              <TouchableOpacity
                onPress={handleAdd}
                activeOpacity={0.85}
                style={styles.addAnotherBtn}
              >
                <Ionicons
                  name="add-circle"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.addAnotherText}>Aggiungi un'altra casa</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Floating Action Button — only when list has items ── */}
      {items.length > 0 && !loading && (
        <View style={styles.fab}>
          <Pressable
            onPress={handleAdd}
            accessibilityLabel="Aggiungi una nuova casa"
            android_ripple={{ color: "rgba(255,255,255,0.18)" }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="add" size={26} color="#fff" pointerEvents="none" />
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── PropertyCard ──────────────────────────────────────────────────────────

function PropertyCard({
  item,
  onPress,
}: {
  item: ClientProperty;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && { transform: [{ scale: 0.985 }] },
      ]}
    >
      <View style={styles.cardIconWrap}>
        <Ionicons name="home" size={22} color="#d97706" />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </Text>
          {item.is_default && (
            <View style={styles.defaultChip}>
              <Ionicons name="star" size={11} color={Colors.secondary} />
              <Text style={styles.defaultChipText}>Predefinita</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardAddress} numberOfLines={2}>
          {item.address}
        </Text>
        <View style={styles.cardMetaRow}>
          <View style={styles.metaPill}>
            <Ionicons
              name="bed-outline"
              size={12}
              color={Colors.textSecondary}
            />
            <Text style={styles.metaPillText}>
              {item.num_rooms} {item.num_rooms === 1 ? "stanza" : "stanze"}
            </Text>
          </View>
          {item.sqm ? (
            <View style={styles.metaPill}>
              <Ionicons
                name="resize-outline"
                size={12}
                color={Colors.textSecondary}
              />
              <Text style={styles.metaPillText}>{item.sqm} m²</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={Colors.textTertiary}
      />
    </Pressable>
  );
}

// ─── EmptyState ────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIllustration}>
        <Ionicons name="home-outline" size={44} color={Colors.secondary} />
      </View>
      <Text style={styles.emptyTitle}>Nessuna casa salvata</Text>
      <Text style={styles.emptyText}>
        Aggiungi la tua prima casa per prenotare pulizie in un attimo. È perfetto
        se hai più di una proprietà da gestire.
      </Text>
      <TouchableOpacity
        onPress={onAdd}
        activeOpacity={0.85}
        style={styles.ctaBtn}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.ctaBtnText}>Aggiungi la prima casa</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.text,
  },

  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  scroll: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 120,
  },

  introBlock: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  introTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  introSub: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },

  // --- Card ---
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    // Soft amber wash matches the client-mode property card on Home —
    // a property in client view always uses the warm orange family.
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    maxWidth: "70%",
  },
  defaultChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.accentLight,
  },
  defaultChipText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cardAddress: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  cardMetaRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.backgroundAlt,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },

  // --- Add another — solid dark-green slab ---
  addAnotherBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: "#022420",
    marginTop: Spacing.sm,
    shadowColor: "#011a17",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  addAnotherText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.15,
  },

  // --- Empty state ---
  emptyWrap: {
    alignItems: "center",
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.base,
  },
  emptyIllustration: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
    marginBottom: Spacing.xl,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 26,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: "#022420",
    shadowColor: "#011a17",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },

  // --- FAB ---
  fab: {
    position: "absolute",
    bottom: 28,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#d97706",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.lg,
  },
});
```

---

### `app/properties/new.tsx`

```tsx
// New property wizard — 4-step flow for creating a property listing.
//
//   Step 1  Property type     (apartment / house / office / restaurant / bnb / shop / other)
//   Step 2  Cleaning frequency (monthly / biweekly / weekly / twice_weekly)
//   Step 3  Type-specific details (changes shape based on Step 1)
//   Step 4  Address + name + cover photo
//
// Premium visual redesign: SVG hero illustrations per step, micro-interactions
// on type tiles, staggered card entrances, animated segmented progress bar,
// and a glow CTA with sparkle icon on the final step.
//
// Editing existing properties still goes through /properties/edit — this
// route is creation-only and will redirect any incoming `id` param there.

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView from "react-native-maps";
import * as Location from "expo-location";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth";
import { createClientProperty, fetchAddressDetails, searchAddresses } from "../../lib/api";
import type { AddressSuggestion } from "../../lib/api";
import { Colors, Radius, Shadows, Spacing } from "../../lib/theme";
import type {
  CleaningFrequency,
  PropertyType,
  PropertyTypeDetails,
} from "../../lib/types";

// ─────────────────────────── Static config ───────────────────────────

const PROPERTY_TYPES: {
  id: PropertyType;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  tint: string;
}[] = [
  { id: "apartment",  icon: "business-outline",     label: "Appartamento",            sub: "In condominio",           tint: "#006b55" },
  { id: "house",      icon: "home-outline",         label: "Casa indipendente / Villa", sub: "Singola con esterni",   tint: "#0d7d6c" },
  { id: "office",     icon: "briefcase-outline",    label: "Ufficio / Studio",        sub: "Spazio di lavoro",        tint: "#3a7bd5" },
  { id: "restaurant", icon: "restaurant-outline",   label: "Ristorante / Bar",        sub: "Locale di ristoro",       tint: "#e85d4f" },
  { id: "bnb",        icon: "bed-outline",          label: "B&B / Airbnb",            sub: "Casa vacanze",            tint: "#b85ca0" },
  { id: "shop",       icon: "storefront-outline",   label: "Negozio",                 sub: "Vetrina commerciale",     tint: "#d97a3a" },
  { id: "other",      icon: "ellipsis-horizontal-circle-outline", label: "Altro",     sub: "Tipologia non in lista",  tint: "#6e7c80" },
];

const FREQUENCIES: {
  id: CleaningFrequency;
  label: string;
  sub: string;
  perMonth: string;
}[] = [
  { id: "monthly",      label: "1 volta al mese",      sub: "Ogni 30 giorni",        perMonth: "1×/mese" },
  { id: "biweekly",     label: "2 volte al mese",      sub: "Ogni 15 giorni",        perMonth: "2×/mese" },
  { id: "weekly",       label: "1 volta a settimana",  sub: "Ogni 7 giorni",         perMonth: "4×/mese" },
  { id: "twice_weekly", label: "2 volte a settimana",  sub: "Ogni 3-4 giorni",       perMonth: "8×/mese" },
];

const APARTMENT_TYPOLOGIES = [
  { id: "monolocale",   label: "Monolocale",   sub: "1 ambiente"   },
  { id: "bilocale",     label: "Bilocale",     sub: "1 camera"     },
  { id: "trilocale",    label: "Trilocale",    sub: "2 camere"     },
  { id: "quadrilocale", label: "Quadrilocale", sub: "3 camere"     },
  { id: "5locali",      label: "5 locali",     sub: "Grande"       },
  { id: "6locali",      label: "6 locali",     sub: "Molto grande" },
  { id: "7locali",      label: "7+ locali",    sub: "Villa/attico" },
];

const TYPOLOGY_TO_ROOMS: Record<string, number> = {
  monolocale: 1, bilocale: 2, trilocale: 3, quadrilocale: 4,
  "5locali": 5, "6locali": 6, "7locali": 7,
};

const TOTAL_STEPS = 4;
const NAME_MAX = 60;
const ADDRESS_MAX = 255;

// ─────────────────────────── Spring configs ───────────────────────────

const SPRING_SNAPPY  = { damping: 18, stiffness: 300, mass: 0.8 };
const SPRING_GENTLE  = { damping: 22, stiffness: 180 };
const SPRING_BOUNCY  = { damping: 10, stiffness: 220 };

// ─────────────────────────── Hero illustrations (SVG) ─────────────────

// Step 1: House with animated sparkles
function HeroStep1() {
  const pulse   = useSharedValue(1);
  const spark1  = useSharedValue(0);
  const spark2  = useSharedValue(0);
  const spark3  = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0,  { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    spark1.value = withDelay(200,
      withRepeat(
        withSequence(withTiming(1, { duration: 600 }), withTiming(0, { duration: 400 })),
        -1, false,
      ),
    );
    spark2.value = withDelay(700,
      withRepeat(
        withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 500 })),
        -1, false,
      ),
    );
    spark3.value = withDelay(1100,
      withRepeat(
        withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 300 })),
        -1, false,
      ),
    );
    // Cancel infinite loops on unmount — otherwise Reanimated keeps
    // running them after the screen leaves, leaking CPU/memory.
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(spark1);
      cancelAnimation(spark2);
      cancelAnimation(spark3);
    };
  }, [pulse, spark1, spark2, spark3]);

  const houseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  const s1Style = useAnimatedStyle(() => ({ opacity: spark1.value }));
  const s2Style = useAnimatedStyle(() => ({ opacity: spark2.value }));
  const s3Style = useAnimatedStyle(() => ({ opacity: spark3.value }));

  return (
    <View style={heroStyles.container}>
      <Animated.View style={houseStyle}>
        <Svg width={100} height={88} viewBox="0 0 100 88">
          <Defs>
            <RadialGradient id="houseBg" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#00c896" stopOpacity="0.18" />
              <Stop offset="100%" stopColor="#006b55" stopOpacity="0.04" />
            </RadialGradient>
          </Defs>
          {/* Base circle glow */}
          <Circle cx="50" cy="50" r="44" fill="url(#houseBg)" />
          {/* Roof */}
          <Polygon points="50,14 82,42 18,42" fill="#006b55" opacity={0.9} />
          <Polygon points="50,14 82,42 18,42" fill="none" stroke="#00c896" strokeWidth="1.5" opacity={0.6} />
          {/* Chimney */}
          <Rect x="62" y="22" width="7" height="14" rx="1" fill="#022420" opacity={0.7} />
          {/* Walls */}
          <Rect x="22" y="42" width="56" height="34" rx="3" fill="#e8fdf7" />
          <Rect x="22" y="42" width="56" height="34" rx="3" fill="none" stroke="#006b55" strokeWidth="1.5" opacity={0.5} />
          {/* Door */}
          <Rect x="42" y="58" width="16" height="18" rx="2" fill="#006b55" opacity={0.8} />
          <Circle cx="55" cy="67" r="1.5" fill="#00c896" />
          {/* Windows */}
          <Rect x="27" y="50" width="12" height="10" rx="2" fill="#00c896" opacity={0.3} />
          <Rect x="61" y="50" width="12" height="10" rx="2" fill="#00c896" opacity={0.3} />
          <Line x1="33" y1="50" x2="33" y2="60" stroke="#006b55" strokeWidth="1" opacity={0.4} />
          <Line x1="27" y1="55" x2="39" y2="55" stroke="#006b55" strokeWidth="1" opacity={0.4} />
          <Line x1="67" y1="50" x2="67" y2="60" stroke="#006b55" strokeWidth="1" opacity={0.4} />
          <Line x1="61" y1="55" x2="73" y2="55" stroke="#006b55" strokeWidth="1" opacity={0.4} />
        </Svg>
      </Animated.View>
      {/* Sparkles */}
      <Animated.View style={[heroStyles.spark, { top: 8, right: 32 }, s1Style]}>
        <Svg width={14} height={14} viewBox="0 0 14 14">
          <Path d="M7 1 L7.8 5.8 L12 7 L7.8 8.2 L7 13 L6.2 8.2 L2 7 L6.2 5.8 Z" fill="#00c896" />
        </Svg>
      </Animated.View>
      <Animated.View style={[heroStyles.spark, { top: 20, left: 28 }, s2Style]}>
        <Svg width={10} height={10} viewBox="0 0 14 14">
          <Path d="M7 1 L7.8 5.8 L12 7 L7.8 8.2 L7 13 L6.2 8.2 L2 7 L6.2 5.8 Z" fill="#00c896" opacity={0.7} />
        </Svg>
      </Animated.View>
      <Animated.View style={[heroStyles.spark, { bottom: 14, right: 20 }, s3Style]}>
        <Svg width={8} height={8} viewBox="0 0 14 14">
          <Path d="M7 1 L7.8 5.8 L12 7 L7.8 8.2 L7 13 L6.2 8.2 L2 7 L6.2 5.8 Z" fill="#006b55" opacity={0.8} />
        </Svg>
      </Animated.View>
    </View>
  );
}

// Step 2: Calendar with cells lighting in sequence
//
// The day cells live in their own component so each can declare its
// own hooks (useSharedValue + useAnimatedStyle) at the top level —
// otherwise they would have to be declared inside a .map() in the
// parent, which violates the Rules of Hooks and can crash on Hermes.
function HeroCalCell({ index, even }: { index: number; even: boolean }) {
  const opacity = useSharedValue(0.15);
  useEffect(() => {
    opacity.value = withDelay(
      index * 200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 350 }),
          withTiming(0.15, { duration: 350 }),
        ),
        -1,
        false,
      ),
    );
    return () => { cancelAnimation(opacity); };
  }, [index, opacity]);
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    backgroundColor: even ? "#00c896" : "#006b55",
  }));
  return <Animated.View style={[heroStyles.calCell, animStyle]} />;
}

function HeroStep2() {
  const cells = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <View style={heroStyles.container}>
      <Svg width={110} height={96} viewBox="0 0 110 96">
        <Defs>
          <RadialGradient id="calBg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#00c896" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#006b55" stopOpacity="0.03" />
          </RadialGradient>
        </Defs>
        <Circle cx="55" cy="48" r="46" fill="url(#calBg)" />
        {/* Calendar body */}
        <Rect x="14" y="20" width="82" height="62" rx="8" fill="#ffffff" stroke="#d4e4e0" strokeWidth="1.5" />
        {/* Header */}
        <Rect x="14" y="20" width="82" height="20" rx="8" fill="#006b55" />
        <Rect x="14" y="32" width="82" height="8" rx="0" fill="#006b55" />
        {/* Calendar pins */}
        <Rect x="29" y="14" width="5" height="12" rx="2.5" fill="#022420" opacity={0.7} />
        <Rect x="76" y="14" width="5" height="12" rx="2.5" fill="#022420" opacity={0.7} />
        {/* Month label */}
        <Rect x="36" y="26" width="38" height="7" rx="3" fill="#00c896" opacity={0.6} />
      </Svg>
      {/* Animated day cells laid on top */}
      <View style={heroStyles.calCells} pointerEvents="none">
        {cells.map((c, i) => (
          <HeroCalCell key={c} index={i} even={i % 2 === 0} />
        ))}
      </View>
    </View>
  );
}

// Step 3: Morphing shape that changes per property type
function HeroStep3({ propertyType }: { propertyType: PropertyType | null }) {
  const morphProgress = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    morphProgress.value = withSpring(1, SPRING_GENTLE);
    // Cancel any running float loop before starting a new one — without
    // this, every change of `propertyType` stacks an extra withRepeat on
    // top of the previous one and the illustration appears to accelerate.
    cancelAnimation(float);
    float.value = 0;
    float.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(4, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    return () => { cancelAnimation(float); };
  }, [propertyType, morphProgress, float]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }],
  }));

  const iconForType = () => {
    switch (propertyType) {
      case "office":     return "briefcase-outline";
      case "restaurant": return "restaurant-outline";
      case "bnb":        return "bed-outline";
      case "shop":       return "storefront-outline";
      case "house":      return "home-outline";
      case "other":      return "shapes-outline";
      default:           return "business-outline";
    }
  };

  const tintForType = () => {
    switch (propertyType) {
      case "office":     return "#3a7bd5";
      case "restaurant": return "#e85d4f";
      case "bnb":        return "#b85ca0";
      case "shop":       return "#d97a3a";
      case "house":      return "#0d7d6c";
      default:           return "#006b55";
    }
  };

  const tint = tintForType();

  return (
    <View style={heroStyles.container}>
      <Animated.View entering={FadeIn.duration(280)} style={floatStyle}>
        <Svg width={110} height={96} viewBox="0 0 110 96">
          <Defs>
            <RadialGradient id="step3Bg" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={tint} stopOpacity="0.15" />
              <Stop offset="100%" stopColor={tint} stopOpacity="0.03" />
            </RadialGradient>
          </Defs>
          <Circle cx="55" cy="48" r="44" fill="url(#step3Bg)" />
          {/* Outer ring */}
          <Circle cx="55" cy="48" r="36" fill="none" stroke={tint} strokeWidth="1" strokeDasharray="4 6" opacity={0.4} />
          {/* Inner card */}
          <Rect x="28" y="26" width="54" height="44" rx="10" fill="#fff" stroke={tint} strokeWidth="1.5" opacity={0.9} />
          {/* Icon placeholder rects — decorative */}
          <Rect x="36" y="36" width="18" height="4" rx="2" fill={tint} opacity={0.5} />
          <Rect x="36" y="44" width="30" height="3" rx="1.5" fill={tint} opacity={0.25} />
          <Rect x="36" y="51" width="24" height="3" rx="1.5" fill={tint} opacity={0.18} />
          {/* Bottom accent bar */}
          <Rect x="28" y="60" width="54" height="10" rx="0" fill={tint} opacity={0.08} />
          <Rect x="28" y="62" width="54" height="8" rx="0" fill="none" />
          <Rect x="28" y="66" width="54" height="4" rx="0" fill={tint} opacity={0.15} />
          {/* Checkmark top-right */}
          <Circle cx="74" cy="32" r="8" fill={tint} opacity={0.9} />
          <Path d="M70 32 L73 35 L78 29" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      <View style={[heroStyles.iconBadge, { backgroundColor: `${tint}18` }]}>
        <Ionicons name={iconForType()} size={16} color={tint} />
      </View>
    </View>
  );
}

// Step 4: Location pin with concentric pulse waves
function HeroStep4({ validated }: { validated: boolean }) {
  const wave1 = useSharedValue(0);
  const wave2 = useSharedValue(0);
  const wave3 = useSharedValue(0);
  const pinScale = useSharedValue(1);

  useEffect(() => {
    const cfg = { duration: 1600, easing: Easing.out(Easing.exp) };
    wave1.value = withRepeat(withTiming(1, cfg), -1, false);
    wave2.value = withDelay(520, withRepeat(withTiming(1, cfg), -1, false));
    wave3.value = withDelay(1040, withRepeat(withTiming(1, cfg), -1, false));
    return () => {
      cancelAnimation(wave1);
      cancelAnimation(wave2);
      cancelAnimation(wave3);
    };
  }, [wave1, wave2, wave3]);

  useEffect(() => {
    if (validated) {
      pinScale.value = withSequence(
        withSpring(1.25, SPRING_BOUNCY),
        withSpring(1.0, SPRING_GENTLE),
      );
    }
  }, [validated, pinScale]);

  // Each wave gets its own useAnimatedStyle call at the top level — the
  // helper-as-hook pattern violates Rules of Hooks even when the call
  // count is stable.
  const w1s = useAnimatedStyle(() => ({
    opacity: interpolate(wave1.value, [0, 0.6, 1], [0.5, 0.18, 0]),
    transform: [{ scale: interpolate(wave1.value, [0, 1], [0.4, 1]) }],
  }));
  const w2s = useAnimatedStyle(() => ({
    opacity: interpolate(wave2.value, [0, 0.6, 1], [0.5, 0.18, 0]),
    transform: [{ scale: interpolate(wave2.value, [0, 1], [0.4, 1]) }],
  }));
  const w3s = useAnimatedStyle(() => ({
    opacity: interpolate(wave3.value, [0, 0.6, 1], [0.5, 0.18, 0]),
    transform: [{ scale: interpolate(wave3.value, [0, 1], [0.4, 1]) }],
  }));
  const pinStyle = useAnimatedStyle(() => ({ transform: [{ scale: pinScale.value }] }));

  const pinColor = validated ? "#00c896" : "#006b55";

  return (
    <View style={heroStyles.container}>
      {/* Pulse rings */}
      <Animated.View style={[heroStyles.waveRing, { width: 96, height: 96, borderRadius: 48, borderColor: pinColor }, w3s]} />
      <Animated.View style={[heroStyles.waveRing, { width: 72, height: 72, borderRadius: 36, borderColor: pinColor }, w2s]} />
      <Animated.View style={[heroStyles.waveRing, { width: 52, height: 52, borderRadius: 26, borderColor: pinColor }, w1s]} />
      {/* Pin */}
      <Animated.View style={pinStyle}>
        <Svg width={52} height={64} viewBox="0 0 52 64">
          <Path
            d="M26 2 C12.7 2 2 12.7 2 26 C2 42 26 62 26 62 C26 62 50 42 50 26 C50 12.7 39.3 2 26 2 Z"
            fill={pinColor}
          />
          <Circle cx="26" cy="26" r="10" fill="#fff" opacity={0.9} />
          {validated && (
            <Path d="M20 26 L24 30 L32 21" stroke={pinColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    height: 120,
    marginBottom: 8,
    position: "relative",
  },
  spark: {
    position: "absolute",
  },
  calCells: {
    position: "absolute",
    top: 52,
    left: 28,
    flexDirection: "row",
    flexWrap: "wrap",
    width: 82,
    gap: 4,
  },
  calCell: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  iconBadge: {
    position: "absolute",
    bottom: 16,
    right: 24,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  waveRing: {
    position: "absolute",
    borderWidth: 1.5,
  },
});

// ─────────────────────────── Main component ───────────────────────────

export default function NewPropertyWizard() {
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null);

  // Step 2
  const [frequency, setFrequency] = useState<CleaningFrequency | null>(null);

  // Step 3
  const [details, setDetails] = useState<DraftDetails>({});

  // Step 4
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [addressLatLng, setAddressLatLng] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Step gating ──────────────────────────────────────────
  const canAdvance = useMemo(() => {
    switch (step) {
      case 1: return !!propertyType;
      case 2: return !!frequency;
      case 3: return isStep3Valid(propertyType, details);
      case 4: return name.trim().length > 0 && !!addressLatLng;
    }
  }, [step, propertyType, frequency, details, name, addressLatLng]);

  // ── Address autocomplete ─────────────────────────────────
  const onAddressChange = useCallback((text: string) => {
    setAddress(text);
    setAddressLatLng(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (text.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearchingAddress(true);
      try {
        const results = await searchAddresses(text, ctrl.signal);
        if (!ctrl.signal.aborted) setAddressSuggestions(results);
      } catch {
        // swallow — user is still typing
      } finally {
        if (!ctrl.signal.aborted) setSearchingAddress(false);
      }
    }, 300);
  }, []);

  const pickSuggestion = useCallback(async (s: AddressSuggestion) => {
    const fullLabel = s.secondaryText
      ? `${s.mainText}, ${s.secondaryText}`
      : s.mainText;
    setAddress(fullLabel);
    setAddressSuggestions([]);

    // Google Places autocomplete returns lat=0/lng=0 — resolve via placeId
    const hasCoords = Math.abs(s.latitude) > 0.001 || Math.abs(s.longitude) > 0.001;
    if (hasCoords) {
      setAddressLatLng({ latitude: s.latitude, longitude: s.longitude });
    } else {
      setSearchingAddress(true);
      try {
        const details = await fetchAddressDetails(s.placeId);
        if (details && (Math.abs(details.latitude) > 0.001 || Math.abs(details.longitude) > 0.001)) {
          setAddressLatLng({ latitude: details.latitude, longitude: details.longitude });
        } else {
          // Fallback: show error — do NOT save (0,0)
          setAddressLatLng(null);
        }
      } catch {
        setAddressLatLng(null);
      } finally {
        setSearchingAddress(false);
      }
    }
  }, []);

  // ── Save ─────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!user || !propertyType || saving) return;
    if (!canAdvance) return;
    setSaving(true);
    try {
      const persistedDetails = buildPersistedDetails(propertyType, details);
      const numRooms = deriveNumRooms(propertyType, details);
      const sqm = deriveSqm(propertyType, details);

      await createClientProperty(user.id, {
        name: name.trim(),
        address: address.trim(),
        num_rooms: numRooms,
        sqm,
        notes: null,
        photo_url: null,
        cover_photo_url: null,
        room_photo_urls: [],
        is_default: false,
        property_type: propertyType,
        cleaning_frequency: frequency,
        type_details: persistedDetails,
        latitude: addressLatLng?.latitude ?? null,
        longitude: addressLatLng?.longitude ?? null,
      });
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Impossibile creare la casa.";
      Alert.alert("Errore", msg);
    } finally {
      setSaving(false);
    }
  }, [user, propertyType, frequency, details, name, address, addressLatLng, saving, canAdvance, router]);

  const onPrimary = useCallback(() => {
    if (step < TOTAL_STEPS) setStep((s) => (s + 1) as typeof step);
    else handleSave();
  }, [step, handleSave]);

  const onBack = useCallback(() => {
    if (step > 1) setStep((s) => (s - 1) as typeof step);
    else router.back();
  }, [step, router]);

  // ── Render ───────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />

      <Header step={step} onBack={onBack} />
      <SegmentedProgressBar step={step} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <Animated.View
              key="step-1"
              entering={FadeInDown.duration(260).springify()}
              exiting={FadeOut.duration(160)}
            >
              <HeroStep1 />
              <StepHeading
                kicker="Step 1 di 4"
                title="Cosa vuoi far pulire?"
                subtitle="Scegli il tipo di proprietà — useremo i pulitori specializzati per questo ambiente"
              />
              <View style={styles.typeGrid}>
                {PROPERTY_TYPES.map((t, i) => (
                  <TypeCard
                    key={t.id}
                    delay={i * 55}
                    selected={propertyType === t.id}
                    isAnySelected={propertyType !== null}
                    onPress={() => {
                      // Switching type wipes the previous type's details
                      // so leftover values (e.g. covers from "restaurant"
                      // when switching to "apartment") can never silently
                      // satisfy the new type's validation in Step 3.
                      if (propertyType !== t.id) setDetails({});
                      setPropertyType(t.id);
                    }}
                    icon={t.icon}
                    label={t.label}
                    sub={t.sub}
                    tint={t.tint}
                  />
                ))}
              </View>
            </Animated.View>
          )}

          {step === 2 && (
            <Animated.View
              key="step-2"
              entering={FadeInDown.duration(260).springify()}
              exiting={FadeOut.duration(160)}
            >
              <HeroStep2 />
              <StepHeading
                kicker="Step 2 di 4"
                title="Ogni quanto vuoi pulire?"
                subtitle="Più frequenza = prezzo per sessione più conveniente. Puoi cambiarla in qualsiasi momento"
              />
              <View style={{ gap: 12 }}>
                {FREQUENCIES.map((f, i) => (
                  <FreqCard
                    key={f.id}
                    delay={i * 60}
                    selected={frequency === f.id}
                    onPress={() => setFrequency(f.id)}
                    label={f.label}
                    sub={f.sub}
                    badge={f.perMonth}
                  />
                ))}
              </View>
            </Animated.View>
          )}

          {step === 3 && (
            <Animated.View
              key="step-3"
              entering={FadeInDown.duration(260).springify()}
              exiting={FadeOut.duration(160)}
            >
              <HeroStep3 propertyType={propertyType} />
              <StepHeading
                kicker="Step 3 di 4"
                title={titleForType(propertyType)}
                subtitle="Aiuta il pulitore a stimare il lavoro"
              />
              <Step3Details
                propertyType={propertyType}
                details={details}
                setDetails={setDetails}
              />
            </Animated.View>
          )}

          {step === 4 && (
            <Animated.View
              key="step-4"
              entering={FadeInDown.duration(260).springify()}
              exiting={FadeOut.duration(160)}
            >
              <HeroStep4 validated={!!addressLatLng} />
              <StepHeading
                kicker="Step 4 di 4"
                title="Dove si trova?"
                subtitle="Indirizzo + un nome per riconoscerla nella lista"
              />

              <FieldLabel>Nome della casa</FieldLabel>
              <View style={styles.inputWrap}>
                <Ionicons name="bookmark-outline" size={18} color={Colors.textTertiary} />
                <TextInput
                  value={name}
                  onChangeText={(t) => setName(t.slice(0, NAME_MAX))}
                  placeholder='Es. "Casa principale"'
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.inputText}
                  maxLength={NAME_MAX}
                  autoCapitalize="sentences"
                />
              </View>

              <FieldLabel style={{ marginTop: 18 }}>Indirizzo</FieldLabel>
              <View style={[styles.inputWrap, addressLatLng ? styles.inputWrapValidated : null]}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={addressLatLng ? Colors.accent : Colors.textTertiary}
                />
                <TextInput
                  value={address}
                  onChangeText={onAddressChange}
                  placeholder="Via, numero civico, città"
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.inputText}
                  maxLength={ADDRESS_MAX}
                  autoCapitalize="none"
                />
                {addressLatLng && (
                  <Animated.View entering={FadeIn.duration(200)}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
                  </Animated.View>
                )}
              </View>
              {searchingAddress && (
                <Text style={styles.searchingHint}>Cerco indirizzi…</Text>
              )}
              {addressSuggestions.length > 0 && (
                <View style={styles.suggestionsBox}>
                  {addressSuggestions.slice(0, 5).map((s, i) => (
                    <Pressable
                      key={s.placeId}
                      onPress={() => pickSuggestion(s)}
                      style={({ pressed }) => [
                        styles.suggestionRow,
                        i === addressSuggestions.slice(0, 5).length - 1 && styles.suggestionRowLast,
                        pressed && { backgroundColor: Colors.surfaceElevated },
                      ]}
                    >
                      <View style={styles.suggestionDot}>
                        <Ionicons name="location" size={12} color={Colors.secondary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionTxt} numberOfLines={1}>
                          {s.mainText}
                        </Text>
                        {!!s.secondaryText && (
                          <Text style={styles.suggestionSubTxt} numberOfLines={1}>
                            {s.secondaryText}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
              {!addressLatLng && address.trim().length > 2 && addressSuggestions.length === 0 && !searchingAddress && (
                <Text style={styles.errorHint}>
                  Seleziona un indirizzo dalla lista per continuare
                </Text>
              )}

              {/* Alternative input: pick the location on a map. Useful when
                  the autocomplete doesn't return a precise enough match
                  (e.g. country houses, new buildings, Airbnb units). */}
              <View style={styles.mapDivider}>
                <View style={styles.mapDividerLine} />
                <Text style={styles.mapDividerTxt}>oppure</Text>
                <View style={styles.mapDividerLine} />
              </View>
              <Pressable
                onPress={() => setMapPickerOpen(true)}
                style={({ pressed }) => [
                  styles.mapPickerBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="map-outline" size={20} color={Colors.secondary} />
                <Text style={styles.mapPickerTxt}>Scegli sulla mappa</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>

        {/* CTA — always visible. When the current step isn't valid yet,
            tapping it shakes + flashes a reminder of what's missing. */}
        <PremiumCTA
          step={step}
          saving={saving}
          canAdvance={canAdvance}
          missingHint={missingHintForStep(step, propertyType)}
          onPress={onPrimary}
        />
      </KeyboardAvoidingView>

      <MapPicker
        visible={mapPickerOpen}
        initial={addressLatLng}
        onClose={() => setMapPickerOpen(false)}
        onPick={(coord, formatted) => {
          setAddressLatLng(coord);
          setAddress(formatted);
          setAddressSuggestions([]);
          setMapPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────── Sub-components ───────────────────────────

function Header({ step, onBack }: { step: number; onBack: () => void }) {
  const backScale = useSharedValue(1);
  const backStyle = useAnimatedStyle(() => ({ transform: [{ scale: backScale.value }] }));

  return (
    <View style={styles.header}>
      <Animated.View style={backStyle}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={styles.headerBtn}
          onPressIn={() => { backScale.value = withSpring(0.88, SPRING_SNAPPY); }}
          onPressOut={() => { backScale.value = withSpring(1.0, SPRING_SNAPPY); }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
      </Animated.View>
      <Animated.Text
        key={`header-${step}`}
        entering={FadeInDown.duration(220)}
        style={styles.headerTitle}
      >
        Nuova casa
      </Animated.Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

// Segmented 4-pill progress bar with glow on active segment
function SegmentedProgressBar({ step }: { step: number }) {
  return (
    <View style={styles.progressWrap}>
      {/* Step number row */}
      <View style={styles.progressNums}>
        {[1,2,3,4].map((n) => (
          <Animated.Text
            key={n}
            style={[
              styles.progressNum,
              n === step && styles.progressNumActive,
              n < step && styles.progressNumDone,
            ]}
          >
            {n}
          </Animated.Text>
        ))}
      </View>
      {/* Segment track */}
      <View style={styles.progressSegments}>
        {[1,2,3,4].map((n) => (
          <ProgressSegment key={n} index={n} step={step} />
        ))}
      </View>
    </View>
  );
}

function ProgressSegment({ index, step }: { index: number; step: number }) {
  const fill = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (index < step) {
      fill.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
      glow.value = withTiming(0, { duration: 200 });
    } else if (index === step) {
      fill.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
      glow.value = withTiming(1, { duration: 300 });
    } else {
      fill.value = withTiming(0, { duration: 200 });
      glow.value = withTiming(0, { duration: 200 });
    }
  }, [step, index, fill, glow]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0, 0.35]),
    transform: [{ scaleY: interpolate(glow.value, [0, 1], [0, 1]) }],
  }));

  return (
    <View style={styles.progressSegTrack}>
      <Animated.View style={[styles.progressSegFill, fillStyle]} />
      <Animated.View style={[styles.progressSegGlow, glowStyle]} />
    </View>
  );
}

function StepHeading({
  kicker, title, subtitle,
}: { kicker: string; title: string; subtitle: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(240).delay(60)} style={{ marginBottom: 20 }}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.headTitle}>{title}</Text>
      <Text style={styles.headSubtitle}>{subtitle}</Text>
    </Animated.View>
  );
}

// Premium type card with icon rotation, bounce, and dimming of unselected
function TypeCard({
  selected, isAnySelected, onPress, icon, label, sub, tint, delay,
}: {
  selected: boolean;
  isAnySelected: boolean;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  tint: string;
  delay: number;
}) {
  const scale     = useSharedValue(1);
  const iconRot   = useSharedValue(0);
  const dimOpacity = useSharedValue(1);

  useEffect(() => {
    if (selected) {
      iconRot.value = withSequence(
        withTiming(5, { duration: 100 }),
        withSpring(0, SPRING_BOUNCY),
      );
      dimOpacity.value = withTiming(1, { duration: 200 });
    } else if (isAnySelected) {
      dimOpacity.value = withTiming(0.55, { duration: 200 });
    } else {
      dimOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [selected, isAnySelected, iconRot, dimOpacity]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: dimOpacity.value,
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${iconRot.value}deg` }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, SPRING_SNAPPY);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1.0, SPRING_BOUNCY);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(delay)}
      style={[styles.typeCardWrap, cardStyle]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${label}, ${sub}`}
        style={[
          styles.typeCard,
          selected && { borderColor: tint, borderWidth: 2, backgroundColor: `${tint}0e` },
        ]}
      >
        <Animated.View style={[styles.typeIconCircle, { backgroundColor: `${tint}1a` }, iconStyle]}>
          <Ionicons name={icon} size={26} color={tint} />
        </Animated.View>
        <Text style={styles.typeLabel} numberOfLines={2}>{label}</Text>
        <Text style={styles.typeSub} numberOfLines={1}>{sub}</Text>
        {selected && (
          <Animated.View
            entering={FadeIn.duration(160)}
            style={[styles.typeCheck, { backgroundColor: tint }]}
          >
            <Ionicons name="checkmark" size={12} color="#fff" />
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function FreqCard({
  selected, onPress, label, sub, badge, delay,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  sub: string;
  badge: string;
  delay: number;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(delay)}
      style={aStyle}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97, SPRING_SNAPPY); }}
        onPressOut={() => { scale.value = withSpring(1.0, SPRING_BOUNCY); }}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${label}, ${sub}, ${badge}`}
        style={[styles.freqCard, selected && styles.freqCardOn]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.freqLabel, selected && { color: Colors.primary }]}>{label}</Text>
          <Text style={styles.freqSub}>{sub}</Text>
        </View>
        <View style={[styles.freqBadge, selected && styles.freqBadgeOn]}>
          <Text style={[styles.freqBadgeTxt, selected && { color: "#fff" }]}>{badge}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function FieldLabel({
  children, style,
}: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.fieldLabel, style]}>{children}</Text>;
}

// Step 3 details — branch on property_type
type DraftDetails = Record<string, string | number | boolean>;

function Step3Details({
  propertyType, details, setDetails,
}: {
  propertyType: PropertyType | null;
  details: DraftDetails;
  setDetails: React.Dispatch<React.SetStateAction<DraftDetails>>;
}) {
  const set = (k: string, v: string | number | boolean) =>
    setDetails((d) => ({ ...d, [k]: v }));
  const onlyDigits = (s: string) => s.replace(/\D/g, "");

  if (propertyType === "apartment") {
    return (
      <>
        <FieldLabel>Tipologia</FieldLabel>
        <View style={styles.chipsGrid}>
          {APARTMENT_TYPOLOGIES.map((t, i) => {
            const on = details.typology === t.id;
            return (
              <Animated.View
                key={t.id}
                entering={FadeInDown.duration(260).delay(i * 40)}
                style={styles.chipWrap}
              >
                <Pressable
                  onPress={() => set("typology", t.id)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{t.label}</Text>
                  <Text style={[styles.chipSub, on && styles.chipSubOn]}>{t.sub}</Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
        <FieldLabel style={{ marginTop: 18 }}>Superficie (mq)</FieldLabel>
        <SqmInput value={String(details.sqm ?? "")} onChange={(v) => set("sqm", onlyDigits(v))} />
      </>
    );
  }

  if (propertyType === "house") {
    return (
      <>
        <FieldLabel>Superficie (mq)</FieldLabel>
        <SqmInput value={String(details.sqm ?? "")} onChange={(v) => set("sqm", onlyDigits(v))} />
        <FieldLabel style={{ marginTop: 18 }}>N° piani</FieldLabel>
        <Stepper value={Number(details.floors ?? 1)} onChange={(n) => set("floors", n)} min={1} max={5} />
        <FieldLabel style={{ marginTop: 18 }}>Giardino</FieldLabel>
        <YesNoToggle value={!!details.has_garden} onChange={(v) => set("has_garden", v)} />
      </>
    );
  }

  if (propertyType === "office") {
    return (
      <>
        <FieldLabel>Superficie (mq)</FieldLabel>
        <SqmInput value={String(details.sqm ?? "")} onChange={(v) => set("sqm", onlyDigits(v))} />
      </>
    );
  }

  if (propertyType === "restaurant") {
    return (
      <>
        <FieldLabel>Superficie (mq)</FieldLabel>
        <SqmInput value={String(details.sqm ?? "")} onChange={(v) => set("sqm", onlyDigits(v))} />
        <FieldLabel style={{ marginTop: 18 }}>N° coperti</FieldLabel>
        <Stepper value={Number(details.covers ?? 20)} onChange={(n) => set("covers", n)} min={1} max={500} />
        <FieldLabel style={{ marginTop: 18 }}>Cucina interna da pulire</FieldLabel>
        <YesNoToggle value={!!details.has_kitchen} onChange={(v) => set("has_kitchen", v)} />
      </>
    );
  }

  if (propertyType === "bnb") {
    return (
      <>
        <FieldLabel>N° camere</FieldLabel>
        <Stepper value={Number(details.bedrooms ?? 1)} onChange={(n) => set("bedrooms", n)} min={1} max={20} />
        <FieldLabel style={{ marginTop: 18 }}>N° bagni</FieldLabel>
        <Stepper value={Number(details.bathrooms ?? 1)} onChange={(n) => set("bathrooms", n)} min={1} max={10} />
      </>
    );
  }

  if (propertyType === "shop") {
    return (
      <>
        <FieldLabel>Superficie (mq)</FieldLabel>
        <SqmInput value={String(details.sqm ?? "")} onChange={(v) => set("sqm", onlyDigits(v))} />
        <FieldLabel style={{ marginTop: 18 }}>Vetrine</FieldLabel>
        <YesNoToggle value={!!details.has_windows} onChange={(v) => set("has_windows", v)} />
      </>
    );
  }

  if (propertyType === "other") {
    return (
      <>
        <FieldLabel>Superficie (mq)</FieldLabel>
        <SqmInput value={String(details.sqm ?? "")} onChange={(v) => set("sqm", onlyDigits(v))} />
        <FieldLabel style={{ marginTop: 18 }}>Descrizione</FieldLabel>
        <View style={[styles.inputWrap, { alignItems: "flex-start", paddingVertical: 14 }]}>
          <TextInput
            value={String(details.description ?? "")}
            onChangeText={(t) => set("description", t.slice(0, 200))}
            placeholder="Descrivi cosa vuoi far pulire"
            placeholderTextColor={Colors.textTertiary}
            multiline
            style={[styles.inputText, { minHeight: 60 }]}
          />
        </View>
      </>
    );
  }

  return null;
}

function SqmInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Preset ranges. The stored value is the median of each range — that's what
  // the cleaner pricing engine uses to compute the base price (€1.30/m²).
  const PRESETS: Array<{ label: string; storeValue: string; min: number; max: number }> = [
    { label: "Fino a 40 m²", storeValue: "40",  min: 0,   max: 40 },
    { label: "40 – 60 m²",   storeValue: "50",  min: 41,  max: 60 },
    { label: "60 – 80 m²",   storeValue: "70",  min: 61,  max: 80 },
    { label: "80 – 100 m²",  storeValue: "90",  min: 81,  max: 100 },
    { label: "100 – 150 m²", storeValue: "125", min: 101, max: 150 },
    { label: "Oltre 150 m²", storeValue: "175", min: 151, max: 9999 },
  ];

  const n = Number(value);
  const hasValue = value.length > 0 && Number.isFinite(n) && n > 0;

  const isActive = (p: typeof PRESETS[number]) =>
    hasValue && n >= p.min && n <= p.max;

  return (
    <View style={styles.sqmChipsWrap}>
      {PRESETS.map((p) => {
        const active = isActive(p);
        return (
          <Pressable
            key={p.storeValue}
            onPress={() => onChange(p.storeValue)}
            style={[styles.sqmChip, active && styles.sqmChipActive]}
            accessibilityLabel={`Superficie ${p.label}`}
            accessibilityRole="button"
          >
            <Text style={[styles.sqmChipText, active && styles.sqmChipTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stepper({
  value, onChange, min, max,
}: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  const scaleM = useSharedValue(1);
  const scaleP = useSharedValue(1);
  const numScale = useSharedValue(1);

  const bump = (sv: ReturnType<typeof useSharedValue<number>>) => {
    sv.value = withSequence(
      withSpring(0.88, SPRING_SNAPPY),
      withSpring(1.0, SPRING_BOUNCY),
    );
    numScale.value = withSequence(
      withTiming(1.18, { duration: 80 }),
      withSpring(1.0, SPRING_BOUNCY),
    );
  };

  const minusStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleM.value }] }));
  const plusStyle  = useAnimatedStyle(() => ({ transform: [{ scale: scaleP.value }] }));
  const numStyle   = useAnimatedStyle(() => ({ transform: [{ scale: numScale.value }] }));

  return (
    <View style={styles.stepper}>
      <Animated.View style={minusStyle}>
        <Pressable
          style={[styles.stepBtn, value <= min && styles.stepBtnDisabled]}
          onPress={() => { bump(scaleM); onChange(Math.max(min, value - 1)); }}
          disabled={value <= min}
          hitSlop={8}
        >
          <Ionicons name="remove" size={20} color={value <= min ? Colors.textTertiary : Colors.text} />
        </Pressable>
      </Animated.View>
      <Animated.Text style={[styles.stepValue, numStyle]}>{value}</Animated.Text>
      <Animated.View style={plusStyle}>
        <Pressable
          style={[styles.stepBtn, value >= max && styles.stepBtnDisabled]}
          onPress={() => { bump(scaleP); onChange(Math.min(max, value + 1)); }}
          disabled={value >= max}
          hitSlop={8}
        >
          <Ionicons name="add" size={20} color={value >= max ? Colors.textTertiary : Colors.text} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function YesNoToggle({
  value, onChange,
}: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Pressable
        onPress={() => onChange(false)}
        accessibilityRole="radio"
        accessibilityState={{ selected: !value }}
        accessibilityLabel="No"
        style={[styles.toggleBtn, !value && styles.toggleBtnOn]}
      >
        <Text style={[styles.toggleTxt, !value && styles.toggleTxtOn]}>No</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange(true)}
        accessibilityRole="radio"
        accessibilityState={{ selected: value }}
        accessibilityLabel="Sì"
        style={[styles.toggleBtn, value && styles.toggleBtnOn]}
      >
        <Text style={[styles.toggleTxt, value && styles.toggleTxtOn]}>Sì</Text>
      </Pressable>
    </View>
  );
}

// ─── Premium CTA ─────────────────────────────────────────────────────

function PremiumCTA({
  step, saving, canAdvance, missingHint, onPress,
}: {
  step: number;
  saving: boolean;
  canAdvance: boolean;
  missingHint: string;
  onPress: () => void;
}) {
  const scale       = useSharedValue(0.92);
  const glowOp      = useSharedValue(0);
  const pressScale  = useSharedValue(1);
  const sparkRot    = useSharedValue(0);
  const shakeX      = useSharedValue(0);
  const hintOp      = useSharedValue(0);
  const [hintVisible, setHintVisible] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLast      = step === TOTAL_STEPS;

  // Entrance animation
  useEffect(() => {
    scale.value = withSpring(1.0, { damping: 14, stiffness: 200 });
    glowOp.value = withSequence(
      withTiming(0.6, { duration: 300 }),
      withTiming(0.15, { duration: 300 }),
    );
    if (isLast) {
      sparkRot.value = withRepeat(
        withTiming(360, { duration: 2400, easing: Easing.linear }),
        -1,
        false,
      );
    }
    return () => { cancelAnimation(sparkRot); };
  }, [scale, glowOp, sparkRot, isLast]);

  // Re-animate glow when canAdvance flips true → user just satisfied the step
  useEffect(() => {
    if (canAdvance) {
      glowOp.value = withSequence(
        withTiming(0.7, { duration: 250 }),
        withTiming(0.2, { duration: 350 }),
      );
    }
  }, [canAdvance, glowOp]);

  // Cleanup hint timer on unmount
  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, []);

  const wrapStyle  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }, { translateX: shakeX.value }],
  }));
  const glowStyle  = useAnimatedStyle(() => ({
    opacity: canAdvance ? glowOp.value : 0,
  }));
  const sparkStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sparkRot.value}deg` }],
  }));
  const hintStyle  = useAnimatedStyle(() => ({ opacity: hintOp.value }));

  const triggerShake = () => {
    // Mount the hint, fade it in, run the shake, then fade it out after 1.8s.
    setHintVisible(true);
    hintOp.value = withTiming(1, { duration: 160 });
    shakeX.value = withSequence(
      withTiming(-10, { duration: 55 }),
      withTiming(10, { duration: 55 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-4, { duration: 45 }),
      withTiming(0, { duration: 45 }),
    );
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => {
      hintOp.value = withTiming(0, { duration: 220 });
      // Unmount after the fade
      setTimeout(() => setHintVisible(false), 240);
    }, 1800);
  };

  const handlePress = () => {
    if (saving) return;
    if (!canAdvance) {
      triggerShake();
      return;
    }
    onPress();
  };

  const handlePressIn = () => {
    if (!saving) pressScale.value = withSpring(0.97, SPRING_SNAPPY);
  };
  const handlePressOut = () => {
    pressScale.value = withSpring(1.0, SPRING_SNAPPY);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      style={[styles.ctaWrap, wrapStyle]}
    >
      {/* Reminder shown when the user taps the CTA before satisfying the step */}
      {hintVisible && (
        <Animated.View style={[styles.ctaHint, hintStyle]} pointerEvents="none">
          <Ionicons name="alert-circle" size={14} color="#c95c5c" />
          <Text style={styles.ctaHintTxt}>{missingHint}</Text>
        </Animated.View>
      )}
      {/* Glow layer behind button (only when CTA is enabled) */}
      <Animated.View style={[styles.ctaGlow, glowStyle]} />
      <Animated.View style={[pressStyle, styles.cta, !canAdvance && styles.ctaDisabled]}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAdvance || saving }}
          accessibilityLabel={isLast ? "Crea casa" : "Avanti al prossimo step"}
          accessibilityHint={!canAdvance ? missingHint : undefined}
          android_ripple={{ color: "rgba(255,255,255,0.18)" }}
          style={StyleSheet.absoluteFill}
        />
        <Text
          style={[styles.ctaTxt, !canAdvance && styles.ctaTxtDisabled]}
          pointerEvents="none"
        >
          {isLast ? (saving ? "Salvo…" : "Crea casa") : "Avanti"}
        </Text>
        {!saving && isLast && canAdvance && (
          <Animated.View style={sparkStyle} pointerEvents="none">
            <Svg width={18} height={18} viewBox="0 0 18 18">
              <Path
                d="M9 1 L10.2 7.2 L16 9 L10.2 10.8 L9 17 L7.8 10.8 L2 9 L7.8 7.2 Z"
                fill="#fff"
              />
            </Svg>
          </Animated.View>
        )}
        {!saving && !isLast && canAdvance && (
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        )}
      </Animated.View>
    </Animated.View>
  );
}

// Map picker modal — full-screen sheet with a static center pin.
// User pans the map under the pin, taps "Conferma" → reverse-geocode
// the center coordinate via expo-location and bubble both the coord and
// the formatted address up to the wizard.
export function MapPicker({
  visible, initial, onClose, onPick,
}: {
  visible: boolean;
  initial: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onPick: (coord: { latitude: number; longitude: number }, formatted: string) => void;
}) {
  // Reject (0,0) "Null Island" — historically arrives from stale state and
  // strands the map in the South Atlantic until the user pans manually.
  const isValidCoord = (c: { latitude: number; longitude: number } | null) =>
    !!c && (Math.abs(c.latitude) > 0.001 || Math.abs(c.longitude) > 0.001);

  const MILANO = { latitude: 45.4642, longitude: 9.1900 };
  const [center, setCenter] = useState(
    isValidCoord(initial) ? (initial as { latitude: number; longitude: number }) : MILANO
  );
  const [resolving, setResolving] = useState(false);
  const [previewAddress, setPreviewAddress] = useState<string>("");

  // Search state — Google Places autocomplete just like in step 4 input.
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef    = useRef<AbortController | null>(null);
  const mapRef = useRef<MapView>(null);
  // Suppress reverse-geocoding while the map is animating to a search
  // result, so the preview card doesn't flicker between intermediate
  // coordinates picked up from onRegionChangeComplete during the fly-to.
  const ignoreNextRegionChangeRef = useRef(false);

  // Re-center the map when the modal re-opens with a fresh initial coord
  // (only if the incoming initial is a real coordinate — protects against
  // reopening with a stale (0,0) leftover from a cancelled flow).
  useEffect(() => {
    if (visible && isValidCoord(initial)) setCenter(initial!);
  }, [visible, initial]);

  // When the modal opens without a usable initial coord, ask once for the
  // device location and pan there — far better UX than landing on Milano
  // for users who live elsewhere. Falls back silently to Milano on denial.
  useEffect(() => {
    if (!visible || isValidCoord(initial)) return;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const target = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        if (!isValidCoord(target)) return;
        ignoreNextRegionChangeRef.current = true;
        setCenter(target);
        mapRef.current?.animateToRegion({ ...target, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 600);
        setTimeout(() => { ignoreNextRegionChangeRef.current = false; }, 650);
      } catch {
        // Permission denied or GPS off — Milano fallback is fine.
      }
    })();
    return () => { cancelled = true; };
  }, [visible, initial]);

  // Reset search state every time the modal closes so the next open is clean.
  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [visible]);

  // Reverse-geocode the current center every time the user stops panning,
  // so the bottom card shows what address they're hovering on.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setResolving(true);
    (async () => {
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: center.latitude,
          longitude: center.longitude,
        });
        if (cancelled) return;
        const r = results[0];
        const formatted = formatReverseGeocode(r);
        setPreviewAddress(formatted || "Indirizzo non riconosciuto");
      } catch {
        if (!cancelled) setPreviewAddress("Indirizzo non riconosciuto");
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => { cancelled = true; };
  }, [center, visible]);

  // ── Search autocomplete (debounced, abortable) ──────────────
  const onSearchChange = (text: string) => {
    // Strip leading space placeholder injected by onFocus seed.
    const cleaned = text.replace(/^ +/, "");
    setSearchQuery(cleaned);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (searchAbortRef.current) searchAbortRef.current.abort();
    // Empty query → clear results, hide dropdown
    if (cleaned.length === 0) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    // Show "searching" state immediately so the dropdown reacts to the first keystroke
    setSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      searchAbortRef.current = ctrl;
      try {
        // Bias toward the current map center so 1-letter queries return
        // locally-relevant streets (Google-Maps style).
        const bias = isValidCoord(center)
          ? { latitude: center.latitude, longitude: center.longitude }
          : undefined;
        const results = await searchAddresses(cleaned, ctrl.signal, bias);
        if (!ctrl.signal.aborted) setSearchResults(results);
      } catch {
        // user is still typing
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 150);
  };

  const pickSearchResult = async (s: AddressSuggestion) => {
    const fullLabel = s.secondaryText
      ? `${s.mainText}, ${s.secondaryText}`
      : s.mainText;
    // Update the preview immediately so the user doesn't see stale text
    // while the map flies to the new coordinate.
    setPreviewAddress(fullLabel);
    setResolving(false);
    setSearchResults([]);
    setSearchQuery(fullLabel);

    // Google Places autocomplete returns lat=0/lng=0 — must resolve first
    const hasCoords = Math.abs(s.latitude) > 0.001 || Math.abs(s.longitude) > 0.001;
    let target = { latitude: s.latitude, longitude: s.longitude };
    if (!hasCoords) {
      setSearching(true);
      try {
        const details = await fetchAddressDetails(s.placeId);
        if (details && (Math.abs(details.latitude) > 0.001 || Math.abs(details.longitude) > 0.001)) {
          target = { latitude: details.latitude, longitude: details.longitude };
        } else {
          // No coordinates found — leave map where it is, keep preview text
          setSearching(false);
          return;
        }
      } catch {
        setSearching(false);
        return;
      } finally {
        setSearching(false);
      }
    }

    ignoreNextRegionChangeRef.current = true;
    setCenter(target);
    mapRef.current?.animateToRegion({
      ...target,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }, 600);
    // Allow onRegionChangeComplete again after animation completes
    setTimeout(() => {
      ignoreNextRegionChangeRef.current = false;
    }, 700);
  };

  const handleConfirm = () => {
    onPick(center, previewAddress);
  };

  // Mount MapView only while the modal is open. RN Modal keeps children
  // mounted with visible=false unless we gate them ourselves; an idle
  // MapView in the background still consumes location/GPU.
  if (!visible) return null;

  // True when the user is actively typing in the search bar
  const isSearchActive = searchQuery.length > 0;

  // GPS shortcut — used by the "Usa la mia posizione" row at the top of the
  // search dropdown. Fetches the device location, recenters the map and
  // clears the search so the dropdown collapses.
  const handleUseMyLocation = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const target = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      if (Math.abs(target.latitude) < 0.001 && Math.abs(target.longitude) < 0.001) return;
      ignoreNextRegionChangeRef.current = true;
      setCenter(target);
      mapRef.current?.animateToRegion({ ...target, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 600);
      setTimeout(() => { ignoreNextRegionChangeRef.current = false; }, 700);
      // Collapse the dropdown — the reverse-geocode side-effect fills in
      // the preview address once the region change completes.
      setSearchQuery("");
      setSearchResults([]);
    } catch {
      // GPS unavailable — silently ignore
    }
  };

  // Safe-area top inset — read from the runtime so Dynamic-Island devices
  // (iPhone 14 Pro+) get the correct ~59pt instead of the legacy 44pt.
  // Fall back to a sensible value when the provider is missing.
  const insets = useSafeAreaInsets();
  const safeTop = Platform.OS === "ios" ? Math.max(insets.top, 44) : 0;
  // Topbar total height = safeTop + content (44px)
  const topbarHeight = safeTop + 44;
  const screenHeight = Dimensions.get("window").height;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Root: warm background, full screen */}
      <View style={{ flex: 1, backgroundColor: "#f4f1ea" }}>

        {/* ── MAP (layer 0, absoluteFillObject) ── */}
        <MapView
          ref={mapRef}
          style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
          initialRegion={{
            latitude: center.latitude,
            longitude: center.longitude,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          }}
          onMapReady={() => {
            mapRef.current?.animateToRegion({
              latitude: center.latitude,
              longitude: center.longitude,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            }, 400);
          }}
          onRegionChangeComplete={(r) => {
            if (ignoreNextRegionChangeRef.current) return;
            setCenter({ latitude: r.latitude, longitude: r.longitude });
          }}
          onPress={(e) => {
            const c = e.nativeEvent.coordinate;
            setCenter({ latitude: c.latitude, longitude: c.longitude });
            mapRef.current?.animateToRegion({
              latitude: c.latitude,
              longitude: c.longitude,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            }, 250);
          }}
          showsUserLocation
          showsMyLocationButton={false}
        />

        {/* ── TOPBAR (position absolute, top 0, zIndex 30) ── */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: topbarHeight,
            paddingTop: safeTop,
            paddingHorizontal: 16,
            paddingBottom: 0,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#f4f1ea",
            zIndex: 30,
            elevation: 30,
          }}
        >
          {/* Close button — 40×40 white circle with shadow */}
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [
              {
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#ffffff",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#062a23",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 12,
                elevation: 6,
              },
              pressed && { opacity: 0.75 },
            ]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                d="M18 6L6 18M6 6l12 12"
                stroke="#062a23"
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>

          {/* Centered title — absolute so it never shifts with button widths */}
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              alignItems: "center",
              pointerEvents: "none",
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: "#062a23",
                letterSpacing: -0.16,
              }}
            >
              Scegli sulla mappa
            </Text>
          </View>

          {/* Right spacer — mirrors left button for optical balance */}
          <View style={{ width: 40, marginLeft: "auto" }} />
        </View>

        {/* ── SEARCH WRAP (position absolute, top topbarHeight, zIndex 20) ── */}
        <View
          style={{
            position: "absolute",
            top: topbarHeight,
            left: 16,
            right: 16,
            zIndex: 20,
            elevation: 20,
          }}
        >
          {/* Search pill — Google Maps style. When the dropdown is active,
              we round only the top corners so the bar and the list below
              read as one continuous white surface. */}
          <View
            style={{
              backgroundColor: "#ffffff",
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              borderBottomLeftRadius: isSearchActive ? 0 : 12,
              borderBottomRightRadius: isSearchActive ? 0 : 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            {/* Search icon — Google neutral gray */}
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                stroke="#5f6368"
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>

            <TextInput
              value={searchQuery}
              onChangeText={onSearchChange}
              onFocus={async () => {
                // Google-Maps-style: when the user taps the search bar
                // and there's no query yet, pre-populate the dropdown
                // with streets near the current map center.
                if (searchQuery.length > 0) return;
                if (!isValidCoord(center)) return;
                setSearching(true);
                try {
                  const ctrl = new AbortController();
                  searchAbortRef.current = ctrl;
                  const seedResults = await searchAddresses(
                    "via",
                    ctrl.signal,
                    {
                      latitude: center.latitude,
                      longitude: center.longitude,
                      radiusMeters: 3000,
                    }
                  );
                  if (!ctrl.signal.aborted) {
                    setSearchResults(seedResults);
                    // Bump the query to a single space so the dropdown
                    // becomes visible (isSearchActive checks length > 0).
                    setSearchQuery(" ");
                  }
                } catch {
                  // best-effort — silent fallback to manual typing
                } finally {
                  setSearching(false);
                }
              }}
              placeholder="Cerca un indirizzo"
              placeholderTextColor="#9aa0a6"
              style={{
                flex: 1,
                fontSize: 16,
                color: "#202124",
                paddingVertical: 0,
              }}
              autoCapitalize="none"
              returnKeyType="search"
              autoCorrect={false}
            />

            {/* Clear button — Google Maps style: flat gray X, no bg pill */}
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                hitSlop={12}
                accessible
                accessibilityLabel="Cancella ricerca"
                style={({ pressed }) => [
                  {
                    width: 24,
                    height: 24,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="#5f6368"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
            )}
          </View>

          {/* Dropdown — Google Maps style. Visually attached to the search
              bar above (no gap, only bottom corners rounded), light shadow,
              hairline separator from the bar. */}
          {isSearchActive && (
            <View
              style={{
                backgroundColor: "#ffffff",
                borderBottomLeftRadius: 12,
                borderBottomRightRadius: 12,
                overflow: "hidden",
                maxHeight: screenHeight * 0.6,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: "rgba(0,0,0,0.08)",
                shadowColor: "#000000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.10,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {/* "Use my location" — Google Maps style: flat row, simple
                    accent-colored icon (no circle background), normal weight
                    text in the accent color. Always shown at the top of the
                    dropdown so the user can skip typing entirely. */}
                <Pressable
                  onPress={handleUseMyLocation}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="Usa la mia posizione attuale"
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                  style={({ pressed }) => [
                    {
                      backgroundColor: "#ffffff",
                      minHeight: 56,
                    },
                    pressed && { backgroundColor: "rgba(0,0,0,0.04)" },
                  ]}
                >
                  {/* Explicit inner View to enforce horizontal flex layout —
                      Pressable style sometimes drops flexDirection on iOS. */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      minHeight: 56,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 16,
                      }}
                    >
                      <Svg width={22} height={22} viewBox="0 0 24 24">
                        <Path
                          d="M12 2v2 M12 20v2 M2 12h2 M20 12h2"
                          stroke="#006b55"
                          strokeWidth={2}
                          strokeLinecap="round"
                        />
                        <Circle cx={12} cy={12} r={7} stroke="#006b55" strokeWidth={2} fill="none" />
                        <Circle cx={12} cy={12} r={2.5} fill="#006b55" />
                      </Svg>
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color: "#006b55",
                        flex: 1,
                      }}
                    >
                      Usa la mia posizione
                    </Text>
                  </View>
                </Pressable>

                {/* Loading state */}
                {searching && searchResults.length === 0 && (
                  <View
                    style={{
                      paddingVertical: 20,
                      paddingHorizontal: 16,
                      alignItems: "center",
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: "rgba(0,0,0,0.08)",
                    }}
                  >
                    <Text style={{ fontSize: 14, color: "#5f6368" }}>
                      Cerco…
                    </Text>
                  </View>
                )}

                {/* Empty state — query typed but no results and not loading */}
                {!searching && searchQuery.trim().length >= 3 && searchResults.length === 0 && (
                  <View
                    style={{
                      paddingVertical: 20,
                      paddingHorizontal: 16,
                      alignItems: "center",
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: "rgba(0,0,0,0.08)",
                    }}
                  >
                    <Text style={{ fontSize: 14, color: "#5f6368", textAlign: "center" }}>
                      Nessun risultato
                    </Text>
                  </View>
                )}

                {/* Result rows — Google Maps style: hairline separator at the
                    top of each row, simple gray pin icon, two-line text
                    hierarchy (medium black + light gray). */}
                {searchResults.slice(0, 6).map((s) => (
                  <Pressable
                    key={s.placeId}
                    onPress={() => pickSearchResult(s)}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={s.mainText + (s.secondaryText ? `, ${s.secondaryText}` : "")}
                    android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                    style={({ pressed }) => [
                      {
                        backgroundColor: "#ffffff",
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: "rgba(0,0,0,0.08)",
                        minHeight: 56,
                      },
                      pressed && { backgroundColor: "rgba(0,0,0,0.04)" },
                    ]}
                  >
                    {/* Explicit inner View to enforce horizontal flex layout —
                        Pressable style sometimes drops flexDirection on iOS. */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        minHeight: 56,
                      }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 16,
                        }}
                      >
                        <Svg width={22} height={22} viewBox="0 0 24 24">
                          <Path
                            d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"
                            stroke="#5f6368"
                            strokeWidth={1.8}
                            fill="none"
                            strokeLinejoin="round"
                          />
                          <Circle cx={12} cy={9} r={2.5} fill="#5f6368" />
                        </Svg>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 16,
                            fontWeight: "500",
                            color: "#202124",
                            lineHeight: 22,
                          }}
                        >
                          {s.mainText}
                        </Text>
                        {!!s.secondaryText && (
                          <Text
                            numberOfLines={1}
                            style={{
                              fontSize: 14,
                              color: "#5f6368",
                              marginTop: 2,
                              lineHeight: 18,
                            }}
                          >
                            {s.secondaryText}
                          </Text>
                        )}
                      </View>
                    </View>
                  </Pressable>
                ))}

                {/* Footer attribution — Google Places ToS requirement.
                    Kept low-key but readable, mirroring Google Maps. */}
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: "rgba(0,0,0,0.08)",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: "#5f6368",
                      textAlign: "right",
                      fontWeight: "500",
                    }}
                  >
                    powered by Google
                  </Text>
                </View>
              </ScrollView>
            </View>
          )}
        </View>

        {/* ── CENTER PIN ──────────────────────────────────────────────────────
            Teardrop SVG anchored so the TIP sits exactly on the map center.
            The container is placed at top:50% left:50% with negative margins
            equal to (pinWidth/2, pinHeight) — that lands the bottom-center
            of the container (= the pin's tip in the SVG) on the map center.
            A small ground-shadow oval sits below the tip to suggest the
            pin is floating above the surface.
            Hidden during search to keep the dropdown overlay clean. */}
        {!isSearchActive && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              marginLeft: -16,
              marginTop: -42,
              alignItems: "center",
              zIndex: 5,
            }}
          >
            <Svg width={32} height={42} viewBox="0 0 32 42">
              {/* Drop shadow */}
              <Path
                d="M16 2 C8 2 2 8 2 16 C2 24 16 40 16 40 C16 40 30 24 30 16 C30 8 24 2 16 2 Z"
                fill="#006b55"
                stroke="#ffffff"
                strokeWidth={3}
                strokeLinejoin="round"
              />
              <Circle cx={16} cy={15} r={5} fill="#ffffff" />
            </Svg>
            {/* Ground shadow — sits just below the pin tip (= map center).
                Translated down so it's centered slightly under the tip,
                giving a subtle "floating" feel. */}
            <View
              style={{
                position: "absolute",
                bottom: -6,
                width: 18,
                height: 5,
                borderRadius: 9,
                backgroundColor: "rgba(6,42,35,0.28)",
              }}
            />
          </View>
        )}

        {/* ── DIM OVERLAY (visible during search, zIndex 15, tap closes search) ── */}
        {isSearchActive && (
          <Pressable
            onPress={() => {
              setSearchQuery("");
              setSearchResults([]);
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(6,42,35,0.25)",
              zIndex: 15,
              elevation: 15,
            }}
          />
        )}

        {/* ── BOTTOM SHEET (hidden during search, position absolute, zIndex 20) ── */}
        {!isSearchActive && (
          <View
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: 24,
              backgroundColor: "#ffffff",
              borderRadius: 20,
              padding: 20,
              shadowColor: "#062a23",
              shadowOffset: { width: 0, height: 20 },
              shadowOpacity: 0.25,
              shadowRadius: 50,
              elevation: 20,
              zIndex: 20,
            }}
          >
            {/* Eyebrow label */}
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: "#3ee0a8",
                letterSpacing: 0.16 * 11,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Posizione selezionata
            </Text>

            {/* Address */}
            <Text
              numberOfLines={2}
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: "#062a23",
                letterSpacing: -0.18,
                lineHeight: 18 * 1.25,
                marginBottom: 4,
              }}
            >
              {resolving ? "Calcolo indirizzo..." : previewAddress || "—"}
            </Text>

            {/* City / hint */}
            <Text
              style={{
                fontSize: 12,
                color: "rgba(6,42,35,0.6)",
                marginBottom: 16,
              }}
            >
              {resolving ? " " : "Trascina la mappa per cambiare"}
            </Text>

            {/* Confirm button — outer View carries the bg + shape; Pressable handles the touch */}
            <View
              style={{
                alignSelf: "stretch",
                height: 56,
                borderRadius: 14,
                backgroundColor: resolving
                  ? "rgba(6,42,35,0.15)"
                  : "#062a23",
                overflow: "hidden",
              }}
            >
              <Pressable
                onPress={handleConfirm}
                disabled={resolving}
                android_ripple={{ color: resolving ? undefined : "#0d4a3d" }}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    paddingHorizontal: 20,
                  },
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: resolving ? "rgba(6,42,35,0.4)" : "#ffffff",
                    textAlign: "center",
                  }}
                >
                  {resolving ? "Calcolo indirizzo..." : "Conferma posizione"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

      </View>
    </Modal>
  );
}

// Build a single-line address string from expo-location's reverseGeocode
// result. The shape varies by provider (Apple/Google) — we pick the most
// useful fields and skip anything missing.
function formatReverseGeocode(r: Location.LocationGeocodedAddress | undefined): string {
  if (!r) return "";
  const street = r.street ?? r.name ?? "";
  const num = r.streetNumber ? ` ${r.streetNumber}` : "";
  const city = r.city ?? r.subregion ?? "";
  const region = r.region ? `, ${r.region}` : "";
  const parts = [
    `${street}${num}`.trim(),
    city,
  ].filter(Boolean);
  return parts.join(", ") + region;
}

// What's missing on each step — drives the reminder shown when the user
// taps "Avanti" before completing the current step.
function missingHintForStep(step: number, propertyType: PropertyType | null): string {
  switch (step) {
    case 1: return "Scegli il tipo di proprietà";
    case 2: return "Scegli ogni quanto vuoi pulire";
    case 3:
      switch (propertyType) {
        case "apartment":  return `Scegli tipologia e mq (min ${MIN_SQM})`;
        case "house":      return `Superficie minima ${MIN_SQM} m²`;
        case "office":     return `Superficie minima ${MIN_SQM} m²`;
        case "restaurant": return `Superficie minima ${MIN_SQM} m²`;
        case "bnb":        return "Imposta camere e bagni";
        case "shop":       return `Superficie minima ${MIN_SQM} m²`;
        case "other":      return `Compila descrizione e mq (min ${MIN_SQM})`;
        default:           return "Compila i dettagli";
      }
    case 4: return "Inserisci nome e seleziona un indirizzo dalla lista";
    default: return "Compila tutti i campi richiesti";
  }
}

// ─────────────────────────── Helpers ───────────────────────────

function titleForType(t: PropertyType | null): string {
  switch (t) {
    case "apartment":  return "Dettagli appartamento";
    case "house":      return "Dettagli casa";
    case "office":     return "Dettagli ufficio";
    case "restaurant": return "Dettagli ristorante";
    case "bnb":        return "Dettagli B&B";
    case "shop":       return "Dettagli negozio";
    case "other":      return "Dettagli proprietà";
    default:           return "Dettagli";
  }
}

// Minimum sqm to consider the input plausible. 1-12 m² values are obvious
// garbage; a real Italian monolocale starts around 25-30 m² so we set the
// floor at 30 to filter junk while still accepting tiny studios.
const MIN_SQM = 30;
const MAX_SQM = 2000;

function isStep3Valid(t: PropertyType | null, d: DraftDetails): boolean {
  if (!t) return false;
  const sqmOk = Number(d.sqm ?? 0) >= MIN_SQM && Number(d.sqm ?? 0) <= MAX_SQM;
  // Stepper-backed fields default to a non-zero value so they can't be the
  // only validation trigger — we require sqm ≥ MIN_SQM for every type that
  // shows it, plus an explicit choice (typology / description) on top.
  switch (t) {
    case "apartment":  return !!d.typology && sqmOk;
    case "house":      return sqmOk;
    case "office":     return sqmOk;
    case "restaurant": return sqmOk;
    case "bnb":        return Number(d.bedrooms ?? 0) >= 1 && Number(d.bathrooms ?? 0) >= 1;
    case "shop":       return sqmOk;
    case "other":      return sqmOk && String(d.description ?? "").trim().length > 0;
  }
}

function deriveNumRooms(t: PropertyType | null, d: DraftDetails): number {
  if (t === "apartment" && typeof d.typology === "string") {
    return TYPOLOGY_TO_ROOMS[d.typology] ?? 1;
  }
  if (t === "bnb") return Number(d.bedrooms ?? 1);
  return 1;
}

function deriveSqm(t: PropertyType | null, d: DraftDetails): number | null {
  if (t === "bnb") return null;
  const n = Number(d.sqm ?? 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildPersistedDetails(t: PropertyType, d: DraftDetails): PropertyTypeDetails {
  switch (t) {
    case "apartment":
      return {
        kind: "apartment",
        typology: String(d.typology ?? ""),
        bedrooms: undefined,
        bathrooms: undefined,
      };
    case "house":
      return {
        kind: "house",
        floors: Number(d.floors ?? 1),
        has_garden: !!d.has_garden,
      };
    case "office":
      return { kind: "office", desks: 0 };
    case "restaurant":
      return {
        kind: "restaurant",
        covers: Number(d.covers ?? 1),
        has_kitchen: !!d.has_kitchen,
      };
    case "bnb":
      return {
        kind: "bnb",
        bedrooms: Number(d.bedrooms ?? 1),
        bathrooms: Number(d.bathrooms ?? 1),
      };
    case "shop":
      return { kind: "shop", has_windows: !!d.has_windows };
    case "other":
      return { kind: "other", description: String(d.description ?? "") };
  }
}

// ─────────────────────────── Styles ───────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: 0.2,
  },

  // Segmented progress bar
  progressWrap: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 12,
    paddingTop: 4,
  },
  progressNums: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 6,
  },
  progressNum: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textTertiary,
    letterSpacing: 0.2,
  },
  progressNumActive: {
    fontSize: 13,
    fontWeight: "900",
    color: Colors.secondary,
  },
  progressNumDone: {
    color: Colors.accent,
    fontWeight: "700",
  },
  progressSegments: {
    flexDirection: "row",
    gap: 5,
  },
  progressSegTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    overflow: "visible",
    position: "relative",
  },
  progressSegFill: {
    height: "100%",
    backgroundColor: Colors.secondary,
    borderRadius: 2,
  },
  progressSegGlow: {
    position: "absolute",
    bottom: -3,
    left: 0,
    right: 0,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },

  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 8,
    paddingBottom: 130,
  },

  kicker: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.secondary,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  headTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: Colors.text,
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: 8,
  },
  headSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Step 1 grid
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  typeCardWrap: {
    width: "48%",
  },
  typeCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    borderRadius: Radius.lg,
    padding: 14,
    minHeight: 124,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  typeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 2,
    lineHeight: 17,
  },
  typeSub: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  typeCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  // Step 2 frequency cards
  freqCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  freqCardOn: {
    borderColor: Colors.secondary,
    borderWidth: 2,
    backgroundColor: Colors.accentLight,
  },
  freqLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 2,
  },
  freqSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  freqBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.surfaceElevated,
  },
  freqBadgeOn: {
    backgroundColor: Colors.secondary,
  },
  freqBadgeTxt: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: 0.3,
  },

  // Inputs
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textSecondary,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  inputWrapValidated: {
    borderColor: Colors.accent,
    borderWidth: 1.5,
  },
  inputWrapInvalid: {
    borderColor: "#c95c5c",
    backgroundColor: "#fff5f5",
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: "600",
  },
  unitTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  searchingHint: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  errorHint: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.error,
  },
  sqmChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  sqmChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  sqmChipActive: {
    backgroundColor: "#022420",
    borderColor: "#022420",
  },
  sqmChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  sqmChipTextActive: {
    color: "#ffffff",
  },
  suggestionsBox: {
    marginTop: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    overflow: "hidden",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionRowLast: {
    borderBottomWidth: 0,
  },
  suggestionDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionTxt: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: "600",
  },
  suggestionSubTxt: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },

  // Chips (apartment typology) — 2-col grid. Width is set on the
  // wrapping Animated.View because the Pressable inside doesn't get a
  // proper parent reference for percentage widths.
  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chipWrap: {
    width: "48%",
  },
  chip: {
    width: "100%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipOn: {
    borderColor: Colors.secondary,
    borderWidth: 2,
    backgroundColor: Colors.accentLight,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
  },
  chipLabelOn: { color: Colors.primary },
  chipSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chipSubOn: { color: Colors.secondary },

  // Stepper (-/+ control)
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  stepBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  stepBtnDisabled: {
    backgroundColor: Colors.surfaceElevated,
    shadowOpacity: 0,
    elevation: 0,
  },
  stepValue: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.text,
    minWidth: 44,
    textAlign: "center",
  },

  // Yes/No toggle
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
  },
  toggleBtnOn: {
    borderColor: Colors.secondary,
    borderWidth: 2,
    backgroundColor: Colors.secondary,
  },
  toggleTxt: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
  },
  toggleTxtOn: { color: "#fff" },

  // CTA bottom — premium pill
  ctaWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    position: "relative",
  },
  ctaGlow: {
    position: "absolute",
    top: 12,
    left: Spacing.lg,
    right: Spacing.lg,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 0,
  },
  cta: {
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.secondary,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  ctaInner: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaDisabledInner: {},
  ctaTxt: {
    fontSize: 15,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
  },
  ctaDisabled: {
    backgroundColor: Colors.borderLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaTxtDisabled: {
    color: Colors.textTertiary,
  },
  ctaHint: {
    position: "absolute",
    top: -8,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#ffe4e4",
    borderWidth: 1,
    borderColor: "#f5b8b8",
    transform: [{ translateY: -36 }],
  },
  ctaHintTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#c95c5c",
  },

  // Map picker entry point on Step 4
  mapDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 22,
    marginBottom: 12,
  },
  mapDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  mapDividerTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textTertiary,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  mapPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  mapPickerTxt: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
  },

  // Map picker modal
  mapModalRoot: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  mapModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  mapModalClose: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  mapModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  mapPinAnchor: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -21,
    marginTop: -42, // anchor pin tip at the geographic center
    alignItems: "center",
  },
  mapPinShadow: {
    position: "absolute",
    bottom: -2,
    width: 12,
    height: 4,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  mapPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  mapPreviewTxt: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  mapModalFooter: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  mapConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 58,
    borderRadius: 16,
    backgroundColor: "#022420",
    paddingHorizontal: 24,
    shadowColor: "#022420",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  mapConfirmBtnDisabled: {
    backgroundColor: "#9ca8a4",
    shadowOpacity: 0,
    elevation: 0,
  },
  mapConfirmTxt: {
    fontSize: 17,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.3,
  },

  // Map search bar (floats over the MapView, Google-Maps style)
  mapSearchBar: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.md,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    paddingVertical: 0,
  },
  mapSearchResults: {
    position: "absolute",
    top: 68,
    left: 12,
    right: 12,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: 6,
    overflow: "hidden",
    ...Shadows.lg,
  },
  mapSearchLoading: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  mapSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  mapSearchRowMain: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    lineHeight: 19,
  },
  mapSearchRowSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
});
```

---

### `app/properties/edit.tsx`

```tsx
// ============================================================================
// Screen: Nuova casa / Modifica casa — premium rebuild
// ----------------------------------------------------------------------------
// Rebuilt from scratch to feel premium: photo-hero layout, card-based
// sections with proper breathing room, animated room chips, inline error
// messages per field, cover photo (mandatory) + optional room photos
// uploaded to Supabase Storage, and a Google Vision API content check
// that rejects non-house images before the photo is persisted on DB.
// ============================================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useAuth } from "../../lib/auth";
import {
  createClientProperty,
  deleteClientProperty,
  fetchAddressDetails,
  fetchClientProperties,
  searchAddresses,
  updateClientProperty,
  uploadPropertyPhoto,
  validatePropertyPhoto,
} from "../../lib/api";
import type { AddressSuggestion } from "../../lib/api";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";
import type { ClientProperty } from "../../lib/types";
import TypologySheet, { TypologyValue } from "../../components/TypologySheet";
import { MapPicker } from "./new";

const ROOM_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const NAME_MAX = 60;
const ADDRESS_MAX = 255;
const NOTES_MAX = 500;
const MAX_ROOM_PHOTOS = 6;

// Maps between the property typology id (used in TypologySheet) and the
// num_rooms integer that we persist in the database. The DB column predates
// the typology picker, so we keep saving num_rooms for backward compat with
// the booking flow / pricing engine.
const TYPOLOGY_TO_ROOMS: Record<string, number> = {
  monolocale: 1,
  bilocale: 2,
  trilocale: 3,
  quadrilocale: 4,
  "5locali": 5,
  "6locali": 6,
  "7locali": 7,
};
const ROOMS_TO_TYPOLOGY = (n: number): string => {
  if (n <= 1) return "monolocale";
  if (n === 2) return "bilocale";
  if (n === 3) return "trilocale";
  if (n === 4) return "quadrilocale";
  if (n === 5) return "5locali";
  if (n === 6) return "6locali";
  return "7locali";
};

export default function PropertyEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const { user } = useAuth();
  const router = useRouter();

  // ── Form state ────────────────────────────────────────────
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  // Address autocomplete state — mirrors the cleaner wizard city
  // picker but filtered to full Italian addresses instead of cities.
  // addressLatLng is only set when the user taps a real Google Places
  // suggestion, so free-typed junk can never pass validation.
  const [addressLatLng, setAddressLatLng] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<
    AddressSuggestion[]
  >([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressAbortRef = useRef<AbortController | null>(null);
  const [notes, setNotes] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [roomPhotos, setRoomPhotos] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  // ── Typology sheet state ───────────────────────────────────
  const [typologyOpen, setTypologyOpen] = useState(false);
  const [typology, setTypology] = useState<TypologyValue>({
    typology: "trilocale",
    bedrooms: 2,
    bathrooms: 1,
    sqm: "",
  });
  // Original new-wizard fields read from the DB on load. We keep them
  // intact across edits because this legacy screen has no UI for them
  // — wiping them would silently demote a B&B/office back to apartment.
  const [originalPropertyType, setOriginalPropertyType] = useState<string | null>(null);
  const [originalNumRooms, setOriginalNumRooms] = useState<number | null>(null);

  // Address autocomplete — delegates to lib/api.searchAddresses which
  // uses Google Places API (New) as primary and falls back to Nominatim
  // if Places is not enabled on the GCP project yet. Debounced 300ms
  // with an AbortController that cancels in-flight requests on fast typing.
  const handleAddressChange = useCallback((text: string) => {
    setAddress(text);
    setAddressLatLng(null);

    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    if (addressAbortRef.current) addressAbortRef.current.abort();

    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setAddressSuggestions([]);
      setAddressSearching(false);
      return;
    }

    setAddressSearching(true);
    addressDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      addressAbortRef.current = controller;
      try {
        const rows = await searchAddresses(trimmed, controller.signal);
        setAddressSuggestions(rows);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setAddressSuggestions([]);
        }
      } finally {
        setAddressSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectAddress = useCallback(
    async (suggestion: AddressSuggestion) => {
      const fullText = suggestion.secondaryText
        ? `${suggestion.mainText}, ${suggestion.secondaryText}`
        : suggestion.mainText;
      setAddress(fullText);
      setAddressSuggestions([]);

      // Nominatim suggestions already include coordinates — just use them.
      if (suggestion.latitude !== 0 || suggestion.longitude !== 0) {
        setAddressLatLng({
          latitude: suggestion.latitude,
          longitude: suggestion.longitude,
        });
        return;
      }

      // Google Places suggestions come without coordinates — fetch them.
      const details = await fetchAddressDetails(suggestion.placeId);
      if (details) {
        setAddressLatLng(details);
      }
    },
    []
  );

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingRoom, setUploadingRoom] = useState(false);

  // Entrance animation for the hero photo zone — soft scale-in
  const heroOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.96);

  // Progress bar — animated width ratio 0..1
  const progressRatio = useSharedValue(0);

  // Star bounce for "Casa predefinita" toggle
  const starScale = useSharedValue(1);

  // Default badge fade-in
  const defaultBadgeOpacity = useSharedValue(0);
  const defaultBadgeScale = useSharedValue(0.6);

  useEffect(() => {
    heroOpacity.value = withTiming(1, { duration: 500 });
    heroScale.value = withSpring(1, { damping: 18, stiffness: 170 });
  }, []);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressRatio.value * 100}%` as unknown as number,
  }));

  const starAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: starScale.value }],
  }));

  const defaultBadgeStyle = useAnimatedStyle(() => ({
    opacity: defaultBadgeOpacity.value,
    transform: [{ scale: defaultBadgeScale.value }],
  }));

  // ── Load existing row when editing ────────────────────────
  useEffect(() => {
    if (!isEdit || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await fetchClientProperties(user.id);
        if (cancelled) return;
        const row = all.find((p) => p.id === id) as ClientProperty | undefined;
        if (!row) {
          Alert.alert("Casa non trovata", "Potrebbe essere stata eliminata.", [
            { text: "OK", onPress: () => router.back() },
          ]);
          return;
        }
        setName(row.name);
        setAddress(row.address);
        // When editing, trust the coordinates already stored on DB —
        // they were previously validated when first picked. The address
        // field is still editable, but editing clears the latlng so the
        // user has to re-pick if they change it.
        if (row.latitude != null && row.longitude != null) {
          setAddressLatLng({
            latitude: row.latitude,
            longitude: row.longitude,
          });
        }
        // Hydrate the typology sheet. For properties created via the new
        // wizard with property_type='apartment' the authoritative typology
        // lives in row.type_details.typology — prefer that over deriving
        // it from num_rooms which is lossy. Legacy rows just fall back.
        const td = (row as { type_details?: { typology?: string; bedrooms?: number; bathrooms?: number } }).type_details ?? {};
        const propertyType = (row as { property_type?: string }).property_type ?? "apartment";
        const isApt = propertyType === "apartment";
        const tdTypology = typeof td.typology === "string" ? td.typology : undefined;
        setOriginalPropertyType(propertyType);
        setOriginalNumRooms(row.num_rooms);
        setTypology({
          typology:
            isApt && tdTypology ? tdTypology : ROOMS_TO_TYPOLOGY(row.num_rooms),
          bedrooms: typeof td.bedrooms === "number" ? td.bedrooms : Math.max(0, row.num_rooms - 1),
          bathrooms: typeof td.bathrooms === "number" ? td.bathrooms : 1,
          sqm: row.sqm ? String(row.sqm) : "",
        });
        setNotes(row.notes ?? "");
        setIsDefault(row.is_default);
        setCoverPhoto(row.cover_photo_url ?? row.photo_url ?? null);
        setRoomPhotos(row.room_photo_urls ?? []);
      } catch (err) {
        console.error("[property edit] load error", err);
        Alert.alert("Errore", "Impossibile caricare la casa.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, id, user, router]);

  // ── Photo pick + validate + upload ────────────────────────
  const pickAndUpload = useCallback(
    async (kind: "cover" | "room") => {
      if (!user) return;
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permesso richiesto",
          "Per caricare una foto dobbiamo accedere alla tua libreria foto."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
        exif: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      if (kind === "cover") setUploadingCover(true);
      else setUploadingRoom(true);

      try {
        // First: validate content with Google Vision API
        const validation = await validatePropertyPhoto(asset.uri);
        if (!validation.isValid) {
          Alert.alert(
            "Foto non valida",
            validation.reason ??
              "La foto non sembra rappresentare una casa. Riprova con una foto dell'interno della tua abitazione."
          );
          return;
        }
        // Then: upload to storage
        const publicUrl = await uploadPropertyPhoto(user.id, asset.uri, kind);
        if (kind === "cover") {
          setCoverPhoto(publicUrl);
        } else {
          setRoomPhotos((prev) => [...prev, publicUrl]);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Caricamento fallito";
        Alert.alert("Errore", msg);
      } finally {
        if (kind === "cover") setUploadingCover(false);
        else setUploadingRoom(false);
      }
    },
    [user]
  );

  const removeCoverPhoto = useCallback(() => {
    Alert.alert(
      "Rimuovere la foto di copertina?",
      "Dovrai caricarne un'altra prima di salvare.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Rimuovi",
          style: "destructive",
          onPress: () => setCoverPhoto(null),
        },
      ]
    );
  }, []);

  const removeRoomPhoto = useCallback((index: number) => {
    setRoomPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Validation ────────────────────────────────────────────
  const fieldErrors = useMemo(() => {
    const errors: {
      name?: string;
      address?: string;
      sqm?: string;
      notes?: string;
      cover?: string;
    } = {};
    if (name.trim().length === 0) {
      errors.name = "Dai un nome alla casa";
    } else if (name.trim().length > NAME_MAX) {
      errors.name = `Massimo ${NAME_MAX} caratteri`;
    }
    if (address.trim().length === 0) {
      errors.address = "L'indirizzo è obbligatorio";
    } else if (address.trim().length > ADDRESS_MAX) {
      errors.address = `Massimo ${ADDRESS_MAX} caratteri`;
    } else if (!addressLatLng) {
      // Address was typed free-hand but never picked from the Google
      // autocomplete dropdown — it might be fake. Force the user to
      // pick a verified address.
      errors.address = "Seleziona un indirizzo dalla lista suggerita";
    }
    if (typology.sqm) {
      const n = Number(typology.sqm);
      if (!Number.isFinite(n)) errors.sqm = "Inserisci un numero";
      else if (n < 10) errors.sqm = "Minimo 10 m²";
      else if (n > 2000) errors.sqm = "Massimo 2000 m²";
    }
    if (notes.length > NOTES_MAX) {
      errors.notes = `Massimo ${NOTES_MAX} caratteri`;
    }
    if (!coverPhoto) {
      errors.cover = "La foto di copertina è obbligatoria";
    }
    return errors;
  }, [name, address, addressLatLng, typology.sqm, notes, coverPhoto]);

  const isValid = useMemo(
    () => Object.keys(fieldErrors).length === 0 && !!typology.typology,
    [fieldErrors, typology.typology]
  );

  // ── Progress calculation (for header bar + save bar) ──────
  // 5 tracked fields: cover photo, name, address+latlng, typology, notes-no-error
  const completedCount = useMemo(() => {
    let n = 0;
    if (coverPhoto) n++;
    if (name.trim().length > 0 && !fieldErrors.name) n++;
    if (address.trim().length > 0 && addressLatLng && !fieldErrors.address) n++;
    if (typology.typology) n++;
    if (!fieldErrors.notes) n++;
    return n;
  }, [coverPhoto, name, address, addressLatLng, typology.typology, fieldErrors]);

  const PROGRESS_TOTAL = 5;

  // Animate progress bar whenever completedCount changes
  useEffect(() => {
    progressRatio.value = withTiming(completedCount / PROGRESS_TOTAL, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [completedCount]);

  // Toggle with star bounce animation
  const handleDefaultToggle = useCallback((val: boolean) => {
    setIsDefault(val);
    starScale.value = withSequence(
      withSpring(val ? 1.4 : 0.7, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 14, stiffness: 250 })
    );
    if (val) {
      defaultBadgeOpacity.value = withDelay(
        80,
        withSpring(1, { damping: 18, stiffness: 220 })
      );
      defaultBadgeScale.value = withDelay(
        80,
        withSpring(1, { damping: 18, stiffness: 220 })
      );
    } else {
      defaultBadgeOpacity.value = withTiming(0, { duration: 180 });
      defaultBadgeScale.value = withTiming(0.6, { duration: 180 });
    }
  }, []);

  // Seed badge visibility once after the edit-mode data loads
  const badgeSeedDone = useRef(false);
  useEffect(() => {
    if (badgeSeedDone.current) return;
    if (!loading) {
      badgeSeedDone.current = true;
      if (isDefault) {
        defaultBadgeOpacity.value = 1;
        defaultBadgeScale.value = 1;
      }
    }
  }, [loading, isDefault]);

  // ── Save ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!user || saving) return;
    if (!isValid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      // For non-apartment properties (office/restaurant/bnb/...) this legacy
      // edit screen has no UI for the type-specific dimensions, so we keep
      // num_rooms exactly as it was loaded. Computing it from the residential
      // TypologySheet would silently rewrite an "ufficio · 12 postazioni"
      // into "trilocale · 3 camere".
      const isApt = !originalPropertyType || originalPropertyType === "apartment";
      const numRoomsForSave = isApt
        ? TYPOLOGY_TO_ROOMS[typology.typology] ?? 1
        : originalNumRooms ?? 1;

      const payload = {
        name: name.trim(),
        address: address.trim(),
        num_rooms: numRoomsForSave,
        sqm: typology.sqm ? Number(typology.sqm) : null,
        notes: notes.trim() ? notes.trim() : null,
        photo_url: coverPhoto, // backward compat
        cover_photo_url: coverPhoto,
        room_photo_urls: roomPhotos,
        is_default: isDefault,
        // lat/lng persisted so the home map can render a pin for this
        // property without having to re-geocode the address.
        latitude: addressLatLng?.latitude ?? null,
        longitude: addressLatLng?.longitude ?? null,
      };

      if (isEdit && id) {
        await updateClientProperty(id, payload);
      } else {
        // Legacy fallback path — creation now flows through the wizard
        // at /properties/new which sets property_type, cleaning_frequency
        // and type_details properly. This branch defaults them for any
        // entry point that still pushes here.
        await createClientProperty(user.id, {
          ...payload,
          property_type: "apartment",
          cleaning_frequency: null,
          type_details: {},
        });
      }
      router.back();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Impossibile salvare la casa.";
      Alert.alert("Errore", msg);
    } finally {
      setSaving(false);
    }
  }, [
    user,
    saving,
    isValid,
    name,
    address,
    addressLatLng,
    typology,
    notes,
    coverPhoto,
    roomPhotos,
    isDefault,
    isEdit,
    id,
    router,
    originalPropertyType,
    originalNumRooms,
  ]);

  // Cleanup debounce + abort on unmount
  useEffect(() => {
    return () => {
      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
      if (addressAbortRef.current) addressAbortRef.current.abort();
    };
  }, []);

  const handleDelete = useCallback(() => {
    if (!isEdit || !id) return;
    Alert.alert(
      "Eliminare questa casa?",
      "Le prenotazioni passate restano nello storico, ma non potrai più riusarla per nuove prenotazioni.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteClientProperty(id);
              router.back();
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : "Impossibile eliminare.";
              Alert.alert("Errore", msg);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [isEdit, id, router]);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/properties");
  }, [router]);

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={24} color={Colors.text} />
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.headerTitle}>
              {isEdit ? "Modifica casa" : "Nuova casa"}
            </Text>
            <Text style={styles.headerSubCount}>
              {completedCount} di {PROGRESS_TOTAL} completati
            </Text>
          </View>
          <View style={styles.iconBtn} />
        </View>
        {/* Progress bar with percentage label — matches V1 "Progress Hero" design */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressBarStyle]} />
          </View>
          <Text style={styles.progressPercent}>
            {Math.round((completedCount / PROGRESS_TOTAL) * 100)}%
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─────────────────────── HERO: Cover photo ─────────────────────── */}
          <Animated.View style={[styles.heroWrap, heroStyle]}>
            {coverPhoto ? (
              <View style={styles.coverPhotoContainer}>
                <Image source={{ uri: coverPhoto }} style={styles.coverPhoto} />
                <View style={styles.coverPhotoOverlay} />
                <Pressable
                  onPress={removeCoverPhoto}
                  style={styles.coverRemoveBtn}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() => pickAndUpload("cover")}
                  style={styles.coverReplaceBtn}
                >
                  <Ionicons name="camera-reverse-outline" size={16} color="#fff" />
                  <Text style={styles.coverReplaceText}>Cambia</Text>
                </Pressable>
                <View style={styles.coverBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />
                  <Text style={styles.coverBadgeText}>Verificata</Text>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => pickAndUpload("cover")}
                disabled={uploadingCover}
                style={({ pressed }) => [
                  styles.coverPlaceholder,
                  showErrors && fieldErrors.cover && styles.coverPlaceholderError,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {uploadingCover ? (
                  <>
                    <ActivityIndicator size="large" color={Colors.secondary} />
                    <Text style={styles.coverPlaceholderHint}>
                      Verifica con AI in corso...
                    </Text>
                  </>
                ) : (
                  <>
                    <View style={styles.coverPlaceholderIconCircle}>
                      <Ionicons
                        name="camera"
                        size={32}
                        color={Colors.secondary}
                      />
                    </View>
                    <Text style={styles.coverPlaceholderTitle}>
                      Foto di copertina
                    </Text>
                    <Text style={styles.coverPlaceholderHint}>
                      Tocca per scegliere una foto dell'ingresso o del salone{"\n"}
                      della casa. Obbligatoria.
                    </Text>
                  </>
                )}
              </Pressable>
            )}
            {showErrors && fieldErrors.cover && !coverPhoto ? (
              <Text style={styles.fieldError}>{fieldErrors.cover}</Text>
            ) : null}
          </Animated.View>

          {/* ─────────────────────── Dettagli ─────────────────────── */}
          <View style={styles.card}>
            <SectionHeader
              icon="information-circle-outline"
              title="Dettagli"
              subtitle="Come riconoscerla al volo"
            />

            <FieldBlock label="Nome della casa">
              <InputRow
                icon="pricetag-outline"
                value={name}
                onChangeText={(t) => setName(t.slice(0, NAME_MAX))}
                placeholder="Es. Casa mamma, Airbnb Navigli"
                error={showErrors ? fieldErrors.name : undefined}
                maxLength={NAME_MAX}
                showLength
              />
            </FieldBlock>

            <FieldBlock label="Indirizzo">
              <View>
                <InputRow
                  icon="location-outline"
                  value={address}
                  onChangeText={(t) => handleAddressChange(t.slice(0, ADDRESS_MAX))}
                  placeholder="Es. Via Roma 12, Milano"
                  error={showErrors ? fieldErrors.address : undefined}
                  maxLength={ADDRESS_MAX}
                  trailing={
                    addressSearching ? (
                      <ActivityIndicator size="small" color={Colors.secondary} />
                    ) : addressLatLng ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={Colors.success}
                      />
                    ) : undefined
                  }
                />
                {addressSuggestions.length > 0 && (
                  <View style={styles.suggestionsList}>
                    {addressSuggestions.map((s, idx) => (
                      <Pressable
                        key={s.placeId}
                        onPress={() => handleSelectAddress(s)}
                        style={({ pressed }) => [
                          styles.suggestionRow,
                          idx > 0 && styles.suggestionRowBordered,
                          pressed && { backgroundColor: Colors.backgroundAlt },
                        ]}
                      >
                        <Ionicons
                          name="location"
                          size={16}
                          color={Colors.secondary}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={styles.suggestionMain}
                            numberOfLines={1}
                          >
                            {s.mainText}
                          </Text>
                          {s.secondaryText ? (
                            <Text
                              style={styles.suggestionSecondary}
                              numberOfLines={1}
                            >
                              {s.secondaryText}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
                {address.trim().length >= 3 &&
                  !addressSearching &&
                  addressSuggestions.length === 0 &&
                  !addressLatLng && (
                    <Text style={styles.fieldHint}>
                      Nessun indirizzo trovato — aggiungi anche la città (es. "Via
                      Arcivescovo Romilli 11, Milano")
                    </Text>
                  )}
                {address.trim().length > 0 &&
                  address.trim().length < 3 &&
                  !addressLatLng && (
                    <Text style={styles.fieldHint}>
                      Continua a scrivere per vedere i suggerimenti...
                    </Text>
                  )}
              </View>
            </FieldBlock>

            {/* Map picker CTA — dark-green chip with frosted icon bubble.
                Pattern: outer View owns bg/shape/shadow/layout, inner
                Pressable is an absoluteFill touch overlay. No flex:1
                inside an alignSelf-flex-start parent (that combination
                collapses the width and clips the content). */}
            <View
              style={{
                marginTop: 12,
                alignSelf: "flex-start",
                borderRadius: 14,
                backgroundColor: Colors.primary,
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.08)",
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.18,
                shadowRadius: 14,
                elevation: 5,
                flexDirection: "row",
                alignItems: "center",
                paddingLeft: 6,
                paddingRight: 16,
                paddingVertical: 6,
              }}
            >
              {/* Frosted icon bubble */}
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
                pointerEvents="none"
              >
                <Ionicons name="map-outline" size={18} color="#ffffff" />
              </View>
              <Text
                pointerEvents="none"
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#ffffff",
                  letterSpacing: 0.1,
                }}
              >
                Scegli sulla mappa
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color="rgba(255,255,255,0.55)"
                style={{ marginLeft: 10 }}
              />
              <Pressable
                onPress={() => setMapPickerOpen(true)}
                accessibilityLabel="Scegli l'indirizzo sulla mappa"
                accessibilityRole="button"
                android_ripple={{ color: "rgba(255,255,255,0.12)" }}
                style={({ pressed }) => [
                  StyleSheet.absoluteFill,
                  { borderRadius: 14 },
                  pressed && { opacity: 0.88 },
                ]}
              />
            </View>
          </View>

          {/* Map picker modal — same component used in /properties/new */}
          <MapPicker
            visible={mapPickerOpen}
            initial={addressLatLng}
            onClose={() => setMapPickerOpen(false)}
            onPick={(coord, formatted) => {
              setMapPickerOpen(false);
              if (formatted) {
                setAddress(formatted.slice(0, ADDRESS_MAX));
              }
              setAddressLatLng(coord);
              setAddressSuggestions([]);
            }}
          />

          {/* ─────────────────────── Dimensioni ─────────────────────── */}
          <View style={styles.card}>
            <SectionHeader
              icon="home-outline"
              title="Dimensioni"
              subtitle="Aiuta il pulitore a prepararsi"
            />

            {/* Riga tipologia — apre il bottom sheet */}
            <Pressable
              onPress={() => setTypologyOpen(true)}
              style={styles.summaryRow}
            >
              <View style={styles.summaryIconWrap}>
                <Ionicons name="home-outline" size={18} color={Colors.secondary} />
              </View>
              <View style={styles.summaryTextWrap}>
                <Text style={styles.summaryLabel}>Tipologia</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {typology.typology.charAt(0).toUpperCase() + typology.typology.slice(1)}
                  {" · "}{typology.bedrooms} {typology.bedrooms === 1 ? "camera" : "camere"}
                  {" · "}{typology.bathrooms} {typology.bathrooms === 1 ? "bagno" : "bagni"}
                  {typology.sqm ? ` · ${typology.sqm} m²` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>
          </View>

          {/* ─────────────────────── Foto delle stanze ─────────────────────── */}
          <View style={styles.card}>
            <SectionHeader
              icon="images-outline"
              title="Foto delle stanze"
              subtitle="Mostra le aree da pulire al pulitore (opzionale)"
            />

            <RoomPhotoGrid
              photos={roomPhotos}
              maxPhotos={MAX_ROOM_PHOTOS}
              uploading={uploadingRoom}
              onAdd={() => pickAndUpload("room")}
              onRemove={removeRoomPhoto}
            />

            <View style={styles.aiNoticeRow}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color={Colors.secondary}
              />
              <Text style={styles.aiNoticeText}>
                Verificate automaticamente — vengono accettate solo foto di case
                e ambienti domestici
              </Text>
            </View>
          </View>

          {/* ─────────────────────── Note ─────────────────────── */}
          <View style={styles.card}>
            <SectionHeader
              icon="document-text-outline"
              title="Note per il pulitore"
              subtitle="Istruzioni fisse che valgono sempre (opzionale)"
            />

            <NotesInput
              value={notes}
              onChangeText={(t) => setNotes(t.slice(0, NOTES_MAX))}
              maxLength={NOTES_MAX}
              error={showErrors ? fieldErrors.notes : undefined}
            />
          </View>

          {/* ─────────────────────── Predefinita ─────────────────────── */}
          <View style={[styles.defaultCard, isDefault && styles.defaultCardActive]}>
            <Animated.View style={[styles.defaultIcon, starAnimStyle]}>
              <Ionicons
                name={isDefault ? "star" : "star-outline"}
                size={18}
                color={isDefault ? Colors.secondary : Colors.textTertiary}
              />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <View style={styles.defaultTitleRow}>
                <Text style={styles.defaultTitle}>Casa predefinita</Text>
                <Animated.View style={[styles.defaultBadge, defaultBadgeStyle]}>
                  <Text style={styles.defaultBadgeText}>PREDEFINITA</Text>
                </Animated.View>
              </View>
              <Text style={styles.defaultSub}>
                Appare sempre per prima quando prenoti una pulizia.
              </Text>
            </View>
            <Switch
              value={isDefault}
              onValueChange={handleDefaultToggle}
              trackColor={{ false: Colors.border, true: Colors.secondary }}
              thumbColor="#fff"
              ios_backgroundColor={Colors.border}
            />
          </View>

          {/* ─────────────────────── Delete ─────────────────────── */}
          {isEdit && (
            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              style={({ pressed }) => [
                styles.deleteBtn,
                pressed && { opacity: 0.5 },
              ]}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
              <Text style={styles.deleteBtnText}>
                {deleting ? "Eliminazione..." : "Elimina questa casa"}
              </Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Save bar — intentionally loud so users can't miss it */}
        <View style={styles.saveBar}>
          {/* Progress indicator strip */}
          <View style={styles.saveProgressWrap}>
            <View style={styles.saveProgressTrack}>
              <Animated.View style={[styles.saveProgressFill, progressBarStyle]} />
            </View>
            <Text style={[styles.saveProgressLabel, isValid && { color: Colors.success }]}>
              {isValid
                ? "Tutto pronto"
                : !coverPhoto
                ? "Aggiungi la foto di copertina"
                : !addressLatLng && address.trim().length > 0
                ? "Seleziona l'indirizzo dai suggerimenti"
                : `${completedCount} di ${PROGRESS_TOTAL} campi completati`}
            </Text>
          </View>
          <AnimatedSaveButton
            onPress={handleSave}
            saving={saving}
            isValid={isValid}
            isEdit={isEdit}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Typology bottom sheet */}
      <TypologySheet
        visible={typologyOpen}
        onClose={() => setTypologyOpen(false)}
        value={typology}
        onChange={setTypology}
      />
    </SafeAreaView>
  );
}

// ───────────────────────────── Sub components ─────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={18} color={Colors.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: Spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

interface InputRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  error?: string;
  maxLength?: number;
  keyboardType?: "default" | "number-pad" | "email-address";
  multiline?: boolean;
  minHeight?: number;
  trailing?: React.ReactNode;
  showLength?: boolean;
}

function InputRow({
  icon,
  value,
  onChangeText,
  placeholder,
  error,
  maxLength,
  keyboardType = "default",
  multiline = false,
  minHeight,
  trailing,
  showLength = false,
}: InputRowProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <View
        style={[
          styles.inputWrap,
          focused && styles.inputWrapFocused,
          error && styles.inputWrapError,
          multiline && {
            alignItems: "flex-start",
            paddingTop: 14,
            minHeight: minHeight ?? 64,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={
            error
              ? Colors.error
              : focused
              ? Colors.secondary
              : Colors.textTertiary
          }
          style={multiline ? { marginTop: 2 } : undefined}
        />
        <TextInput
          style={[styles.input, multiline && { textAlignVertical: "top" }]}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          maxLength={maxLength}
          keyboardType={keyboardType}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {trailing}
      </View>
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : showLength && maxLength ? (
        <Text style={styles.fieldHint}>
          {value.length}/{maxLength} caratteri
        </Text>
      ) : null}
    </View>
  );
}

function RoomChip({
  value,
  selected,
  onPress,
}: {
  value: number;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPress={() => {
        scale.value = withSequence(
          withTiming(0.92, { duration: 90, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 150, easing: Easing.out(Easing.back(2)) })
        );
        onPress();
      }}
    >
      <Animated.View
        style={[styles.roomChip, selected && styles.roomChipSelected, animStyle]}
      >
        <Text
          style={[
            styles.roomChipText,
            selected && styles.roomChipTextSelected,
          ]}
        >
          {value}
        </Text>
        <Text
          style={[
            styles.roomChipLabel,
            selected && styles.roomChipLabelSelected,
          ]}
        >
          {value === 1 ? "stanza" : "stanze"}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ───────────────────────────── Styles ─────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  // ── Header with progress ──
  headerWrap: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: Colors.text },
  headerSubCount: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textTertiary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: Spacing.base,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: Colors.borderLight,
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.secondary,
    borderRadius: 3,
  },
  progressPercent: {
    marginLeft: Spacing.sm,
    fontSize: 11,
    fontWeight: "800",
    color: Colors.secondary,
    letterSpacing: 0.2,
    minWidth: 32,
    textAlign: "right",
  },

  scroll: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 140,
  },

  // ── HERO cover photo ──
  heroWrap: {
    marginBottom: Spacing.lg,
  },
  coverPhotoContainer: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: Radius.xl,
    overflow: "hidden",
    backgroundColor: Colors.surfaceElevated,
    ...Shadows.md,
  },
  coverPhoto: { width: "100%", height: "100%" },
  coverPhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  coverRemoveBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverReplaceBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(2, 36, 32, 0.82)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  coverReplaceText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  coverBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  coverBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  coverPlaceholder: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: "dashed",
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  coverPlaceholderError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  coverPlaceholderIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  coverPlaceholderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  coverPlaceholderHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 17,
  },

  // ── Card containers ──
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },

  // ── Typology summary row ──
  summaryRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  summaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginTop: Spacing.base,
    marginBottom: 0,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textSecondary,
  },

  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  fieldError: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: Colors.error,
  },

  // ── Input rows ──
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.base,
    height: 52,
  },
  inputWrapFocused: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.surface,
  },
  inputWrapError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    height: "100%",
  },
  trailingUnit: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontWeight: "700",
  },

  // --- Suggestions dropdown ---
  suggestionsList: {
    marginTop: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  suggestionRowBordered: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  suggestionMain: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  suggestionSecondary: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // ── Room chips ──
  roomGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  roomChip: {
    width: 74,
    height: 74,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  roomChipSelected: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.accentLight,
  },
  roomChipText: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  roomChipTextSelected: {
    color: Colors.secondary,
  },
  roomChipLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  roomChipLabelSelected: {
    color: Colors.secondary,
  },

  aiNoticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  aiNoticeText: {
    flex: 1,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },

  // ── Default toggle ──
  defaultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
    marginBottom: Spacing.md,
  },
  defaultCardActive: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.accentLight,
  },
  defaultIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  defaultTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  defaultTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: Colors.secondary,
  },
  defaultBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  defaultSub: {
    marginTop: 3,
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // ── Room photo grid (premium) ──
  roomPhotoGridWrap: {
    marginTop: Spacing.md,
  },
  roomPhotoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  roomPhotoThumbWrap: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: "hidden",
    position: "relative",
  },
  roomPhotoThumbImg: {
    width: "100%",
    height: "100%",
  },
  roomPhotoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  roomPhotoGhostSlot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: "dashed",
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  roomPhotoGhostPrimary: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.accentLight,
    borderWidth: 2,
  },
  roomPhotoGhostLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "800",
    color: Colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  roomPhotoGhostSub: {
    marginTop: 2,
    fontSize: 9,
    color: Colors.textTertiary,
    textAlign: "center",
  },

  // ── Notes input ──
  notesWrap: {
    marginTop: Spacing.md,
  },
  notesInputContainer: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceElevated,
    padding: Spacing.base,
  },
  notesInputContainerFocused: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.surface,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  notesInputContainerError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  notesInput: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: "top",
  },
  notesFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  notesError: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.error,
    flex: 1,
  },
  notesCounter: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textTertiary,
    textAlign: "right",
  },
  notesCounterWarning: {
    color: Colors.warning,
  },
  notesCounterDanger: {
    color: Colors.error,
  },

  // ── Delete ──
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: Spacing.base,
    borderRadius: Radius.md,
    backgroundColor: Colors.errorLight,
    marginTop: Spacing.sm,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.error,
  },

  // ── Save bar (sticky, loud, always visible) ──
  saveBar: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Platform.OS === "ios" ? 32 : Spacing.lg,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 16,
  },
  saveProgressWrap: {
    marginBottom: 12,
  },
  saveProgressTrack: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  saveProgressFill: {
    height: 4,
    backgroundColor: Colors.secondary,
    borderRadius: 4,
  },
  saveProgressLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.warning,
    textAlign: "center",
  },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  saveBtnDisabled: {
    backgroundColor: Colors.textTertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
});

// ─────────────────────────── New sub-components ───────────────────────────
// Declared after StyleSheet to avoid Hermes TDZ issues with const styles

// ── AnimatedSaveButton ────────────────────────────────────────────────────
function AnimatedSaveButton({
  onPress,
  saving,
  isValid,
  isEdit,
}: {
  onPress: () => void;
  saving: boolean;
  isValid: boolean;
  isEdit: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const onPressIn = () => {
    if (!saving) {
      scale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
    }
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };
  return (
    <Animated.View style={[animStyle, styles.saveBtn, saving && styles.saveBtnDisabled]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={saving}
        accessibilityLabel={isEdit ? "Salva modifiche" : "Salva casa"}
        accessibilityRole="button"
        android_ripple={{ color: "rgba(255,255,255,0.18)" }}
        style={StyleSheet.absoluteFill}
      />
      {saving ? (
        <ActivityIndicator color="#fff" pointerEvents="none" />
      ) : (
        <>
          <Ionicons
            name="checkmark"
            size={18}
            color="#fff"
            pointerEvents="none"
          />
          <Text style={styles.saveBtnText} pointerEvents="none">
            {isEdit ? "Salva modifiche" : "Salva casa"}
          </Text>
        </>
      )}
    </Animated.View>
  );
}

// ── NotesInput ───────────────────────────────────────────────────────────
function NotesInput({
  value,
  onChangeText,
  maxLength,
  error,
}: {
  value: string;
  onChangeText: (t: string) => void;
  maxLength: number;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);

  const counterStyle = (() => {
    if (value.length >= maxLength - 10) return styles.notesCounterDanger;
    if (value.length >= maxLength - 50) return styles.notesCounterWarning;
    return undefined;
  })();

  return (
    <View style={styles.notesWrap}>
      <View
        style={[
          styles.notesInputContainer,
          focused && styles.notesInputContainerFocused,
          error && styles.notesInputContainerError,
        ]}
      >
        <TextInput
          style={styles.notesInput}
          value={value}
          onChangeText={onChangeText}
          placeholder="Es. Le chiavi sono dal portinaio, c'è un gatto, materiali già presenti"
          placeholderTextColor={Colors.textTertiary}
          multiline
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          textAlignVertical="top"
        />
      </View>
      <View style={styles.notesFooter}>
        {error ? (
          <Text style={styles.notesError}>{error}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Text style={[styles.notesCounter, counterStyle]}>
          {value.length} / {maxLength}
        </Text>
      </View>
    </View>
  );
}

// ── RoomPhotoThumbAnimated ────────────────────────────────────────────────
function RoomPhotoThumbAnimated({
  uri,
  onRemove,
}: {
  uri: string;
  onRemove: () => void;
}) {
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 16, stiffness: 220 });
    opacity.value = withTiming(1, { duration: 220 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.roomPhotoThumbWrap, animStyle]}>
      <Image source={{ uri }} style={styles.roomPhotoThumbImg} />
      <Pressable
        onPress={onRemove}
        style={styles.roomPhotoRemove}
        hitSlop={6}
        accessibilityLabel="Rimuovi foto"
      >
        <Ionicons name="close" size={14} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

// ── RoomPhotoGrid ─────────────────────────────────────────────────────────
// Shows photos in pairs of 2 per row. Fills remaining slots with ghost
// placeholders up to a max of 4 visible slots. The first empty ghost
// is the primary CTA; the rest are subtle dashed guides.
function RoomPhotoGrid({
  photos,
  maxPhotos,
  uploading,
  onAdd,
  onRemove,
}: {
  photos: string[];
  maxPhotos: number;
  uploading: boolean;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  // Build a flat list: real photos + ghost slots (max visible = 4 slots or
  // enough to show all real photos plus one add slot)
  const GHOST_SLOTS = 4;
  const totalSlots = Math.max(GHOST_SLOTS, photos.length + (photos.length < maxPhotos ? 1 : 0));
  // Cap rows to show at most 2 rows of 2
  const visibleSlots = Math.min(totalSlots, 4);

  const slots: Array<{ kind: "photo"; uri: string; idx: number } | { kind: "add" } | { kind: "ghost" }> = [];
  for (let i = 0; i < photos.length; i++) {
    slots.push({ kind: "photo", uri: photos[i], idx: i });
  }
  if (photos.length < maxPhotos && slots.length < visibleSlots) {
    slots.push({ kind: "add" });
  }
  while (slots.length < visibleSlots) {
    slots.push({ kind: "ghost" });
  }

  // Split into rows of 2
  const rows: typeof slots[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    rows.push(slots.slice(i, i + 2));
  }

  const isFirstEmpty = photos.length === 0;

  return (
    <View style={styles.roomPhotoGridWrap}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.roomPhotoRow}>
          {row.map((slot, colIdx) => {
            const isFirst = rowIdx === 0 && colIdx === 0 && slot.kind !== "photo";

            if (slot.kind === "photo") {
              return (
                <RoomPhotoThumbAnimated
                  key={`photo-${slot.idx}`}
                  uri={slot.uri}
                  onRemove={() => onRemove(slot.idx)}
                />
              );
            }

            if (slot.kind === "add") {
              return (
                <Pressable
                  key={`add-${rowIdx}-${colIdx}`}
                  onPress={onAdd}
                  disabled={uploading}
                  accessibilityLabel="Aggiungi foto stanza"
                  style={({ pressed }) => [
                    styles.roomPhotoThumbWrap,
                    styles.roomPhotoGhostSlot,
                    isFirst && styles.roomPhotoGhostPrimary,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {uploading ? (
                    <ActivityIndicator color={Colors.secondary} />
                  ) : (
                    <>
                      <Ionicons
                        name="add-circle-outline"
                        size={isFirst ? 32 : 22}
                        color={isFirst ? Colors.secondary : Colors.textTertiary}
                      />
                      {isFirst && (
                        <>
                          <Text style={styles.roomPhotoGhostLabel}>
                            Aggiungi foto
                          </Text>
                          <Text style={styles.roomPhotoGhostSub}>
                            Camera  •  Libreria
                          </Text>
                        </>
                      )}
                    </>
                  )}
                </Pressable>
              );
            }

            // ghost — decorative empty slot
            return (
              <View
                key={`ghost-${rowIdx}-${colIdx}`}
                style={[styles.roomPhotoThumbWrap, styles.roomPhotoGhostSlot]}
              />
            );
          })}
          {/* If row has only 1 slot, add invisible filler for even columns */}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}
```

---

### `app/profile/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="edit" />
    </Stack>
  );
}
```

---

### `app/profile/edit.tsx`

```tsx
import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { updateProfileName } from "../../lib/api";
import { Colors } from "../../lib/theme";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);

  const trimmedName = fullName.trim();
  const hasChanges =
    trimmedName.length > 0 && trimmedName !== (profile?.full_name ?? "");
  const isValid = trimmedName.length >= 2;

  const handleSave = useCallback(async () => {
    if (!user || !hasChanges || !isValid) return;
    setSaving(true);
    try {
      await updateProfileName(user.id, trimmedName);
      await refreshProfile();
      router.back();
    } catch {
      Alert.alert("Errore", "Impossibile salvare. Riprova.");
    } finally {
      setSaving(false);
    }
  }, [user, hasChanges, isValid, trimmedName, refreshProfile, router]);

  const handleBack = useCallback(() => {
    if (hasChanges && !saving) {
      Alert.alert(
        "Annullare le modifiche?",
        "Le modifiche non salvate andranno perse.",
        [
          { text: "Continua a modificare", style: "cancel" },
          {
            text: "Esci senza salvare",
            style: "destructive",
            onPress: () => router.back(),
          },
        ]
      );
      return;
    }
    router.back();
  }, [hasChanges, saving, router]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" />

      {/* Nav bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.8}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: Colors.surface,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "700",
            color: Colors.text,
          }}
        >
          Modifica profilo
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: Colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 10,
            }}
          >
            Nome completo
          </Text>
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 4,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Il tuo nome completo"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
              maxLength={60}
              style={{
                height: 52,
                fontSize: 16,
                color: Colors.text,
              }}
            />
          </View>

          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: Colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginTop: 24,
              marginBottom: 10,
            }}
          >
            Email
          </Text>
          <View
            style={{
              backgroundColor: Colors.surfaceLow,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 16,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons
              name="mail-outline"
              size={18}
              color={Colors.textTertiary}
            />
            <Text
              style={{
                marginLeft: 10,
                fontSize: 15,
                color: Colors.textSecondary,
                flex: 1,
              }}
            >
              {user?.email ?? "—"}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 12,
              color: Colors.textTertiary,
              marginTop: 6,
              marginLeft: 4,
            }}
          >
            Contatta il supporto per modificare l'email
          </Text>
        </ScrollView>

        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 24,
            backgroundColor: Colors.background,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!hasChanges || !isValid || saving}
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityState={{
              disabled: !hasChanges || !isValid || saving,
              busy: saving,
            }}
            accessibilityLabel="Salva modifiche al profilo"
            style={{
              backgroundColor:
                !hasChanges || !isValid || saving
                  ? Colors.textTertiary
                  : Colors.secondary,
              borderRadius: 16,
              height: 56,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}
              >
                Salva modifiche
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

---

### `app/documents/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function DocumentsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
```

---

### `app/documents/index.tsx`

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { useStripeIdentity } from "@stripe/stripe-identity-react-native";
import type { IdentityVerificationSheetStatus } from "@stripe/stripe-identity-react-native";
import { useAuth } from "../../lib/auth";
import { useIdentityVerification } from "../../lib/hooks/useIdentityVerification";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateIT(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const FAQ_ITEMS = [
  {
    icon: "card-outline" as const,
    q: "Quali documenti posso usare?",
    a: "Puoi usare carta d'identità, passaporto o patente di guida. Il documento deve essere in corso di validità.",
  },
  {
    icon: "scan-outline" as const,
    q: "Come avviene la verifica?",
    a: "Stripe verifica automaticamente l'autenticità del documento e confronta il tuo selfie con la foto sul documento tramite liveness check.",
  },
  {
    icon: "timer-outline" as const,
    q: "Quanto tempo ci vuole?",
    a: "La verifica è generalmente automatica e richiede 2-5 minuti. In alcuni casi può richiedere fino a 24 ore per la revisione manuale.",
  },
  {
    icon: "lock-closed-outline" as const,
    q: "I miei dati sono al sicuro?",
    a: "Sì. I dati biometrici e i documenti sono trattati direttamente da Stripe nel rispetto del GDPR. CleanHome non accede mai alle immagini del tuo documento.",
  },
  {
    icon: "refresh-outline" as const,
    q: "Posso ripetere la verifica?",
    a: "Sì, se la verifica non va a buon fine puoi ripeterla in qualsiasi momento.",
  },
];

const BENEFITS = [
  {
    icon: "card-outline" as const,
    label: "Documento d'identità",
    sub: "Carta, passaporto o patente",
  },
  {
    icon: "camera-outline" as const,
    label: "Selfie con liveness check",
    sub: "Verifica rapida in tempo reale",
  },
  {
    icon: "checkmark-done-circle-outline" as const,
    label: "Verifica in 2-5 minuti",
    sub: "Automatica, verificato per sempre",
  },
];

const PROCESSING_MESSAGES = [
  "Stiamo analizzando il documento...",
  "Verifica del selfie in corso...",
  "Confronto dati biometrici...",
  "Quasi pronto, ancora un momento...",
];

// ─── Trust Badges ────────────────────────────────────────────────────────────

function TrustBadges() {
  return (
    <Animated.View
      entering={FadeInDown.delay(260).springify().damping(22)}
      style={styles.trustRow}
    >
      <View style={styles.trustChip}>
        <Ionicons name="shield-checkmark-outline" size={12} color={Colors.secondary} />
        <Text style={styles.trustChipText}>Stripe Identity</Text>
      </View>
      <View style={styles.trustChip}>
        <Ionicons name="lock-closed-outline" size={12} color={Colors.secondary} />
        <Text style={styles.trustChipText}>Crittografato</Text>
      </View>
      <View style={styles.trustChip}>
        <Ionicons name="document-text-outline" size={12} color={Colors.secondary} />
        <Text style={styles.trustChipText}>GDPR</Text>
      </View>
    </Animated.View>
  );
}

// ─── FAQ Modal ────────────────────────────────────────────────────────────────

function FaqAccordionItem({
  item,
  index,
}: {
  item: (typeof FAQ_ITEMS)[number];
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const rotation = useSharedValue(0);
  const height = useSharedValue(0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    rotation.value = withSpring(next ? 90 : 0, { damping: 18, stiffness: 200 });
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(22)}
      style={styles.faqAccordion}
    >
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.faqAccordionHeader,
          pressed && { opacity: 0.8 },
        ]}
        accessibilityRole="button"
      >
        <View style={styles.faqAccordionIconWrap}>
          <Ionicons name={item.icon} size={16} color={Colors.secondary} />
        </View>
        <Text style={styles.faqAccordionQ}>{item.q}</Text>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </Animated.View>
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn.duration(180)} style={styles.faqAccordionBody}>
          <Text style={styles.faqAccordionA}>{item.a}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function FaqModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.faqOverlay}>
        <Pressable style={styles.faqBackdrop} onPress={onClose} />
        <View style={styles.faqSheet}>
          <View style={styles.faqHandle} />
          <Text style={styles.faqTitle}>Come funziona la verifica?</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {FAQ_ITEMS.map((item, i) => (
              <FaqAccordionItem key={i} item={item} index={i} />
            ))}
          </ScrollView>
          <View style={styles.faqCloseBtn}>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Chiudi"
              accessibilityRole="button"
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.faqCloseBtnText} pointerEvents="none">Chiudi</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Shield Glow Hero ────────────────────────────────────────────────────────

function ShieldHero() {
  const pulse = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);

  const shieldStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.heroIconContainer}>
      {/* Glow rings */}
      <Animated.View style={[styles.glowRing, styles.glowRingOuter, glowStyle]} />
      <Animated.View style={[styles.glowRing, styles.glowRingMid, glowStyle]} />
      {/* Shield */}
      <Animated.View style={[styles.shieldInner, shieldStyle]}>
        <Ionicons name="shield-checkmark" size={48} color={Colors.secondary} />
      </Animated.View>
    </View>
  );
}

// ─── Benefit Card ────────────────────────────────────────────────────────────

function BenefitCard({
  item,
  index,
}: {
  item: (typeof BENEFITS)[number];
  index: number;
}) {
  return (
    <Animated.View
      entering={FadeInRight.delay(200 + index * 80).springify().damping(22)}
      style={styles.benefitCard}
    >
      <View style={styles.benefitIconWrap}>
        <Ionicons name={item.icon} size={20} color={Colors.secondary} />
      </View>
      <View style={styles.benefitTextGroup}>
        <Text style={styles.benefitLabel}>{item.label}</Text>
        <Text style={styles.benefitSub}>{item.sub}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Premium CTA Button ───────────────────────────────────────────────────────

interface PremiumCtaProps {
  label: string;
  onPress: () => void;
  isLoading: boolean;
  iconName?: React.ComponentProps<typeof Ionicons>["name"];
  variant?: "primary" | "warning";
}

function PremiumCta({
  label,
  onPress,
  isLoading,
  iconName = "shield-checkmark",
  variant = "primary",
}: PremiumCtaProps) {
  const scale = useSharedValue(1);
  const iconScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 150 });
    iconScale.value = withSpring(0.9, { damping: 12, stiffness: 200 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
    iconScale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  const bgColor = variant === "warning" ? Colors.warning : Colors.secondary;
  const shadowColor = variant === "warning" ? Colors.warning : Colors.secondary;

  return (
    <Animated.View style={[styles.ctaWrapper, animatedStyle]}>
      <View
        style={[
          styles.ctaInner,
          { backgroundColor: bgColor, shadowColor },
          isLoading && styles.ctaDisabled,
        ]}
      >
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={label}
          android_ripple={{ color: "rgba(255,255,255,0.18)" }}
          style={StyleSheet.absoluteFill}
        />
        {isLoading ? (
          <ActivityIndicator size="small" color="#ffffff" pointerEvents="none" />
        ) : (
          <>
            <Animated.View style={iconAnimStyle} pointerEvents="none">
              <Ionicons name={iconName} size={22} color="#ffffff" />
            </Animated.View>
            <Text style={styles.ctaText} pointerEvents="none">{label}</Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Rotating Processing Message ──────────────────────────────────────────────

function RotatingMessage() {
  const [msgIndex, setMsgIndex] = useState(0);
  const [displayed, setDisplayed] = useState(PROCESSING_MESSAGES[0]);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const interval = setInterval(() => {
      opacity.value = withTiming(0, { duration: 300 }, () => {
        runOnJS(setMsgIndex)((prev) => (prev + 1) % PROCESSING_MESSAGES.length);
        opacity.value = withTiming(1, { duration: 300 });
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setDisplayed(PROCESSING_MESSAGES[msgIndex]);
  }, [msgIndex]);

  const msgStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.Text style={[styles.processingRotMsg, msgStyle]}>{displayed}</Animated.Text>
  );
}

// ─── Processing Ring ─────────────────────────────────────────────────────────

function ProcessingRing() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.processingRingContainer}>
      <Animated.View style={[styles.processingRing, ringStyle]} />
      <View style={styles.processingRingCenter}>
        <Ionicons name="shield-checkmark-outline" size={32} color={Colors.secondary} />
      </View>
    </View>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────

function VerifiedCard({ verifiedAt }: { verifiedAt: string | null }) {
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.92);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    cardScale.value = withSpring(1, { damping: 20, stiffness: 180 });
    cardOpacity.value = withTiming(1, { duration: 300 });
    checkScale.value = withDelay(
      200,
      withSpring(1, { damping: 14, stiffness: 220 })
    );
    checkOpacity.value = withDelay(200, withTiming(1, { duration: 200 }));
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  return (
    <Animated.View style={[styles.verifiedCard, cardStyle]}>
      <Animated.View style={[styles.verifiedIconWrap, checkStyle]}>
        <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
      </Animated.View>
      <Text style={styles.verifiedTitle}>Identità verificata</Text>
      {verifiedAt ? (
        <View style={styles.verifiedDateRow}>
          <Ionicons name="calendar-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.verifiedDate}>Verificato il {formatDateIT(verifiedAt)}</Text>
        </View>
      ) : null}
      <Text style={styles.verifiedSub}>
        Sei pronto per ricevere pagamenti e prenotazioni su CleanHome.
      </Text>
      <View style={styles.verifiedBadge}>
        <Ionicons name="shield-checkmark-outline" size={12} color={Colors.success} />
        <Text style={styles.verifiedBadgeText}>Verifica Stripe · GDPR</Text>
      </View>
    </Animated.View>
  );
}

interface ProcessingCardProps {
  onRefresh: () => void;
  onRestart: () => void;
  isRefreshing: boolean;
  isRestarting: boolean;
}

function ProcessingCard({
  onRefresh,
  onRestart,
  isRefreshing,
  isRestarting,
}: ProcessingCardProps) {
  const [restartVisible, setRestartVisible] = useState(false);
  const restartOpacity = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRestartVisible(true);
      restartOpacity.value = withTiming(1, { duration: 400 });
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  const restartStyle = useAnimatedStyle(() => ({ opacity: restartOpacity.value }));

  const refreshScale = useSharedValue(1);
  const refreshAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: refreshScale.value }],
  }));

  const onRefreshPressIn = () =>
    (refreshScale.value = withSpring(0.97, { damping: 15, stiffness: 150 }));
  const onRefreshPressOut = () =>
    (refreshScale.value = withSpring(1, { damping: 15, stiffness: 150 }));

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(22)}
      style={styles.processingCard}
    >
      <ProcessingRing />
      <Text style={styles.processingTitle}>Verifica in corso</Text>
      <RotatingMessage />
      <Text style={styles.processingSub}>
        Riceverai una notifica appena completata.{"\n"}Di solito 2–5 minuti.
      </Text>
      <Animated.View style={[{ alignSelf: "stretch" }, refreshAnimStyle]}>
        <View style={[styles.processingRefreshBtn, isRefreshing && styles.ctaDisabled]}>
          <Pressable
            onPress={onRefresh}
            onPressIn={onRefreshPressIn}
            onPressOut={onRefreshPressOut}
            disabled={isRefreshing}
            accessibilityLabel="Aggiorna stato verifica"
            accessibilityRole="button"
            android_ripple={{ color: "rgba(255,255,255,0.18)" }}
            style={StyleSheet.absoluteFill}
          />
          {isRefreshing ? (
            <ActivityIndicator size="small" color="#fff" pointerEvents="none" />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={16} color="#fff" pointerEvents="none" />
              <Text style={styles.processingRefreshBtnText} pointerEvents="none">Aggiorna stato</Text>
            </>
          )}
        </View>
      </Animated.View>
      {restartVisible && (
        <Animated.View style={[{ alignSelf: "stretch" }, restartStyle]}>
          <Pressable
            style={[styles.processingRestartBtn, isRestarting && { opacity: 0.6 }]}
            onPress={onRestart}
            disabled={isRestarting}
            accessibilityLabel="Ricomincia la verifica identità"
            accessibilityRole="button"
          >
            {isRestarting ? (
              <ActivityIndicator size="small" color={Colors.textSecondary} />
            ) : (
              <Text style={styles.processingRestartBtnText}>Ricomincia verifica</Text>
            )}
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}

interface RequiresInputCardProps {
  lastError: string | null;
  onRetry: () => void;
  isLoading: boolean;
}

function RequiresInputCard({ lastError, onRetry, isLoading }: RequiresInputCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(20)}
      style={styles.requiresCard}
    >
      <View style={styles.requiresIconWrap}>
        <Ionicons name="alert-circle" size={44} color={Colors.warning} />
      </View>
      <Text style={styles.requiresTitle}>Quasi ci siamo</Text>
      <Text style={styles.requiresSub}>
        {lastError ??
          "Abbiamo bisogno di qualche informazione in più per completare la verifica. Riprova — richiede solo un minuto."}
      </Text>
      <View style={styles.requiresTipCard}>
        <Ionicons name="bulb-outline" size={14} color={Colors.secondary} />
        <Text style={styles.requiresTipText}>
          Assicurati di usare un documento chiaro e non scaduto.
        </Text>
      </View>
      <PremiumCta
        label="Riprova verifica"
        onPress={onRetry}
        isLoading={isLoading}
        iconName="refresh-outline"
        variant="warning"
      />
    </Animated.View>
  );
}

interface WelcomeContentProps {
  wasCanceled: boolean;
  onStart: () => void;
  isLoading: boolean;
  onFaq: () => void;
}

function WelcomeContent({
  wasCanceled,
  onStart,
  isLoading,
  onFaq,
}: WelcomeContentProps) {
  return (
    <>
      {/* Hero */}
      <Animated.View
        entering={FadeInDown.delay(60).springify().damping(22)}
        style={styles.heroBlock}
      >
        <ShieldHero />
        <View style={styles.heroTextGroup}>
          <Text style={styles.heroTitleLine1}>Verifica</Text>
          <Text style={styles.heroTitleLine2}>la tua identità</Text>
        </View>
        <Text style={styles.heroSub}>
          {wasCanceled
            ? "Hai annullato la verifica precedente. Ricomincia quando sei pronto."
            : "Pochi minuti, verificato per sempre. Richiesto per ricevere pagamenti dai clienti."}
        </Text>
      </Animated.View>

      {/* Benefits */}
      <View style={styles.benefitsSection}>
        {BENEFITS.map((b, i) => (
          <BenefitCard key={i} item={b} index={i} />
        ))}
      </View>

      {/* Trust badges */}
      <TrustBadges />

      {/* CTA */}
      <Animated.View
        entering={FadeInDown.delay(340).springify().damping(22)}
        style={styles.ctaSection}
      >
        <PremiumCta
          label="Inizia verifica"
          onPress={onStart}
          isLoading={isLoading}
          iconName="shield-checkmark"
          variant="primary"
        />
      </Animated.View>

      {/* FAQ link */}
      <Animated.View entering={FadeIn.delay(420).duration(400)}>
        <Pressable
          style={({ pressed }) => [styles.faqLink, pressed && { opacity: 0.7 }]}
          onPress={onFaq}
          accessibilityLabel="Come funziona la verifica? Apri FAQ"
          accessibilityRole="button"
        >
          <Ionicons name="help-circle-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.faqLinkText}>Come funziona la verifica?</Text>
        </Pressable>
      </Animated.View>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DocumentsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const {
    status,
    verifiedAt,
    lastError,
    isLoading,
    error,
    startVerification,
    refetch,
    syncFromStripe,
  } = useIdentityVerification(user?.id);

  const [sdkLoading, setSdkLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [faqVisible, setFaqVisible] = useState(false);

  // ⚠️ FIX: reset sdkLoading on mount per evitare bottone permanently
  // disabled se l'utente è uscito dall'app durante l'onboarding Stripe
  useEffect(() => {
    setSdkLoading(false);
  }, []);

  const optionsProvider = useCallback(async () => {
    const { sessionId, ephemeralKeySecret } = await startVerification();
    return {
      sessionId,
      ephemeralKeySecret,
      brandLogo: Image.resolveAssetSource(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../../assets/icon.png")
      ),
    };
  }, [startVerification]);

  const {
    present,
    loading: sdkPresenting,
    status: sdkStatus,
  } = useStripeIdentity(optionsProvider);

  const isCtaLoading = sdkLoading || sdkPresenting;

  const handleStartVerification = useCallback(async () => {
    if (isCtaLoading) return;
    setSdkLoading(true);
    try {
      await present();
      await refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore durante la verifica";
      Alert.alert("Errore", msg);
    } finally {
      setSdkLoading(false);
    }
  }, [isCtaLoading, present, refetch]);

  // "Aggiorna stato" now syncs directly with Stripe API instead of just rereading
  // the DB. This resolves stuck "processing" states when the webhook hasn't arrived yet.
  const handleRefetch = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await syncFromStripe();
    } catch {
      // Fallback to a plain DB read if the Stripe sync call fails
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [syncFromStripe, refetch]);

  // Auto-sync on mount when status is stuck in "processing" and the DB row
  // hasn't been updated in the last 30 seconds (likely a stale webhook state).
  const autoSyncDoneRef = useRef(false);
  useEffect(() => {
    if (!isLoading && status === "processing" && !autoSyncDoneRef.current) {
      autoSyncDoneRef.current = true;
      syncFromStripe().catch(() => {
        // Silently ignore — the manual "Aggiorna stato" button remains available
      });
    }
  }, [isLoading, status, syncFromStripe]);

  const handleFaqOpen = useCallback(() => setFaqVisible(true), []);
  const handleFaqClose = useCallback(() => setFaqVisible(false), []);

  const wasCanceled =
    status === "canceled" ||
    (sdkStatus as IdentityVerificationSheetStatus | undefined) === "FlowCanceled";

  const renderMainContent = () => {
    if (isLoading) {
      return (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.loadingBlock}
        >
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.loadingText}>Caricamento stato verifica...</Text>
        </Animated.View>
      );
    }
    if (error) {
      return (
        <Animated.View
          entering={FadeInDown.springify().damping(20)}
          style={styles.errorBlock}
        >
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle" size={40} color={Colors.error} />
          </View>
          <Text style={styles.errorTitle}>Qualcosa è andato storto</Text>
          <Text style={styles.errorText}>{error.message}</Text>
          <Pressable
            style={({ pressed }) => [styles.retrySmall, pressed && { opacity: 0.8 }]}
            onPress={refetch}
            accessibilityRole="button"
            accessibilityLabel="Riprova caricamento"
          >
            <Ionicons name="refresh-outline" size={14} color={Colors.error} />
            <Text style={styles.retrySmallText}>Riprova</Text>
          </Pressable>
        </Animated.View>
      );
    }
    if (status === "verified") return <VerifiedCard verifiedAt={verifiedAt} />;
    if (status === "processing") {
      return (
        <ProcessingCard
          onRefresh={handleRefetch}
          onRestart={handleStartVerification}
          isRefreshing={isRefreshing}
          isRestarting={isCtaLoading}
        />
      );
    }
    if (status === "requires_input") {
      return (
        <RequiresInputCard
          lastError={lastError}
          onRetry={handleStartVerification}
          isLoading={isCtaLoading}
        />
      );
    }
    return (
      <WelcomeContent
        wasCanceled={wasCanceled}
        onStart={handleStartVerification}
        isLoading={isCtaLoading}
        onFaq={handleFaqOpen}
      />
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Verifica identità</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderMainContent()}
        {status !== "verified" && !isLoading && (
          <Animated.View
            entering={FadeIn.delay(500).duration(400)}
            style={styles.footer}
          >
            <Ionicons name="lock-closed" size={10} color={Colors.textTertiary} />
            <Text style={styles.footerText}>Powered by Stripe · GDPR compliant</Text>
          </Animated.View>
        )}
      </ScrollView>
      <FaqModal visible={faqVisible} onClose={handleFaqClose} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: -0.2,
  },

  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },

  loadingBlock: {
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  loadingText: { fontSize: 14, color: Colors.textSecondary },

  errorBlock: {
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    ...Shadows.md,
  },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.errorLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.3,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  retrySmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorLight,
    marginTop: Spacing.xs,
  },
  retrySmallText: { fontSize: 14, fontWeight: "700", color: Colors.error },

  // ─── Hero ───────────────────────────────────────────────────────────────────

  heroBlock: {
    alignItems: "center",
    gap: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  heroIconContainer: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  glowRing: {
    position: "absolute",
    borderRadius: 9999,
    backgroundColor: Colors.accentLight,
  },
  glowRingOuter: {
    width: 120,
    height: 120,
    opacity: 0.6,
  },
  glowRingMid: {
    width: 88,
    height: 88,
    backgroundColor: Colors.accentLight,
    opacity: 0.9,
  },
  shieldInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
  heroTextGroup: {
    alignItems: "center",
    gap: 0,
  },
  heroTitleLine1: {
    fontSize: 38,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -1.5,
    lineHeight: 42,
    fontFamily: "NotoSerif_700Bold",
  },
  heroTitleLine2: {
    fontSize: 38,
    fontWeight: "800",
    color: Colors.secondary,
    textAlign: "center",
    letterSpacing: -1.5,
    lineHeight: 44,
    fontFamily: "NotoSerif_700Bold",
  },
  heroSub: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 23,
    paddingHorizontal: Spacing.md,
  },

  // ─── Benefits ────────────────────────────────────────────────────────────────

  benefitsSection: {
    gap: Spacing.sm,
  },
  benefitCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  benefitIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  benefitTextGroup: { flex: 1, gap: 2 },
  benefitLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.1,
  },
  benefitSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },

  // ─── Trust badges ────────────────────────────────────────────────────────────

  trustRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  trustChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  trustChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.secondary,
    letterSpacing: 0.1,
  },

  // ─── CTA ─────────────────────────────────────────────────────────────────────

  ctaSection: { gap: Spacing.sm },
  ctaWrapper: { alignSelf: "stretch" },
  ctaInner: {
    borderRadius: Radius.lg,
    height: 60,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.2,
    includeFontPadding: false,
  },

  // ─── FAQ link ────────────────────────────────────────────────────────────────

  faqLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  faqLinkText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },

  // ─── Verified card ───────────────────────────────────────────────────────────

  verifiedCard: {
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1.5,
    borderColor: Colors.success,
    ...Shadows.md,
  },
  verifiedIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.successLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  verifiedTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -0.5,
    fontFamily: "NotoSerif_700Bold",
  },
  verifiedDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  verifiedDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  verifiedSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.full,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.success,
    letterSpacing: 0.2,
  },

  // ─── Processing card ─────────────────────────────────────────────────────────

  processingCard: {
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.md,
  },
  processingRingContainer: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  processingRing: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: Colors.accent,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
  },
  processingRingCenter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  processingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -0.4,
    fontFamily: "NotoSerif_700Bold",
  },
  processingRotMsg: {
    fontSize: 14,
    color: Colors.secondary,
    textAlign: "center",
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  processingSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  processingRefreshBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    marginTop: Spacing.xs,
    height: 48,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    ...Shadows.sm,
  },
  processingRefreshBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  processingRestartBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    paddingVertical: 11,
    paddingHorizontal: Spacing.xl,
    height: 44,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  processingRestartBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },

  // ─── Requires input card ──────────────────────────────────────────────────────

  requiresCard: {
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.warningLight,
    ...Shadows.md,
  },
  requiresIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.warningLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  requiresTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -0.4,
    fontFamily: "NotoSerif_700Bold",
  },
  requiresSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  requiresTipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignSelf: "stretch",
  },
  requiresTipText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // ─── Footer ───────────────────────────────────────────────────────────────────

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: Spacing.xs,
  },
  footerText: { fontSize: 11, color: Colors.textTertiary },

  // ─── FAQ Sheet ────────────────────────────────────────────────────────────────

  faqOverlay: { flex: 1, justifyContent: "flex-end" },
  faqBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,36,32,0.45)",
  },
  faqSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.xl,
    paddingBottom: 40,
    maxHeight: "82%",
    gap: Spacing.md,
    ...Shadows.lg,
  },
  faqHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  faqTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: -0.4,
    fontFamily: "NotoSerif_700Bold",
    marginBottom: Spacing.xs,
  },
  faqAccordion: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.lg,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  faqAccordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.base,
  },
  faqAccordionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    ...Shadows.sm,
  },
  faqAccordionQ: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
    lineHeight: 18,
  },
  faqAccordionBody: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
    paddingTop: 0,
  },
  faqAccordionA: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  faqCloseBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 52,
    marginTop: Spacing.xs,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  faqCloseBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.1,
  },
});
```

---

### `app/payments/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function PaymentsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
```

---

### `app/payments/index.tsx`

```tsx
import { useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StatusBar,
  StyleSheet,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentMethodRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  onPress: () => void;
}

interface InfoRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  onPress?: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PaymentMethodRow({ icon, title, subtitle, onPress }: PaymentMethodRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => [pressed && { opacity: 0.75 }]}
    >
      {/* Inner View enforces the horizontal layout — Pressable on iOS can
          silently drop flexDirection when the press style is a function. */}
      <View style={styles.methodRow}>
        <View style={styles.methodIconWrap}>
          <Ionicons name={icon} size={22} color={Colors.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.methodTitle}>{title}</Text>
          <Text style={styles.methodSub}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
      </View>
    </Pressable>
  );
}

function InfoRow({ icon, title, onPress }: InfoRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={title}
      style={({ pressed }) => [pressed && onPress && { opacity: 0.75 }]}
    >
      {/* Inner View ensures the horizontal layout survives on iOS even
          when the Pressable style is a function-based style array. */}
      <View style={styles.infoRow}>
        <View style={styles.infoIconWrap}>
          <Ionicons name={icon} size={18} color={Colors.textSecondary} />
        </View>
        <Text style={styles.infoRowText}>{title}</Text>
        {onPress ? (
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PaymentsScreen() {
  const router = useRouter();

  const handleExplainPayment = useCallback(() => {
    Alert.alert(
      "Come funziona il pagamento",
      "La carta viene richiesta in fase di prenotazione tramite Stripe. L'addebito è immediato e i fondi vengono custoditi da CleanHome (escrow): il pagamento al cleaner viene rilasciato solo dopo la tua conferma del servizio o automaticamente dopo 48 ore dal completamento.",
      [{ text: "Ho capito", style: "default" }]
    );
  }, []);

  const handleInfoRow = useCallback(
    (title: string, message: string) => {
      Alert.alert(title, message);
    },
    []
  );

  const handleSupportContact = useCallback(() => {
    router.push("/support");
  }, [router]);

  const handleChat = useCallback(() => {
    router.push("/support/chat");
  }, [router]);

  const handleEmailBilling = useCallback(async () => {
    await Linking.openURL("mailto:billing@cleanhomeapp.com").catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.75 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.breadcrumb}>Supporto · Help Center</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../../assets/icon.png")}
              style={{ width: 26, height: 26, borderRadius: 6 }}
            />
            <Text style={styles.headerBrand}>CleanHome</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Title block ── */}
        <View style={styles.titleBlock}>
          <Text style={styles.pageTitle}>Pagamenti e rimborsi</Text>
          <Text style={styles.pageSubtitle}>
            Gestisci i tuoi metodi di pagamento, visualizza le politiche di rimborso e ottieni assistenza per i tuoi estratti conto.
          </Text>
        </View>

        {/* ── Payment Methods ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metodi di pagamento</Text>
          <View style={styles.card}>
            <PaymentMethodRow
              icon="card-outline"
              title="Carte di credito e debito"
              subtitle="Visa, Mastercard, Amex"
              onPress={() =>
                handleInfoRow(
                  "Carte accettate",
                  "Accettiamo tutte le principali carte di credito e debito: Visa, Mastercard, American Express. Il pagamento è processato in modo sicuro da Stripe."
                )
              }
            />
            <View style={styles.cardDivider} />
            <PaymentMethodRow
              icon="wallet-outline"
              title="Portafogli digitali"
              subtitle={Platform.OS === "ios" ? "Apple Pay, Google Pay" : "Google Pay"}
              onPress={() =>
                handleInfoRow(
                  "Portafogli digitali",
                  Platform.OS === "ios"
                    ? "Puoi pagare con Apple Pay o Google Pay direttamente dal Payment Sheet al momento della prenotazione."
                    : "Puoi pagare con Google Pay direttamente dal Payment Sheet al momento della prenotazione."
                )
              }
            />
            <View style={styles.cardDivider} />
            <View style={styles.updateLink}>
              <Pressable
                onPress={handleExplainPayment}
                accessibilityRole="button"
                accessibilityLabel="Come funziona il pagamento"
                android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="information-circle-outline" size={16} color={Colors.textOnDark} pointerEvents="none" />
              <Text style={styles.updateLinkText} pointerEvents="none">Come funziona il pagamento</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.textOnDark} pointerEvents="none" />
            </View>
          </View>
        </View>

        {/* ── Security card ── */}
        <View style={styles.securityCard}>
          <View style={styles.securityLeft}>
            <View style={styles.shieldWrap}>
              <Ionicons name="shield-checkmark" size={22} color={Colors.textOnDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.securityTitle}>Sicurezza prima di tutto</Text>
              <Text style={styles.securitySub}>PCI DSS Compliant</Text>
            </View>
          </View>
          <View style={styles.securityBadge}>
            <Ionicons name="lock-closed" size={11} color={Colors.accent} />
            <Text style={styles.securityBadgeText}>SICURO</Text>
          </View>
        </View>

        {/* ── Refund Policy ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Politica di rimborso</Text>
          <View style={styles.card}>
            <InfoRow
              icon="checkmark-circle-outline"
              title="Modalità escrow (hold-until-confirm)"
              onPress={() =>
                handleInfoRow(
                  "Come funziona l'escrow",
                  "L'addebito sulla tua carta è immediato, ma i fondi restano custoditi da CleanHome. Vengono trasferiti al cleaner solo dopo che confermi il servizio o automaticamente dopo 48 ore dal completamento del lavoro. Se apri una contestazione, i fondi restano congelati fino alla risoluzione."
                )
              }
            />
            <View style={styles.cardDivider} />
            <InfoRow
              icon="calendar-outline"
              title="Politica di cancellazione"
              onPress={() =>
                handleInfoRow(
                  "Cancellazioni",
                  "Più di 24h prima del servizio: rimborso completo. Tra 24h e 2h prima: rimborso 50% + commissione. Meno di 2h o no-show: nessun rimborso. Noi processiamo il rimborso immediatamente; l'accredito sulla tua carta dipende dalla banca emittente, tipicamente 3-7 giorni lavorativi."
                )
              }
            />
            <View style={styles.cardDivider} />
            <InfoRow
              icon="alert-circle-outline"
              title="Contestazione del servizio"
              onPress={() =>
                handleInfoRow(
                  "Hai 48 ore per contestare",
                  "Quando il cleaner segna il lavoro come completato, hai 48 ore per confermarlo o aprire una contestazione. Devi caricare almeno una foto del problema e descrivere cosa è successo (minimo 20 caratteri). CleanHome esamina entro 5 giorni lavorativi e decide rimborso totale, parziale o conferma del pagamento al cleaner."
                )
              }
            />
          </View>
        </View>

        {/* ── Invoice Issues ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Problemi con le fatture</Text>
          <View style={styles.card}>
            <InfoRow
              icon="alert-circle-outline"
              title="Segnala un addebito duplicato"
              onPress={handleSupportContact}
            />
            <View style={styles.cardDivider} />
            <InfoRow
              icon="document-text-outline"
              title="Richiedi fattura / ricevuta IVA"
              onPress={() => router.push("/payments/invoices")}
            />
          </View>
        </View>

        {/* ── Footer assistance ── */}
        <View style={styles.assistanceCard}>
          <View style={styles.assistanceIconWrap}>
            <Ionicons name="help-buoy-outline" size={20} color={Colors.secondary} />
          </View>
          <Text style={styles.assistanceTitle}>Hai ancora bisogno di aiuto?</Text>
          <Text style={styles.assistanceSub}>
            Il nostro team di assistenza è disponibile 7 giorni su 7.
          </Text>
          {/* CTA block — wrapper with alignSelf:stretch so the primary
              button fills the card width.  The parent card uses
              alignItems:"center", which collapses any direct child that
              relies on alignSelf:"stretch" to 0 width.  Wrapping in a
              View with alignSelf:"stretch" is the canonical RN fix. */}
          <View style={styles.ctaBlock}>
            <Pressable
              onPress={handleChat}
              accessibilityRole="button"
              accessibilityLabel="Apri la chat con noi"
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={({ pressed }) => [
                styles.assistancePrimaryBtn,
                pressed && { opacity: 0.88 },
              ]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.textOnDark} />
              <Text style={styles.assistancePrimaryBtnText}>Chat con noi</Text>
            </Pressable>
            <Pressable
              onPress={handleEmailBilling}
              accessibilityRole="link"
              accessibilityLabel="Scrivi al team via email"
              style={({ pressed }) => [
                styles.assistanceSecondaryLink,
                pressed && { opacity: 0.6 },
              ]}
              hitSlop={8}
            >
              <Ionicons name="mail-outline" size={14} color={Colors.secondary} />
              <Text style={styles.assistanceSecondaryLinkText}>
                Scrivi via email
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: Platform.OS === "ios" ? 32 : 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  breadcrumb: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  headerBrand: {
    fontSize: 20,
    fontWeight: "700",
    fontStyle: "italic",
    color: "#181c1c",
    letterSpacing: -0.3,
  },
  helpCenterBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  helpCenterText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textOnDark,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    gap: Spacing.xl,
  },

  // Title block
  titleBlock: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: -0.6,
    fontFamily: "NotoSerif-Bold",
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans-Regular",
  },

  // Sections
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: -0.2,
    fontFamily: "NotoSerif-Bold",
  },
  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: "hidden",
    ...Shadows.sm,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
    marginLeft: 56,
    opacity: 0.6,
  },

  // Method row
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
  },
  methodIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  methodTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 2,
    fontFamily: "PlusJakartaSans-SemiBold",
  },
  methodSub: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: "PlusJakartaSans-Regular",
  },

  // Update link
  updateLink: {
    marginHorizontal: Spacing.base,
    marginVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: Spacing.base,
  },
  updateLinkText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textOnDark,
  },

  // Security card
  securityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadows.md,
  },
  securityLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  shieldWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  securityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textOnDark,
    marginBottom: 2,
  },
  securitySub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  securityBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.accent,
    letterSpacing: 1,
  },

  // Info row — keeps same outer dimensions as methodRow for visual parity
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  infoRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: Colors.text,
    fontFamily: "PlusJakartaSans-Medium",
  },
  // Assistance card
  assistanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
    ...Shadows.md,
  },
  assistanceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  assistanceTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.primary,
    textAlign: "center",
    fontFamily: "NotoSerif-Bold",
  },
  assistanceSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  // Wrapper that stretches to card width — fixes the alignItems:"center"
  // vs alignSelf:"stretch" collapse bug on the primary button.
  ctaBlock: {
    alignSelf: "stretch",
    gap: Spacing.sm,
  },
  assistancePrimaryBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    ...Shadows.sm,
  },
  assistancePrimaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textOnDark,
    letterSpacing: 0.1,
  },
  assistanceSecondaryLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  assistanceSecondaryLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.secondary,
    textDecorationLine: "underline",
    textDecorationColor: Colors.secondary,
  },
});
```

---

### `app/payments/invoices.tsx`

```tsx
import { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { fetchBookings } from "../../lib/api";
import { Booking } from "../../lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceStatus = "paid" | "pending" | "overdue";

interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: InvoiceStatus;
}

const IT_MONTHS = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

function bookingToInvoice(b: Booking): Invoice {
  const d = new Date(b.date);
  const status: InvoiceStatus =
    b.status === "completed" || b.status === "work_done"
      ? "paid"
      : b.status === "accepted"
      ? "pending"
      : b.status === "declined" ||
        b.status === "cancelled" ||
        b.status === "auto_cancelled"
      ? "overdue"
      : "pending";
  return {
    id: b.id,
    date: `${IT_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    description: b.service_type,
    amount: b.total_price,
    status,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 76;
const SEPARATOR_HEIGHT = 8;

const STATUS_CONFIG: Record<InvoiceStatus, { color: string; bg: string; label: string }> = {
  paid: { color: Colors.success, bg: Colors.successLight, label: "Pagata" },
  pending: { color: Colors.warning, bg: Colors.warningLight, label: "In attesa" },
  overdue: { color: Colors.error, bg: Colors.errorLight, label: "Scaduta" },
};

// ─── Invoice row ──────────────────────────────────────────────────────────────

interface InvoiceRowProps {
  item: Invoice;
  onPress: (id: string) => void;
}

function InvoiceRow({ item, onPress }: InvoiceRowProps) {
  const cfg = STATUS_CONFIG[item.status];

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [styles.invoiceRow, pressed && { opacity: 0.8 }]}
    >
      {/* Left icon */}
      <View style={styles.invoiceIconWrap}>
        <Ionicons name="document-text-outline" size={20} color={Colors.secondary} />
      </View>

      {/* Center text */}
      <View style={{ flex: 1 }}>
        <Text style={styles.invoiceDate}>{item.date}</Text>
        <Text style={styles.invoiceDesc} numberOfLines={1}>{item.description}</Text>
      </View>

      {/* Right: amount + status dot */}
      <View style={styles.invoiceRight}>
        <Text style={styles.invoiceAmount}>€{item.amount.toFixed(2)}</Text>
        <View style={styles.statusDotRow}>
          <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.statusDotLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InvoicesScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const loadInvoices = useCallback(async () => {
    if (!user || !profile) return;
    try {
      const bookings = await fetchBookings(user.id, profile.active_role);
      setInvoices(bookings.map(bookingToInvoice));
    } catch {
      setInvoices([]);
    }
  }, [user, profile]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const totalPaid = useMemo(
    () => invoices.filter((i) => i.status === "paid").reduce((acc, i) => acc + i.amount, 0),
    [invoices]
  );

  const totalPending = useMemo(
    () => invoices.filter((i) => i.status === "pending").reduce((acc, i) => acc + i.amount, 0),
    [invoices]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  }, [loadInvoices]);

  const handleInvoicePress = useCallback((_id: string) => {
    Alert.alert(
      "Prossimamente",
      "Il dettaglio delle fatture sarà disponibile a breve. Puoi consultare lo storico pagamenti dal Dashboard Stripe.",
    );
  }, []);

  const handleExport = useCallback(() => {
    Alert.alert(
      "Prossimamente",
      "L'esportazione PDF delle fatture sarà disponibile a breve.",
    );
  }, []);

  const keyExtractor = useCallback((item: Invoice) => item.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<Invoice> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT + SEPARATOR_HEIGHT,
      offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: Invoice }) => (
      <InvoiceRow item={item} onPress={handleInvoicePress} />
    ),
    [handleInvoicePress]
  );

  const ListHeader = (
    <>
      {/* ── Page title ── */}
      <View style={styles.titleBlock}>
        <Text style={styles.labelOverline}>FATTURAZIONE E FATTURE</Text>
        <Text style={styles.pageTitle}>Le tue fatture</Text>
        <Text style={styles.pageSubtitle}>
          Tieni traccia di tutti i pagamenti e scarica le ricevute in qualsiasi momento.
        </Text>
      </View>

      {/* ── Summary cards ── */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
          <Text style={styles.summaryCardLabel}>Totale pagato</Text>
          <Text style={styles.summaryCardAmount}>
            €{totalPaid.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </Text>
          <View style={styles.summaryCardIcon}>
            <Ionicons name="trending-up" size={18} color={Colors.textOnDarkSecondary} />
          </View>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardSecondary]}>
          <Text style={[styles.summaryCardLabel, { color: Colors.warning }]}>In sospeso</Text>
          <Text style={[styles.summaryCardAmount, { color: Colors.text }]}>
            €{totalPending.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </Text>
          <View style={[styles.summaryCardIcon, { backgroundColor: Colors.warningLight }]}>
            <Ionicons name="time-outline" size={18} color={Colors.warning} />
          </View>
        </View>
      </View>

      {/* ── Membership badge ── */}
      <View style={styles.membershipBadge}>
        <Ionicons name="diamond" size={20} color={Colors.textOnDarkSecondary} />
        <View>
          <Text style={styles.membershipTitle}>Premium Curator</Text>
          <Text style={styles.membershipSub}>Accesso prioritario e fatture illimitate</Text>
        </View>
        <View style={styles.membershipCheck}>
          <Ionicons name="checkmark" size={14} color={Colors.textOnDark} />
        </View>
      </View>

      {/* ── Section header ── */}
      <View style={styles.recentHeader}>
        <Text style={styles.sectionTitle}>Fatturazione recente</Text>
        <Text style={styles.invoiceCount}>{invoices.length} fatture</Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Nav header ── */}
      <View style={styles.navHeader}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.75 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.breadcrumb}>Supporto</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../../assets/icon.png")}
              style={{ width: 26, height: 26, borderRadius: 6 }}
            />
            <Text style={styles.headerBrand}>CleanHome</Text>
          </View>
        </View>
        <Pressable style={styles.downloadBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={18} color={Colors.secondary} />
          <Text style={styles.downloadBtnText}>Esporta</Text>
        </Pressable>
      </View>

      {/* ── List ── */}
      <FlatList
        data={invoices}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: SEPARATOR_HEIGHT }} />}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={12}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.secondary}
            colors={[Colors.secondary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={36} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>Nessuna fattura</Text>
            <Text style={styles.emptySub}>
              Le tue fatture appariranno qui dopo la prima prenotazione.
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: Platform.OS === "ios" ? 40 : 24 }} />}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Nav header
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  breadcrumb: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  headerBrand: {
    fontSize: 20,
    fontWeight: "700",
    fontStyle: "italic",
    color: "#181c1c",
    letterSpacing: -0.3,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  downloadBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.secondary,
  },

  listContent: {
    paddingHorizontal: Spacing.base,
  },

  // Title block
  titleBlock: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.base,
    gap: Spacing.sm,
  },
  labelOverline: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: "PlusJakartaSans-ExtraBold",
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: -0.8,
    fontFamily: "NotoSerif-Bold",
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans-Regular",
  },

  // Summary cards
  summaryRow: {
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  summaryCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.xs,
    ...Shadows.sm,
    position: "relative",
    overflow: "hidden",
  },
  summaryCardPrimary: {
    backgroundColor: Colors.primary,
  },
  summaryCardSecondary: {
    backgroundColor: Colors.surface,
  },
  summaryCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textOnDarkTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryCardAmount: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.textOnDark,
    letterSpacing: -0.5,
    fontFamily: "NotoSerif-Bold",
  },
  summaryCardIcon: {
    position: "absolute",
    top: Spacing.base,
    right: Spacing.base,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Membership badge
  membershipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  membershipTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textOnDark,
    marginBottom: 2,
    fontFamily: "PlusJakartaSans-Bold",
  },
  membershipSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  membershipCheck: {
    marginLeft: "auto",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Recent section header
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.primary,
    fontFamily: "PlusJakartaSans-Bold",
  },
  invoiceCount: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: "500",
  },

  // Invoice row
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    height: ITEM_HEIGHT,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  invoiceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  invoiceDate: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  invoiceDesc: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
  },
  invoiceRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  invoiceAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: -0.3,
    fontFamily: "PlusJakartaSans-ExtraBold",
  },
  statusDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusDotLabel: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Empty
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 32,
  },
});
```

---

### `app/support/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function SupportLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
```

---

### `app/support/index.tsx`

```tsx
import { useState, useCallback } from "react";
import { Linking } from "react-native";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Shadows, Spacing } from "../../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const TOPICS: TopicItem[] = [
  {
    id: "booking",
    icon: "calendar-outline",
    label: "Prenotazioni & Programmazione",
    description: "Gestisci le tue prenotazioni",
  },
  {
    id: "payments",
    icon: "card-outline",
    label: "Pagamenti & Rimborsi",
    description: "Fatture, rimborsi e metodi di pagamento",
  },
  {
    id: "trust",
    icon: "shield-checkmark-outline",
    label: "Fiducia & Sicurezza",
    description: "Verifica identità, segnalazioni",
  },
  {
    id: "account",
    icon: "person-circle-outline",
    label: "Impostazioni Account",
    description: "Profilo, preferenze, notifiche",
  },
];

// ─── Topic Row ────────────────────────────────────────────────────────────────

interface TopicRowProps {
  item: TopicItem;
  onPress: (id: string) => void;
}

function TopicRow({ item, onPress }: TopicRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.label}. ${item.description}`}
      style={({ pressed }) => [styles.topicRow, pressed && styles.topicRowPressed]}
      onPress={() => onPress(item.id)}
    >
      <View style={styles.topicIconWrap}>
        <Ionicons name={item.icon} size={22} color={Colors.secondary} />
      </View>
      <View style={styles.topicContent}>
        <Text style={styles.topicLabel}>{item.label}</Text>
        <Text style={styles.topicDescription}>{item.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SupportScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");

  const handleTopicPress = useCallback(
    (id: string) => {
      router.push(`/support/faq/${id}` as never);
    },
    [router]
  );

  const handleStartAIChat = useCallback(() => {
    router.push("/support/chat");
  }, [router]);

  const handleTalkToConcierge = useCallback(() => {
    router.push("/support/chat");
  }, [router]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* ── Dark green hero header ── */}
        <View style={styles.hero}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.textOnDark} />
          </Pressable>

          <Text style={styles.heroLabel}>Centro supporto</Text>
          <Text style={styles.heroTitle}>Come possiamo{"\n"}aiutarti oggi?</Text>

          {/* Search bar inside hero */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cerca nell'assistenza..."
              placeholderTextColor={Colors.textTertiary}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color={Colors.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.body}>
          {/* ── AI / Concierge card ── */}
          <View style={styles.aiCard}>
            <View style={styles.aiCardHeader}>
              <View style={styles.aiAlwaysBadge}>
                <View style={styles.aiDot} />
                <Text style={styles.aiAlwaysText}>AI SEMPRE DISPONIBILE</Text>
              </View>
            </View>

            <Text style={styles.aiTitle}>Supporto Ibrido Intelligente</Text>
            <Text style={styles.aiDescription}>
              Combiniamo intelligenza artificiale avanzata con il tocco umano dei nostri
              concierge dedicati per offrirti il massimo del supporto, 24 ore su 24.
            </Text>

            <View style={styles.aiButtons}>
              <View style={styles.btnPrimary}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Inizia chat con assistente AI"
                  onPress={handleStartAIChat}
                  android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.textOnDark} pointerEvents="none" />
                <Text style={styles.btnPrimaryText} pointerEvents="none">Inizia Chat AI</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Parla con il concierge"
                style={({ pressed }) => [styles.btnOutline, pressed && styles.btnPressed]}
                onPress={handleTalkToConcierge}
              >
                <Ionicons name="headset-outline" size={16} color={Colors.secondary} />
                <Text style={styles.btnOutlineText}>Parla col Concierge</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Topics section ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SFOGLIA PER ARGOMENTO</Text>
            <Text style={styles.sectionTitle}>Domande frequenti</Text>
            <View style={styles.topicsCard}>
              {TOPICS.map((topic, index) => (
                <View key={topic.id}>
                  <TopicRow item={topic} onPress={handleTopicPress} />
                  {index < TOPICS.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>

          {/* ── Still have questions ── */}
          <View style={styles.stillCard}>
            <Text style={styles.stillTitle}>Hai ancora domande?</Text>
            <Text style={styles.stillSubtitle}>
              L'assistente AI risponde 24/7 e può trasferirti a un operatore umano per casi complessi.
            </Text>
            <View style={styles.stillBtnFull}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Apri chat assistente"
                onPress={handleTalkToConcierge}
                android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="sparkles" size={18} color="#fff" pointerEvents="none" />
              <Text style={styles.stillBtnFullText} pointerEvents="none">Parla con l'assistente</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" pointerEvents="none" />
            </View>
          </View>

          {/* ── Footer links ── */}
          <View style={styles.footer}>
            <Pressable accessibilityRole="link" onPress={() => router.push("/legal/terms")}>
              <Text style={styles.footerLink}>Termini di Servizio</Text>
            </Pressable>
            <View style={styles.footerDot} />
            <Pressable accessibilityRole="link" onPress={() => router.push("/legal/privacy")}>
              <Text style={styles.footerLink}>Privacy</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Hero
  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xxl,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: Colors.textOnDarkSecondary,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.textOnDark,
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: Spacing.xl,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base,
    height: 48,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },

  // Body
  body: {
    padding: Spacing.xl,
    gap: Spacing.xl,
  },

  // AI card
  aiCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.md,
  },
  aiCardHeader: {
    marginBottom: Spacing.md,
  },
  aiAlwaysBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  aiDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  aiAlwaysText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: Colors.secondary,
  },
  aiTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: -0.3,
    marginBottom: Spacing.sm,
  },
  aiDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: Spacing.lg,
  },
  aiButtons: {
    gap: Spacing.sm,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textOnDark,
  },
  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
  },
  btnOutlineText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.secondary,
  },
  btnPressed: {
    opacity: 0.82,
  },

  // Section
  section: {
    gap: Spacing.md,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: Colors.textTertiary,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.2,
  },
  topicsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: "hidden",
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    gap: Spacing.md,
  },
  topicRowPressed: {
    backgroundColor: Colors.backgroundAlt,
  },
  topicIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  topicContent: {
    flex: 1,
    gap: 2,
  },
  topicLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  topicDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 72,
  },

  // Still have questions
  stillCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  stillTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  stillSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: Spacing.lg,
  },
  stillButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  stillBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  stillBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  stillBtnFull: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  stillBtnFullText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
    flexWrap: "wrap",
  },
  footerLink: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: "500",
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.textTertiary,
  },
});
```

---

### `app/support/chat.tsx`

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchSupportHistory,
  sendSupportMessage,
  SupportMessage,
} from "../../lib/api";
import { Colors, Radius, Shadows, Spacing } from "../../lib/theme";

const QUICK_REPLIES = [
  "Quando viene addebitato il pagamento?",
  "Come funziona il rimborso?",
  "Come segnalo un problema con il servizio?",
  "Cosa succede se nessun cleaner accetta?",
];

export default function SupportChatScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList<SupportMessage>>(null);

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Initial history load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { chatId: id, messages: msgs } = await fetchSupportHistory();
        if (cancelled) return;
        setChatId(id);
        if (msgs.length === 0) {
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content:
                "Ciao! Sono l'assistente virtuale di CleanHome. Posso aiutarti con prenotazioni, pagamenti, rimborsi, contestazioni e altro. Come posso aiutarti?",
              created_at: new Date().toISOString(),
            },
          ]);
        } else {
          setMessages(msgs);
        }
      } catch (err: any) {
        Alert.alert("Errore", err?.message ?? "Impossibile caricare la chat");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || sending) return;
      setText("");
      setSending(true);

      // Optimistic user message
      const optimisticUser: SupportMessage = {
        id: `tmp-${Date.now()}`,
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);

      try {
        const { chatId: id, reply } = await sendSupportMessage({
          content: trimmed,
          chatId: chatId ?? undefined,
        });
        if (!chatId) setChatId(id);
        const assistantMsg: SupportMessage = {
          id: `tmp-a-${Date.now()}`,
          role: "assistant",
          content: reply,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "system",
            content:
              "Ho avuto un problema tecnico. Riprova oppure tocca \"Parla con un operatore\".",
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [chatId, sending]
  );

  const renderItem = useCallback(({ item }: { item: SupportMessage }) => {
    if (item.role === "system") {
      return (
        <View style={styles.systemRow}>
          <Ionicons name="information-circle" size={14} color={Colors.textSecondary} />
          <Text style={styles.systemText}>{item.content}</Text>
        </View>
      );
    }
    const isUser = item.role === "user";
    return (
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
        {!isUser && (
          <View style={styles.avatarBot}>
            <Ionicons name="sparkles" size={14} color="#fff" />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
          ]}
        >
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <View style={styles.aiDot} />
              <Text style={styles.headerTitle}>Assistente CleanHome</Text>
            </View>
            <Text style={styles.headerSub}>AI disponibile 24/7</Text>
          </View>
          <View style={{ width: 26 }} />
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {sending && (
          <View style={styles.typingRow}>
            <View style={styles.avatarBot}>
              <Ionicons name="sparkles" size={14} color="#fff" />
            </View>
            <View style={[styles.bubble, styles.bubbleAssistant]}>
              <ActivityIndicator size="small" color={Colors.textSecondary} />
            </View>
          </View>
        )}

        {/* ── Quick replies (only when chat is empty/short) ── */}
        {messages.length <= 1 && !sending && (
          <View style={styles.quickReplies}>
            {QUICK_REPLIES.map((q) => (
              <Pressable
                key={q}
                style={styles.quickReplyChip}
                onPress={() => send(q)}
                disabled={sending}
              >
                <Text style={styles.quickReplyText}>{q}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Input ── */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Scrivi un messaggio..."
            placeholderTextColor={Colors.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={4000}
            editable={!sending}
          />
          <Pressable
            style={[
              styles.sendBtn,
              (!text.trim() || sending) && styles.sendBtnDisabled,
            ]}
            onPress={() => send(text)}
            disabled={!text.trim() || sending}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerCenter: { flex: 1 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  aiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  headerTitle: { fontSize: 16, fontWeight: "600", color: Colors.text },
  headerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  humanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  humanBtnDone: { backgroundColor: Colors.successLight, borderColor: Colors.success },
  humanBtnText: { fontSize: 12, color: Colors.secondary, fontWeight: "600" },

  listContent: { padding: Spacing.lg, gap: Spacing.sm },
  bubbleRow: { flexDirection: "row", marginVertical: 4, gap: 6 },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowAssistant: { justifyContent: "flex-start" },
  avatarBot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.lg,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    ...Shadows.sm,
  },
  bubbleText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 21,
  },
  bubbleTextUser: { color: "#fff" },
  systemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.sm,
    marginVertical: 6,
  },
  systemText: {
    flex: 1,
    fontSize: 13,
    color: Colors.warning,
    lineHeight: 18,
    fontStyle: "italic",
  },
  typingRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingBottom: 8,
    gap: 6,
  },
  quickReplies: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 12,
  },
  quickReplyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickReplyText: { fontSize: 13, color: Colors.text },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: Platform.OS === "ios" ? 24 : Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: Colors.textTertiary, opacity: 0.5 },
});
```

---

### `app/support/faq/[topic].tsx`

```tsx
import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Colors, Radius, Shadows, Spacing } from "../../../lib/theme";

// ─── FAQ data ─────────────────────────────────────────────────────────────────

interface FaqItem {
  q: string;
  a: string;
}

interface TopicData {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  items: FaqItem[];
}

const FAQ_DATA: Record<string, TopicData> = {
  booking: {
    label: "Prenotazioni & Programmazione",
    icon: "calendar-outline",
    items: [
      {
        q: "Come cancello una prenotazione?",
        a: "Vai in \"Le mie prenotazioni\", apri quella che vuoi cancellare e tocca \"Cancella prenotazione\". Puoi cancellare gratuitamente fino a 24 ore prima. Dopo tale termine si applica la policy di rimborso parziale.",
      },
      {
        q: "Posso riprogrammare una prenotazione?",
        a: "Sì, puoi modificare la data e l'orario fino a 12 ore prima dell'appuntamento. Apri la prenotazione e tocca \"Modifica orario\".",
      },
      {
        q: "Il cleaner non si è presentato. Cosa faccio?",
        a: "Se il cleaner non arriva entro 15 minuti dall'orario concordato, apri la prenotazione e tocca \"Segnala problema\". Verrai rimborsato completamente e potrai scegliere un altro professionista.",
      },
      {
        q: "Posso prenotare lo stesso cleaner ogni settimana?",
        a: "Assolutamente sì. Nella schermata di prenotazione scegli \"Prenotazione ricorrente\" e imposta la frequenza che preferisci (settimanale, bisettimanale, mensile).",
      },
      {
        q: "Come funziona la valutazione post-pulizia?",
        a: "Al termine del servizio riceverai una notifica per lasciare una recensione. Hai 7 giorni per farlo. Le recensioni sono pubbliche e aiutano gli altri utenti a scegliere il professionista giusto.",
      },
    ],
  },
  payments: {
    label: "Pagamenti & Rimborsi",
    icon: "card-outline",
    items: [
      {
        q: "Quali metodi di pagamento sono accettati?",
        a: "Accettiamo tutte le principali carte di credito e debito (Visa, Mastercard, American Express), Apple Pay e Google Pay tramite Stripe. I pagamenti sono sicuri e criptati (PCI-DSS Level 1).",
      },
      {
        q: "Quando mi viene addebitato il pagamento?",
        a: "L'addebito avviene immediatamente al momento della prenotazione. I fondi restano custoditi da CleanHome (modalità escrow): il pagamento al cleaner viene rilasciato solo dopo che confermi che il servizio è stato eseguito correttamente, oppure in automatico dopo 48 ore dal completamento del lavoro.",
      },
      {
        q: "Come funziona il rimborso in caso di cancellazione?",
        a: "Se cancelli con più di 24 ore di anticipo: rimborso completo. Tra 24 e 2 ore prima: rimborso del 50% del servizio. Meno di 2 ore o no-show: nessun rimborso. Noi processiamo il rimborso entro pochi minuti, ma l'accredito sulla tua carta dipende dalla banca emittente: tipicamente 3-7 giorni lavorativi, a volte fino a 10. Se dopo 10 giorni non vedi l'accredito, contatta la tua banca.",
      },
      {
        q: "Cosa succede se nessun cleaner accetta?",
        a: "Cerchiamo subito 6 cleaner nella tua zona. Se nessuno accetta entro 10 minuti, allarghiamo automaticamente la ricerca a 15 km. Se entro 20 minuti totali nessuno è disponibile, ricevi il rimborso completo automaticamente, senza dover fare nulla.",
      },
      {
        q: "Come segnalo un problema con il servizio?",
        a: "Quando il cleaner segna il lavoro come completato, hai 48 ore per confermare o aprire una contestazione. Apri la prenotazione e tocca \"Segnala problema\": carica almeno una foto e descrivi cosa è successo (minimo 20 caratteri). I fondi restano congelati e CleanHome esamina il caso entro 5 giorni lavorativi.",
      },
      {
        q: "Dove trovo le mie ricevute?",
        a: "Tutte le ricevute sono disponibili in Profilo → Pagamenti → Ricevute. Puoi scaricarle in PDF per uso fiscale. Il cleaner emette la fattura del servizio direttamente al cliente secondo il proprio regime fiscale.",
      },
      {
        q: "C'è una commissione di servizio?",
        a: "Sì, applichiamo una commissione del 9% al cliente sul prezzo del servizio (visibile in fase di pagamento) per coprire i costi di piattaforma, assicurazione, supporto clienti e processore pagamenti. Una commissione equivalente è trattenuta al cleaner. La commissione totale CleanHome è del 18%.",
      },
    ],
  },
  account: {
    label: "Impostazioni Account",
    icon: "person-circle-outline",
    items: [
      {
        q: "Come cambio la mia email?",
        a: "Vai in Profilo → Modifica profilo → Email. Riceverai una email di conferma al nuovo indirizzo. La modifica sarà effettiva dopo la conferma.",
      },
      {
        q: "Come cambio la password?",
        a: "Vai in Profilo → Sicurezza → Cambia password. Per sicurezza, ti chiediamo di inserire prima la password attuale.",
      },
      {
        q: "Come elimino il mio account?",
        a: "Vai in Profilo → Account → Elimina account. Attenzione: questa azione è irreversibile e cancellerà tutte le tue prenotazioni, messaggi e dati personali nel rispetto del GDPR.",
      },
      {
        q: "Come gestisco le notifiche push?",
        a: "Vai in Profilo → Notifiche per scegliere quali notifiche ricevere. Puoi gestire le notifiche anche dalle impostazioni del tuo dispositivo.",
      },
      {
        q: "Posso avere sia un account cliente che cleaner?",
        a: "Sì! Con un unico account puoi passare da cliente a professionista e viceversa. Tocca l'icona del profilo e scegli \"Cambia ruolo\" dal menu.",
      },
    ],
  },
  trust: {
    label: "Fiducia & Sicurezza",
    icon: "shield-checkmark-outline",
    items: [
      {
        q: "Come vengono verificati i cleaner?",
        a: "Ogni professionista deve caricare un documento d'identità valido e completare la verifica Stripe per ricevere i pagamenti. Controlliamo le recensioni e monitoriamo costantemente la qualità del servizio.",
      },
      {
        q: "Cosa succede se qualcosa viene danneggiato?",
        a: "CleanHome offre una protezione base per danni accidentali. Apri la prenotazione entro 24 ore dalla pulizia e tocca \"Segnala danno\". Il nostro team gestirà la pratica e ti contatterà.",
      },
      {
        q: "Come segnalo un cleaner?",
        a: "Apri la prenotazione o il profilo del cleaner e tocca il menu (⋮) poi \"Segnala\". Descrivi il problema nel dettaglio. Ogni segnalazione viene esaminata entro 48 ore.",
      },
      {
        q: "I miei dati sono al sicuro?",
        a: "Sì. Non condividiamo mai il tuo indirizzo o numero di telefono con i cleaner prima della conferma della prenotazione. Tutti i dati sono criptati e conservati in conformità al GDPR.",
      },
      {
        q: "Come funziona la garanzia soddisfatti o rimborsati?",
        a: "Se non sei soddisfatto del servizio, segnalacelo entro 24 ore dalla pulizia con foto e descrizione. Valuteremo il caso e, se confermato, riceverai un rimborso o una pulizia gratuita.",
      },
    ],
  },
};

// ─── FAQ item ──────────────────────────────────────────────────────────────────

interface FaqRowProps {
  item: FaqItem;
  index: number;
}

function FaqRow({ item, index }: FaqRowProps) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded((p) => !p), []);

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(22)}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.faqRow,
          expanded && styles.faqRowExpanded,
          pressed && { opacity: 0.85 },
        ]}
        accessibilityLabel={item.q}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.faqQuestion}>
          <Text style={styles.faqQuestionText}>{item.q}</Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={Colors.textSecondary}
          />
        </View>
        {expanded && (
          <Text style={styles.faqAnswer}>{item.a}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FaqTopicScreen() {
  const router = useRouter();
  const { topic } = useLocalSearchParams<{ topic: string }>();

  const topicData = topic ? FAQ_DATA[topic] : null;

  if (!topicData) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.notFound}>
          <Ionicons name="search-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.notFoundTitle}>Argomento non trovato</Text>
          <Pressable
            onPress={() => router.back()}
            style={styles.backLinkBtn}
            accessibilityLabel="Torna al supporto"
            accessibilityRole="button"
          >
            <Text style={styles.backLinkText}>Torna al supporto</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {topicData.label}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Hero block ── */}
        <View style={styles.heroBlock}>
          <View style={styles.heroIconWrap}>
            <Ionicons name={topicData.icon} size={28} color={Colors.secondary} />
          </View>
          <Text style={styles.heroLabel}>FAQ</Text>
          <Text style={styles.heroTitle}>{topicData.label}</Text>
          <Text style={styles.heroSub}>
            {topicData.items.length} domande frequenti su questo argomento
          </Text>
        </View>

        {/* ── FAQ list ── */}
        <View style={styles.faqList}>
          {topicData.items.map((item, idx) => (
            <FaqRow key={item.q} item={item} index={idx} />
          ))}
        </View>

        {/* ── Still need help ── */}
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Non hai trovato risposta?</Text>
          <Text style={styles.helpSub}>
            L'assistente AI può aiutarti subito o trasferirti a un operatore umano.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.helpBtn, pressed && { opacity: 0.88 }]}
            onPress={() => router.push("/support/chat")}
            accessibilityLabel="Apri chat assistente"
            accessibilityRole="button"
          >
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={styles.helpBtnText}>Apri chat con CleanHome</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
    flex: 1,
    textAlign: "center",
    marginHorizontal: Spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.xl,
  },
  heroBlock: {
    alignItems: "center",
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.5,
    color: Colors.secondary,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  faqList: {
    gap: Spacing.sm,
  },
  faqRow: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  faqRowExpanded: {
    borderColor: Colors.secondary,
    gap: Spacing.md,
  },
  faqQuestion: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    justifyContent: "space-between",
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    lineHeight: 22,
  },
  faqAnswer: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  helpCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  helpSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 20,
  },
  helpBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    alignSelf: "flex-start",
  },
  helpBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.base,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  backLinkBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
```

---

### `app/legal/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function LegalLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="terms" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="refund" />
    </Stack>
  );
}
```

---

### `app/legal/privacy.tsx`

```tsx
import { useCallback } from "react";
import { View, Text, Pressable, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { Colors } from "../../lib/theme";

const PRIVACY_URL = "https://www.cleanhomeapp.com/privacy";

export default function PrivacyScreen() {
  const router = useRouter();

  const handleOpen = useCallback(async () => {
    await WebBrowser.openBrowserAsync(PRIVACY_URL, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  }, []);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: Colors.surface,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "700",
            color: Colors.text,
          }}
        >
          Informativa Privacy
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Body */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
          gap: 24,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            backgroundColor: Colors.accentLight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="shield-checkmark" size={36} color={Colors.primary} />
        </View>

        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: Colors.text,
            textAlign: "center",
            letterSpacing: -0.4,
          }}
        >
          Informativa Privacy
        </Text>

        <Text
          style={{
            fontSize: 15,
            color: Colors.textSecondary,
            textAlign: "center",
            lineHeight: 23,
          }}
        >
          La nostra informativa sulla privacy è disponibile sul sito ufficiale,
          sempre aggiornata con i dati legali corretti del titolare del
          trattamento.
        </Text>

        <View
          style={{
            width: "100%",
            backgroundColor: "#022420",
            borderRadius: 16,
            shadowColor: "#022420",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 12,
            elevation: 4,
            overflow: "hidden",
          }}
        >
          <Pressable
            onPress={handleOpen}
            android_ripple={{ color: "rgba(255,255,255,0.15)" }}
            style={({ pressed }) => ({
              paddingVertical: 16,
              paddingHorizontal: 32,
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel="Apri Informativa Privacy sul sito ufficiale"
          >
            <Text
              style={{
                color: "#ffffff",
                fontWeight: "700",
                fontSize: 16,
              }}
            >
              Apri Informativa Privacy
            </Text>
          </Pressable>
        </View>

        <Text
          style={{
            fontSize: 12,
            color: Colors.textTertiary,
            textAlign: "center",
          }}
        >
          Versione web sempre aggiornata su cleanhomeapp.com
        </Text>
      </View>
    </SafeAreaView>
  );
}
```

---

### `app/legal/refund.tsx`

```tsx
import { useCallback } from "react";
import { View, Text, Pressable, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { Colors } from "../../lib/theme";

const REFUND_URL = "https://www.cleanhomeapp.com/refund";

export default function RefundScreen() {
  const router = useRouter();

  const handleOpen = useCallback(async () => {
    await WebBrowser.openBrowserAsync(REFUND_URL, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  }, []);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: Colors.surface,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "700",
            color: Colors.text,
          }}
        >
          Politica di Rimborso
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Body */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
          gap: 24,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            backgroundColor: Colors.accentLight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="refresh-circle" size={36} color={Colors.primary} />
        </View>

        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: Colors.text,
            textAlign: "center",
            letterSpacing: -0.4,
          }}
        >
          Politica di Rimborso
        </Text>

        <Text
          style={{
            fontSize: 15,
            color: Colors.textSecondary,
            textAlign: "center",
            lineHeight: 23,
          }}
        >
          Le condizioni di rimborso e cancellazione dei servizi CleanHome sono
          disponibili sul sito ufficiale, sempre aggiornate.
        </Text>

        <View
          style={{
            width: "100%",
            backgroundColor: "#022420",
            borderRadius: 16,
            shadowColor: "#022420",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 12,
            elevation: 4,
            overflow: "hidden",
          }}
        >
          <Pressable
            onPress={handleOpen}
            android_ripple={{ color: "rgba(255,255,255,0.15)" }}
            style={({ pressed }) => ({
              paddingVertical: 16,
              paddingHorizontal: 32,
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel="Apri Politica di Rimborso sul sito ufficiale"
          >
            <Text
              style={{
                color: "#ffffff",
                fontWeight: "700",
                fontSize: 16,
              }}
            >
              Apri Politica di Rimborso
            </Text>
          </Pressable>
        </View>

        <Text
          style={{
            fontSize: 12,
            color: Colors.textTertiary,
            textAlign: "center",
          }}
        >
          Versione web sempre aggiornata su cleanhomeapp.com
        </Text>
      </View>
    </SafeAreaView>
  );
}
```

---

### `app/legal/terms.tsx`

```tsx
import { useCallback } from "react";
import { View, Text, Pressable, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { Colors } from "../../lib/theme";

const TERMS_URL = "https://www.cleanhomeapp.com/terms";

export default function TermsScreen() {
  const router = useRouter();

  const handleOpen = useCallback(async () => {
    await WebBrowser.openBrowserAsync(TERMS_URL, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  }, []);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: Colors.surface,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "700",
            color: Colors.text,
          }}
        >
          Termini di Servizio
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Body */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
          gap: 24,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            backgroundColor: Colors.accentLight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="document-text" size={36} color={Colors.primary} />
        </View>

        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: Colors.text,
            textAlign: "center",
            letterSpacing: -0.4,
          }}
        >
          Termini di Servizio
        </Text>

        <Text
          style={{
            fontSize: 15,
            color: Colors.textSecondary,
            textAlign: "center",
            lineHeight: 23,
          }}
        >
          I termini e le condizioni di utilizzo del servizio CleanHome sono
          disponibili sul sito ufficiale, con i dati aggiornati del titolare.
        </Text>

        <View
          style={{
            width: "100%",
            backgroundColor: "#022420",
            borderRadius: 16,
            shadowColor: "#022420",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 12,
            elevation: 4,
            overflow: "hidden",
          }}
        >
          <Pressable
            onPress={handleOpen}
            android_ripple={{ color: "rgba(255,255,255,0.15)" }}
            style={({ pressed }) => ({
              paddingVertical: 16,
              paddingHorizontal: 32,
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel="Apri Termini di Servizio sul sito ufficiale"
          >
            <Text
              style={{
                color: "#ffffff",
                fontWeight: "700",
                fontSize: 16,
              }}
            >
              Apri Termini di Servizio
            </Text>
          </Pressable>
        </View>

        <Text
          style={{
            fontSize: 12,
            color: Colors.textTertiary,
            textAlign: "center",
          }}
        >
          Versione web sempre aggiornata su cleanhomeapp.com
        </Text>
      </View>
    </SafeAreaView>
  );
}
```
