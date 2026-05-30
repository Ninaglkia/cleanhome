/**
 * welcome-rocket.tsx
 *
 * Post-login rocket splash shown ONLY on the first login.
 * Reads profile from AuthContext to personalise the greeting and
 * determine the correct home route (client vs cleaner).
 *
 * Flow:
 *  1. Screen mounts → logo + text fade/scale in
 *  2. Lottie astronaut plays at normal speed (~1.5 s)
 *  3. Rocket fades out → WelcomeModal slides up
 *  4. User picks "Sì, mostrami" → navigates home with tour flag
 *     User picks "Esplora subito" → navigates home directly
 *  5. AsyncStorage flags `cleanhome.first_login_done` and
 *     `cleanhome.welcome_choice_made` are set so this screen and
 *     modal never show again.
 *
 * Total on-screen time before choice: ~2.0 seconds.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable, AppState, type AppStateStatus } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LottieView from "lottie-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { useAuth } from "../../lib/auth";
import WelcomeModal from "../../components/WelcomeModal";

// Storage key for signalling the home screen to open the tour
export const START_TOUR_KEY = "cleanhome.start_tour_on_next_home";

// SH is intentionally unused for now — kept available for future responsive sizing.
const { width: SW } = Dimensions.get("window");

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const BG = "#062a23";      // dark forest green background
const MINT = "#3ee0a8";    // mint accent
const WHITE = "#ffffff";

export default function WelcomeRocketScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const lottieRef = useRef<LottieView>(null);
  // Tracks whether the exit timer has already fired so AppState can re-trigger
  const modalShownRef = useRef(false);

  // Whether the welcome modal is shown (after the rocket fades out)
  const [showModal, setShowModal] = useState(false);

  // Determine first name for greeting
  const rawFirstName =
    profile?.full_name?.split(" ")[0] ??
    user?.user_metadata?.full_name?.split(" ")[0] ??
    "";
  const hasName = rawFirstName.trim().length > 0;
  const firstName = hasName ? rawFirstName : "";

  // Animated values
  const screenOpacity = useSharedValue(1);
  const contentScale = useSharedValue(0.3);
  const contentOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

  const navigateToHome = useCallback(() => {
    const destination =
      profile?.active_role === "cleaner"
        ? "/(tabs)/cleaner-home"
        : "/(tabs)/home";
    router.replace(destination as never);
  }, [profile?.active_role, router]);

  const markFirstLogin = useCallback(async () => {
    try {
      await AsyncStorage.setItem("cleanhome.first_login_done", "1");
    } catch {
      // non-critical — proceed anyway
    }
  }, []);

  const handleShowModal = useCallback(() => {
    modalShownRef.current = true;
    setShowModal(true);
  }, []);

  // User chose to start the guided tour — set flag so the home screen
  // opens the coach marks on next mount, then navigate
  const handleStartTour = useCallback(async () => {
    try {
      await AsyncStorage.setItem(START_TOUR_KEY, "1");
    } catch {
      // non-critical — proceed anyway
    }
    await markFirstLogin();
    navigateToHome();
  }, [navigateToHome, markFirstLogin]);

  const handleSkipTour = useCallback(async () => {
    await markFirstLogin();
    navigateToHome();
  }, [navigateToHome, markFirstLogin]);

  // AppState guard: if app returns to foreground before the modal appeared,
  // force-show it immediately so the user is never stuck on the splash.
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active" && !modalShownRef.current) {
        handleShowModal();
      }
    };
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [handleShowModal]);

  useEffect(() => {
    // NOTE: first_login_done is intentionally NOT set here on mount —
    // it is set only when the user actually engages (handleStartTour or
    // handleSkipTour). Otherwise an app crash or kill during the rocket
    // animation would silently consume the user's only first-run
    // experience.

    // Step 1: Lottie content pops in with spring
    contentScale.value = withSpring(1.05, { damping: 14, stiffness: 120 });
    contentOpacity.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });

    // Settle to 1.0 after the overshoot
    setTimeout(() => {
      contentScale.value = withSpring(1, { damping: 18, stiffness: 200 });
    }, 300);

    // Step 2: Title slides up
    titleTranslateY.value = withDelay(
      320,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) })
    );
    titleOpacity.value = withDelay(
      320,
      withTiming(1, { duration: 380 })
    );

    // Step 3: Subtitle fades in
    subtitleOpacity.value = withDelay(
      560,
      withTiming(1, { duration: 380 })
    );

    // Step 4: After ~2s, fade the rocket content out and show the welcome modal
    const exitTimer = setTimeout(() => {
      screenOpacity.value = withTiming(
        0,
        { duration: 420, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(handleShowModal)();
          }
        }
      );
    }, 2000);

    return () => clearTimeout(exitTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Animated styles ─────────────────────────────────────────────────────────

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: contentScale.value }],
    opacity: contentOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  return (
    <>
      {/* ── Rocket splash (fades out after ~2s) ── */}
      <Animated.View style={[styles.root, screenStyle]} pointerEvents={showModal ? "none" : "auto"}>
        {/* Pulsante "Salta" — sempre visibile per non bloccare l'utente */}
        {!showModal && (
          <Pressable
            onPress={handleSkipTour}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Salta"
            accessibilityRole="button"
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>Salta</Text>
          </Pressable>
        )}
        {/* Lottie astronaut — centred, fills most of the screen */}
        <Animated.View style={[styles.lottieWrap, contentStyle]}>
          <LottieView
            ref={lottieRef}
            source={require("../../assets/lottie/rocket.json")}
            autoPlay
            loop={false}
            style={styles.lottie}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Text block — sits below the animation */}
        <View style={styles.textBlock}>
          <Animated.Text style={[styles.title, titleStyle]}>
            {hasName ? `Benvenuto, ${firstName}!` : "Benvenuto!"}
          </Animated.Text>
          <Animated.Text style={[styles.subtitle, subtitleStyle]}>
            Pronti al decollo
          </Animated.Text>

          {/* Mint decorative accent bar */}
          <Animated.View style={[styles.accentBar, subtitleStyle]} />
        </View>
      </Animated.View>

      {/* ── Welcome modal — slides up once rocket fades ── */}
      <WelcomeModal
        visible={showModal}
        firstName={firstName}
        onStartTour={handleStartTour}
        onSkipTour={handleSkipTour}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtn: {
    position: "absolute",
    top: 56,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  skipText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  lottieWrap: {
    width: SW * 0.72,
    height: SW * 0.72,
    marginBottom: 8,
  },
  lottie: {
    width: "100%",
    height: "100%",
  },
  textBlock: {
    alignItems: "center",
    paddingHorizontal: 32,
    marginTop: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: WHITE,
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: MINT,
    textAlign: "center",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 20,
  },
  accentBar: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: MINT,
    opacity: 0.7,
  },
});
