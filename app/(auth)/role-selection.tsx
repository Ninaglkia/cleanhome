import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { Ionicons } from "@expo/vector-icons";

// ─── Design tokens — dal Stitch HTML selezione_ruolo_onboarding_step_1 ─────────
const C = {
  background: "#f0f4f3",        // surface-container-low
  surface: "#ffffff",           // surface-container-lowest
  primary: "#022420",           // brand dark
  primaryContainer: "#1a3a35", // primary-container
  secondary: "#006b55",        // secondary (teal)
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outlineVariant: "#c1c8c5",
  accentCta: "#4fc4a3",         // CTA button — exact hex from Stitch HTML
  accentCtaText: "#1a3a35",     // on-secondary-fixed-variant
  progressActive: "#006b55",
  progressInactive: "#c1c8c5",
} as const;

// ─── Tipi ───────────────────────────────────────────────────────────────────────
type RoleOption = "client" | "cleaner" | "both";

interface OptionConfig {
  role: RoleOption;
  label: string;
  sublabel: string;
  iconName: React.ComponentProps<typeof Ionicons>["name"];
}

const OPTIONS: OptionConfig[] = [
  {
    role: "client",
    label: "Cliente",
    sublabel: "Cerco servizi di pulizia professionali",
    iconName: "home-outline",
  },
  {
    role: "cleaner",
    label: "Pulitore",
    sublabel: "Voglio offrire i miei servizi",
    iconName: "sparkles-outline",
  },
  {
    role: "both",
    label: "Entrambi",
    sublabel: "Entrambe le opzioni",
    iconName: "swap-horizontal-outline",
  },
];

// ─── Componente card radio ───────────────────────────────────────────────────────
interface RadioCardProps {
  label: string;
  sublabel: string;
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  selected: boolean;
  onPress: () => void;
}

function RadioCard({ label, sublabel, iconName, selected, onPress }: RadioCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.radioCard,
        selected && styles.radioCardSelected,
        pressed && { opacity: 0.88 },
      ]}
    >
      {/* Left: icon + text */}
      <View style={styles.radioCardLeft}>
        {/* Icon circle */}
        <View style={[styles.iconCircle, selected && styles.iconCircleSelected]}>
          <Ionicons
            name={iconName}
            size={20}
            color={selected ? C.surface : C.primary}
          />
        </View>
        <View style={styles.radioCardTextWrap}>
          <Text style={[styles.radioCardLabel, selected && styles.radioCardLabelSelected]}>
            {label}
          </Text>
          <Text style={styles.radioCardSublabel}>{sublabel}</Text>
        </View>
      </View>

      {/* Right: radio indicator */}
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
    </Pressable>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────────
