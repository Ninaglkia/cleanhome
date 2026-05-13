import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Dimensions,
  StatusBar,
  FlatList,
  ViewToken,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { markCleanerOnboarded } from "../../lib/api";
import LottieView from "lottie-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const C = {
  bg: "#f0f4f3",
  surface: "#ffffff",
  primary: "#022420",
  secondary: "#006b55",
  mint: "#4fc4a3",
  mintDark: "#1a3a35",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outlineVariant: "#c1c8c5",
} as const;

const ROLES = [
  { id: "client" as const, title: "Cliente", desc: "Cerco servizi di pulizia professionali" },
  { id: "cleaner" as const, title: "Pulitore", desc: "Voglio offrire i miei servizi" },
  { id: "both" as const, title: "Entrambi", desc: "Entrambe le opzioni" },
];

// Lottie animations per ruolo (slide 0)
const ROLE_ANIMATIONS = {
  client: require("../../assets/lottie/cleaning.json"),
  cleaner: require("../../assets/lottie/money.json"),
  both: require("../../assets/lottie/rocket.json"),
};

// Lottie animations
const SLIDES = [
  {
    id: "1",
    animation: null, // dynamic — set by role selection
    eyebrow: "BENVENUTO",
    title: "Come ti piacerebbe\nusare CleanHome?",
    description:
      "Trova i migliori professionisti della pulizia o offri i tuoi servizi. Un'app, infinite possibilità.",
  },
  {
    id: "2",
    animation: require("../../assets/lottie/booking.json"),
    eyebrow: "L'ARTE DELLA CURA",
    title: "Prenotazione\nSemplice",
    description:
      "Dimentica le lunghe attese. Trova i migliori professionisti certificati e prenota in pochi tocchi.",
  },
  {
    id: "3",
    animation: require("../../assets/lottie/security.json"),
    eyebrow: "SECURITY FIRST",
    title: "Pagamenti\nSicuri",
    description:
      "Ogni transazione è protetta da crittografia end-to-end di livello bancario. I tuoi dati sono al sicuro.",
  },
];

