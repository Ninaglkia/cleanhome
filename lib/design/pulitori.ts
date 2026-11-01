import { BrandColor } from "./brand";

/**
 * Pulitori design system — tokens from the claude.ai/design handoff
 * (design_handoff_pulitori/README.md). High-fidelity green system for the
 * CleanHome client marketplace. Screens designed at 393×852 (iPhone 16).
 *
 * Adopt these tokens screen-by-screen to converge the client app onto one
 * cohesive green identity that matches the Casa logo and launch screen.
 */

export const PColor = {
  // Core greens
  ink: BrandColor.background, // shared brand ink, buttons and active navigation
  accent: "#1F7A5C", // icons, links, selection borders, selected chips, toggles ON
  mint: "#3DDC97", // text/icons ON dark buttons, badge counters, CTA on dark
  // Success / positive
  success: "#1F8A5B",
  successDot: "#34C759",
  // Pale mint surfaces
  mintPale: "#E3F3EC", // banner backgrounds, icon tiles
  cardSelected: "#F3FBF7", // selected card background
  chip: "#D6EFE3", // selected chip background
  // Accents
  star: "#F5A623",
  error: "#E5484D", // cancel, exit, notification badges
  // Muted / body text
  muted: "#64766C",
  muted2: "#77867D",
  muted3: "#718176",
  body: "#4F5A55",
  body2: "#6B7B74",
  body3: "#4F6B60",
  // Surfaces
  white: "#FFFFFF",
  canvas: "#F4F6F5",
  canvas2: "#EEF3F1",
} as const;

export const PBorder = {
  faint: "rgba(20,52,43,0.06)",
  subtle: "rgba(20,52,43,0.10)",
  card: "rgba(20,52,43,0.12)",
} as const;

/** Linear gradients (135deg unless noted). */
export const PGradient = {
  heroMatch: ["#14342B", "#1F8A5B"] as const, // match / success headers
  heroProfile: ["#14342B", "#1F5E48"] as const, // profile / detail headers
  heroOnboarding: ["#14342B", "#1F7A5C"] as const, // onboarding
} as const;

/** Avatar gradients (135deg) keyed by initials, plus a user fallback. */
export const PAvatarGradient: Record<string, readonly [string, string]> = {
  GR: ["#1F7A5C", "#34C79A"],
  EC: ["#2A6F97", "#4CB5D6"],
  MB: ["#8A5A2B", "#C98B4A"],
  SG: ["#6B3FA0", "#A874D6"],
  user: ["#C0392B", "#E57368"],
};

export const PSpace = {
  screen: 16,
  bar: 18,
  cardGap: 12,
} as const;

export const PRadius = {
  card: 18, // 16–20
  sheet: 28, // 26–30 (top corners)
  pill: 18, // 14–23
  chip: 12, // 8–19
  avatarTile: 14, // 11–16
} as const;

export const PShadow = {
  card: {
    shadowColor: "#14342B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1,
  },
  floating: {
    shadowColor: "#14342B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  dropdown: {
    shadowColor: BrandColor.background,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
} as const;

/** Fixed heights (pt). */
export const PHeight = {
  statusBar: 54,
  tabBar: 96,
  bottomAction: 110, // 104–116
  homeIndicator: 5,
} as const;

/**
 * Typography scale. Use the native system sans-serif family throughout the app.
 * Values: fontSize / fontWeight.
 */
export const PType = {
  screenTitle: { fontSize: 28, fontWeight: "800" as const },
  sectionTitle: { fontSize: 24, fontWeight: "800" as const }, // 23–26
  cardTitle: { fontSize: 17.5, fontWeight: "700" as const }, // 17–18
  cleanerName: { fontSize: 15.5, fontWeight: "700" as const },
  body: { fontSize: 14.5, fontWeight: "500" as const }, // 14–15 / 400–500
  caption: { fontSize: 12, fontWeight: "600" as const }, // 11.5–13
  price: { fontSize: 22, fontWeight: "800" as const }, // 18–24
  timerMono: { fontSize: 46, fontWeight: "800" as const },
  overline: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 2 }, // 10–12, ls 1–2.5
} as const;
