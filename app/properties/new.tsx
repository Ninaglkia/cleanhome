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
