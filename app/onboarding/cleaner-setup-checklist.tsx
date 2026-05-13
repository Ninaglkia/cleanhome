// ============================================================================
// Screen: Cleaner setup checklist
// ----------------------------------------------------------------------------
// Shown right after the cleaner-profile wizard completes. Gives the new
// professional a visual, step-by-step guide to finish the setup required
// before they can accept bookings: photo, identity verification for
// payouts (Stripe Connect), and publishing their first listing.
//
// Design notes:
//  - Cards display a live completion state computed from the DB on focus
//  - The first PENDING card pulses softly + shows a finger-pointer hint
//    so the eye is drawn to "what to do next"
//  - Tapping a card navigates to the relevant section; returning here
//    triggers a refresh so completed items flip to "Fatto" automatically
//  - When everything is green the big CTA flips to "Vai alla dashboard"
//    and the pulse stops
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  interpolateColor,
  cancelAnimation,
} from "react-native-reanimated";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import {
  fetchCleanerSetupProgress,
  saveCleanerSetupProgress,
  type CleanerSetupProgress,
} from "../../lib/api";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";

// ─── Step config ───────────────────────────────────────────────────────────

type StepKey = "profile" | "photo" | "stripe" | "listing";

interface StepConfig {
  key: StepKey;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  ctaLabel: string;
  navigate: (push: (path: string) => void) => void;
}

const STEPS: StepConfig[] = [
  {
    key: "profile",
    icon: "person-circle-outline",
    title: "Profilo professionale",
    description: "Bio, città, servizi e tariffa — la base che i clienti vedono nella tua scheda.",
    ctaLabel: "Modifica profilo",
    navigate: (push) => push("/profile/edit"),
  },
  {
    key: "photo",
    icon: "camera-outline",
    title: "Aggiungi una foto",
    description: "I profili con foto ricevono 3 volte più richieste. Una foto sorridente fa la differenza.",
    ctaLabel: "Carica foto",
    navigate: (push) => push("/profile/edit"),
  },
  {
    key: "stripe",
    icon: "shield-checkmark-outline",
    title: "Verifica identità per i pagamenti",
    description: "Ti colleghiamo a Stripe per ricevere i compensi in sicurezza. Serve un documento d'identità.",
    ctaLabel: "Verifica ora",
    navigate: (push) => push("/payments"),
  },
  {
    key: "listing",
    icon: "megaphone-outline",
    title: "Pubblica il primo annuncio",
    description: "Il tuo annuncio è ciò che fa trovare te ai clienti. Scegli titolo, foto di copertina e zona.",
    ctaLabel: "Crea annuncio",
    navigate: (push) => push("/listings"),
  },
];

// ─── Main screen ───────────────────────────────────────────────────────────

