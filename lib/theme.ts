import { BrandColor } from "./design/brand";
import { PBorder, PColor } from "./design/pulitori";

/** One forest-green identity for both roles, with quiet neutral surfaces. */

export const Colors = {
  // --- Brand core ---
  primary: BrandColor.background,
  primaryLight: "#1F5E48",
  primaryMid: PColor.accent,
  secondary: PColor.accent,
  secondaryLight: "#216C53",
  accent: PColor.mint,
  accentLight: PColor.mintPale,

  // --- Backgrounds ---
  background: PColor.canvas,
  backgroundAlt: PColor.canvas2,
  surface: PColor.white,
  surfaceElevated: PColor.cardSelected,

  // --- Text ---
  text: PColor.ink,
  textSecondary: PColor.body,
  textTertiary: PColor.muted,
  textOnDark: "#ffffff",       // White text on dark surfaces
  textOnDarkSecondary: PColor.mint,
  textOnDarkTertiary: "#A8C3B5",

  // --- Borders ---
  border: PBorder.card,
  borderLight: PBorder.faint,
  borderFocus: PColor.accent,

  // --- Semantic ---
  success: PColor.success,
  successLight: PColor.mintPale,
  warning: "#d97706",
  warningLight: "#fef3c7",
  error: "#dc2626",
  errorLight: "#fee2e2",
  info: "#2563eb",
  infoLight: "#dbeafe",

  // Legacy role aliases retain their API; both roles use the shared brand.
  cleanerPrimary: BrandColor.background,
  cleanerPrimaryLight: PColor.accent,
  cleanerAccent: PColor.accent,
  cleanerLight: PColor.mintPale,
  cleanerAccentLight: PColor.cardSelected,

  // --- Surface system (stitch spec aliases) ---
  surfaceLow: PColor.canvas2,

  // --- Semantic (stitch spec) ---
  // warning/success/error already defined above; keep matching aliases:
  warningAmber: "#f59e0b",         // Amber variant per stitch spec
  successGreen: "#22c55e",         // Green variant per stitch spec
  errorRed: "#ba1a1a",             // Error red per stitch spec

  // Legacy aliases (keep backward compat with tailwind.config.js classes)
  primaryContainer: "#1F5E48",
  secondaryContainer: PColor.mintPale,
  outlineVariant: "#DCE4DF",
  onSurface: PColor.ink,
  onSurfaceVariant: PColor.body,
  muted: PColor.muted,
} as const;

/**
 * Booking status visual config — color, label, and icon name
 */
export const BookingStatusConfig: Record<
  string,
  { color: string; bgColor: string; label: string; icon: string }
> = {
  pending: {
    color: Colors.warning,
    bgColor: Colors.warningLight,
    label: "In attesa",
    icon: "time-outline",
  },
  accepted: {
    color: Colors.secondary,
    bgColor: Colors.accentLight,
    label: "Accettata",
    icon: "checkmark-circle-outline",
  },
  declined: {
    color: Colors.error,
    bgColor: Colors.errorLight,
    label: "Rifiutata",
    icon: "close-circle-outline",
  },
  completed: {
    color: Colors.success,
    bgColor: Colors.successLight,
    label: "Completata",
    icon: "checkmark-done-circle-outline",
  },
  work_done: {
    color: Colors.info,
    bgColor: Colors.infoLight,
    label: "Lavoro fatto",
    icon: "hammer-outline",
  },
  disputed: {
    color: Colors.error,
    bgColor: Colors.errorLight,
    label: "Contestata",
    icon: "alert-circle-outline",
  },
  cancelled: {
    color: Colors.muted,
    bgColor: Colors.surfaceElevated,
    label: "Cancellata",
    icon: "ban-outline",
  },
  auto_cancelled: {
    color: Colors.muted,
    bgColor: Colors.surfaceElevated,
    label: "Auto-cancellata",
    icon: "ban-outline",
  },
};

/**
 * Legacy map — keeps existing code compatible
 */
export const BookingStatusColors: Record<string, { color: string; label: string }> = Object.fromEntries(
  Object.entries(BookingStatusConfig).map(([k, v]) => [k, { color: v.color, label: v.label }])
);

/**
 * Spacing scale — always multiples of 4
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

/**
 * Border radius system — consistent across the app
 */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

/**
 * Shadow presets — layered for depth
 */
export const Shadows = {
  sm: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  lg: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
} as const;

/**
 * Spring animation presets for react-native-reanimated
 */
export const SpringConfig = {
  // Button press — snappy and responsive
  press: { damping: 18, stiffness: 300, mass: 0.8 },
  // Card entrance — gentle and premium
  entrance: { damping: 22, stiffness: 180 },
  // Modal / sheet slide — smooth
  modal: { damping: 28, stiffness: 200 },
} as const;