export default function RoleSelectionScreen() {
  const { setActiveRole } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<RoleOption>("client");
  const [loading, setLoading] = useState(false);

  const handleNext = useCallback(async () => {
    setLoading(true);
    try {
      // "both" maps to "client" as active role — user can switch later
      const roleArg = selected === "both" ? "client" : selected;
      await setActiveRole(roleArg);
      if (selected === "client" || selected === "both") {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/onboarding/cleaner");
      }
    } catch {
      setLoading(false);
    }
  }, [selected, setActiveRole, router]);

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <StatusBar barStyle="dark-content" backgroundColor={C.background} />
        <ActivityIndicator size="large" color={C.secondary} />
        <Text style={styles.loadingText}>Configurazione in corso...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="leaf" size={22} color="#022420" />
            <Text style={styles.brandName}>CleanHome</Text>
          </View>
          {/* No skip button here — the user MUST pick a role before entering
              the app, otherwise they land on a default client home with the
              wrong tab config and no way back other than from the profile. */}
        </View>

        {/* ── Hero image placeholder ── */}
        <View style={styles.heroImage}>
          <View style={styles.heroImageOverlay} />
          {/* Overlay gradient — dark to transparent from bottom */}
          <View style={styles.heroGradientOverlay} />
        </View>

        {/* ── Overlapping card container ── */}
        <View style={styles.cardContainer}>
          <Text style={styles.questionHeadline}>
            Come ti piacerebbe{"\n"}usare CleanHome?
          </Text>

          {/* ── Radio option cards ── */}
          <View style={styles.optionList}>
            {OPTIONS.map((opt) => (
              <RadioCard
                key={opt.role}
                label={opt.label}
                sublabel={opt.sublabel}
                iconName={opt.iconName}
                selected={selected === opt.role}
                onPress={() => setSelected(opt.role)}
              />
            ))}
          </View>
        </View>

        {/* ── Progress dots ── */}
        <View style={styles.progressRow}>
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
        </View>

        {/* ── Back button ── */}
        <View style={{ paddingHorizontal: 24 }}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#022420" />
            <Text style={styles.backText}>Indietro</Text>
          </Pressable>
        </View>

        {/* ── CTA ── */}
        <View style={styles.ctaBtnOuter}>
          <Pressable onPress={handleNext} style={styles.ctaBtnTap}>
            <Text style={styles.ctaText}>Avanti</Text>
            <Ionicons name="arrow-forward" size={20} color="#ffffff" />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: C.onSurfaceVariant,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 44,
    paddingBottom: 16,
  },
  brandName: {
    fontSize: 22,
    fontWeight: "900",
    fontStyle: "italic",
    color: C.primary,
    letterSpacing: -0.5,
  },
  skipText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.secondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // ── Hero image ─────────────────────────────────────────────────────────────────
  heroImage: {
    marginHorizontal: 24,
    aspectRatio: 4 / 5,
    borderRadius: 16,
    backgroundColor: "#d0dbd8", // placeholder grigio caldo
    overflow: "hidden",
    // editorial shadow
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.06,
    shadowRadius: 48,
    elevation: 8,
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#c8d5d1",
    // Simulazione trame minimali — in produzione si usa <Image>
  },
  heroGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Gradiente simulato: fondo scuro trasparente
    backgroundColor: "transparent",
    // React Native non ha gradiente nativo — usare expo-linear-gradient
    // se disponibile; altrimenti overlay leggero basso
  },

  // ── Overlapping card container ─────────────────────────────────────────────────
  cardContainer: {
    marginHorizontal: "5%",
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 28,
    marginTop: -60, // overlap sull'immagine come nel design HTML
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: `${C.outlineVariant}1A`,
  },
  questionHeadline: {
    // Stitch: font-headline text-3xl font-bold — Noto Serif bold, no italic
    fontSize: 28,
    fontWeight: "700",
    color: C.primary,
    lineHeight: 34,
    letterSpacing: -0.3,
    marginBottom: 24,
  },

  // ── Option list ────────────────────────────────────────────────────────────────
  optionList: {
    gap: 12,
  },
  radioCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: `${C.outlineVariant}4D`, // ~30% opacity
    backgroundColor: C.surface,
  },
  radioCardSelected: {
    borderColor: C.primary,
    backgroundColor: `${C.primary}0D`, // primary/5
  },
  radioCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${C.outlineVariant}40`,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleSelected: {
    backgroundColor: C.primary,
  },
  radioCardTextWrap: {
    flex: 1,
  },
  radioCardLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: C.onSurface,
    marginBottom: 2,
  },
  radioCardLabelSelected: {
    color: C.primary,
  },
  radioCardSublabel: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    lineHeight: 16,
  },
  // Radio button indicator
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioOuterSelected: {
    borderColor: C.primary,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: C.primary,
  },

  // ── Progress dots ─────────────────────────────────────────────────────────────
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 28,
    marginBottom: 20,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.progressInactive,
  },
  progressDotActive: {
    width: 28,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.progressActive,
  },

  // ── Back button ─────────────────────────────────────────────────────────────────
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    marginBottom: 6,
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#022420",
  },

  // ── CTA button ─────────────────────────────────────────────────────────────────
  ctaBtnOuter: {
    height: 54,
    backgroundColor: "#022420",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 8,
    marginHorizontal: 24,
  },
  ctaBtnTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
});
