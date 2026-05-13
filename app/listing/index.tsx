import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  Alert,
  LayoutChangeEvent,
  Modal,
  StatusBar,
  Vibration,
  Linking,
  Switch,
} from "react-native";
// Loaded lazily so the bundle still works in Expo Go (no native rebuild).
let ImagePicker: any = null;
try {
  ImagePicker = require("expo-image-picker");
} catch {}
// Use gesture-handler's ScrollView so it cooperates correctly with the
// child PanGesture used by the drawing overlay (the standard RN
// ScrollView's native UIScrollView gestures bypass the responder system
// and would steal vertical pans during freeform drawing).
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Circle, Polygon, Marker, MapPressEvent, LatLng } from "react-native-maps";
import Svg, { Path as SvgPath } from "react-native-svg";
import * as Location from "expo-location";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { useAuth } from "../../lib/auth";
import {
  fetchListing,
  updateListing,
  uploadListingCover,
  ListingCoverRejectedError,
} from "../../lib/api";

// ─── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  primary: "#022420",
  secondary: "#006b55",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  background: "#f6faf9",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
  primaryContainer: "#1a3a35",
  accent: "#00c896",
} as const;

const MAP_CIRCLE_FILL = "#006b5540";
const MAP_CIRCLE_STROKE = "#006b55";
const DRAW_SAMPLE_EVERY = 1; // capture every touch event for smooth drawing
const DRAW_MAX_POINTS = 150; // max vertices after simplification

// ─── Coverage plan types ────────────────────────────────────────────────────────

interface CoveragePlan {
  name: string;
  minKm: number;
  maxKm: number;
  priceLabel: string;
  priceMonthly: number | null;
}

const COVERAGE_PLANS: readonly CoveragePlan[] = [
  { name: "Base", minKm: 0, maxKm: 5, priceLabel: "Gratis", priceMonthly: null },
  { name: "Standard", minKm: 6, maxKm: 15, priceLabel: "4,99 €/mese", priceMonthly: 4.99 },
  { name: "Premium", minKm: 16, maxKm: 30, priceLabel: "9,99 €/mese", priceMonthly: 9.99 },
  { name: "Pro", minKm: 31, maxKm: 50, priceLabel: "14,99 €/mese", priceMonthly: 14.99 },
] as const;

const SLIDER_MIN_KM = 1;
const SLIDER_MAX_KM = 50;

function getPlanForRadius(km: number): CoveragePlan {
  return (
    COVERAGE_PLANS.find((p) => km >= p.minKm && km <= p.maxKm) ??
    COVERAGE_PLANS[COVERAGE_PLANS.length - 1]
  );
}

function kmToMeters(km: number): number {
  return km * 1000;
}

// Chaikin corner-cutting smoothing for a closed polygon.
// Each iteration replaces every edge with two new points at 1/4 and 3/4,
// rounding sharp angles into smooth curves.
function chaikinSmoothLatLng(points: LatLng[], iterations: number): LatLng[] {
  if (points.length < 3) return points;
  let pts = points;
  for (let iter = 0; iter < iterations; iter++) {
    const next: LatLng[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      next.push({
        latitude: 0.75 * p0.latitude + 0.25 * p1.latitude,
        longitude: 0.75 * p0.longitude + 0.25 * p1.longitude,
      });
      next.push({
        latitude: 0.25 * p0.latitude + 0.75 * p1.latitude,
        longitude: 0.25 * p0.longitude + 0.75 * p1.longitude,
      });
    }
    pts = next;
  }
  return pts;
}

