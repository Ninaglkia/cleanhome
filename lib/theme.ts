/**
 * CleanHome Design System — "Fresh Luxe"
 *
 * Aesthetic direction: Deep emerald green as the anchor color on crisp white
 * surfaces. Premium shadows, warm teal accents, confident typography hierarchy.
 * Every surface feels intentional — not template-generated.
 */

export const Colors = {
  // --- Brand core ---
  primary: "#022420",          // Deep forest green — authority, trust
  primaryLight: "#0d3b34",     // Elevated surface variant
  primaryMid: "#1a5248",       // Interactive states on dark
  secondary: "#006b55",        // Mid-teal — CTAs, links
  secondaryLight: "#00836a",   // Hover/pressed states
  accent: "#00c896",           // Bright mint — highlights, badges
  accentLight: "#e8fdf7",      // Accent wash — chip backgrounds

  // --- Backgrounds ---
  background: "#f7faf9",       // Almost white with a green tint — body
  backgroundAlt: "#edf5f2",    // Cards on background — slightly deeper
  surface: "#ffffff",          // Pure white — cards, sheets
  surfaceElevated: "#f0f7f4",  // Slightly tinted surface for inner containers

  // --- Text ---
  text: "#0f1f1d",             // Near-black with green tint — primary text
  textSecondary: "#4a6660",    // Secondary / label text
  textTertiary: "#8aaca6",     // Placeholder / disabled text
  textOnDark: "#ffffff",       // White text on dark surfaces
  textOnDarkSecondary: "#82f4d1", // Mint on dark — brand moments
  textOnDarkTertiary: "#5e8a82", // Muted text on dark

  // --- Borders ---
  border: "#d4e4e0",           // Standard border
  borderLight: "#e8f2ef",      // Light divider
  borderFocus: "#006b55",      // Input focus ring

  // --- Semantic ---
  success: "#16a34a",
  successLight: "#dcfce7",
  warning: "#d97706",
  warningLight: "#fef3c7",
  error: "#dc2626",
  errorLight: "#fee2e2",
  info: "#2563eb",
  infoLight: "#dbeafe",

  // --- Cleaner role accent (warm brown/amber — distinguishes from client teal) ---
  cleanerPrimary: "#8B5E3C",       // Warm brown — cleaner active tint
  cleanerPrimaryLight: "#A0714F",  // Lighter variant for states
  cleanerAccent: "#D4A574",        // Cleaner amber accent
  cleanerLight: "#F5EBE0",         // Cleaner light wash
  cleanerAccentLight: "#fdf3ec",   // Warm wash — cleaner chip backgrounds

  // --- Surface system (stitch spec aliases) ---
  surfaceLow: "#f0f4f3",           // Lower surface (input fills)

  // --- Semantic (stitch spec) ---
  // warning/success/error already defined above; keep matching aliases:
  warningAmber: "#f59e0b",         // Amber variant per stitch spec
  successGreen: "#22c55e",         // Green variant per stitch spec
  errorRed: "#ba1a1a",             // Error red per stitch spec

  // Legacy aliases (keep backward compat with tailwind.config.js classes)
  primaryContainer: "#1a3a35",
  secondaryContainer: "#82f4d1",
  outlineVariant: "#c1c8c5",
  onSurface: "#0f1f1d",
  onSurfaceVariant: "#4a6660",
  muted: "#8aaca6",
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
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
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