type Slide = (typeof SLIDES)[number];

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, setActiveRole } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedRole, setSelectedRole] = useState<"client" | "cleaner" | "both">("client");
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useSharedValue(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  // Persist the chosen role then route to the right next step. Clients
  // are done onboarding (mark cleaner_onboarded=true → splash sends them
  // straight to /(tabs)/home next time). Cleaners still need to fill the
  // profile wizard (bio, services, hourly rate) followed by the setup
  // checklist — the wizard screen itself calls markCleanerOnboarded once
  // the profile data is persisted, so we intentionally skip it here.
  const finishOnboarding = useCallback(async () => {
    const isCleaner = selectedRole === "cleaner" || selectedRole === "both";
    try {
      const roleArg = isCleaner ? "cleaner" : "client";
      await setActiveRole(roleArg);
      if (!isCleaner && user?.id) {
        await markCleanerOnboarded(user.id);
      }
    } catch {
      // Non-fatal — the user can always reconfigure from the profile tab.
    }
    router.replace(isCleaner ? "/onboarding/cleaner" : "/(tabs)/home");
  }, [selectedRole, setActiveRole, user?.id, router]);

  const handleNext = useCallback(() => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      // Ultima slide — salva e vai alla home
      finishOnboarding();
    }
  }, [activeIndex, finishOnboarding]);

  const renderSlide = useCallback(
    ({ item, index }: { item: Slide; index: number }) => (
      <View style={styles.slide}>
        {/* Lottie animation — slide 0 changes based on role */}
        <View style={styles.animationWrap}>
          <LottieView
            source={index === 0 ? ROLE_ANIMATIONS[selectedRole] : item.animation}
            autoPlay
            loop
            style={styles.lottie}
            key={index === 0 ? selectedRole : item.id}
          />
        </View>

        {/* Text content */}
        <View style={styles.textContent}>
          <Text style={styles.eyebrow}>{item.eyebrow}</Text>
          <Text style={styles.title}>{item.title}</Text>

          {/* Slide 0: role selection options */}
          {index === 0 ? (
            <View style={styles.rolesContainer}>
              {ROLES.map((r) => {
                const active = selectedRole === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setSelectedRole(r.id)}
                    style={[styles.option, active && styles.optionActive]}
                  >
                    <View style={styles.optionText}>
                      <Text style={[styles.optionTitle, active && { color: C.primary }]}>{r.title}</Text>
                      <Text style={styles.optionDesc}>{r.desc}</Text>
                    </View>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.description}>{item.description}</Text>
          )}
        </View>
      </View>
    ),
    [selectedRole]
  );

  const isLastSlide = activeIndex === SLIDES.length - 1;

  // Button pulse animation
  const btnScale = useSharedValue(1);
  const btnGlow = useSharedValue(0.3);

  useEffect(() => {
    // Gentle pulse loop
    btnScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // infinite
      true
    );
    btnGlow.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1200 }),
        withTiming(0.25, { duration: 1200 })
      ),
      -1,
      true
    );
  }, []);

  const btnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
    shadowOpacity: btnGlow.value,
  }));

  const handleBtnPressIn = useCallback(() => {
    btnScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  }, []);

  const handleBtnPressOut = useCallback(() => {
    btnScale.value = withSpring(1.03, { damping: 15, stiffness: 300 });
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 8 }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        {activeIndex > 0 ? (
          <Pressable
            onPress={() => {
              flatListRef.current?.scrollToIndex({ index: activeIndex - 1, animated: true });
            }}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={20} color={C.primary} />
            <Text style={styles.backText}>Indietro</Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../../assets/icon.png")}
              style={{ width: 20, height: 20, borderRadius: 5 }}
            />
            <Text style={styles.brand}>CleanHome</Text>
          </View>
        )}
        {/* No skip button — this onboarding finalizes the user's role choice
            and marks cleaner_onboarded on the profile. Allowing skip silently
            defaults everyone to "client" which breaks cleaners' first-run
            experience. Keep the flow explicit. */}
        <View style={{ width: 40 }} />
      </View>

      {/* Horizontal paging FlatList */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={(e) => {
          scrollX.value = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        style={styles.flatList}
      />

      {/* Bottom: dots + button */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotOn : styles.dotOff,
              ]}
            />
          ))}
        </View>

        {/* CTA button — animated pulse + scale on press */}
        <Animated.View style={[styles.ctaOuter, isLastSlide && styles.ctaOuterLast, btnAnimStyle]}>
          <Pressable
            onPress={handleNext}
            onPressIn={handleBtnPressIn}
            onPressOut={handleBtnPressOut}
            style={styles.ctaTap}
          >
            <Text style={[styles.ctaText, isLastSlide && styles.ctaTextLast]}>
              {isLastSlide ? "Inizia" : "Avanti"}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={isLastSlide ? "#ffffff" : C.mintDark}
            />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    height: 48,
  },
  brand: { fontSize: 22, fontWeight: "900", color: C.primary },
  skip: { fontSize: 13, fontWeight: "700", color: C.secondary, letterSpacing: 1 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 15, fontWeight: "600", color: C.primary },

  flatList: { flex: 1 },

  // Each slide = full screen width
  slide: {
    width: SCREEN_W,
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 32,
  },

  // Lottie animation area — smaller to leave room for options
  animationWrap: {
    flex: 3,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  lottie: {
    width: SCREEN_W * 0.55,
    height: SCREEN_W * 0.55,
  },

  // Text + options content
  textContent: {
    flex: 4,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: C.secondary,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: C.primary,
    textAlign: "center",
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    fontWeight: "500",
    color: C.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 23,
    paddingHorizontal: 8,
  },

  // Role options (slide 0)
  rolesContainer: { width: "100%", gap: 8, marginTop: 8 },
  option: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
    borderWidth: 2, borderColor: `${C.outlineVariant}4D`, backgroundColor: C.surface,
  },
  optionActive: { borderColor: C.primary, backgroundColor: `${C.primary}08` },
  optionText: { flex: 1, marginRight: 12 },
  optionTitle: { fontSize: 15, fontWeight: "700", color: C.onSurface, marginBottom: 1 },
  optionDesc: { fontSize: 11, color: C.onSurfaceVariant },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: C.outlineVariant,
    alignItems: "center", justifyContent: "center",
  },
  radioActive: { borderColor: C.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },

  // Bottom section
  bottom: {
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 16,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: { height: 6, borderRadius: 3 },
  dotOn: { width: 28, backgroundColor: C.secondary },
  dotOff: { width: 6, backgroundColor: C.outlineVariant },

  // CTA — mint green default, dark green on last slide
  ctaOuter: {
    width: "100%",
    height: 56,
    backgroundColor: C.mint,
    borderRadius: 14,
    overflow: "hidden",
  },
  ctaOuterLast: {
    backgroundColor: C.primary,
  },
  ctaTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "700",
    color: C.mintDark,
  },
  ctaTextLast: {
    color: "#ffffff",
  },
});
