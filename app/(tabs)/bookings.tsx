import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Alert,
  Dimensions,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
  useAnimatedScrollHandler,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import LottieView from "lottie-react-native";
import { useAuth } from "../../lib/auth";
import { fetchBookings, confirmBookingCompletion } from "../../lib/api";
import { Booking } from "../../lib/types";
import { NotificationBell } from "../../components/NotificationBell";

// ─── Static design tokens (non-role-specific) ────────────────────────────────

const C = {
  background: "#f6faf9",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outlineVariant: "#c1c8c5",
  outline: "#717976",
  amber50: "#fffbeb",
  amber700: "#b45309",
  green100: "#dcfce7",
  green700: "#15803d",
  error: "#ba1a1a",
} as const;

// ─── Role-based theme tokens ──────────────────────────────────────────────────

// CLEANER mode: dark forest green
const CLEANER_THEME = {
  primary: "#022420",
  primaryContainer: "#1a3a35",
  secondary: "#006b55",
  secondaryContainer: "#82f4d1",
  avatarFallbackText: "#abcec6",
  serviceTagBg: "#82f4d14D",
  confirmWorkBg: "#006b55",
  backgroundTint: "#f6faf9",
} as const;

// CLIENT mode: warm terra / amber — consistent with profile.tsx ClientView
const CLIENT_THEME = {
  primary: "#8B5E3C",
  primaryContainer: "#5C3D24",
  secondary: "#C2410C",
  secondaryContainer: "#F5EBE0",
  avatarFallbackText: "#ffffff",
  serviceTagBg: "#F5EBE04D",
  confirmWorkBg: "#C2410C",
  backgroundTint: "#fdf8f4",
} as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 220;
const SEPARATOR_HEIGHT = 16;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const FILTERS = [
  { key: "all", label: "Tutte" },
  { key: "pending", label: "In attesa" },
  { key: "accepted", label: "Attive" },
  { key: "completed", label: "Completate" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

// Spring configs
const SPRING_SNAPPY = { damping: 18, stiffness: 200, mass: 0.8 };
const SPRING_GENTLE = { damping: 22, stiffness: 160, mass: 1 };
const SPRING_BADGE = { damping: 12, stiffness: 280, mass: 0.6 };
const TIMING_PILL = { duration: 240, easing: Easing.bezier(0.34, 1.56, 0.64, 1) };

// ─── Status config (semantic — never role-tinted) ────────────────────────────

interface StatusConfig {
  label: string;
  textColor: string;
  bgColor: string;
}

function getStatusConfig(status: string): StatusConfig {
  switch (status) {
    case "pending":
      return { label: "In attesa", textColor: C.amber700, bgColor: C.amber50 };
    case "accepted":
      // "ACCETTATA" uses the secondary role color — injected via prop
      return { label: "ACCETTATA", textColor: "ROLE", bgColor: "#e6f9f4" };
    case "work_done":
      return { label: "DA CONFERMARE", textColor: C.amber700, bgColor: C.amber50 };
    case "completed":
      return { label: "COMPLETATA", textColor: C.green700, bgColor: C.green100 };
    case "declined":
      return { label: "RIFIUTATA", textColor: "#b3261e", bgColor: "#fee2e2" };
    case "cancelled":
    case "auto_cancelled":
      return { label: "ANNULLATA", textColor: C.outline, bgColor: C.surfaceLow };
    case "disputed":
      return { label: "CONTESTATA", textColor: "#b3261e", bgColor: "#fee2e2" };
    default:
      return { label: status.toUpperCase(), textColor: C.outline, bgColor: C.surfaceLow };
  }
}

function getServiceLabel(serviceType: string): string {
  const upper = serviceType.toUpperCase();
  return upper.length > 20 ? upper.slice(0, 18) + "…" : upper;
}

// ─── Animated CTA button — pulse glow on idle ────────────────────────────────

interface AnimatedCTAProps {
  onPress: () => void;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  primaryColor: string;
}

function AnimatedCTA({ onPress, label, icon, accessibilityLabel, primaryColor }: AnimatedCTAProps) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.35);
  const isPressing = useRef(false);

  // Pulse glow: shadow opacity cycles 0.35 → 0.7 → 0.35 every ~2s
  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(glowOpacity);
    };
  }, [glowOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Shadow wrapper — animates opacity independently
  const shadowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  const handlePressIn = () => {
    isPressing.current = true;
    cancelAnimation(glowOpacity);
    glowOpacity.value = 0.2;
    scale.value = withSpring(0.96, SPRING_SNAPPY);
  };

  const handlePressOut = () => {
    isPressing.current = false;
    scale.value = withSpring(1, SPRING_GENTLE);
    // Resume glow after press
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  };

  return (
    <Animated.View
      style={[
        animatedStyle,
        shadowStyle,
        {
          shadowColor: primaryColor,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 16,
          elevation: 8,
          borderRadius: 16,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        style={[styles.ctaBtn, { backgroundColor: primaryColor }]}
      >
        <Ionicons name={icon} size={17} color="#fff" />
        <Text style={styles.ctaBtnText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Animated badge — bounces when count changes ──────────────────────────────

interface AnimatedBadgeProps {
  count: number;
  isActive: boolean;
}

function AnimatedBadge({ count, isActive }: AnimatedBadgeProps) {
  const scale = useSharedValue(1);
  const prevCount = useRef(count);

  useEffect(() => {
    if (prevCount.current !== count && count > 0) {
      scale.value = withSequence(
        withSpring(1.3, SPRING_BADGE),
        withSpring(1, SPRING_GENTLE)
      );
    }
    prevCount.current = count;
  }, [count, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        animStyle,
        styles.tabBadge,
        isActive && styles.tabBadgeActive,
      ]}
    >
      <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
        {count}
      </Text>
    </Animated.View>
  );
}

// ─── Ripple effect component ──────────────────────────────────────────────────

function TabRipple({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);

  useEffect(() => {
    if (visible) {
      opacity.value = 0.12;
      scale.value = 0.3;
      opacity.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) });
      scale.value = withTiming(1.4, { duration: 400, easing: Easing.out(Easing.ease) });
    }
  }, [visible, opacity, scale]);

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.ripple, rippleStyle]}
    />
  );
}

