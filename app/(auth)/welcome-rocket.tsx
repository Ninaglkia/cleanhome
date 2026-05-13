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
import { View, Text, StyleSheet, Dimensions } from "react-native";
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
    navigateToHome();
  }, [navigateToHome]);

  const handleSkipTour = useCallback(() => {
    navigateToHome();
  }, [navigateToHome]);

  useEffect(() => {
    markFirstLogin();

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