export default function CleanerSetupChecklistScreen() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<Record<StepKey, boolean>>({
    profile: true, // always true — the wizard just saved these fields
    photo: false,
    stripe: false,
    listing: false,
  });
  const [loading, setLoading] = useState(true);

  // ── Load the live cleaner state from the DB ──────────────────
  const loadStatus = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: cp }, { count: listingCount }, savedProgress] =
        await Promise.all([
          supabase
            .from("cleaner_profiles")
            .select(
              "avatar_url, stripe_onboarding_complete, stripe_charges_enabled"
            )
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("cleaner_listings")
            .select("id", { count: "exact", head: true })
            .eq("cleaner_id", user.id),
          fetchCleanerSetupProgress(user.id).catch(
            (): CleanerSetupProgress => ({})
          ),
        ]);

      const liveStatus: Record<StepKey, boolean> = {
        profile: true, // wizard already saved profile
        photo: !!cp?.avatar_url || !!(savedProgress as CleanerSetupProgress).photo,
        stripe:
          (!!cp?.stripe_onboarding_complete && !!cp?.stripe_charges_enabled) ||
          !!(savedProgress as CleanerSetupProgress).stripe,
        listing:
          (listingCount ?? 0) > 0 ||
          !!(savedProgress as CleanerSetupProgress).listing,
      };

      setStatus(liveStatus);

      // Persist the derived state back so it survives re-installs
      const all = Object.values(liveStatus).every(Boolean);
      saveCleanerSetupProgress(user.id, liveStatus, all).catch(() => {});
    } catch {
      // Silent error: the fallback status reflects defaults (everything incomplete).
      // Better to render the checklist with placeholders than block the user.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus])
  );

  // ── Derived state ─────────────────────────────────────────────
  const completedCount = useMemo(
    () => Object.values(status).filter(Boolean).length,
    [status]
  );
  const total = STEPS.length;
  const allDone = completedCount === total;

  // Index of the first pending step — this is what pulses
  const nextPendingIndex = useMemo(
    () => STEPS.findIndex((s) => !status[s.key]),
    [status]
  );

  // ── Handlers ──────────────────────────────────────────────────
  const handleCardPress = useCallback(
    (step: StepConfig) => {
      step.navigate((path) => router.push(path as never));
    },
    [router]
  );

  const handleFinish = useCallback(async () => {
    await refreshProfile();
    if (allDone && user) {
      // Mark setup as complete before leaving
      saveCleanerSetupProgress(user.id, status, true).catch(() => {});
    }
    router.replace("/(tabs)/cleaner-home");
  }, [router, refreshProfile, allDone, user, status]);

  // ── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.loaderText}>Carico la tua checklist…</Text>
          {/* Escape hatch — if the request hangs, the user is not trapped */}
          <Pressable
            onPress={() => router.replace("/(tabs)/cleaner-home")}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Vai alla dashboard senza attendere"
            style={styles.loaderSkipBtn}
          >
            <Text style={styles.loaderSkipText}>Salta e vai alla dashboard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero: rocket Lottie + celebration ── */}
        <View style={styles.hero}>
          <View style={styles.lottieWrap}>
            <LottieView
              source={require("../../assets/lottie/rocket.json")}
              autoPlay
              loop
              style={styles.lottie}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.eyebrow}>ULTIMI PASSI</Text>
          <Text style={styles.headline}>
            {allDone ? "Sei pronto a decollare!" : "Quasi pronto,\nprofessionista!"}
          </Text>
          <Text style={styles.subheadline}>
            {allDone
              ? "Hai completato tutti i passi. Puoi iniziare a ricevere prenotazioni dai clienti nella tua zona."
              : "Ti mancano pochi passi per iniziare a ricevere prenotazioni. Completali nell'ordine che preferisci."}
          </Text>
        </View>

        {/* ── Progress ring ── */}
        <View style={styles.progressBlock}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Setup completato</Text>
            <Text style={styles.progressCount}>
              {completedCount} <Text style={styles.progressTotal}>/ {total}</Text>
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(completedCount / total) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* ── Step cards ── */}
        <View style={styles.stepsList}>
          {STEPS.map((step, idx) => {
            const done = status[step.key];
            const isNextPending = idx === nextPendingIndex;
            return (
              <StepCard
                key={step.key}
                step={step}
                done={done}
                isNext={isNextPending}
                entranceDelay={idx * 120}
                onPress={() => handleCardPress(step)}
              />
            );
          })}
        </View>

        {/* ── Footer CTA ── */}
        <View style={[styles.finishBtn, allDone && styles.finishBtnPrimary]}>
          <Pressable
            onPress={handleFinish}
            accessibilityRole="button"
            accessibilityLabel={allDone ? "Vai alla dashboard" : "Continua alla dashboard, completa dopo"}
            android_ripple={{ color: allDone ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.06)" }}
            style={StyleSheet.absoluteFill}
          />
          {allDone ? (
            <>
              <Ionicons name="rocket" size={20} color="#fff" pointerEvents="none" />
              <Text style={styles.finishBtnTextPrimary} pointerEvents="none">Vai alla dashboard</Text>
            </>
          ) : (
            <Text style={styles.finishBtnText} pointerEvents="none">
              Continua alla dashboard — completa dopo
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── StepCard ──────────────────────────────────────────────────────────────

interface StepCardProps {
  step: StepConfig;
  done: boolean;
  isNext: boolean;
  entranceDelay: number;
  onPress: () => void;
}

function StepCard({
  step,
  done,
  isNext,
  entranceDelay,
  onPress,
}: StepCardProps) {
  // Entrance animation — slide up + fade
  const entranceOpacity = useSharedValue(0);
  const entranceTranslate = useSharedValue(20);

  // Pulse animation — only active when this is the "next" pending step
  const pulse = useSharedValue(0);

  // Finger pointer bounce — hint to tap
  const fingerX = useSharedValue(0);

  useEffect(() => {
    entranceOpacity.value = withDelay(
      entranceDelay,
      withTiming(1, { duration: 500 })
    );
    entranceTranslate.value = withDelay(
      entranceDelay,
      withSpring(0, { damping: 18, stiffness: 160 })
    );
    // entranceOpacity/entranceTranslate are Reanimated shared values — stable refs,
    // including them would trigger redundant animations on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entranceDelay]);

  useEffect(() => {
    if (isNext && !done) {
      // Continuous breathing pulse on the highlighted card
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      // Finger "tap" bounce
      fingerX.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 600 }),
          withTiming(-6, { duration: 350, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 350, easing: Easing.in(Easing.quad) }),
          withTiming(-6, { duration: 350, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 350, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      );
    } else {
      pulse.value = withTiming(0, { duration: 300 });
      fingerX.value = withTiming(0, { duration: 300 });
    }
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(fingerX);
    };
    // Reanimated shared values are stable refs — no need to list as deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNext, done]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    transform: [{ translateY: entranceTranslate.value }],
  }));

  // Pulse: border color + shadow opacity interpolated
  const pulseStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      pulse.value,
      [0, 1],
      [done ? Colors.success : Colors.borderLight, Colors.secondary]
    ),
    shadowOpacity: 0.06 + pulse.value * 0.14,
    shadowRadius: 10 + pulse.value * 14,
    transform: [{ scale: 1 + pulse.value * 0.015 }],
  }));

  const fingerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: fingerX.value }],
    opacity: isNext && !done ? 1 : 0,
  }));

  return (
    <Animated.View style={[entranceStyle]}>
      <Pressable
        onPress={onPress}
        disabled={done}
        accessibilityRole="button"
        accessibilityLabel={done ? `${step.title} completato` : `${step.title}. ${step.ctaLabel}`}
        accessibilityState={{ disabled: done }}
      >
        <Animated.View
          style={[
            styles.card,
            done && styles.cardDone,
            pulseStyle,
          ]}
        >
          {/* Icon circle */}
          <View
            style={[
              styles.cardIcon,
              done && styles.cardIconDone,
              isNext && !done && styles.cardIconNext,
            ]}
          >
            {done ? (
              <Ionicons name="checkmark" size={22} color="#fff" />
            ) : (
              <Ionicons name={step.icon} size={22} color={Colors.secondary} />
            )}
          </View>

          {/* Text */}
          <View style={{ flex: 1 }}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, done && styles.cardTitleDone]}>
                {step.title}
              </Text>
              {done && (
                <View style={styles.doneChip}>
                  <Text style={styles.doneChipText}>Fatto</Text>
                </View>
              )}
              {isNext && !done && (
                <View style={styles.nextChip}>
                  <Text style={styles.nextChipText}>Inizia qui</Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.cardDescription, done && styles.cardDescriptionDone]}
            >
              {step.description}
            </Text>

            {!done && (
              <View style={styles.cardCtaRow}>
                <Text style={styles.cardCtaText}>{step.ctaLabel}</Text>
                <Animated.View style={fingerStyle}>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={Colors.secondary}
                  />
                </Animated.View>
              </View>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  loaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  loaderSkipBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  loaderSkipText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.secondary,
    textDecorationLine: "underline",
  },

  scroll: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 48,
  },

  // --- Hero ---
  hero: {
    alignItems: "center",
    marginTop: Spacing.base,
    marginBottom: Spacing.lg,
  },
  lottieWrap: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  lottie: { width: 180, height: 180 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.secondary,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  headline: {
    fontSize: 30,
    fontWeight: "900",
    color: Colors.text,
    letterSpacing: -0.8,
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 10,
  },
  subheadline: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 12,
  },

  // --- Progress ---
  progressBlock: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  progressCount: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.secondary,
  },
  progressTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textTertiary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.backgroundAlt,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
  },

  // --- Steps ---
  stepsList: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardDone: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconNext: {
    backgroundColor: Colors.accentLight,
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  cardIconDone: {
    backgroundColor: Colors.success,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    flexShrink: 1,
  },
  cardTitleDone: {
    color: Colors.textSecondary,
  },
  cardDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  cardDescriptionDone: {
    color: Colors.textTertiary,
  },
  cardCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  cardCtaText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  doneChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.success,
  },
  doneChipText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  nextChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.secondary,
  },
  nextChipText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // --- Footer CTA ---
  finishBtn: {
    height: 54,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: "transparent",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  finishBtnPrimary: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
    ...Shadows.md,
  },
  finishBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  finishBtnTextPrimary: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
});