// ─── Animated filter pill selector ───────────────────────────────────────────

interface FilterTabsProps {
  activeFilter: FilterKey;
  onSelect: (key: FilterKey) => void;
  bookings: Booking[];
  pillColor: string;
}

function FilterTabs({ activeFilter, onSelect, bookings, pillColor }: FilterTabsProps) {
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const [layoutReady, setLayoutReady] = useState(false);
  // Track which tab last had a ripple triggered
  const [rippleKey, setRippleKey] = useState<string | null>(null);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillWidth.value,
    opacity: layoutReady ? 1 : 0,
    backgroundColor: pillColor,
    shadowColor: pillColor,
  }));

  const movePillTo = useCallback(
    (key: string) => {
      const layout = tabLayouts.current[key];
      if (!layout) return;
      pillX.value = withTiming(layout.x, TIMING_PILL);
      pillWidth.value = withTiming(layout.width, TIMING_PILL);
    },
    [pillX, pillWidth]
  );

  const getBadge = (key: string): number | null => {
    if (key === "all") return null;
    if (key === "accepted")
      return bookings.filter((b) => ["accepted", "work_done"].includes(b.status)).length || null;
    return bookings.filter((b) => b.status === key).length || null;
  };

  return (
    <View style={styles.tabsContainer}>
      {/* Sliding pill background */}
      <Animated.View style={[styles.tabPill, pillStyle]} pointerEvents="none" />

      {FILTERS.map((filter) => {
        const isActive = activeFilter === filter.key;
        const badge = getBadge(filter.key);

        return (
          <Pressable
            key={filter.key}
            accessibilityLabel={`Filtro ${filter.label}${badge ? `, ${badge} prenotazioni` : ""}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              tabLayouts.current[filter.key] = { x, width };
              if (Object.keys(tabLayouts.current).length === FILTERS.length) {
                setLayoutReady(true);
                const active = tabLayouts.current[activeFilter];
                if (active) {
                  pillX.value = active.x;
                  pillWidth.value = active.width;
                }
              }
            }}
            onPress={() => {
              if (!isActive) {
                // Trigger ripple on inactive tab press
                setRippleKey(filter.key);
                setTimeout(() => setRippleKey(null), 450);
              }
              onSelect(filter.key);
              movePillTo(filter.key);
            }}
            style={styles.tabItem}
          >
            {/* Ripple — only fires on inactive tab press */}
            <TabRipple visible={rippleKey === filter.key} />

            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {filter.label}
            </Text>
            {badge !== null && badge > 0 ? (
              <AnimatedBadge count={badge} isActive={isActive} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  isClient: boolean;
  onCTA: () => void;
  filterKey: FilterKey;
  primaryColor: string;
}

function EmptyState({ isClient, onCTA, filterKey, primaryColor }: EmptyStateProps) {
  const translateY = useSharedValue(24);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(60, withSpring(0, SPRING_GENTLE));
    opacity.value = withDelay(60, withTiming(1, { duration: 380 }));
  }, [opacity, translateY]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const isFiltered = filterKey !== "all";
  const title = isFiltered
    ? "Nessun risultato qui"
    : isClient
    ? "La tua casa ti aspetta"
    : "Nessuna richiesta ancora";

  const subtitle = isFiltered
    ? "Prova un altro filtro per vedere le tue prenotazioni."
    : isClient
    ? "Prenota il tuo primo servizio e lascia fare a noi il resto."
    : "Le richieste dei clienti appariranno qui non appena arrivano.";

  return (
    <Animated.View style={[styles.emptyState, containerStyle]}>
      <View style={styles.emptyLottieWrap}>
        <LottieView
          source={require("../../assets/lottie/cleaning.json")}
          autoPlay
          loop={true}
          style={styles.emptyLottie}
          resizeMode="contain"
          speed={0.85}
        />
      </View>

      <Text style={[styles.emptyTitle, { color: primaryColor }]}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>

      {isClient && !isFiltered ? (
        <View style={styles.emptyCTAWrap}>
          <AnimatedCTA
            onPress={onCTA}
            label="Trova un professionista"
            icon="sparkles-outline"
            accessibilityLabel="Cerca professionisti per prenotare un servizio"
            primaryColor={primaryColor}
          />
          <Text style={styles.emptyHint}>Migliaia di professionisti verificati in Italia</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

// ─── Booking card ─────────────────────────────────────────────────────────────

interface BookingCardProps {
  item: Booking;
  onPress: (bookingId: string) => void;
  onReview: (bookingId: string) => void;
  onConfirmWorkDone: (bookingId: string) => void;
  isClientView: boolean;
  theme: typeof CLEANER_THEME | typeof CLIENT_THEME;
}

const BookingCard = ({
  item,
  onPress,
  onReview,
  onConfirmWorkDone,
  isClientView,
  theme,
}: BookingCardProps) => {
  const statusCfg = getStatusConfig(item.status);
  // Resolve the "ROLE" placeholder for "accepted" status
  const resolvedStatusCfg: StatusConfig = {
    ...statusCfg,
    textColor: statusCfg.textColor === "ROLE" ? theme.secondary : statusCfg.textColor,
    bgColor: statusCfg.textColor === "ROLE" ? `${theme.secondary}15` : statusCfg.bgColor,
  };

  const isCompleted = item.status === "completed";
  const needsClientConfirm = isClientView && item.status === "work_done";

  const scale = useSharedValue(1);
  const cardAnimated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const initials = item.service_type
    ? item.service_type.slice(0, 2).toUpperCase()
    : "CL";

  const cardBaseStyle = isCompleted
    ? [styles.card, styles.cardCompleted]
    : styles.card;

  return (
    <Animated.View style={cardAnimated}>
      <Pressable
        onPress={() => onPress(item.id)}
        onPressIn={() => { scale.value = withSpring(0.97, SPRING_SNAPPY); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING_GENTLE); }}
        style={cardBaseStyle}
      >
        {/* ── Top row: avatar + name/rate + status badge ── */}
        <View style={styles.cardTopRow}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarFallback, { backgroundColor: theme.primaryContainer }]}>
              <Text style={[styles.avatarFallbackText, { color: theme.avatarFallbackText }]}>
                {initials}
              </Text>
            </View>
          </View>

          <View style={styles.cleanerInfo}>
            <Text style={[styles.cleanerName, { color: theme.primary }]} numberOfLines={1}>
              {item.service_type}
            </Text>
            <Text style={[styles.cleanerRate, { color: theme.secondary }]}>
              {item.total_price > 0 ? `€${item.total_price.toFixed(2)}` : "—"}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: resolvedStatusCfg.bgColor }]}>
            <Text style={[styles.statusBadgeText, { color: resolvedStatusCfg.textColor }]}>
              {resolvedStatusCfg.label}
            </Text>
          </View>
        </View>

        {/* ── Service type badge ── */}
        <View style={[styles.serviceTagWrap, { backgroundColor: theme.serviceTagBg }]}>
          <Text style={[styles.serviceTagText, { color: theme.secondary }]}>
            {getServiceLabel(item.service_type)}
          </Text>
        </View>

        {/* ── Meta rows ── */}
        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={C.onSurfaceVariant} />
            <Text style={[styles.metaText, isCompleted && styles.metaTextDim]}>
              {item.date}
              {item.time_slot ? ` · ${item.time_slot}` : ""}
            </Text>
          </View>

          {item.address ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={C.onSurfaceVariant} />
              <Text style={[styles.metaText, isCompleted && styles.metaTextDim]} numberOfLines={1}>
                {item.address}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Footer: price + action ── */}
        <View style={styles.cardFooter}>
          <Text style={[styles.priceText, { color: theme.primary }, isCompleted && styles.priceTextDim]}>
            €{item.total_price.toFixed(2)}
          </Text>

          {needsClientConfirm ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onConfirmWorkDone(item.id);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.confirmWorkBtn, { backgroundColor: theme.confirmWorkBg }]}
            >
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={styles.confirmWorkBtnText}>Conferma lavoro</Text>
            </Pressable>
          ) : isCompleted ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onReview(item.id);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.reviewLink, { color: theme.secondary }]}>Lascia Recensione</Text>
            </Pressable>
          ) : (
            <Ionicons name="chevron-forward" size={20} color={theme.primary} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ─── Custom refresh spinner overlay ──────────────────────────────────────────

interface RefreshSpinnerProps {
  refreshing: boolean;
  primaryColor: string;
}

function RefreshSpinner({ refreshing, primaryColor }: RefreshSpinnerProps) {
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (refreshing) {
      opacity.value = withTiming(1, { duration: 200 });
      rotation.value = withRepeat(
        withTiming(360, { duration: 800, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(rotation);
      opacity.value = withTiming(0, { duration: 200 });
      rotation.value = 0;
    }
  }, [refreshing, rotation, opacity]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    opacity: opacity.value,
  }));

  if (!refreshing) return null;

  return (
    <Animated.View style={[styles.refreshSpinnerWrap, spinStyle]}>
      <Ionicons name="reload-outline" size={22} color={primaryColor} />
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isCleaner = profile?.active_role === "cleaner";
  const isClientView = !isCleaner;
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  // ─── Role-based theme ───────────────────────────────────────────────────────
  const theme = useMemo(
    () => (isCleaner ? CLEANER_THEME : CLIENT_THEME),
    [isCleaner]
  );

  // ─── Entrance stagger: header → tabs → content ──────────────────────────────
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(-12);
  const tabsOpacity = useSharedValue(0);
  const tabsY = useSharedValue(8);
  const contentOpacity = useSharedValue(0);

  // ─── Parallax on header title ────────────────────────────────────────────────
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerParallaxStyle = useAnimatedStyle(() => {
    const translateY = interpolate(scrollY.value, [0, 80], [0, -4], "clamp");
    const scale = interpolate(scrollY.value, [0, 80], [1, 0.98], "clamp");
    return {
      transform: [{ translateY }, { scale }],
    };
  });

  const headerAnimStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));

  const tabsAnimStyle = useAnimatedStyle(() => ({
    opacity: tabsOpacity.value,
    transform: [{ translateY: tabsY.value }],
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const runEntranceAnimation = useCallback(() => {
    headerOpacity.value = withTiming(1, { duration: 320 });
    headerY.value = withSpring(0, SPRING_GENTLE);

    tabsOpacity.value = withDelay(80, withTiming(1, { duration: 280 }));
    tabsY.value = withDelay(80, withSpring(0, SPRING_GENTLE));

    contentOpacity.value = withDelay(160, withTiming(1, { duration: 300 }));
  }, [headerOpacity, headerY, tabsOpacity, tabsY, contentOpacity]);

  // ─── Data loading ────────────────────────────────────────────────────────────
  const loadBookings = useCallback(async () => {
    if (!user || !profile) return;
    try {
      const data = await fetchBookings(user.id, profile.active_role);
      setBookings(data);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  }, [loadBookings]);

  useEffect(() => {
    loadBookings();
    runEntranceAnimation();
  }, [loadBookings, runEntranceAnimation]);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  // ─── Navigation handlers ─────────────────────────────────────────────────────
  const handleBookingPress = useCallback(
    (bookingId: string) => {
      // Open booking detail — has chat shortcut + escrow action bar inside
      router.push(`/booking/${bookingId}` as never);
    },
    [router]
  );

  const handleReview = useCallback(
    (bookingId: string) => {
      router.push(`/review/${bookingId}`);
    },
    [router]
  );

  const handleConfirmWorkDone = useCallback(
    (bookingId: string) => {
      Alert.alert(
        "Confermare il lavoro?",
        "Confermando il lavoro rilasci il pagamento al professionista. Questa azione non può essere annullata.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Conferma",
            onPress: async () => {
              try {
                await confirmBookingCompletion(bookingId);
                setBookings((prev) =>
                  prev.map((b) =>
                    b.id === bookingId ? { ...b, status: "completed" } : b
                  )
                );
              } catch (e: any) {
                Alert.alert(
                  "Errore",
                  e?.message ?? "Impossibile confermare il lavoro. Riprova tra qualche secondo."
                );
              }
            },
          },
        ]
      );
    },
    [bookings]
  );

  // ─── Filtered data ───────────────────────────────────────────────────────────
  const filteredBookings =
    activeFilter === "all"
      ? bookings
      : activeFilter === "accepted"
      ? bookings.filter((b) => ["accepted", "work_done"].includes(b.status))
      : bookings.filter((b) => b.status === activeFilter);

  // ─── Header subtitle ─────────────────────────────────────────────────────────
  const activeCount = bookings.filter((b) =>
    ["accepted", "work_done"].includes(b.status)
  ).length;
  const completedCount = bookings.filter((b) => b.status === "completed").length;

  const headerSubtitle =
    bookings.length === 0
      ? isClientView
        ? "Inizia il tuo primo servizio"
        : "Le richieste appariranno qui"
      : [
          activeCount > 0 ? `${activeCount} ${activeCount === 1 ? "attiva" : "attive"}` : null,
          completedCount > 0 ? `${completedCount} completate` : null,
        ]
          .filter(Boolean)
          .join(" · ") || `${bookings.length} prenotazioni`;

  // ─── Render item ─────────────────────────────────────────────────────────────
  const renderBooking = useCallback(
    ({ item }: { item: Booking }) => (
      <BookingCard
        item={item}
        onPress={handleBookingPress}
        onReview={handleReview}
        onConfirmWorkDone={handleConfirmWorkDone}
        isClientView={isClientView}
        theme={theme}
      />
    ),
    [handleBookingPress, handleReview, handleConfirmWorkDone, isClientView, theme]
  );

  const keyExtractor = useCallback((item: Booking) => item.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<Booking> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT + SEPARATOR_HEIGHT,
      offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
      index,
    }),
    []
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.backgroundTint }]}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={theme.backgroundTint} />

      {/* ── Header — parallax on scroll ── */}
      <Animated.View style={[styles.header, headerAnimStyle]}>
        <View style={styles.headerRow}>
          <Animated.View style={[styles.headerTextBlock, headerParallaxStyle]}>
            <Text style={[styles.headerTitle, { color: theme.primary }]}>
              Le tue prenotazioni
            </Text>
            <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
          </Animated.View>
          <NotificationBell color={theme.primary} />
        </View>
      </Animated.View>

      {/* ── Animated pill filter tabs ── */}
      <Animated.View style={[styles.tabsWrapper, tabsAnimStyle]}>
        <FilterTabs
          activeFilter={activeFilter}
          onSelect={setActiveFilter}
          bookings={bookings}
          pillColor={theme.primary}
        />
      </Animated.View>

      {/* ── Content ── */}
      <Animated.View style={[styles.contentArea, contentAnimStyle]}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.secondary} />
            <Text style={styles.loadingText}>Caricamento prenotazioni…</Text>
          </View>
        ) : filteredBookings.length === 0 ? (
          <EmptyState
            isClient={isClientView}
            onCTA={() => router.push("/(tabs)/home" as never)}
            filterKey={activeFilter}
            primaryColor={theme.primary}
          />
        ) : (
          <>
            {/* Custom refresh indicator — sits above list, animated */}
            <RefreshSpinner refreshing={refreshing} primaryColor={theme.primary} />

            <Animated.FlatList
              data={filteredBookings}
              keyExtractor={keyExtractor}
              renderItem={renderBooking}
              getItemLayout={getItemLayout}
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              maxToRenderPerBatch={8}
              windowSize={5}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="transparent"
                  colors={["transparent"]}
                  style={{ backgroundColor: "transparent" }}
                />
              }
            />
          </>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: C.outline,
    fontWeight: "500",
  },
  separator: {
    height: SEPARATOR_HEIGHT,
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerTextBlock: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: C.outline,
    letterSpacing: 0.1,
  },

  // ── Animated pill tabs ────────────────────────────────────────────────────────
  tabsWrapper: {
    marginBottom: 8,
  },
  tabsContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 4,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: `${C.outlineVariant}22`,
  },
  tabPill: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 4,
    gap: 4,
    zIndex: 1,
    overflow: "hidden",
    borderRadius: 10,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: C.onSurfaceVariant,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: `${C.outlineVariant}55`,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: C.onSurfaceVariant,
  },
  tabBadgeTextActive: {
    color: "#ffffff",
  },
  ripple: {
    borderRadius: 10,
    backgroundColor: C.onSurface,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingBottom: 32,
    gap: 8,
  },
  emptyLottieWrap: {
    width: 220,
    height: 220,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLottie: {
    width: 220,
    height: 220,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
    fontFamily: "NotoSerif_700Bold",
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: C.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 260,
    marginBottom: 4,
  },
  emptyCTAWrap: {
    marginTop: 16,
    alignItems: "center",
    gap: 12,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.2,
  },
  emptyHint: {
    fontSize: 12,
    color: C.outline,
    textAlign: "center",
    letterSpacing: 0.1,
  },

  // ── Card ──────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
    borderWidth: 1,
    borderColor: `${C.outlineVariant}1A`,
    gap: 14,
  },
  cardCompleted: {
    backgroundColor: `${C.surfaceLow}80`,
    opacity: 0.9,
  },

  // Card top row
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    flexShrink: 0,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cleanerInfo: {
    flex: 1,
  },
  cleanerName: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 2,
  },
  cleanerRate: {
    fontSize: 13,
    fontWeight: "600",
  },
  statusBadge: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  // Service type badge
  serviceTagWrap: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  serviceTagText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },

  // Meta rows
  metaBlock: {
    gap: 7,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    fontWeight: "400",
    flex: 1,
  },
  metaTextDim: {
    opacity: 0.7,
  },

  // Card footer
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: `${C.outlineVariant}1A`,
  },
  priceText: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  priceTextDim: {
    opacity: 0.6,
  },
  reviewLink: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  confirmWorkBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 6,
  },
  confirmWorkBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 4,
  },

  // ── Refresh spinner ───────────────────────────────────────────────────────────
  refreshSpinnerWrap: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
});
