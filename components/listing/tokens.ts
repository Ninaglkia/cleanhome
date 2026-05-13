import type { LatLng } from "react-native-maps";

// ─── Design tokens ─────────────────────────────────────────────────────────────

export const C = {
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

export const MAP_CIRCLE_FILL = "#006b5540";
export const MAP_CIRCLE_STROKE = "#006b55";
export const DRAW_SAMPLE_EVERY = 1;
export const DRAW_MAX_POINTS = 150;

// ─── Coverage plans ────────────────────────────────────────────────────────────

export interface CoveragePlan {
  name: string;
  minKm: number;
  maxKm: number;
  priceLabel: string;
  priceMonthly: number | null;
}

export const COVERAGE_PLANS: readonly CoveragePlan[] = [
  { name: "Base", minKm: 0, maxKm: 5, priceLabel: "Gratis", priceMonthly: null },
  { name: "Standard", minKm: 6, maxKm: 15, priceLabel: "4,99 €/mese", priceMonthly: 4.99 },
  { name: "Premium", minKm: 16, maxKm: 30, priceLabel: "9,99 €/mese", priceMonthly: 9.99 },
  { name: "Pro", minKm: 31, maxKm: 50, priceLabel: "14,99 €/mese", priceMonthly: 14.99 },
] as const;

export const SLIDER_MIN_KM = 1;
export const SLIDER_MAX_KM = 50;
export const ROME_COORDS = { latitude: 41.9028, longitude: 12.4964 };

export function getPlanForRadius(km: number): CoveragePlan {
  return (
    COVERAGE_PLANS.find((p) => km >= p.minKm && km <= p.maxKm) ??
    COVERAGE_PLANS[COVERAGE_PLANS.length - 1]
  );
}

export function kmToMeters(km: number): number {
  return km * 1000;
}

// ─── Geometry helpers ──────────────────────────────────────────────────────────

export function chaikinSmoothLatLng(points: LatLng[], iterations: number): LatLng[] {
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

export function buildSvgPathFromPoints(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`;
  }
  return d;
}

export function distSq(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function calcPolygonRadiusKm(points: LatLng[]): number {
  if (points.length < 3) return 0;
  const centroid = points.reduce(
    (acc, p) => ({
      latitude: acc.latitude + p.latitude / points.length,
      longitude: acc.longitude + p.longitude / points.length,
    }),
    { latitude: 0, longitude: 0 }
  );
  const avgDist =
    points.reduce((sum, p) => {
      const dLat = (p.latitude - centroid.latitude) * 111;
      const dLng =
        (p.longitude - centroid.longitude) *
        111 *
        Math.cos((centroid.latitude * Math.PI) / 180);
      return sum + Math.sqrt(dLat * dLat + dLng * dLng);
    }, 0) / points.length;
  return Math.round(avgDist * 10) / 10;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ListingStatus = "active" | "review" | "draft" | "paused";

export interface ServiceTag {
  id: string;
  label: string;
  selected: boolean;
}

export interface DayAvailability {
  day: string;
  short: string;
  available: boolean;
}

export interface CoverageZone {
  id: string;
  city: string;
  radiusKm: number;
  plan: CoveragePlan;
  lat: number;
  lng: number;
  polygon?: LatLng[];
}

export const STATUS_CONFIG: Record<
  ListingStatus,
  { label: string; color: string; bg: string }
> = {
  active: { label: "Attivo", color: "#006b55", bg: "#e6f4f1" },
  review: { label: "In revisione", color: "#b45309", bg: "#fef3c7" },
  draft: { label: "Bozza", color: "#717976", bg: "#f0f4f3" },
  paused: { label: "In pausa", color: "#8a4502", bg: "#fef0d9" },
};

export const INITIAL_SERVICES: ServiceTag[] = [
  { id: "standard", label: "Pulizia Standard", selected: true },
  { id: "deep", label: "Pulizia Profonda", selected: true },
  { id: "ironing", label: "Stiratura", selected: false },
  { id: "windows", label: "Pulizia Vetri", selected: true },
  { id: "laundry", label: "Lavanderia", selected: false },
  { id: "oven", label: "Pulizia Forno", selected: false },
];

export const INITIAL_DAYS: DayAvailability[] = [
  { day: "Lunedì", short: "Lun", available: true },
  { day: "Martedì", short: "Mar", available: true },
  { day: "Mercoledì", short: "Mer", available: false },
  { day: "Giovedì", short: "Gio", available: true },
  { day: "Venerdì", short: "Ven", available: true },
  { day: "Sabato", short: "Sab", available: false },
  { day: "Domenica", short: "Dom", available: false },
];