// Build an SVG path string from screen-space points (live drawing preview).
function buildSvgPathFromPoints(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`;
  }
  return d;
}

// Distance squared between two screen points (used by simplification).
function distSq(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// Precise geometry helpers for a drawn polygon.
// For small regions (covered by a single city / province) we approximate
// the sphere as a local equirectangular projection anchored at the polygon
// centroid — error is < 0.2% up to ~100 km, which is way below what the
// user can perceive on the map.
function projectToLocalKm(
  lat: number,
  lng: number,
  anchorLat: number
): { x: number; y: number } {
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((anchorLat * Math.PI) / 180);
  return { x: lng * kmPerDegLng, y: lat * kmPerDegLat };
}

function polygonCentroid(points: LatLng[]): { latitude: number; longitude: number } {
  const n = points.length;
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.latitude;
    lng += p.longitude;
  }
  return { latitude: lat / n, longitude: lng / n };
}

// Area in km² via Shoelace on a local planar projection.
function calcPolygonAreaKm2(points: LatLng[]): number {
  if (points.length < 3) return 0;
  const c = polygonCentroid(points);
  const projected = points.map((p) => projectToLocalKm(p.latitude, p.longitude, c.latitude));
  let sum = 0;
  for (let i = 0; i < projected.length; i++) {
    const a = projected[i];
    const b = projected[(i + 1) % projected.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

// Equivalent-area radius in km. Gives a single number the user can compare
// against the subscription plans (which are keyed on a "coverage radius").
function calcPolygonRadiusKm(points: LatLng[]): number {
  const area = calcPolygonAreaKm2(points);
  if (area <= 0) return 0;
  return Math.sqrt(area / Math.PI);
}

// Max distance from centroid — useful as the polygon's "reach" so the user
// understands the farthest point they commit to cover.
function calcPolygonMaxReachKm(points: LatLng[]): number {
  if (points.length < 3) return 0;
  const c = polygonCentroid(points);
  let max = 0;
  for (const p of points) {
    const dLat = (p.latitude - c.latitude) * 111.32;
    const dLng =
      (p.longitude - c.longitude) * 111.32 * Math.cos((c.latitude * Math.PI) / 180);
    const d = Math.sqrt(dLat * dLat + dLng * dLng);
    if (d > max) max = d;
  }
  return max;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type ListingStatus = "active" | "review" | "draft" | "paused";

// Snapshot of the editable fields used for dirty-tracking.
// Captured once from the DB at mount time; isDirty compares current form
// state against this baseline.
interface ListingSnapshot {
  hourlyRate: string;
  description: string;
  selectedServices: string[];
  availableDays: string[];
  coverUrl: string | null;
  draftCity: string;
  draftRadiusKm: number;
  centerLat: number;
  centerLng: number;
  zoneMode: "circle" | "draw";
  drawnPolygon: Array<{ latitude: number; longitude: number }>;
  isZoneConfirmed: boolean;
}

interface ServiceTag {
  id: string;
  label: string;
  selected: boolean;
}

interface DayAvailability {
  day: string;
  short: string;
  available: boolean;
}

interface CoverageZone {
  id: string;
  city: string;
  radiusKm: number;
  plan: CoveragePlan;
  lat: number;
  lng: number;
  // Optional polygon vertices when the zone was defined via the freeform
  // "Disegna zona" mode. When present, this is the canonical shape and
  // radiusKm is just an approximation for plan/pricing.
  polygon?: LatLng[];
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

// IDs map 1:1 to the canonical labels stored in `cleaner_listings.services`.
// Keep these strings in sync with lib/types.ts → ALL_SERVICES.
const INITIAL_SERVICES: ServiceTag[] = [
  { id: "Pulizia ordinaria", label: "Pulizia ordinaria", selected: true },
  { id: "Pulizia profonda", label: "Pulizia profonda", selected: true },
  { id: "Stiratura", label: "Stiratura", selected: false },
  { id: "Pulizia vetri", label: "Pulizia vetri", selected: true },
  { id: "Pulizia post-ristrutturazione", label: "Pulizia post-ristrutturazione", selected: false },
  { id: "Pulizia uffici", label: "Pulizia uffici", selected: false },
  { id: "Pulizia condominiale", label: "Pulizia condominiale", selected: false },
];

const INITIAL_DAYS: DayAvailability[] = [
  { day: "Lunedì", short: "Lun", available: true },
  { day: "Martedì", short: "Mar", available: true },
  { day: "Mercoledì", short: "Mer", available: false },
  { day: "Giovedì", short: "Gio", available: true },
  { day: "Venerdì", short: "Ven", available: true },
  { day: "Sabato", short: "Sab", available: false },
  { day: "Domenica", short: "Dom", available: false },
];

const STATUS_CONFIG: Record<
  ListingStatus,
  { label: string; color: string; bg: string }
> = {
  active: { label: "Attivo", color: "#006b55", bg: "#e6f4f1" },
  review: { label: "In revisione", color: "#b45309", bg: "#fef3c7" },
  draft: { label: "Bozza", color: "#717976", bg: "#f0f4f3" },
  paused: { label: "In pausa", color: "#8a4502", bg: "#fef0d9" },
};

const ROME_COORDS = { latitude: 41.9028, longitude: 12.4964 };

// ─── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

interface StatusBadgeProps {
  status: ListingStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
      <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

interface ServiceChipProps {
  tag: ServiceTag;
  onToggle: (id: string) => void;
}

function ServiceChip({ tag, onToggle }: ServiceChipProps) {
  const handlePress = useCallback(() => onToggle(tag.id), [tag.id, onToggle]);
  return (
    <Pressable
      onPress={handlePress}
      style={[styles.chip, tag.selected && styles.chipSelected]}
    >
      {tag.selected && (
        <Ionicons
          name="checkmark"
          size={12}
          color={C.surface}
          style={{ marginRight: 4 }}
        />
      )}
      <Text style={[styles.chipText, tag.selected && styles.chipTextSelected]}>
        {tag.label}
      </Text>
    </Pressable>
  );
}

interface DayPillProps {
  day: DayAvailability;
  onToggle: (day: string) => void;
}

function DayPill({ day, onToggle }: DayPillProps) {
  const handlePress = useCallback(() => onToggle(day.day), [day.day, onToggle]);
  return (
    <Pressable
      onPress={handlePress}
      style={[styles.dayPill, day.available && styles.dayPillActive]}
    >
      <Text
        style={[styles.dayPillText, day.available && styles.dayPillTextActive]}
      >
        {day.short}
      </Text>
    </Pressable>
  );
}

// ─── PlanBadge ──────────────────────────────────────────────────────────────────

interface PlanBadgeProps {
  plan: CoveragePlan;
}

function PlanBadge({ plan }: PlanBadgeProps) {
  const isFree = plan.priceMonthly === null;
  return (
    <View style={styles.planBadgeRow}>
      <View
        style={[
          styles.planBadge,
          { backgroundColor: isFree ? "#e6f4f1" : C.primaryContainer },
        ]}
      >
        <Text
          style={[
            styles.planBadgeName,
            { color: isFree ? C.secondary : C.accent },
          ]}
        >
          {plan.name}
        </Text>
      </View>
      <View style={styles.planPriceBlock}>
        <Text style={styles.planPriceLabel}>{plan.priceLabel}</Text>
        {!isFree && (
          <Text style={styles.planPriceSub}>per questa zona</Text>
        )}
      </View>
    </View>
  );
}

// ─── CoverageZoneRow ─────────────────────────────────────────────────────────────

interface CoverageZoneRowProps {
  zone: CoverageZone;
  onDelete: (id: string) => void;
}

function CoverageZoneRow({ zone, onDelete }: CoverageZoneRowProps) {
  const handleDelete = useCallback(() => onDelete(zone.id), [zone.id, onDelete]);
  const isDrawn = !!zone.polygon && zone.polygon.length >= 3;
  return (
    <View style={styles.coverageZoneRow}>
      <View style={styles.coverageZoneLeft}>
        <Ionicons
          name={isDrawn ? "create" : "location"}
          size={15}
          color={C.secondary}
        />
        <View>
          <Text style={styles.coverageZoneCity}>{zone.city}</Text>
          <Text style={styles.coverageZoneMeta}>
            {isDrawn ? "Zona disegnata" : `${zone.radiusKm} km`} · {zone.plan.name} · {zone.plan.priceLabel}
          </Text>
        </View>
      </View>
      <Pressable onPress={handleDelete} hitSlop={10} style={styles.coverageZoneDelete}>
        <Ionicons name="trash-outline" size={16} color="#ef4444" />
      </Pressable>
    </View>
  );
}

// ─── RadiusSlider ─────────────────────────────────────────────────────────────────
// Custom slider built with PanGestureHandler + Reanimated (no @react-native-community/slider needed)

interface RadiusSliderProps {
  radiusKm: number;
  onRadiusChange: (km: number) => void;
}

function RadiusSlider({ radiusKm, onRadiusChange }: RadiusSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const thumbX = useSharedValue(0);

  // Sync thumb position when radiusKm changes from outside
  const fraction = trackWidth > 0
    ? (radiusKm - SLIDER_MIN_KM) / (SLIDER_MAX_KM - SLIDER_MIN_KM)
    : 0;
  const thumbPosition = fraction * trackWidth;

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setTrackWidth(w);
      thumbX.value = ((radiusKm - SLIDER_MIN_KM) / (SLIDER_MAX_KM - SLIDER_MIN_KM)) * w;
    },
    [radiusKm, thumbX]
  );

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const updateRadius = useCallback(
    (x: number) => {
      if (trackWidth === 0) return;
      const clamped = clamp(x, 0, trackWidth);
      const km = Math.round(
        SLIDER_MIN_KM + (clamped / trackWidth) * (SLIDER_MAX_KM - SLIDER_MIN_KM)
      );
      onRadiusChange(clamp(km, SLIDER_MIN_KM, SLIDER_MAX_KM));
    },
    [trackWidth, onRadiusChange]
  );

  // Tap-or-drag anywhere on the track jumps the thumb to the touch point.
  // `e.x` is the X coordinate inside the track view (0 at left edge), so
  // a single tap immediately sets the value without requiring a drag from
  // the thumb. minDistance(0) makes the Pan gesture activate on touch-down.
  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      const newX = Math.min(Math.max(e.x, 0), trackWidth);
      thumbX.value = newX;
      runOnJS(updateRadius)(newX);
    })
    .onUpdate((e) => {
      const newX = Math.min(Math.max(e.x, 0), trackWidth);
      thumbX.value = newX;
      runOnJS(updateRadius)(newX);
    });

  const thumbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  const fillWidth = trackWidth > 0 ? thumbPosition : 0;

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderLabelRow}>
        <Text style={styles.sliderLabelLeft}>{SLIDER_MIN_KM} km</Text>
        <Text style={styles.sliderKmValue}>{radiusKm} km</Text>
        <Text style={styles.sliderLabelRight}>{SLIDER_MAX_KM} km</Text>
      </View>
      <GestureDetector gesture={panGesture}>
        <View style={styles.sliderTrackWrapper} onLayout={handleLayout}>
          {/* Track background */}
          <View style={styles.sliderTrack} />
          {/* Filled portion */}
          <View style={[styles.sliderFill, { width: fillWidth }]} />
          {/* Thumb — visual only, gesture is on the whole track wrapper */}
          <Animated.View
            style={[styles.sliderThumbWrapper, thumbAnimStyle]}
            pointerEvents="none"
          >
            <View style={styles.sliderThumb} />
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

// ─── PriceSlider ─────────────────────────────────────────────────────────────
// Hourly rate slider €20 → €35 (1 € step). Mirrors RadiusSlider visually.

const PRICE_MIN = 20;
const PRICE_MAX = 35;

interface PriceSliderProps {
  /** Current value in euros (number). */
  priceEur: number;
  onPriceChange: (eur: number) => void;
}

function PriceSlider({ priceEur, onPriceChange }: PriceSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const thumbX = useSharedValue(0);

  const fraction = trackWidth > 0
    ? (priceEur - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)
    : 0;
  const thumbPosition = fraction * trackWidth;

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setTrackWidth(w);
      thumbX.value = ((priceEur - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * w;
    },
    [priceEur, thumbX]
  );

  const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), max);

  const updatePrice = useCallback(
    (x: number) => {
      if (trackWidth === 0) return;
      const clamped = clamp(x, 0, trackWidth);
      const eur = Math.round(
        PRICE_MIN + (clamped / trackWidth) * (PRICE_MAX - PRICE_MIN)
      );
      onPriceChange(clamp(eur, PRICE_MIN, PRICE_MAX));
    },
    [trackWidth, onPriceChange]
  );

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      const newX = Math.min(Math.max(e.x, 0), trackWidth);
      thumbX.value = newX;
      runOnJS(updatePrice)(newX);
    })
    .onUpdate((e) => {
      const newX = Math.min(Math.max(e.x, 0), trackWidth);
      thumbX.value = newX;
      runOnJS(updatePrice)(newX);
    });

  const thumbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  const fillWidth = trackWidth > 0 ? thumbPosition : 0;

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderLabelRow}>
        <Text style={styles.sliderLabelLeft}>€{PRICE_MIN}</Text>
        <Text style={styles.sliderKmValue}>€{priceEur}/ora</Text>
        <Text style={styles.sliderLabelRight}>€{PRICE_MAX}</Text>
      </View>
      <GestureDetector gesture={panGesture}>
        <View style={styles.sliderTrackWrapper} onLayout={handleLayout}>
          <View style={styles.sliderTrack} />
          <View style={[styles.sliderFill, { width: fillWidth }]} />
          <Animated.View
            style={[styles.sliderThumbWrapper, thumbAnimStyle]}
            pointerEvents="none"
          >
            <View style={styles.sliderThumb} />
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

// ─── Completion banner ────────────────────────────────────────────────────────

interface CompletionItem {
  key: string;
  done: boolean;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}

function CompletionBanner({ items }: { items: CompletionItem[] }) {
  const missing = items.filter((i) => !i.done);
  const progress = items.length - missing.length;

  if (missing.length === 0) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#ECFDF5",
          borderRadius: 16,
          padding: 14,
          marginBottom: 12,
          gap: 12,
          borderWidth: 1,
          borderColor: "#10B981",
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: "#D1FAE5",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="checkmark-circle" size={22} color="#059669" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#065F46" }}>
            Annuncio completo
          </Text>
          <Text style={{ fontSize: 12, color: "#047857", lineHeight: 16 }}>
            Pubblicato e visibile ai clienti nella tua zona.
          </Text>
        </View>
      </View>
    );
  }

  // The listing itself is published & visible as soon as the cleaner's
  // subscription is active — completeness is an OPTIONAL quality nudge,
  // not a publication gate. The previous "Completa X campi per
  // pubblicare" copy was misleading because the listing was already
  // online. Re-tone to amber/info ("Migliora") instead of red/error.
  return (
    <View
      style={{
        backgroundColor: "#FFFBEB",
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#FCD34D",
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: "#FEF3C7",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="sparkles-outline" size={22} color="#B45309" />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 15, fontWeight: "700", color: "#92400E", marginBottom: 2 }}
          >
            Migliora l'annuncio ({progress}/{items.length})
          </Text>
          <Text style={{ fontSize: 12, color: "#B45309", lineHeight: 16 }}>
            L'annuncio è già online. Aggiungi questi dettagli per attirare più clienti:
          </Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        {missing.map((item) => (
          <View
            key={item.key}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              padding: 12,
              gap: 10,
              borderWidth: 1,
              borderColor: "#FDE68A",
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: "#FEF3C7",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={item.icon} size={18} color="#B45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#78350F",
                  marginBottom: 2,
                }}
              >
                {item.label}
              </Text>
              <Text style={{ fontSize: 12, color: "#92400E", lineHeight: 16 }}>
                {item.hint}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function ListingScreen() {
  const router = useRouter();

  // Existing state
  const [hourlyRate, setHourlyRate] = useState("25");
  // Start with an empty description — the old hard-coded placeholder
  // ("Professionista con 5 anni di esperienza...") was silently
  // published by cleaners who didn't bother to edit it, which made
  // every cleaner profile look identical. Now the input is empty and
  // the placeholder text (in the TextInput below) guides the user.
  const [description, setDescription] = useState("");
  const [services, setServices] = useState<ServiceTag[]>(INITIAL_SERVICES);
  const [days, setDays] = useState<DayAvailability[]>(INITIAL_DAYS);

  // Coverage zone state
  const [coverageZones, setCoverageZones] = useState<CoverageZone[]>([]);
  const [draftCity, setDraftCity] = useState("");
  const [draftRadiusKm, setDraftRadiusKm] = useState(10);
  const [centerCoords, setCenterCoords] = useState(ROME_COORDS);
  // Ref holding the map's initial region. Set once after hydrate (from saved
  // coverage coords) so cleaners outside Rome don't see the wrong city.
  // Falls back to ROME_COORDS only if no saved zone exists.
  const initialMapRegionRef = useRef<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  // Persistence state for the "Salva" button.
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();

  // Listing ID from the route query (?id=...). Required: without an id
  // we redirect the user back to the listings hub so they can pick or
  // create one. Stored as plain string for the API calls below.
  const params = useLocalSearchParams<{ id?: string }>();
  const listingId = params.id;

  // Cover photo state — synced with cleaner_profiles.avatar_url.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  // True while the Image bitmap is being downloaded/decoded. Used to show a
  // skeleton placeholder with identical dimensions so there is no layout shift.
  const [isCoverLoading, setIsCoverLoading] = useState(false);
  // True from mount until the listing row has been fetched from the DB.
  // Without this we briefly render the "Aggiungi un tuo selfie" empty state
  // for the cleaner who already uploaded a cover — because `coverUrl` is
  // still null during the network fetch.
  const [isFetchingListing, setIsFetchingListing] = useState(true);

  // ── Dirty tracking ────────────────────────────────────────────────────────
  // Snapshot of all editable fields captured once the listing is fetched from
  // the DB. isDirty compares current state against this snapshot; the save CTA
  // is disabled (muted) when there are no changes.
  const [initialSnapshot, setInitialSnapshot] = useState<ListingSnapshot | null>(null);

  // Listing active/inactive — synced with cleaner_profiles.is_available.
  const [isActive, setIsActive] = useState(true);

  // MapView refs
  const mapRef = useRef<MapView>(null);
  const mapRefFullscreen = useRef<MapView>(null);

  // Draw mode
  const [drawnPolygon, setDrawnPolygon] = useState<LatLng[]>([]);
  const [zoneMode, setZoneMode] = useState<"circle" | "draw">("circle");

  // Freeform drawing state
  const [isDrawingActive, setIsDrawingActive] = useState(false);
  const [hasDrawnOnce, setHasDrawnOnce] = useState(false);
  // Guard to prevent handleOverlayTouchEnd from running twice when both
  // .onEnd and .onFinalize fire for the same gesture (BUG 5 fix).
  const touchEndCalledRef = useRef(false);
  // Live screen-space points captured SYNCHRONOUSLY during drag.
  // No async involved → no out-of-order, no lag, instant preview.
  const screenPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  // Live SVG path string for in-progress drawing (rendered as <Path/>).
  const [liveSvgPath, setLiveSvgPath] = useState<string>("");

  // ── Circle drag state ─────────────────────────────────────────────
  // Cached screen-space coordinates of the circle (refreshed whenever
  // centerCoords / draftRadiusKm / map region change). Used for fast
  // synchronous hit-testing inside the touch responder.
  const circleCenterPxRef = useRef<{ x: number; y: number } | null>(null);
  const circleRadiusPxRef = useRef<number | null>(null);
  // Pixel offset between the touch point and the circle center at drag-start.
  // Preserved so the circle does not "snap" under the finger.
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  const [isDraggingCircle, setIsDraggingCircle] = useState(false);
  // Mirror of isDraggingCircle as a ref — updated SYNCHRONOUSLY in
  // the gesture grant so that any same-tick check sees the correct value.
  const isDraggingCircleRef = useRef(false);
  // True after the user confirms the current zone (circle or polygon).
  // While true the on-map "Conferma" / "Ridisegna" controls are hidden
  // and the zone stays visible. Reset on redraw / mode change / edit.
  const [isZoneConfirmed, setIsZoneConfirmed] = useState(false);

  // ── isDirty: true when the current form state differs from the snapshot ──
  // JSON.stringify is sufficient here — data is small (<2 KB) and all values
  // are primitives or shallow arrays of primitives.
  const isDirty = useMemo<boolean>(() => {
    if (initialSnapshot === null) {
      // Fetch failed or still loading → treat as NOT dirty so the CTA
      // stays disabled until the baseline is established.
      return false;
    }
    const currentSnapshot: ListingSnapshot = {
      hourlyRate,
      description,
      selectedServices: services.filter((s) => s.selected).map((s) => s.id),
      availableDays: days.filter((d) => d.available).map((d) => d.day),
      coverUrl,
      draftCity,
      draftRadiusKm,
      centerLat: centerCoords.latitude,
      centerLng: centerCoords.longitude,
      zoneMode,
      drawnPolygon: drawnPolygon.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      })),
      isZoneConfirmed,
    };
    return JSON.stringify(currentSnapshot) !== JSON.stringify(initialSnapshot);
  }, [
    initialSnapshot,
    hourlyRate,
    description,
    services,
    days,
    coverUrl,
    draftCity,
    draftRadiusKm,
    centerCoords,
    zoneMode,
    drawnPolygon,
    isZoneConfirmed,
  ]);

  // ── Address search (Google Places API New) ──
  // Uses the modern `places:autocomplete` + `places/{id}` endpoints so we
  // get accurate, disambiguated results for Italian cities and addresses.
  // Autocomplete returns placeId + formatted text only; we fetch coords
  // lazily on select via Place Details ("location" field-mask only, so
  // it's billed as cheap Location-Only).
  type SearchResult = {
    placeId: string;
    title: string; // primary line (e.g. "Milano")
    subtitle: string; // secondary line (e.g. "Lombardia, Italia")
    name: string; // short label stored in draftCity
    latitude: number; // 0 until Place Details resolves it
    longitude: number;
    iconName: keyof typeof Ionicons.glyphMap;
  };

  // Map a Google Places type array to an Ionicons name. Google returns
  // an array like ["restaurant","food","point_of_interest",…] — we pick
  // the most specific icon we know how to render.
  const pickIconForGoogleTypes = (
    types: string[] | undefined
  ): keyof typeof Ionicons.glyphMap => {
    const t = new Set(types || []);
    if (t.has("airport")) return "airplane";
    if (t.has("train_station") || t.has("subway_station") || t.has("transit_station"))
      return "train";
    if (t.has("bus_station")) return "bus";
    if (t.has("restaurant") || t.has("cafe") || t.has("meal_takeaway"))
      return "restaurant";
    if (t.has("bar") || t.has("night_club")) return "wine";
    if (t.has("lodging")) return "bed";
    if (t.has("museum") || t.has("art_gallery")) return "color-palette";
    if (t.has("tourist_attraction")) return "camera";
    if (t.has("hospital") || t.has("pharmacy") || t.has("doctor"))
      return "medkit";
    if (t.has("school") || t.has("university")) return "school";
    if (t.has("bank") || t.has("atm")) return "cash";
    if (t.has("gas_station")) return "car";
    if (t.has("supermarket") || t.has("store") || t.has("shopping_mall"))
      return "storefront";
    if (t.has("park")) return "leaf";
    if (t.has("church") || t.has("place_of_worship")) return "business";
    if (t.has("stadium") || t.has("gym")) return "football";
    // Administrative / locality types
    if (t.has("locality") || t.has("administrative_area_level_3"))
      return "business";
    if (
      t.has("sublocality") ||
      t.has("sublocality_level_1") ||
      t.has("neighborhood")
    )
      return "map";
    if (t.has("route") || t.has("street_address") || t.has("premise"))
      return "navigate";
    return "location";
  };

  const GOOGLE_PLACES_KEY =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || "";

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A per-typing "session token" significantly reduces Google Places cost
  // by grouping autocomplete + details calls as a single session.
  const searchSessionTokenRef = useRef<string>("");
  const newSessionToken = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    if (!GOOGLE_PLACES_KEY) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    if (!searchSessionTokenRef.current) {
      searchSessionTokenRef.current = newSessionToken();
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        // Google Places API (New) — Autocomplete.
        // Restrict to Italy via includedRegionCodes.
        const res = await fetch(
          "https://places.googleapis.com/v1/places:autocomplete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
            },
            body: JSON.stringify({
              input: trimmed,
              languageCode: "it",
              regionCode: "it",
              includedRegionCodes: ["it"],
              sessionToken: searchSessionTokenRef.current,
            }),
          }
        );

        const data = (await res.json()) as {
          suggestions?: Array<{
            placePrediction?: {
              placeId: string;
              text?: { text: string };
              structuredFormat?: {
                mainText?: { text: string };
                secondaryText?: { text: string };
              };
              types?: string[];
            };
          }>;
          error?: { message: string };
        };

        if (data.error) {
          console.warn("[places:autocomplete]", data.error.message);
          setSearchResults([]);
          return;
        }

        const mapped: SearchResult[] = (data.suggestions || [])
          .map((s) => s.placePrediction)
          .filter((p): p is NonNullable<typeof p> => !!p)
          .map((p) => {
            const main = p.structuredFormat?.mainText?.text || p.text?.text || "";
            const secondary = p.structuredFormat?.secondaryText?.text || "";
            return {
              placeId: p.placeId,
              title: main,
              subtitle: secondary,
              name: main,
              latitude: 0, // resolved lazily via Place Details on select
              longitude: 0,
              iconName: pickIconForGoogleTypes(p.types),
            };
          });

        setSearchResults(mapped.slice(0, 6));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectSearchResult = useCallback(
    async (result: SearchResult) => {
      setSearchQuery("");
      setSearchResults([]);

      if (!GOOGLE_PLACES_KEY) return;

      // Google Places (New) — Place Details with a Location-Only FieldMask.
      // This is the cheapest billing tier for Place Details because we ask
      // only for the `location` field.
      let lat = 0;
      let lng = 0;
      try {
        const detailsRes = await fetch(
          `https://places.googleapis.com/v1/places/${encodeURIComponent(
            result.placeId
          )}?sessionToken=${encodeURIComponent(
            searchSessionTokenRef.current || ""
          )}`,
          {
            method: "GET",
            headers: {
              "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
              "X-Goog-FieldMask": "location",
            },
          }
        );
        const details = (await detailsRes.json()) as {
          location?: { latitude: number; longitude: number };
          error?: { message: string };
        };
        if (details.error || !details.location) {
          console.warn("[places:details]", details.error?.message);
          return;
        }
        lat = details.location.latitude;
        lng = details.location.longitude;
      } catch {
        return;
      } finally {
        // Rotate the session token — one autocomplete-then-details cycle
        // counts as a single billable session in Google Places pricing.
        searchSessionTokenRef.current = "";
      }

      const coord = { latitude: lat, longitude: lng };

      // When in circle mode, drop a fresh 1 km circle on the searched
      // location so the user can then reposition / resize it. We also zoom
      // in tighter so the small circle is clearly visible. In draw mode we
      // just pan the map without touching the polygon the user drew.
      const isCircle = zoneMode === "circle";
      if (isCircle) {
        setCenterCoords(coord);
        setDraftRadiusKm(1);
        setIsZoneConfirmed(false);
      }

      const delta = isCircle ? 0.02 : 0.05;
      const region = {
        ...coord,
        latitudeDelta: delta,
        longitudeDelta: delta,
      };
      // Animate whichever map is currently mounted (fullscreen takes
      // precedence — its modal is on top when visible).
      mapRefFullscreen.current?.animateToRegion(region, 600);
      mapRef.current?.animateToRegion(region, 600);

      // Also update the city field with a clean short label.
      const shortLabel = result.title.split(",")[0]?.trim() || result.title;
      setDraftCity(shortLabel);
    },
    [zoneMode, GOOGLE_PLACES_KEY]
  );

  // Rightmost vertex (max longitude) of the confirmed polygon — used as
  // the coordinate of the green clear-zone Marker. The Marker is rendered
  // INSIDE the MapView so it follows pan/zoom natively.
  const polygonClearMarkerCoord = useMemo<LatLng | null>(() => {
    if (!isZoneConfirmed || zoneMode !== "draw" || drawnPolygon.length < 3) {
      return null;
    }
    return drawnPolygon.reduce((acc, p) =>
      p.longitude > acc.longitude ? p : acc
    );
  }, [isZoneConfirmed, zoneMode, drawnPolygon]);
  // ── Drag overlay (visual ghost circle following the finger) ──
  // While dragging, the native <Circle> is hidden and an Animated.View
  // (a regular round View driven by reanimated shared values) follows
  // the finger in real time. No async bridge call per move = zero lag.
  const dragOverlayActive = useSharedValue(0); // 0 hidden, 1 visible
  const dragOverlayCx = useSharedValue(0);
  const dragOverlayCy = useSharedValue(0);
  const dragOverlayR = useSharedValue(0);
  const dragOverlayScale = useSharedValue(1); // 1 idle, 1.06 dragging
  const dragLastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [dragOverlayMounted, setDragOverlayMounted] = useState(false);

  // Ref to the parent ScrollView so we can lock its native scroll
  // synchronously (via setNativeProps) the moment the user starts
  // touching the map / drawing area, bypassing React state delays.
  const scrollViewRef = useRef<ScrollView>(null);

  const dragOverlayAnimStyle = useAnimatedStyle(() => {
    const r = dragOverlayR.value;
    return {
      opacity: dragOverlayActive.value,
      width: r * 2,
      height: r * 2,
      borderRadius: r,
      transform: [
        { translateX: dragOverlayCx.value - r },
        { translateY: dragOverlayCy.value - r },
        { scale: dragOverlayScale.value },
      ],
    };
  });
  // Pure JS handlers used by the gesture-handler PanGesture (see below).
  // The drag is rendered via an Animated.View overlay that follows the
  // finger in real time (no per-move async bridge call). The native
  // <Circle> is hidden while dragging and re-shown at the end with the
  // final coordinate.
  const handleCircleDragStart = useCallback((x: number, y: number) => {
    setIsZoneConfirmed(false);
    const cx = circleCenterPxRef.current?.x ?? 0;
    const cy = circleCenterPxRef.current?.y ?? 0;
    const r = circleRadiusPxRef.current ?? 0;
    dragOffsetRef.current = { dx: cx - x, dy: cy - y };
    dragLastPosRef.current = { x: cx, y: cy };
    // Position the ghost overlay exactly on top of the current native circle
    dragOverlayCx.value = cx;
    dragOverlayCy.value = cy;
    dragOverlayR.value = r;
    // Smooth fade-in (60 ms) + spring scale up for tactile feedback
    dragOverlayActive.value = withTiming(1, { duration: 60, easing: Easing.out(Easing.quad) });
    dragOverlayScale.value = withSpring(1.06, { damping: 14, stiffness: 220 });
    setDragOverlayMounted(true);
    isDraggingCircleRef.current = true;
    setIsDraggingCircle(true);
    // Light haptic — short vibration on iOS / Android
    Vibration.vibrate(15);
  }, [dragOverlayCx, dragOverlayCy, dragOverlayR, dragOverlayActive, dragOverlayScale]);

  const handleCircleDragUpdate = useCallback(
    (x: number, y: number) => {
      const off = dragOffsetRef.current;
      if (!off) return;
      const newCx = x + off.dx;
      const newCy = y + off.dy;
      // Pure synchronous update — drives the Animated.View on the UI thread.
      dragOverlayCx.value = newCx;
      dragOverlayCy.value = newCy;
      dragLastPosRef.current = { x: newCx, y: newCy };
      circleCenterPxRef.current = { x: newCx, y: newCy };
    },
    [dragOverlayCx, dragOverlayCy]
  );

  const handleCircleDragEnd = useCallback(
    async (isFullscreen: boolean) => {
      isDraggingCircleRef.current = false;
      setIsDraggingCircle(false);
      dragOffsetRef.current = null;
      // Spring scale back to 1 immediately for instant tactile release feel
      dragOverlayScale.value = withSpring(1, { damping: 16, stiffness: 240 });
      const last = dragLastPosRef.current;
      dragLastPosRef.current = null;
      const hideOverlay = () => {
        dragOverlayActive.value = withTiming(
          0,
          { duration: 120, easing: Easing.in(Easing.quad) },
          (finished) => {
            "worklet";
            if (finished) runOnJS(setDragOverlayMounted)(false);
          }
        );
      };
      if (!last) {
        hideOverlay();
        return;
      }
      const ref = isFullscreen ? mapRefFullscreen.current : mapRef.current;
      if (!ref) {
        hideOverlay();
        return;
      }
      try {
        // ONE single async conversion at release time — the only bridge call.
        const coord = await ref.coordinateForPoint({ x: last.x, y: last.y });
        if (coord) {
          setCenterCoords(coord);
          Location.reverseGeocodeAsync(coord)
            .then((results) => {
              if (results.length > 0) {
                const r = results[0];
                setDraftCity(r.city || r.subregion || r.region || "");
              }
            })
            .catch(() => {});
        }
      } catch {
        // ignore — overlay still fades out below
      }
      // Wait one frame so the native <Circle> can re-render in the new
      // position before the ghost fades, eliminating any visual jump.
      requestAnimationFrame(hideOverlay);
    },
    [dragOverlayActive, dragOverlayScale]
  );

  // Hit test that checks whether a point in the active map's pixel space
  // falls inside the cached circle bounds.
  const hitTestCircle = useCallback((x: number, y: number): boolean => {
    const cx = circleCenterPxRef.current?.x;
    const cy = circleCenterPxRef.current?.y;
    const r = circleRadiusPxRef.current;
    if (cx == null || cy == null || r == null) return false;
    const dx = x - cx;
    const dy = y - cy;
    const hitR = r + 12; // touch padding
    return dx * dx + dy * dy <= hitR * hitR;
  }, []);
  // Tick counter forced by onRegionChangeComplete — used as an effect
  // dependency to recompute the cached pixel coords when the user
  // pans/zooms the map manually.
  const [mapRegionTick, setMapRegionTick] = useState(0);
  const handleRegionChangeComplete = useCallback(() => {
    setMapRegionTick((t) => t + 1);
  }, []);

  // NOTE: circle/polygon stay FIXED at their geographic coordinates when
  // the user pans the map. Previously the shapes were slid by the region
  // delta, which felt like "the zone chases the map" — the user reported
  // this as a bug. Pan is now pure viewport navigation. The shapes are
  // only moved by explicit gestures (drag the circle, redraw the polygon)
  // or by searching a city in circle mode.
  const handleRegionChange = useCallback(
    (_region: { latitude: number; longitude: number }) => {
      // Intentionally no-op: MapView renders Circle/Polygon at their own
      // lat/lng, so they naturally stay fixed as the user pans.
    },
    []
  );
  // Inline-only: true while the user's finger is touching the inline map.
  // Used to disable the parent ScrollView's vertical scroll so the map
  // gesture (pan / pinch / drag-circle) doesn't get hijacked by the page.
  const [isMapTouching, setIsMapTouching] = useState(false);

  const handleMapContainerTouchStart = useCallback(() => {
    setIsMapTouching(true);
  }, []);
  const handleMapContainerTouchEnd = useCallback(() => {
    setIsMapTouching(false);
  }, []);

  // ── Pan gestures for the circle drag (gesture-handler) ──
  // Two distinct gestures, one per MapView. They share the same wrapper
  // handlers via the `isFullscreen` flag. The gesture is manualActivation
  // so it stays inert until onTouchesDown verifies the touch is inside
  // the cached circle bounds; otherwise manager.fail() lets the touch
  // pass through to the native MapView (pan/pinch keep working).
  const circleDragGestureInline = useMemo(
    () =>
      Gesture.Pan()
        .enabled(zoneMode === "circle")
        .runOnJS(true)
        .manualActivation(true)
        .onTouchesDown((e, manager) => {
          if (zoneMode !== "circle") {
            manager.fail();
            return;
          }
          const t = e.changedTouches[0];
          if (!hitTestCircle(t.x, t.y)) {
            manager.fail();
            return;
          }
          handleCircleDragStart(t.x, t.y);
          manager.activate();
        })
        .onUpdate((e) => {
          handleCircleDragUpdate(e.x, e.y);
        })
        .onEnd(() => handleCircleDragEnd(false))
        .onFinalize(() => {
          if (isDraggingCircleRef.current) handleCircleDragEnd(false);
        }),
    [zoneMode, hitTestCircle, handleCircleDragStart, handleCircleDragUpdate, handleCircleDragEnd]
  );

  const circleDragGestureFullscreen = useMemo(
    () =>
      Gesture.Pan()
        .enabled(zoneMode === "circle")
        .runOnJS(true)
        .manualActivation(true)
        .onTouchesDown((e, manager) => {
          if (zoneMode !== "circle") {
            manager.fail();
            return;
          }
          const t = e.changedTouches[0];
          if (!hitTestCircle(t.x, t.y)) {
            manager.fail();
            return;
          }
          handleCircleDragStart(t.x, t.y);
          manager.activate();
        })
        .onUpdate((e) => {
          handleCircleDragUpdate(e.x, e.y);
        })
        .onEnd(() => handleCircleDragEnd(true))
        .onFinalize(() => {
          if (isDraggingCircleRef.current) handleCircleDragEnd(true);
        }),
    [zoneMode, hitTestCircle, handleCircleDragStart, handleCircleDragUpdate, handleCircleDragEnd]
  );

  const handleMapContainerLayout = useCallback((_e: LayoutChangeEvent) => {
    // reserved for future use; overlay uses absoluteFillObject
  }, []);

  // Fullscreen modal
  const [fullscreenVisible, setFullscreenVisible] = useState(false);

  const effectiveRadiusKm = zoneMode === "draw" && drawnPolygon.length >= 3
    ? Math.ceil(calcPolygonRadiusKm(drawnPolygon))
    : draftRadiusKm;
  const draftPlan = useMemo(() => getPlanForRadius(effectiveRadiusKm), [effectiveRadiusKm]);

  // Initial map region — used only at mount. After that, the map is
  // panned/zoomed by the user OR programmatically via animateToRegion.
  // This is intentionally NOT linked to centerCoords so that dragging
  // the circle does not re-center the map under it.
  // Computed once, using saved coverage center if available (set by hydrate).
  // Falls back to current device location or Rome only as last resort.
  const initialMapRegion = useMemo(() => {
    if (initialMapRegionRef.current) return initialMapRegionRef.current;
    return {
      latitude: ROME_COORDS.latitude,
      longitude: ROME_COORDS.longitude,
      latitudeDelta: Math.max((draftRadiusKm * 2) / 111, 0.5),
      longitudeDelta: Math.max((draftRadiusKm * 2) / 111, 0.5),
    };
    // intentional empty deps: only the very first value matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geocode city name to coordinates
  const geocodeCity = useCallback(async (city: string) => {
    if (!city.trim()) return;
    try {
      const results = await Location.geocodeAsync(city);
      if (results.length > 0) {
        setCenterCoords({ latitude: results[0].latitude, longitude: results[0].longitude });
      } else {
        Alert.alert("Città non trovata", "Prova con un altro nome");
      }
    } catch {
      Alert.alert("Errore", "Impossibile cercare la città");
    }
  }, []);

  // Handle map tap: only moves circle center in circle mode.
  // In draw mode the overlay handles all input.
  const handleMapPress = useCallback((e: MapPressEvent) => {
    if (zoneMode === "draw") return;
    setIsZoneConfirmed(false);
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setCenterCoords({ latitude, longitude });
    Location.reverseGeocodeAsync({ latitude, longitude }).then((results) => {
      if (results.length > 0) {
        const r = results[0];
        setDraftCity(r.city || r.subregion || r.region || "");
      }
    }).catch(() => {});
  }, [zoneMode]);

// ── Refresh cached pixel coords for the circle hit-test ──
  // Triggered whenever centerCoords / radius / fullscreen / region changes.
  useEffect(() => {
    if (zoneMode !== "circle") return;
    const ref = fullscreenVisible ? mapRefFullscreen.current : mapRef.current;
    if (!ref) return;
    let cancelled = false;
    (async () => {
      try {
        const center = await ref.pointForCoordinate(centerCoords);
        if (cancelled) return;
        circleCenterPxRef.current = center;
        // Compute the on-screen radius by mapping a point one "radius east"
        // and measuring the pixel distance from the center. This is exact
        // for the current map zoom level.
        const lonDeg =
          draftRadiusKm /
          (111 * Math.cos((centerCoords.latitude * Math.PI) / 180));
        const edge = await ref.pointForCoordinate({
          latitude: centerCoords.latitude,
          longitude: centerCoords.longitude + lonDeg,
        });
        if (cancelled) return;
        const dx = edge.x - center.x;
        const dy = edge.y - center.y;
        circleRadiusPxRef.current = Math.sqrt(dx * dx + dy * dy);
      } catch {
        // ignore — refs may be unmounted mid-async
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    centerCoords,
    draftRadiusKm,
    fullscreenVisible,
    zoneMode,
    mapRegionTick,
  ]);

  // ── Touch responder handlers for dragging the circle ──
  // Draw mode handlers
  const handleClearPolygon = useCallback(() => {
    setDrawnPolygon([]);
  }, []);

  // Reset the confirmed zone so the user can redraw / re-edit.
  // For draw mode: clears the polygon. For circle mode: just re-enables
  // the on-map confirm button so the user can drag/edit and confirm again.
  const handleResetConfirmedZone = useCallback(() => {
    setIsZoneConfirmed(false);
    if (zoneMode === "draw") {
      setDrawnPolygon([]);
      setHasDrawnOnce(false);
      screenPointsRef.current = [];
      setLiveSvgPath("");
    }
  }, [zoneMode]);

  // Locate the user: request foreground permission, get the current
  // position, and animate the active map to that region.
  const handleLocateUser = useCallback(async () => {
    try {
      // Check current status first — if previously denied, iOS won't re-prompt
      let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();

      // Only request if we can still ask (first time, or reset)
      if (status !== "granted" && canAskAgain) {
        const res = await Location.requestForegroundPermissionsAsync();
        status = res.status;
        canAskAgain = res.canAskAgain;
      }

      if (status !== "granted") {
        // Permanently denied — offer to open iOS/Android settings directly
        Alert.alert(
          "Posizione disattivata",
          "Per trovare la tua posizione devi attivare l'accesso nelle impostazioni dell'app.",
          [
            { text: "Annulla", style: "cancel" },
            {
              text: "Apri Impostazioni",
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const ref = fullscreenVisible
        ? mapRefFullscreen.current
        : mapRef.current;
      ref?.animateToRegion(
        {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        600
      );
    } catch {
      Alert.alert(
        "Posizione non disponibile",
        "Non riesco a leggere la tua posizione. Controlla che il GPS sia attivo e riprova."
      );
    }
  }, [fullscreenVisible]);

  // Unified zone confirmation. Handles both circle (uses centerCoords +
  // radius) and draw (uses polygon vertices) modes. Adds a CoverageZone
  // to the list, resets the draft state, and closes fullscreen if open.
  // City is optional — if empty we save the zone with a generic label.
  const handleConfirmZone = useCallback(() => {
    const city = draftCity.trim() || "Zona personalizzata";
    setIsZoneConfirmed(true);

    if (zoneMode === "draw") {
      if (drawnPolygon.length < 3) {
        Alert.alert(
          "Zona insufficiente",
          "Disegna una zona con almeno 3 punti."
        );
        return;
      }
      const polyRadiusKm = Math.max(1, Math.ceil(calcPolygonRadiusKm(drawnPolygon)));
      const polyPlan = getPlanForRadius(polyRadiusKm);
      // Centroid as the reference lat/lng for the saved zone
      const centroid = drawnPolygon.reduce(
        (acc, p) => ({
          lat: acc.lat + p.latitude / drawnPolygon.length,
          lng: acc.lng + p.longitude / drawnPolygon.length,
        }),
        { lat: 0, lng: 0 }
      );
      const newZone: CoverageZone = {
        id: `${Date.now()}`,
        city,
        radiusKm: polyRadiusKm,
        plan: polyPlan,
        lat: centroid.lat,
        lng: centroid.lng,
        polygon: drawnPolygon,
      };
      setCoverageZones((prev) => [...prev, newZone]);
      // Keep the drawn polygon visible on the map after confirmation —
      // the user can press "Cancella zona" or "Ridisegna" to start over.
    } else {
      // Circle mode
      const newZone: CoverageZone = {
        id: `${Date.now()}`,
        city,
        radiusKm: draftRadiusKm,
        plan: draftPlan,
        lat: centerCoords.latitude,
        lng: centerCoords.longitude,
      };
      setCoverageZones((prev) => [...prev, newZone]);
      // Keep the circle visible after confirmation.
    }

    if (fullscreenVisible) {
      setFullscreenVisible(false);
      setIsDrawingActive(false);
      screenPointsRef.current = [];
      setLiveSvgPath("");
    }
  }, [
    zoneMode,
    drawnPolygon,
    draftCity,
    draftRadiusKm,
    draftPlan,
    centerCoords,
    fullscreenVisible,
  ]);

  const handleSwitchToCircle = useCallback(() => {
    setZoneMode("circle");
    setDrawnPolygon([]);
    setIsZoneConfirmed(false);
  }, []);

  const handleSwitchToDraw = useCallback(() => {
    setZoneMode("draw");
    setDrawnPolygon([]);
    setIsDrawingActive(false);
    setHasDrawnOnce(false);
    screenPointsRef.current = [];
    setLiveSvgPath("");
    setIsZoneConfirmed(false);
  }, []);

  const handleOverlayTouchStart = useCallback(
    (e: { nativeEvent: { locationX: number; locationY: number } }) => {
      // Hard-lock the parent ScrollView synchronously via native props so
      // the page does NOT scroll while the user is drawing the polygon.
      scrollViewRef.current?.setNativeProps({ scrollEnabled: false });
      // Reset the double-fire guard for this new stroke (BUG 5 fix).
      touchEndCalledRef.current = false;
      const { locationX, locationY } = e.nativeEvent;
      screenPointsRef.current = [{ x: locationX, y: locationY }];
      setLiveSvgPath(buildSvgPathFromPoints(screenPointsRef.current));
    },
    []
  );

  const handleOverlayTouchMove = useCallback(
    (e: { nativeEvent: { locationX: number; locationY: number } }) => {
      const { locationX, locationY } = e.nativeEvent;
      const next = { x: locationX, y: locationY };
      const buf = screenPointsRef.current;
      // Skip points too close to the previous one (reduces noise + cost).
      const last = buf[buf.length - 1];
      if (last && distSq(last, next) < 4) return; // ~2px threshold
      buf.push(next);
      setLiveSvgPath(buildSvgPathFromPoints(buf));
    },
    []
  );

  const handleOverlayTouchEnd = useCallback(async () => {
    // Guard against double-fire from .onEnd + .onFinalize (BUG 5 fix).
    if (touchEndCalledRef.current) return;
    touchEndCalledRef.current = true;
    // Re-enable parent ScrollView native scroll on release.
    scrollViewRef.current?.setNativeProps({ scrollEnabled: true });
    // Snapshot the points immediately (BUG 4 fix): copy before any async
    // await so a concurrent handleOverlayTouchStart cannot mutate the ref
    // while Promise.all is running.
    const raw = [...screenPointsRef.current];
    if (raw.length < 3) {
      Alert.alert("Zona troppo piccola", "Disegna una zona più grande.");
      screenPointsRef.current = [];
      setLiveSvgPath("");
      return;
    }
    // Simplify in screen-space: keep at most DRAW_MAX_POINTS vertices.
    let sampled: Array<{ x: number; y: number }>;
    if (raw.length <= DRAW_MAX_POINTS) {
      sampled = raw;
    } else {
      const step = raw.length / DRAW_MAX_POINTS;
      sampled = Array.from({ length: DRAW_MAX_POINTS }, (_, i) =>
        raw[Math.round(i * step)]
      );
    }
    // Batch convert ALL screen points → LatLng in parallel.
    // Ordering is preserved because we await Promise.all on an indexed array.
    const ref = fullscreenVisible ? mapRefFullscreen.current : mapRef.current;
    if (!ref) {
      screenPointsRef.current = [];
      setLiveSvgPath("");
      return;
    }
    const coords = await Promise.all(
      sampled.map((p) =>
        ref.coordinateForPoint({ x: p.x, y: p.y }).catch(() => null)
      )
    );
    const valid = coords.filter((c): c is LatLng => c !== null);
    if (valid.length < 3) {
      Alert.alert("Errore", "Non sono riuscito a calcolare la zona. Riprova.");
      screenPointsRef.current = [];
      setLiveSvgPath("");
      return;
    }
    // Smooth the polygon with 2 Chaikin iterations → soft, fluid curve.
    const smoothed = chaikinSmoothLatLng(valid, 2);
    setDrawnPolygon(smoothed);
    setIsDrawingActive(false);
    setHasDrawnOnce(true);
    screenPointsRef.current = [];
    setLiveSvgPath("");

    // Auto-fill the city field by reverse-geocoding the polygon centroid.
    const centroid = smoothed.reduce(
      (acc, p) => ({
        latitude: acc.latitude + p.latitude / smoothed.length,
        longitude: acc.longitude + p.longitude / smoothed.length,
      }),
      { latitude: 0, longitude: 0 }
    );
    Location.reverseGeocodeAsync(centroid)
      .then((results) => {
        if (results.length > 0) {
          const r = results[0];
          const name = r.city || r.subregion || r.region || "";
          if (name) setDraftCity(name);
        }
      })
      .catch(() => {});
  }, [fullscreenVisible]);

  // ── Pan gesture for the freeform drawing overlay ──
  // Uses gesture-handler so the parent ScrollView (also from gesture-handler)
  // automatically yields the vertical pan to this child gesture, preventing
  // the page from scrolling while the user is tracing a polygon.
  const drawPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .maxPointers(1)
        .shouldCancelWhenOutside(false)
        .onBegin((e) => {
          handleOverlayTouchStart({
            nativeEvent: { locationX: e.x, locationY: e.y },
          });
        })
        .onUpdate((e) => {
          handleOverlayTouchMove({
            nativeEvent: { locationX: e.x, locationY: e.y },
          });
        })
        .onEnd(() => {
          handleOverlayTouchEnd();
        })
        .onFinalize(() => {
          handleOverlayTouchEnd();
        }),
    [handleOverlayTouchStart, handleOverlayTouchMove, handleOverlayTouchEnd]
  );

  const handleStartDrawing = useCallback(() => {
    setDrawnPolygon([]);
    screenPointsRef.current = [];
    setLiveSvgPath("");
    setIsDrawingActive(true);
    setHasDrawnOnce(false);
    setIsZoneConfirmed(false);
  }, []);

  const handleRedraw = useCallback(() => {
    setDrawnPolygon([]);
    screenPointsRef.current = [];
    setLiveSvgPath("");
    setIsDrawingActive(true);
    setHasDrawnOnce(false);
    setIsZoneConfirmed(false);
  }, []);

  // Fullscreen modal — always opens with the map FREE (no active drawing).
  // The user can pan/zoom or switch mode before deciding to draw.
  const handleOpenFullscreen = useCallback(() => {
    setIsDrawingActive(false);
    screenPointsRef.current = [];
    setLiveSvgPath("");
    setFullscreenVisible(true);
  }, []);
  const handleCloseFullscreen = useCallback(() => {
    setIsDrawingActive(false);
    screenPointsRef.current = [];
    setLiveSvgPath("");
    setFullscreenVisible(false);
  }, []);

  // Handlers
  const handleBack = useCallback(() => router.back(), [router]);

  const handleToggleService = useCallback((id: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  }, []);

  const handleToggleDay = useCallback((day: string) => {
    setDays((prev) =>
      prev.map((d) => (d.day === day ? { ...d, available: !d.available } : d))
    );
  }, []);

  const handleRadiusChange = useCallback((km: number) => {
    setDraftRadiusKm(km);
    setIsZoneConfirmed(false);
  }, []);

  // "Aggiungi zona" button is just an alias of the unified confirm flow.
  const handleAddZone = useCallback(() => {
    handleConfirmZone();
  }, [handleConfirmZone]);

  const handleDeleteZone = useCallback((id: string) => {
    setCoverageZones((prev) => prev.filter((z) => z.id !== id));
  }, []);

  // ── Cover photo upload ───────────────────────────────────────────────
  // Lets the cleaner replace the listing cover photo. Picks from the
  // device library, uploads to Supabase Storage, and persists the URL on
  // cleaner_profiles.avatar_url.
  const handleChangeCoverPhoto = useCallback(async () => {
    if (!user?.id) {
      Alert.alert(
        "Accesso richiesto",
        "Devi essere loggato per cambiare la foto."
      );
      return;
    }
    if (!ImagePicker) {
      Alert.alert(
        "Non disponibile",
        "La funzionalità foto richiede un rebuild dell'app (dev build)."
      );
      return;
    }

    // Ask which source — Camera or Library — and proceed.
    Alert.alert("Cambia foto di copertina", "Da dove vuoi prenderla?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Fotocamera",
        onPress: async () => {
          const { status } =
            await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert(
              "Permesso negato",
              "Abilita l'accesso alla fotocamera nelle impostazioni."
            );
            return;
          }
          try {
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
              cameraType: ImagePicker.CameraType.front,
            });
            await persistPickedCover(result);
          } catch (err) {
            console.warn("[camera] launchCameraAsync error", err);
            Alert.alert(
              "Fotocamera non disponibile",
              err instanceof Error ? err.message : "Prova dalla libreria."
            );
          }
        },
      },
      {
        text: "Libreria",
        onPress: async () => {
          const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") {
            Alert.alert(
              "Permesso negato",
              "Abilita l'accesso alla libreria foto nelle impostazioni."
            );
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
          });
          await persistPickedCover(result);
        },
      },
    ]);
  }, [user?.id]);

  const persistPickedCover = useCallback(
    async (result: any) => {
      if (!user?.id || !listingId) return;
      if (result?.canceled || !result?.assets?.length) return;
      const localUri = result.assets[0].uri as string;
      // Optimistic preview while the upload runs.
      setCoverUrl(localUri);
      setIsUploadingCover(true);
      try {
        const publicUrl = await uploadListingCover(
          user.id,
          listingId,
          localUri
        );
        setCoverUrl(publicUrl);
      } catch (err) {
        // Revert the optimistic preview on any failure.
        setCoverUrl((prev) => (prev === localUri ? null : prev));
        if (err instanceof ListingCoverRejectedError) {
          Alert.alert("Foto non ammessa", err.friendlyMessage);
        } else {
          const msg =
            err instanceof Error ? err.message : "Errore sconosciuto";
          Alert.alert("Errore upload foto", msg);
        }
      } finally {
        setIsUploadingCover(false);
      }
    },
    [user?.id, listingId]
  );

  // ── Active / inactive toggle ─────────────────────────────────────────
  const handleToggleActive = useCallback(
    async (next: boolean) => {
      if (!listingId) {
        Alert.alert(
          "Annuncio non caricato",
          "Riprova tra un momento."
        );
        return;
      }
      const previous = isActive;
      // Optimistic UI: flip immediately, rollback on error.
      setIsActive(next);
      try {
        await updateListing(listingId, { is_active: next });
      } catch (err) {
        setIsActive(previous);
        Alert.alert(
          "Errore",
          err instanceof Error ? err.message : "Riprova."
        );
      }
    },
    [listingId, isActive]
  );

  // ── New listing: go back to the listings hub where the user can
  // either create a new free listing (if they don't have one yet) or
  // start the paid subscription flow. Keeping the CTA for now so the
  // layout doesn't change.
  const handleAddNewListing = useCallback(() => {
    router.push("/listings");
  }, [router]);

  // Persist the coverage zone + rate to Supabase. The DB trigger
  // converts the raw inputs into a PostGIS GEOGRAPHY column used by
  // the client search.
  const handleSave = useCallback(async () => {
    if (!listingId) {
      Alert.alert(
        "Annuncio non caricato",
        "Torna alla lista annunci e riprova."
      );
      return;
    }
    if (!isZoneConfirmed) {
      Alert.alert(
        "Zona mancante",
        "Conferma prima la zona di copertura (cerchio o poligono) sulla mappa."
      );
      return;
    }

    const isCircle = zoneMode === "circle";
    const polygonPoints =
      zoneMode === "draw" && drawnPolygon.length >= 3
        ? drawnPolygon.map((p) => ({ lat: p.latitude, lng: p.longitude }))
        : null;

    const selectedServices = services.filter((s) => s.selected).map((s) => s.id);

    setIsSaving(true);
    // Optimistic: kick off the save and navigate IMMEDIATELY so the tap
    // feels instant. The DB write resolves in the background; on error
    // we surface an Alert which still works even after the component
    // has unmounted (the alert is rendered by the OS).
    const savePromise = updateListing(listingId, {
      city: draftCity || null,
      hourly_rate: parseFloat(hourlyRate) || null,
      description: description.trim() || null,
      services: selectedServices.length > 0 ? selectedServices : null,
      coverage_mode: isCircle ? "circle" : "polygon",
      coverage_center_lat: centerCoords.latitude,
      coverage_center_lng: centerCoords.longitude,
      coverage_radius_km: isCircle ? draftRadiusKm : null,
      coverage_polygon: !isCircle ? polygonPoints : null,
    });
    router.replace("/listings");
    try {
      await savePromise;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Errore sconosciuto";
      Alert.alert("Errore nel salvataggio", msg);
    } finally {
      setIsSaving(false);
    }
  }, [
    listingId,
    isZoneConfirmed,
    zoneMode,
    drawnPolygon,
    draftCity,
    centerCoords,
    draftRadiusKm,
    hourlyRate,
    description,
    services,
    router,
  ]);

  // Redirect to the listings hub if the route lacks an ?id=... query.
  // Without a listing id we have nothing to edit.
  useEffect(() => {
    if (!listingId) {
      router.replace("/listings");
    }
  }, [listingId, router]);

  // Load the listing row from Supabase on mount. Every field is
  // hydrated into the corresponding local state so the editor reflects
  // what's currently persisted.
  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    (async () => {
      try {
        const existing = await fetchListing(listingId);
        if (cancelled || !existing) return;

        // ── Hydrate fields ──────────────────────────────────────────────────

        const city = existing.city ?? "";
        if (city) setDraftCity(city);

        const cover = existing.cover_url ?? null;
        if (cover) {
          // Pre-warm the image cache so the bitmap is ready before the Image
          // component asks for it — eliminates the 1-2 s blank area on open.
          setIsCoverLoading(true);
          Image.prefetch(cover).catch(() => {
            // If prefetch fails (offline, bad URL) we still show the Image
            // normally; onLoadEnd will clear the skeleton.
          });
          setCoverUrl(cover);
        }

        const rate = existing.hourly_rate != null ? String(existing.hourly_rate) : "25";
        if (existing.hourly_rate != null) setHourlyRate(rate);

        const desc = existing.description ?? "";
        if (desc) setDescription(desc);

        let resolvedServices = INITIAL_SERVICES;
        if (existing.services && existing.services.length > 0) {
          const persisted = new Set(existing.services);
          resolvedServices = INITIAL_SERVICES.map((s) => ({
            ...s,
            selected: persisted.has(s.id),
          }));
          setServices(resolvedServices);
        }

        setIsActive(existing.is_active !== false);

        // ── Coverage zone ────────────────────────────────────────────────────

        let resolvedZoneMode: "circle" | "draw" = "circle";
        let resolvedCenterLat = ROME_COORDS.latitude;
        let resolvedCenterLng = ROME_COORDS.longitude;
        let resolvedRadiusKm = 10;
        let resolvedPolygon: Array<{ latitude: number; longitude: number }> = [];
        let resolvedZoneConfirmed = false;

        if (
          existing.coverage_mode === "circle" &&
          existing.coverage_center_lat != null &&
          existing.coverage_center_lng != null &&
          existing.coverage_radius_km != null
        ) {
          const lat = Number(existing.coverage_center_lat);
          const lng = Number(existing.coverage_center_lng);
          const radiusKm = Number(existing.coverage_radius_km);
          resolvedZoneMode = "circle";
          resolvedCenterLat = lat;
          resolvedCenterLng = lng;
          resolvedRadiusKm = radiusKm;
          resolvedZoneConfirmed = true;
          setZoneMode("circle");
          setCenterCoords({ latitude: lat, longitude: lng });
          setDraftRadiusKm(radiusKm);
          setIsZoneConfirmed(true);
          // Set initial map region to saved coverage center (BUG 3 fix)
          const delta = Math.max((radiusKm * 2) / 111, 0.5);
          initialMapRegionRef.current = {
            latitude: lat,
            longitude: lng,
            latitudeDelta: delta,
            longitudeDelta: delta,
          };
        } else if (
          existing.coverage_mode === "polygon" &&
          existing.coverage_polygon &&
          existing.coverage_polygon.length >= 3
        ) {
          const polygon = existing.coverage_polygon.map((p) => ({
            latitude: Number(p.lat),
            longitude: Number(p.lng),
          }));
          resolvedZoneMode = "draw";
          resolvedPolygon = polygon;
          resolvedZoneConfirmed = true;
          setZoneMode("draw");
          setDrawnPolygon(polygon);
          setHasDrawnOnce(true);
          setIsZoneConfirmed(true);
          // Center map on polygon centroid (BUG 3 fix)
          const centroid = polygon.reduce(
            (acc, p) => ({
              latitude: acc.latitude + p.latitude / polygon.length,
              longitude: acc.longitude + p.longitude / polygon.length,
            }),
            { latitude: 0, longitude: 0 }
          );
          resolvedCenterLat = centroid.latitude;
          resolvedCenterLng = centroid.longitude;
          initialMapRegionRef.current = {
            latitude: centroid.latitude,
            longitude: centroid.longitude,
            latitudeDelta: 0.3,
            longitudeDelta: 0.3,
          };
        }

        // ── Capture the initial snapshot for dirty-tracking ─────────────────
        // This is set once and never updated, so the user always compares
        // against what was saved in the DB at mount time.
        setInitialSnapshot({
          hourlyRate: existing.hourly_rate != null ? String(existing.hourly_rate) : "25",
          description: desc,
          selectedServices: resolvedServices
            .filter((s) => s.selected)
            .map((s) => s.id),
          availableDays: INITIAL_DAYS.filter((d) => d.available).map((d) => d.day),
          coverUrl: cover,
          draftCity: city,
          draftRadiusKm: resolvedRadiusKm,
          centerLat: resolvedCenterLat,
          centerLng: resolvedCenterLng,
          zoneMode: resolvedZoneMode,
          drawnPolygon: resolvedPolygon,
          isZoneConfirmed: resolvedZoneConfirmed,
        });
      } catch {
        // Listing not found or transient error — keep defaults.
        // initialSnapshot stays null → isDirty stays false → CTA stays muted.
      } finally {
        if (!cancelled) setIsFetchingListing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={C.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Il mio annuncio</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isDrawingActive && !isMapTouching}
        >
          {/* ── Completion checklist ── */}
          {/* Hide while the listing is still being fetched — otherwise the
              banner flashes "incomplete" with default values for a moment. */}
          {!isFetchingListing && (
          <CompletionBanner
            items={[
              {
                key: "cover",
                done: !!coverUrl,
                label: "Foto profilo",
                hint: "Carica una foto chiara — i clienti si fidano di chi mostra la faccia",
                icon: "camera-outline",
              },
              {
                key: "rate",
                done: !!hourlyRate && parseFloat(hourlyRate) > 0,
                label: "Tariffa oraria",
                hint: "Imposta la tariffa oraria nella sezione qui sotto",
                icon: "pricetag-outline",
              },
              {
                key: "services",
                done: services.some((s) => s.selected),
                label: "Servizi offerti",
                hint: "Seleziona almeno un servizio (es. Pulizia ordinaria)",
                icon: "checkmark-circle-outline",
              },
              {
                key: "description",
                done: description.trim().length >= 30,
                label: "Descrizione (min 30 caratteri)",
                hint: "Racconta cosa ti rende speciale: esperienza, professionalità, dettagli",
                icon: "document-text-outline",
              },
              {
                key: "days",
                done: days.some((d) => d.available),
                label: "Disponibilità settimanale",
                hint: "Seleziona almeno un giorno in cui sei disponibile",
                icon: "calendar-outline",
              },
              {
                key: "zone",
                done:
                  coverageZones.length > 0 ||
                  (zoneMode === "draw" && drawnPolygon.length >= 3) ||
                  isZoneConfirmed,
                label: "Zona di copertura",
                hint: "Imposta la zona dove offri il servizio sulla mappa",
                icon: "location-outline",
              },
            ]}
          />
          )}

          {/* ── Cover image / empty state ── */}
          <View style={styles.coverContainer}>
            {isFetchingListing ? (
              // While the listing row is still being fetched we can't yet
              // know whether the cleaner has a cover or not — show a neutral
              // skeleton instead of flashing the "Aggiungi un tuo selfie"
              // empty state for users who actually have a photo.
              <View style={[styles.coverImage, styles.coverSkeleton]} />
            ) : coverUrl ? (
              <>
                {/* Skeleton shown while the bitmap is being downloaded.
                    Same dimensions as coverImage → zero layout shift. */}
                {isCoverLoading && (
                  <View style={[styles.coverImage, styles.coverSkeleton]} />
                )}
                <Image
                  source={{ uri: coverUrl }}
                  style={[
                    styles.coverImage,
                    // Keep the image in the tree even while loading so
                    // prefetch + decode happen in parallel. Hide it visually
                    // until onLoadEnd fires to avoid flicker.
                    isCoverLoading && { position: "absolute", opacity: 0 },
                  ]}
                  resizeMode="cover"
                  onLoadStart={() => setIsCoverLoading(true)}
                  onLoadEnd={() => setIsCoverLoading(false)}
                />
              </>
            ) : (
              <View style={[styles.coverImage, styles.coverEmpty]}>
                <View style={styles.coverEmptyIconCircle}>
                  <Ionicons name="person-outline" size={36} color={C.primary} />
                </View>
                <Text style={styles.coverEmptyTitle}>Aggiungi un tuo selfie</Text>
                <Text style={styles.coverEmptySubtitle}>
                  I clienti si fidano di chi mostra il proprio volto.
                  Una foto chiara e sorridente raddoppia le richieste.
                </Text>
              </View>
            )}
            <View style={styles.coverOverlay}>
              <StatusBadge status={isActive ? "active" : "paused"} />
              <Pressable
                style={styles.coverEditBtn}
                onPress={handleChangeCoverPhoto}
                disabled={isUploadingCover}
              >
                <Ionicons
                  name={
                    isUploadingCover
                      ? "sync-outline"
                      : coverUrl
                        ? "camera-outline"
                        : "add-circle-outline"
                  }
                  size={16}
                  color={C.surface}
                />
                <Text style={styles.coverEditText}>
                  {isUploadingCover
                    ? "Verifica…"
                    : coverUrl
                      ? "Cambia foto"
                      : "Carica foto"}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ── Prezzo base ── */}
          <View style={styles.card}>
            <SectionLabel>Tariffa oraria</SectionLabel>
            <PriceSlider
              priceEur={Math.min(
                PRICE_MAX,
                Math.max(PRICE_MIN, parseInt(hourlyRate, 10) || 25)
              )}
              onPriceChange={(v) => setHourlyRate(String(v))}
            />
            <Text style={[styles.priceHint, { marginTop: 4, alignSelf: "center" }]}>
              Media zona: €22–€30
            </Text>

            {/* Active / inactive switch */}
            <View style={styles.activeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeLabel}>
                  {isActive ? "Annuncio attivo" : "Annuncio in pausa"}
                </Text>
                <Text style={styles.activeHint}>
                  {isActive
                    ? "I clienti nella tua zona possono vederti e contattarti"
                    : "Il tuo annuncio è nascosto ai clienti"}
                </Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={handleToggleActive}
                trackColor={{ false: "#cfd6d4", true: C.secondary }}
                thumbColor={C.surface}
                ios_backgroundColor="#cfd6d4"
              />
            </View>
          </View>


          {/* ── Servizi offerti ── */}
          <View style={styles.card}>
            <SectionLabel>Servizi offerti</SectionLabel>
            <Text style={styles.cardSubtext}>
              Seleziona i servizi che offri ai clienti
            </Text>
            <View style={styles.chipRow}>
              {services.map((s) => (
                <ServiceChip key={s.id} tag={s} onToggle={handleToggleService} />
              ))}
            </View>
          </View>

          {/* ── Descrizione ── */}
          <View style={styles.card}>
            <SectionLabel>Descrizione</SectionLabel>
            <Text style={styles.cardSubtext}>
              Racconta ai clienti cosa ti rende speciale
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              style={styles.textArea}
              placeholderTextColor={`${C.outline}80`}
              placeholder="Descrivi il tuo servizio..."
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/500</Text>
          </View>

          {/* ── Disponibilità ── */}
          <View style={styles.card}>
            <SectionLabel>Disponibilità settimanale</SectionLabel>
            <Text style={styles.cardSubtext}>
              Seleziona i giorni in cui sei disponibile
            </Text>
            <View style={styles.daysRow}>
              {days.map((d) => (
                <DayPill key={d.day} day={d} onToggle={handleToggleDay} />
              ))}
            </View>
          </View>

          {/* ── Zone di copertura ── */}
          <View style={styles.card}>
            <SectionLabel>Zone di copertura</SectionLabel>
            <Text style={styles.cardSubtext}>
              Configura le aree in cui operi e il piano associato
            </Text>

            {/* Città base */}
            <Text style={styles.zoneFieldLabel}>Città base</Text>
            <TextInput
              value={draftCity}
              onChangeText={setDraftCity}
              placeholder="Es. Roma, Milano, Napoli..."
              placeholderTextColor={`${C.outline}80`}
              style={styles.addZoneInput}
              returnKeyType="search"
              onSubmitEditing={() => geocodeCity(draftCity)}
            />

            {/* Toggle modalità zona */}
            <View style={styles.zoneModeToggleRow}>
              <Pressable
                onPress={handleSwitchToCircle}
                style={[
                  styles.zoneModeButton,
                  styles.zoneModeButtonLeft,
                  zoneMode === "circle" && styles.zoneModeButtonActive,
                ]}
              >
                <Ionicons
                  name="radio-button-on-outline"
                  size={16}
                  color={zoneMode === "circle" ? C.surface : C.onSurfaceVariant}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.zoneModeButtonText,
                    zoneMode === "circle" && styles.zoneModeButtonTextActive,
                  ]}
                >
                  Cerchio
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSwitchToDraw}
                style={[
                  styles.zoneModeButton,
                  styles.zoneModeButtonRight,
                  zoneMode === "draw" && styles.zoneModeButtonActive,
                ]}
              >
                <Ionicons
                  name="pencil-outline"
                  size={16}
                  color={zoneMode === "draw" ? C.surface : C.onSurfaceVariant}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.zoneModeButtonText,
                    zoneMode === "draw" && styles.zoneModeButtonTextActive,
                  ]}
                >
                  Disegna zona
                </Text>
              </Pressable>
            </View>

            {/* Mappa con cerchio o poligono.
                onTouch* bubble up from MapView/overlays and (a) disable the
                parent ScrollView so vertical pan/drag stays on the map and
                so that vertical pan/drag stays on the map. */}
            <View
              style={styles.mapContainer}
              onLayout={handleMapContainerLayout}
              onTouchStart={handleMapContainerTouchStart}
              onTouchEnd={handleMapContainerTouchEnd}
              onTouchCancel={handleMapContainerTouchEnd}
            >
              {/* GestureDetector wraps the MapView so the circle-drag
                  PanGesture can hit-test BEFORE the native MapView gestures.
                  If the touch lands inside the circle the gesture activates
                  and drags the circle; otherwise it fails and the touch
                  falls through to the native MapView (pan/pinch keep working). */}
              <GestureDetector gesture={circleDragGestureInline}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  initialRegion={initialMapRegion}
                  showsUserLocation
                  scrollEnabled={!isDrawingActive && !isDraggingCircle}
                  zoomEnabled={!isDrawingActive && !isDraggingCircle}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  onPress={isDrawingActive ? undefined : handleMapPress}
                  onRegionChange={handleRegionChange}
                  onRegionChangeComplete={handleRegionChangeComplete}
                >
                  {zoneMode === "circle" && !dragOverlayMounted && (
                    <Circle
                      center={{
                        latitude: centerCoords.latitude,
                        longitude: centerCoords.longitude,
                      }}
                      radius={kmToMeters(draftRadiusKm)}
                      fillColor={MAP_CIRCLE_FILL}
                      strokeColor={MAP_CIRCLE_STROKE}
                      strokeWidth={2}
                    />
                  )}
                  {zoneMode === "draw" && !isDrawingActive && drawnPolygon.length >= 3 && (
                    <Polygon
                      coordinates={drawnPolygon}
                      fillColor="#006b5530"
                      strokeColor="#006b55"
                      strokeWidth={2}
                    />
                  )}
                  {/* Green clear-zone marker anchored to the rightmost
                      vertex of the confirmed polygon. Being a Marker,
                      it follows the map natively on pan/zoom. */}
                  {polygonClearMarkerCoord && (
                    <Marker
                      coordinate={polygonClearMarkerCoord}
                      anchor={{ x: 0.5, y: 0.5 }}
                      onPress={handleResetConfirmedZone}
                      tracksViewChanges={false}
                    >
                      <View style={styles.markerClearCircle}>
                        <Ionicons name="close" size={18} color={C.surface} />
                      </View>
                    </Marker>
                  )}
                </MapView>
              </GestureDetector>

              {/* Ghost circle overlay shown during drag — pure JS Animated
                  view, no bridge calls per move = zero lag. */}
              {dragOverlayMounted && (
                <Animated.View
                  pointerEvents="none"
                  style={[styles.dragGhostCircle, dragOverlayAnimStyle]}
                />
              )}

              {/* Freeform drawing overlay — active only when isDrawingActive.
                  Wrapped in a gesture-handler PanGesture so the parent
                  ScrollView (also from gesture-handler) yields the vertical
                  pan to this child gesture, preventing page scroll while
                  the user is tracing. */}
              {zoneMode === "draw" && isDrawingActive && (
                <GestureDetector gesture={drawPanGesture}>
                <View
                  style={styles.drawOverlay}
                >
                  <Svg
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  >
                    {liveSvgPath ? (
                      <SvgPath
                        d={liveSvgPath}
                        stroke="#006b55"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="rgba(0, 107, 85, 0.18)"
                      />
                    ) : null}
                  </Svg>
                  {liveSvgPath === "" && (
                    <View style={styles.drawOverlayHint} pointerEvents="none">
                      <Ionicons name="pencil" size={14} color={C.surface} style={{ marginRight: 5 }} />
                      <Text style={styles.drawOverlayHintText}>Trascina per disegnare</Text>
                    </View>
                  )}
                </View>
                </GestureDetector>
              )}

              {/* Expand button (top-right) */}
              <Pressable
                onPress={handleOpenFullscreen}
                style={styles.mapExpandButton}
                hitSlop={8}
              >
                <Ionicons name="expand-outline" size={18} color={C.onSurface} />
              </Pressable>

              {/* Locate-user button (bottom-right of inline map) */}
              <Pressable
                onPress={handleLocateUser}
                style={styles.mapLocateButton}
                hitSlop={8}
              >
                <Ionicons name="navigate" size={18} color={C.secondary} />
              </Pressable>


              {/* Confirm button inside map — circle mode, hidden after confirm */}
              {zoneMode === "circle" && !isZoneConfirmed && (
                <View style={styles.mapDrawActionsRow} pointerEvents="box-none">
                  <Pressable
                    onPress={handleConfirmZone}
                    style={styles.mapDrawTriggerButton}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={C.surface}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.mapDrawTriggerText}>Conferma</Text>
                  </Pressable>
                </View>
              )}

              {/* Draw action buttons inside map — draw mode only, hidden after confirm */}
              {zoneMode === "draw" && !isDrawingActive && !isZoneConfirmed && (
                <View style={styles.mapDrawActionsRow} pointerEvents="box-none">
                  {drawnPolygon.length >= 3 ? (
                    <>
                      <Pressable
                        onPress={handleRedraw}
                        style={styles.mapDrawRedrawButton}
                      >
                        <Ionicons
                          name="refresh-outline"
                          size={15}
                          color={C.secondary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.mapDrawRedrawText}>Ridisegna</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleConfirmZone}
                        style={styles.mapDrawTriggerButton}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={C.surface}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.mapDrawTriggerText}>Conferma</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      onPress={handleStartDrawing}
                      style={styles.mapDrawTriggerButton}
                    >
                      <Ionicons
                        name="pencil-outline"
                        size={15}
                        color={C.surface}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.mapDrawTriggerText}>
                        Inizia a disegnare
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            {/* Slider raggio — visibile solo in modalità cerchio */}
            {zoneMode === "circle" && (
              <RadiusSlider
                radiusKm={draftRadiusKm}
                onRadiusChange={handleRadiusChange}
              />
            )}

            {/* Riepilogo km della zona disegnata */}
            {zoneMode === "draw" && drawnPolygon.length >= 3 && (
              <View style={styles.zoneKmSummary}>
                <Ionicons
                  name="resize-outline"
                  size={15}
                  color={C.secondary}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.zoneKmSummaryText}>
                  {calcPolygonAreaKm2(drawnPolygon).toFixed(1)} km² · raggio{" "}
                  {calcPolygonRadiusKm(drawnPolygon).toFixed(1)} km · max{" "}
                  {calcPolygonMaxReachKm(drawnPolygon).toFixed(1)} km
                </Text>
              </View>
            )}

            {/* Piano attivo */}
            <PlanBadge plan={draftPlan} />

            {/* Piani di riferimento */}
            <View style={styles.planTableContainer}>
              {COVERAGE_PLANS.map((p) => {
                const isActive = draftPlan.name === p.name;
                return (
                  <View
                    key={p.name}
                    style={[styles.planTableRow, isActive && styles.planTableRowActive]}
                  >
                    <View style={styles.planTableLeft}>
                      <Text
                        style={[
                          styles.planTableName,
                          isActive && styles.planTableNameActive,
                        ]}
                      >
                        {p.name}
                      </Text>
                      <Text style={styles.planTableRange}>
                        {p.minKm}–{p.maxKm} km
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.planTablePrice,
                        isActive && styles.planTablePriceActive,
                      ]}
                    >
                      {p.priceLabel}
                    </Text>
                  </View>
                );
              })}
            </View>

          </View>

          {/* ── Save button ── */}
          {/* Visible but muted when there are no unsaved changes, so the
              user always knows where the save action lives. */}
          <View
            style={[
              styles.saveButton,
              (isSaving || !isDirty) && { opacity: isSaving ? 0.6 : 0.4 },
            ]}
          >
            <Pressable
              onPress={handleSave}
              disabled={isSaving || !isDirty}
              android_ripple={isDirty ? { color: "rgba(255,255,255,0.18)" } : undefined}
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel={
                isSaving
                  ? "Caricamento in corso"
                  : !isDirty
                  ? "Nessuna modifica da salvare"
                  : "Conferma e carica annuncio"
              }
            />
            <Ionicons
              name={isSaving ? "sync-outline" : "checkmark-circle-outline"}
              size={20}
              color="#ffffff"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.saveButtonText}>
              {isSaving ? "Caricamento…" : !isDirty ? "Nessuna modifica" : "Conferma e carica"}
            </Text>
          </View>

          {/* ── Delete listing ── */}
          <Pressable
            onPress={() => {
              if (!listingId) return;
              Alert.alert(
                "Elimina annuncio",
                "Sei sicuro di voler eliminare questo annuncio? L'azione non può essere annullata.",
                [
                  { text: "Annulla", style: "cancel" },
                  {
                    text: "Elimina",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        const { deleteListing } = await import("../../lib/api");
                        await deleteListing(listingId);
                        Alert.alert(
                          "Annuncio eliminato",
                          "L'annuncio è stato rimosso.",
                          [{ text: "OK", onPress: () => router.replace("/listings") }]
                        );
                      } catch (err) {
                        Alert.alert(
                          "Errore",
                          err instanceof Error ? err.message : "Impossibile eliminare."
                        );
                      }
                    },
                  },
                ]
              );
            }}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                alignSelf: "center",
                gap: 10,
                marginTop: 24,
                marginBottom: 8,
                paddingVertical: 16,
                paddingHorizontal: 40,
                borderRadius: 16,
                backgroundColor: "#fde7e7",
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="trash-outline" size={20} color="#b3261e" />
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#b3261e" }}>
              Elimina annuncio
            </Text>
          </Pressable>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Fullscreen map modal ── */}
      <Modal
        visible={fullscreenVisible}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={handleCloseFullscreen}
      >
        <StatusBar barStyle="light-content" backgroundColor={C.primary} />
        <View style={styles.fullscreenContainer}>
          <GestureDetector gesture={circleDragGestureFullscreen}>
            <MapView
              ref={mapRefFullscreen}
              style={styles.fullscreenMap}
              initialRegion={initialMapRegion}
              showsUserLocation
              scrollEnabled={!isDrawingActive && !isDraggingCircle}
              zoomEnabled={!isDrawingActive && !isDraggingCircle}
              rotateEnabled={false}
              pitchEnabled={false}
              onPress={isDrawingActive ? undefined : handleMapPress}
              onRegionChangeComplete={handleRegionChangeComplete}
            >
              {zoneMode === "circle" && !dragOverlayMounted && (
                <Circle
                  center={{
                    latitude: centerCoords.latitude,
                    longitude: centerCoords.longitude,
                  }}
                  radius={kmToMeters(draftRadiusKm)}
                  fillColor={MAP_CIRCLE_FILL}
                  strokeColor={MAP_CIRCLE_STROKE}
                  strokeWidth={2}
                />
              )}
              {zoneMode === "draw" && !isDrawingActive && drawnPolygon.length >= 3 && (
                <Polygon
                  coordinates={drawnPolygon}
                  fillColor="#006b5530"
                  strokeColor="#006b55"
                  strokeWidth={2}
                />
              )}
              {polygonClearMarkerCoord && (
                <Marker
                  coordinate={polygonClearMarkerCoord}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={handleResetConfirmedZone}
                  tracksViewChanges={false}
                >
                  <View style={styles.markerClearCircle}>
                    <Ionicons name="close" size={18} color={C.surface} />
                  </View>
                </Marker>
              )}
            </MapView>
          </GestureDetector>

          {/* Ghost circle overlay in fullscreen during drag */}
          {dragOverlayMounted && (
            <Animated.View
              pointerEvents="none"
              style={[styles.dragGhostCircle, dragOverlayAnimStyle]}
            />
          )}

          {/* Freeform drawing overlay in fullscreen */}
          {zoneMode === "draw" && isDrawingActive && (
            <GestureDetector gesture={drawPanGesture}>
            <View
              style={styles.drawOverlay}
            >
              <Svg
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              >
                {liveSvgPath ? (
                  <SvgPath
                    d={liveSvgPath}
                    stroke="#006b55"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="rgba(0, 107, 85, 0.18)"
                  />
                ) : null}
              </Svg>
              {liveSvgPath === "" && (
                <View style={styles.drawOverlayHint} pointerEvents="none">
                  <Ionicons name="pencil" size={14} color={C.surface} style={{ marginRight: 5 }} />
                  <Text style={styles.drawOverlayHintText}>Trascina per disegnare</Text>
                </View>
              )}
            </View>
            </GestureDetector>
          )}

          {/* Close button — top-left */}
          <Pressable
            onPress={handleCloseFullscreen}
            style={styles.fullscreenCloseButton}
            hitSlop={8}
          >
            <Ionicons name="close" size={22} color={C.onSurface} />
          </Pressable>

          {/* Address search bar with autocomplete (Nominatim / OSM) */}
          <View style={styles.fullscreenSearchContainer} pointerEvents="box-none">
            <View style={styles.fullscreenSearchBar}>
              <Ionicons
                name="search"
                size={16}
                color={C.onSurfaceVariant}
                style={{ marginRight: 8 }}
              />
              <TextInput
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder="Cerca città, via, indirizzo…"
                placeholderTextColor={C.outline}
                style={styles.fullscreenSearchInput}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={18} color={C.outline} />
                </Pressable>
              )}
            </View>
            {(searchResults.length > 0 || isSearching) && (
              <View style={styles.fullscreenSearchDropdown}>
                {isSearching && searchResults.length === 0 && (
                  <Text style={styles.fullscreenSearchEmpty}>Ricerca…</Text>
                )}
                {searchResults.map((r, idx) => (
                  <Pressable
                    key={r.placeId}
                    onPress={() => handleSelectSearchResult(r)}
                    style={({ pressed }) => [
                      styles.fullscreenSearchRow,
                      idx > 0 && styles.fullscreenSearchRowBorder,
                      pressed && { backgroundColor: C.surfaceLow },
                    ]}
                  >
                    <View style={styles.fullscreenSearchIconCircle}>
                      <Ionicons
                        name={r.iconName}
                        size={18}
                        color={C.secondary}
                      />
                    </View>
                    <View style={styles.fullscreenSearchTextCol}>
                      <Text
                        style={styles.fullscreenSearchRowTitle}
                        numberOfLines={1}
                      >
                        {r.title}
                      </Text>
                      {r.subtitle ? (
                        <Text
                          style={styles.fullscreenSearchRowSubtitle}
                          numberOfLines={1}
                        >
                          {r.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name="arrow-up-outline"
                      size={16}
                      color={C.outline}
                      style={styles.fullscreenSearchRowArrow}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Locate-user button — bottom-right of fullscreen map */}
          <Pressable
            onPress={handleLocateUser}
            style={styles.fullscreenLocateButton}
            hitSlop={8}
          >
            <Ionicons name="navigate" size={20} color={C.secondary} />
          </Pressable>


          {/* Mode toggle Cerchio/Disegna — hidden while search dropdown is
              open so the city suggestions remain fully visible */}
          {!isDrawingActive && searchResults.length === 0 && !isSearching && (
            <View style={styles.fullscreenModeToggle} pointerEvents="box-none">
              <Pressable
                onPress={handleSwitchToCircle}
                style={[
                  styles.fullscreenModeButton,
                  zoneMode === "circle" && styles.fullscreenModeButtonActive,
                ]}
              >
                <Ionicons
                  name="ellipse-outline"
                  size={15}
                  color={zoneMode === "circle" ? C.surface : C.onSurfaceVariant}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.fullscreenModeButtonText,
                    zoneMode === "circle" && styles.fullscreenModeButtonTextActive,
                  ]}
                >
                  Cerchio
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSwitchToDraw}
                style={[
                  styles.fullscreenModeButton,
                  zoneMode === "draw" && styles.fullscreenModeButtonActive,
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={15}
                  color={zoneMode === "draw" ? C.surface : C.onSurfaceVariant}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.fullscreenModeButtonText,
                    zoneMode === "draw" && styles.fullscreenModeButtonTextActive,
                  ]}
                >
                  Disegna zona
                </Text>
              </Pressable>
            </View>
          )}

          {/* Radius slider in fullscreen — circle mode only */}
          {zoneMode === "circle" && (
            <View style={styles.fullscreenSliderContainer} pointerEvents="box-none">
              <RadiusSlider
                radiusKm={draftRadiusKm}
                onRadiusChange={handleRadiusChange}
              />
            </View>
          )}

          {/* Confirm button in fullscreen — circle mode */}
          {zoneMode === "circle" && !isDrawingActive && (
            <View style={styles.fullscreenDrawActionsRow} pointerEvents="box-none">
              <Pressable
                onPress={handleConfirmZone}
                style={styles.fullscreenDrawTrigger}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={C.surface}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.mapDrawTriggerText}>Conferma zona</Text>
              </Pressable>
            </View>
          )}

          {/* Draw action buttons in fullscreen — draw mode only */}
          {zoneMode === "draw" && !isDrawingActive && (
            <View style={styles.fullscreenDrawActionsRow} pointerEvents="box-none">
              {drawnPolygon.length >= 3 ? (
                <>
                  <Pressable
                    onPress={handleRedraw}
                    style={styles.mapDrawRedrawButton}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={15}
                      color={C.secondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.mapDrawRedrawText}>Ridisegna</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      handleConfirmZone();
                      handleCloseFullscreen();
                    }}
                    style={styles.fullscreenDrawTrigger}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={C.surface}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.mapDrawTriggerText}>Conferma</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={handleStartDrawing}
                  style={styles.fullscreenDrawTrigger}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={15}
                    color={C.surface}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.mapDrawTriggerText}>
                    Inizia a disegnare
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const THUMB_SIZE = 24;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.background,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.background,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontStyle: "italic",
    color: C.onSurface,
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 38,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },

  // Cover
  coverContainer: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 14,
    height: 200,
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverEmpty: {
    backgroundColor: C.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
  },
  coverSkeleton: {
    // Light grey placeholder shown while the cover image is loading.
    // Uses the same width/height as coverImage so there is no layout shift.
    backgroundColor: "#dde4e2",
  },
  coverEmptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(2,36,32,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverEmptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.onSurface,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  coverEmptySubtitle: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,36,32,0.35)",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    padding: 16,
  },
  coverEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  coverEditText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.surface,
  },

  // Status badge
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: C.outline,
    marginBottom: 10,
  },
  cardSubtext: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    marginTop: -4,
    marginBottom: 14,
  },

  // Price
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceLow,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    gap: 4,
    flex: 1,
    marginRight: 12,
  },
  priceCurrency: {
    fontSize: 22,
    fontWeight: "700",
    color: C.primary,
  },
  priceInput: {
    fontSize: 28,
    fontWeight: "700",
    color: C.onSurface,
    flex: 1,
    padding: 0,
  },
  priceUnit: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    fontWeight: "500",
  },
  priceHint: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    flex: 1,
    textAlign: "right",
  },

  // Active / inactive switch row
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5ece9",
    gap: 12,
  },
  activeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: C.onSurface,
  },
  activeHint: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 16,
  },

  // "Crea un nuovo annuncio" CTA card
  newListingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    gap: 14,
    borderWidth: 1.5,
    borderColor: "#006b5530",
    borderStyle: "dashed",
  },
  newListingIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#006b5515",
    alignItems: "center",
    justifyContent: "center",
  },
  newListingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.onSurface,
    lineHeight: 19,
  },
  newListingSubtitle: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    lineHeight: 16,
    marginTop: 2,
  },
  newListingPriceBadge: {
    backgroundColor: C.secondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  newListingPriceText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.surface,
  },

  // Chips
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.surfaceLow,
    borderWidth: 1,
    borderColor: C.outlineVariant,
  },
  chipSelected: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: C.onSurfaceVariant,
  },
  chipTextSelected: {
    color: C.surface,
    fontWeight: "600",
  },

  // Text area
  textArea: {
    backgroundColor: C.surfaceLow,
    borderRadius: 14,
    padding: 16,
    fontSize: 14,
    color: C.onSurface,
    minHeight: 120,
    lineHeight: 21,
  },
  charCount: {
    marginTop: 8,
    fontSize: 11,
    color: C.outline,
    textAlign: "right",
  },

  // Days
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  dayPill: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.outlineVariant,
  },
  dayPillActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  dayPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: C.onSurfaceVariant,
  },
  dayPillTextActive: {
    color: C.surface,
  },

  // Zone field
  zoneFieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: C.onSurfaceVariant,
    marginBottom: 8,
  },
  addZoneInput: {
    height: 48,
    backgroundColor: C.surfaceLow,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    color: C.onSurface,
    marginBottom: 14,
  },

  // Map
  mapContainer: {
    borderRadius: 14,
    overflow: "hidden",
    height: 250,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.outlineVariant,
  },
  map: {
    flex: 1,
  },

  // Slider
  sliderContainer: {
    marginBottom: 16,
  },
  sliderLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sliderLabelLeft: {
    fontSize: 11,
    color: C.outline,
    fontWeight: "500",
  },
  sliderLabelRight: {
    fontSize: 11,
    color: C.outline,
    fontWeight: "500",
  },
  sliderKmValue: {
    fontSize: 18,
    fontWeight: "800",
    color: C.secondary,
  },
  sliderTrackWrapper: {
    height: THUMB_SIZE,
    justifyContent: "center",
  },
  sliderTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.outlineVariant,
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.secondary,
  },
  sliderThumbWrapper: {
    position: "absolute",
    left: -(THUMB_SIZE / 2),
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: C.secondary,
    borderWidth: 3,
    borderColor: C.surface,
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },

  // Plan badge
  planBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    backgroundColor: C.surfaceLow,
    borderRadius: 14,
    padding: 14,
  },
  planBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  planBadgeName: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  planPriceBlock: {
    flex: 1,
  },
  planPriceLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: C.onSurface,
  },
  planPriceSub: {
    fontSize: 11,
    color: C.outline,
    marginTop: 2,
  },

  // Plan table
  planTableContainer: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.outlineVariant,
    marginBottom: 16,
  },
  planTableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.outlineVariant,
  },
  planTableRowActive: {
    backgroundColor: "#e6f4f1",
  },
  planTableLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  planTableName: {
    fontSize: 13,
    fontWeight: "600",
    color: C.onSurfaceVariant,
    minWidth: 60,
  },
  planTableNameActive: {
    color: C.secondary,
    fontWeight: "700",
  },
  planTableRange: {
    fontSize: 12,
    color: C.outline,
  },
  planTablePrice: {
    fontSize: 13,
    fontWeight: "600",
    color: C.onSurfaceVariant,
  },
  planTablePriceActive: {
    color: C.secondary,
    fontWeight: "700",
  },

  // Add zone button
  addZoneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.secondary,
    borderRadius: 14,
    height: 50,
    marginBottom: 4,
    ...Platform.select({
      ios: {
        shadowColor: C.secondary,
        shadowOpacity: 0.22,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },
  addZoneButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  addZoneButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.surface,
  },

  // Zone list
  coverageZoneList: {
    marginTop: 14,
    gap: 8,
  },
  coverageZoneListTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: C.outline,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  coverageZoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surfaceLow,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  coverageZoneLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  coverageZoneCity: {
    fontSize: 14,
    fontWeight: "600",
    color: C.onSurface,
  },
  coverageZoneMeta: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    marginTop: 2,
  },
  coverageZoneDelete: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },

  // Reviews
  reviewsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  ratingBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: C.accent,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 3,
  },
  reviewCount: {
    fontSize: 12,
    color: C.onSurfaceVariant,
  },

  // Save button — verde scuro: outer View porta layout + bg, Pressable copre
  // l'area come absoluteFill per il touch. Pattern bullet-proof su iOS.
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#022420",
    borderRadius: 16,
    height: 58,
    marginTop: 16,
    marginBottom: 12,
    marginHorizontal: 20,
    paddingHorizontal: 24,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#022420",
        shadowOpacity: 0.22,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
  },
  saveButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.2,
  },

  bottomSpacer: {
    height: 60,
  },

  // Zone mode toggle
  zoneModeToggleRow: {
    flexDirection: "row",
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.outlineVariant,
  },
  zoneModeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    backgroundColor: C.surfaceLow,
  },
  zoneModeButtonLeft: {
    borderRightWidth: 1,
    borderRightColor: C.outlineVariant,
  },
  zoneModeButtonRight: {},
  zoneModeButtonActive: {
    backgroundColor: C.secondary,
  },
  zoneModeButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.onSurfaceVariant,
  },
  zoneModeButtonTextActive: {
    color: C.surface,
  },

  // Draw mode controls
  drawControlsContainer: {
    marginBottom: 16,
    gap: 10,
  },
  drawPointCount: {
    fontSize: 13,
    fontWeight: "600",
    color: C.onSurfaceVariant,
    textAlign: "center",
    paddingVertical: 8,
    backgroundColor: C.surfaceLow,
    borderRadius: 10,
  },
  drawActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  drawActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.surfaceLow,
    borderWidth: 1,
    borderColor: C.outlineVariant,
  },
  drawActionButtonDisabled: {
    opacity: 0.45,
  },
  drawActionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.onSurfaceVariant,
  },
  drawActionButtonTextDisabled: {
    color: C.outline,
  },
  drawConfirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.secondary,
    borderRadius: 14,
    height: 50,
    ...Platform.select({
      ios: {
        shadowColor: C.secondary,
        shadowOpacity: 0.22,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },
  drawConfirmButtonDisabled: {
    backgroundColor: C.outlineVariant,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  drawConfirmButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.surface,
  },
  drawConfirmButtonTextDisabled: {
    color: C.outline,
  },

  // Drawing overlay
  drawOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 14,
  },
  drawOverlayHint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(2,36,32,0.72)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  drawOverlayHintText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.surface,
  },

  // Map action buttons (overlaid on the map card)
  mapExpandButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  fullscreenSearchContainer: {
    position: "absolute",
    top: Platform.select({ ios: 56, android: 40 }) ?? 48,
    left: 64,
    right: 16,
    // Keep dropdown above all other map overlays (mode toggle, buttons…)
    zIndex: 50,
    elevation: 50,
  },
  fullscreenSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: "#022420",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 4 },
    }),
  },
  fullscreenSearchInput: {
    flex: 1,
    fontSize: 14,
    color: C.onSurface,
    padding: 0,
  },
  fullscreenSearchDropdown: {
    marginTop: 8,
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingVertical: 2,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#022420",
        shadowOpacity: 0.1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
    }),
  },
  fullscreenSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  fullscreenSearchRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5ece9",
  },
  fullscreenSearchIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#006b5515",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenSearchTextCol: {
    flex: 1,
    justifyContent: "center",
  },
  fullscreenSearchRowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: C.onSurface,
    lineHeight: 19,
  },
  fullscreenSearchRowSubtitle: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    lineHeight: 16,
    marginTop: 1,
  },
  fullscreenSearchRowArrow: {
    marginLeft: 8,
    transform: [{ rotate: "45deg" }],
  },
  fullscreenSearchRowText: {
    flex: 1,
    fontSize: 13,
    color: C.onSurface,
    lineHeight: 18,
  },
  fullscreenSearchEmpty: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 13,
    color: C.onSurfaceVariant,
    fontStyle: "italic",
  },
  zoneKmSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#006b5512",
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  zoneKmSummaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.secondary,
    letterSpacing: 0.2,
  },
  markerClearCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.secondary,
    borderWidth: 2,
    borderColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#006b55",
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },
  mapLocateButton: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },
  fullscreenLocateButton: {
    position: "absolute",
    // Positioned ABOVE the km slider (which sits at bottom ~110 full width)
    bottom: Platform.select({ ios: 190, android: 170 }) ?? 180,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#022420",
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 5 },
    }),
  },
  mapDrawActionsRow: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  mapDrawTriggerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.secondary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: C.secondary,
        shadowOpacity: 0.28,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 4 },
    }),
  },
  mapDrawTriggerText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.surface,
  },
  mapDrawRedrawButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.secondary,
    ...Platform.select({
      ios: {
        shadowColor: "#006b55",
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  mapDrawRedrawText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.secondary,
  },

  // Fullscreen modal
  fullscreenContainer: {
    flex: 1,
    backgroundColor: C.primary,
  },
  fullscreenMap: {
    flex: 1,
  },
  fullscreenCloseButton: {
    position: "absolute",
    top: Platform.select({ ios: 56, android: 40 }) ?? 48,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },
  fullscreenDrawActionsRow: {
    position: "absolute",
    bottom: Platform.select({ ios: 48, android: 32 }) ?? 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  fullscreenDrawTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: C.secondary,
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  fullscreenModeToggle: {
    position: "absolute",
    top: Platform.select({ ios: 116, android: 100 }) ?? 108,
    left: 64,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surface,
    borderRadius: 22,
    padding: 4,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#022420",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  fullscreenModeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 18,
  },
  fullscreenModeButtonActive: {
    backgroundColor: C.secondary,
  },
  fullscreenModeButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.onSurfaceVariant,
  },
  fullscreenModeButtonTextActive: {
    color: C.surface,
  },
  // ── "Sposta cerchio" buttons ─────────────────────────────────────
  moveCircleButton: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.secondary,
    ...Platform.select({
      ios: {
        shadowColor: "#006b55",
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  moveCircleButtonActive: {
    backgroundColor: C.secondary,
    borderColor: C.secondary,
  },
  moveCircleButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.secondary,
  },
  moveCircleButtonTextActive: {
    color: C.surface,
  },
  fullscreenMoveCircleButton: {
    position: "absolute",
    top: Platform.select({ ios: 110, android: 90 }) ?? 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.secondary,
    ...Platform.select({
      ios: {
        shadowColor: "#006b55",
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 4 },
    }),
  },
  fullscreenMoveCircleButtonActive: {
    backgroundColor: C.secondary,
    borderColor: C.secondary,
  },
  fullscreenMoveCircleButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.secondary,
    letterSpacing: 0.2,
  },
  fullscreenMoveCircleButtonTextActive: {
    color: C.surface,
  },
  dragGhostCircle: {
    position: "absolute",
    left: 0,
    top: 0,
    backgroundColor: MAP_CIRCLE_FILL,
    borderColor: MAP_CIRCLE_STROKE,
    borderWidth: 2,
  },
  fullscreenLockBadge: {
    position: "absolute",
    top: Platform.select({ ios: 110, android: 90 }) ?? 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(2, 36, 32, 0.92)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#022420",
        shadowOpacity: 0.16,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },
  fullscreenLockBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.surface,
    letterSpacing: 0.2,
  },
  fullscreenSliderContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: Platform.select({ ios: 110, android: 90 }) ?? 100,
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#022420",
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },

});
