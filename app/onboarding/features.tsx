import { useCallback } from "react";
import { View, Text, Pressable, StyleSheet, Image, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const C = {
  bg: "#f6faf9",
  surface: "#ffffff",
  primary: "#022420",
  secondary: "#006b55",
  secondaryFixed: "#85f7d4",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outlineVariant: "#c1c8c5",
} as const;

const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCscbwPXdd8Xt2G_3o3kRDst9sZCS8HMIL8-A88QjU1Lw5_j2gaKuVUiQcUFnW1LsFQmm4_t6VqvoTmuTwF6hGHlhhPLqdp0v73a_pWOOk2dMSRmeyHcjc0oYyJaIf6TfhinqMd-JKz_lmnUfV4KkUJx-vOsZNLtX3HJfUS5EZtKiMQxwAOrQx8me5igFPD9Z6TpbhXaBHzMZC-wurjUAaILsFJSKWYVg6Ccqk3BwQTmQbSauIWJzCN1_1aNkFrqA40cj_4QRBAtOw";

export default function FeaturesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleNext = useCallback(() => {
    router.push("/onboarding/security");
  }, [router]);

  // Intent: "I already have an account". Push (not replace) so the user can
  // tap back to continue the marketing onboarding if they changed their mind.
  const handleAlreadyHaveAccount = useCallback(() => {
    router.push("/(auth)/login");
  }, [router]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />

      {/* Hero image — flex: 4 */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: HERO_IMAGE }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={styles.gradient} />

        {/* Floating card */}
        <View style={styles.floatCard}>
          <View style={styles.floatRow}>
            <View style={styles.floatIcon}>
              <Ionicons name="sparkles" size={16} color="#00513f" />
            </View>
            <View>
              <Text style={styles.floatLabel}>STATUS</Text>
              <Text style={styles.floatValue}>Pronto in 2 min</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>
      </View>

      {/* Content — flex: 5 */}
      <View style={styles.content}>
        <Text style={styles.eyebrow}>L'ARTE DELLA CURA</Text>
        <Text style={styles.headline}>Prenotazione{"\n"}Semplice</Text>
        <Text style={styles.body}>
          Dimentica le lunghe attese. Trova i migliori professionisti certificati
          della pulizia e prenota il tuo servizio in pochi tocchi, esattamente
          quando ne hai bisogno.
        </Text>

        {/* Dots */}
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotOff]} />
          <View style={[styles.dot, styles.dotOn]} />
          <View style={[styles.dot, styles.dotOff]} />
        </View>
      </View>

      {/* Buttons — fixed bottom */}
      <View style={styles.buttons}>
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
          <Text style={styles.backText}>Indietro</Text>
        </Pressable>

        {/* Next — View wrapper guarantees green bg */}
        <View style={styles.ctaBtnOuter}>
          <Pressable onPress={handleNext} style={styles.ctaBtnTap}>
            <Text style={styles.ctaText}>Avanti</Text>
            <Ionicons name="arrow-forward" size={20} color="#ffffff" />
          </Pressable>
        </View>

        <Pressable onPress={handleAlreadyHaveAccount} style={styles.altBtn}>
          <Text style={styles.altText}>Ho già un account — Accedi</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Image
  imageContainer: {
    flex: 3.5,
    overflow: "hidden",
    borderBottomLeftRadius: 40,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 36, 32, 0.25)",
  },

  // Float card
  floatCard: {
    position: "absolute",
    bottom: 16,
    left: 16,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 14,
    padding: 16,
    width: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  floatRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  floatIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.secondaryFixed,
    alignItems: "center", justifyContent: "center",
  },
  floatLabel: { fontSize: 9, fontWeight: "700", color: C.secondary, letterSpacing: 2 },
  floatValue: { fontSize: 13, fontWeight: "700", color: C.primary, marginTop: 1 },
  progressTrack: { height: 6, backgroundColor: "#ebefee", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", width: "75%", backgroundColor: C.secondary, borderRadius: 3 },

  // Content
  content: {
    flex: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  eyebrow: {
    fontSize: 10, fontWeight: "700", color: C.secondary,
    letterSpacing: 3.5, marginBottom: 12,
  },
  headline: {
    fontSize: 34, fontWeight: "900", color: C.primary,
    textAlign: "center", lineHeight: 40, letterSpacing: -0.5, marginBottom: 16,
  },
  body: {
    fontSize: 15, fontWeight: "500", color: C.onSurfaceVariant,
    textAlign: "center", lineHeight: 23, marginBottom: 24,
  },

  dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { height: 6, borderRadius: 3 },
  dotOn: { width: 28, backgroundColor: C.primary },
  dotOff: { width: 6, backgroundColor: C.outlineVariant },

  // Buttons
  buttons: { paddingHorizontal: 24, paddingBottom: 8 },
  backBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, marginBottom: 6,
  },
  backText: { fontSize: 15, fontWeight: "600", color: C.primary },
  ctaBtnOuter: {
    height: 54, backgroundColor: C.primary, borderRadius: 14,
    overflow: "hidden", marginBottom: 8,
  },
  ctaBtnTap: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  ctaText: { fontSize: 17, fontWeight: "700", color: "#ffffff" },
  altBtn: { alignItems: "center", paddingVertical: 10 },
  altText: { fontSize: 13, fontWeight: "700", color: C.secondary, letterSpacing: 0.2 },
});
