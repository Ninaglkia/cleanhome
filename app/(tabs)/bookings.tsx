import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Alert,
  RefreshControl,
  Linking,
} from "react-native";
import { Pressable } from "../../components/ui/AppPressable";
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
} from "react-native-reanimated";
import LottieView from "lottie-react-native";
import { useAuth } from "../../lib/auth";
import {
  fetchBookings,
  confirmBookingCompletion,
  fetchPendingOffersForCleaner,
  cleanerOfferAction,
} from "../../lib/api";
import { Booking, BookingOffer } from "../../lib/types";
import { NotificationBell } from "../../components/NotificationBell";
import { MarkDoneModal } from "../../components/escrow/MarkDoneModal";
import {
  startLocationBroadcast,
  TrackingSession,
} from "../../lib/realtime-tracking";
import {
  NotificationMessages,
  sendPushNotification,
} from "../../lib/notifications";

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
          <Text style={styles.emptyHint}>Professionisti verificati nella tua zona</Text>
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
  onMarkDone?: (bookingId: string) => void;
  onStartTracking?: (bookingId: string) => void;
  onStopTracking?: (bookingId: string) => void;
  isBroadcasting?: boolean;
  isTrackingLoading?: boolean;
  isClientView: boolean;
  theme: typeof CLEANER_THEME | typeof CLIENT_THEME;
}

const BookingCard = ({
  item,
  onPress,
  onReview,
  onConfirmWorkDone,
  onMarkDone,
  onStartTracking,
  onStopTracking,
  isBroadcasting = false,
  isTrackingLoading = false,
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
  const canCleanerMarkDone = !isClientView && item.status === "accepted" && !!onMarkDone;
  const isWaitingConfirm = !isClientView && item.status === "work_done";

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
              {item.booking_date}
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

        {/* ── Cleaner: location tracking banner ── */}
        {canCleanerMarkDone && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            {isBroadcasting
              ? <><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" }} /><Text style={{ fontSize: 12, fontWeight: "700", color: "#16a34a" }}>Condivisione posizione attiva</Text></>
              : <Text style={{ fontSize: 12, color: C.outline }}>Posizione non condivisa</Text>
            }
          </View>
        )}

        {/* ── Cleaner: travel + mark-done actions ── */}
        {isWaitingConfirm ? (
          <View style={[styles.cleanerWaitBanner]}>
            <Ionicons name="time-outline" size={14} color={C.amber700} />
            <Text style={{ fontSize: 13, color: C.amber700, marginLeft: 6, fontWeight: "600" }}>In attesa di conferma cliente</Text>
          </View>
        ) : canCleanerMarkDone ? (
          <View style={{ gap: 8 }}>
            {!isBroadcasting ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sono in viaggio"
                disabled={isTrackingLoading}
                onPress={() => onStartTracking?.(item.id)}
                style={({ pressed }) => [styles.travelBtn, { borderColor: theme.secondary }, (pressed || isTrackingLoading) && { opacity: 0.7 }]}
              >
                {isTrackingLoading ? <ActivityIndicator size="small" color={theme.secondary} /> : (
                  <><Ionicons name="navigate" size={16} color={theme.secondary} /><Text style={[styles.travelBtnText, { color: theme.secondary }]}>Sono in viaggio</Text></>
                )}
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Arrivato — ferma posizione"
                disabled={isTrackingLoading}
                onPress={() => onStopTracking?.(item.id)}
                style={({ pressed }) => [styles.arrivedBtn, { backgroundColor: theme.secondary }, (pressed || isTrackingLoading) && { opacity: 0.7 }]}
              >
                {isTrackingLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                  <><Ionicons name="checkmark-circle" size={16} color="#fff" /><Text style={styles.arrivedBtnText}>Arrivato — ferma posizione</Text></>
                )}
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Segna completato"
              onPress={() => onMarkDone?.(item.id)}
              style={({ pressed }) => [styles.markDoneBtn, { backgroundColor: theme.secondary }, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.markDoneBtnText}>Segna completato</Text>
              <Ionicons name="checkmark" size={15} color="#fff" />
            </Pressable>
          </View>
        ) : null}

        {/* ── Footer: price + action ── */}
        <View style={styles.cardFooter}>
          <Text style={[styles.priceText, { color: theme.primary }, isCompleted && styles.priceTextDim]}>
            €{(item.total_price ?? 0).toFixed(2)}
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
          ) : isCompleted && isClientView ? (
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
  const [hasError, setHasError] = useState(false);
  const isCleaner = profile?.active_role === "cleaner";
  const isClientView = !isCleaner;
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  // ─── Cleaner-only: pending dispatch offers ────────────────────────────────
  const [pendingOffers, setPendingOffers] = useState<BookingOffer[]>([]);
  const [actingOfferId, setActingOfferId] = useState<string | null>(null);

  // ─── Cleaner-only: MarkDoneModal ─────────────────────────────────────────
  const [markDoneBookingId, setMarkDoneBookingId] = useState<string | null>(null);

  // ─── Cleaner-only: live location tracking ────────────────────────────────
  const [broadcastingIds, setBroadcastingIds] = useState<Set<string>>(new Set());
  const [trackingLoadingId, setTrackingLoadingId] = useState<string | null>(null);
  const sessionsRef = useRef<Record<string, TrackingSession>>({});

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
      setHasError(false);
      if (profile.active_role === "cleaner") {
        const [data, offers] = await Promise.all([
          fetchBookings(user.id, "cleaner"),
          fetchPendingOffersForCleaner(user.id),
        ]);
        setBookings(data);
        const now = Date.now();
        setPendingOffers(
          offers.filter(
            (o) => o.booking != null && new Date(o.expires_at).getTime() > now
          )
        );
      } else {
        const data = await fetchBookings(user.id, profile.active_role);
        setBookings(data);
      }
    } catch {
      // Keep stale bookings visible — surface a retryable error instead of a
      // misleading "zero bookings" empty state on network failure.
      setHasError(true);
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

  // Mutex against double-tap on the Alert "Conferma" button.
  // Set when we start the network call, cleared when it resolves/rejects.
  // Without this guard, two rapid taps fire two parallel confirmBookingCompletion
  // calls — and although the server enforces atomic claim, the optimistic UI
  // update can show "completed" before the server's idempotency check returns,
  // confusing the user.
  const confirmingRef = useRef<Set<string>>(new Set());

  const handleConfirmWorkDone = useCallback(
    (bookingId: string) => {
      if (confirmingRef.current.has(bookingId)) return;
      Alert.alert(
        "Confermare il lavoro?",
        "Confermando il lavoro rilasci il pagamento al professionista. Questa azione non può essere annullata.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Conferma",
            onPress: async () => {
              if (confirmingRef.current.has(bookingId)) return;
              confirmingRef.current.add(bookingId);
              try {
                await confirmBookingCompletion(bookingId);
                setBookings((prev) =>
                  prev.map((b) =>
                    b.id === bookingId ? { ...b, status: "completed" } : b
                  )
                );
              } catch (e: unknown) {
                Alert.alert(
                  "Errore",
                  e instanceof Error ? e.message : "Impossibile confermare il lavoro. Riprova tra qualche secondo."
                );
              } finally {
                confirmingRef.current.delete(bookingId);
              }
            },
          },
        ]
      );
    },
    []
  );

  // ─── Cleaner: offer accept/decline ───────────────────────────────────────────
  const handleAcceptOffer = useCallback(
    async (offerId: string, bookingId: string) => {
      setActingOfferId(offerId);
      try {
        const result = await cleanerOfferAction(bookingId, "accept");
        if (result.ok) {
          setPendingOffers((prev) => prev.filter((o) => o.id !== offerId));
          loadBookings();
          Alert.alert("Incarico accettato", "Trovi i dettagli nella sezione Attive.");
        } else if (result.error === "already_taken") {
          setPendingOffers((prev) => prev.filter((o) => o.id !== offerId));
          Alert.alert(
            "Incarico non disponibile",
            "Un altro professionista ha già accettato questa richiesta."
          );
        } else {
          Alert.alert("Errore", result.error ?? "Impossibile accettare l'incarico. Riprova.");
        }
      } catch (err) {
        Alert.alert(
          "Errore",
          err instanceof Error ? err.message : "Impossibile accettare l'incarico."
        );
      } finally {
        setActingOfferId(null);
      }
    },
    [loadBookings]
  );

  const handleDeclineOffer = useCallback(
    (offerId: string, bookingId: string) => {
      Alert.alert(
        "Rifiutare l'incarico?",
        "Non potrai più accettarlo in seguito.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Rifiuta",
            style: "destructive",
            onPress: async () => {
              setActingOfferId(offerId);
              try {
                await cleanerOfferAction(bookingId, "decline");
                setPendingOffers((prev) => prev.filter((o) => o.id !== offerId));
              } catch (err) {
                Alert.alert(
                  "Errore",
                  err instanceof Error ? err.message : "Impossibile rifiutare l'incarico."
                );
              } finally {
                setActingOfferId(null);
              }
            },
          },
        ]
      );
    },
    []
  );

  // ─── Cleaner: location tracking ───────────────────────────────────────────────
  const handleStartTracking = useCallback(async (id: string) => {
    if (sessionsRef.current[id]) return;
    setTrackingLoadingId(id);
    try {
      const session = await startLocationBroadcast(id);
      sessionsRef.current[id] = session;
      setBroadcastingIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const permissionDenied = /permess|negato/i.test(msg);
      if (permissionDenied) {
        Alert.alert(
          "Posizione disattivata",
          "Per far vedere al cliente il tuo arrivo in tempo reale, consenti l'accesso alla posizione nelle impostazioni.",
          [
            { text: "Annulla", style: "cancel" },
            { text: "Apri impostazioni", onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert("Impossibile condividere la posizione", "Controlla la connessione e riprova.");
      }
    } finally {
      setTrackingLoadingId(null);
    }
  }, []);

  const handleStopTracking = useCallback(async (id: string) => {
    setTrackingLoadingId(id);
    try {
      await sessionsRef.current[id]?.stop();
    } catch {
      // ignore — drop locally regardless
    }
    delete sessionsRef.current[id];
    setBroadcastingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setTrackingLoadingId(null);
  }, []);

  // Stop tracking for jobs that are no longer "accepted"
  useEffect(() => {
    if (!isCleaner) return;
    const acceptedIds = new Set(
      bookings.filter((b) => b.status === "accepted").map((b) => b.id)
    );
    Object.keys(sessionsRef.current).forEach((id) => {
      if (!acceptedIds.has(id)) {
        sessionsRef.current[id]?.stop().catch(() => {});
        delete sessionsRef.current[id];
        setBroadcastingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }, [bookings, isCleaner]);

  // Tear down on unmount
  useEffect(() => {
    return () => {
      Object.values(sessionsRef.current).forEach((s) => s.stop().catch(() => {}));
      sessionsRef.current = {};
    };
  }, []);

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
    bookings.length === 0 && pendingOffers.length === 0
      ? isClientView
        ? "Inizia il tuo primo servizio"
        : "Le richieste appariranno qui"
      : [
          !isClientView && pendingOffers.length > 0
            ? `${pendingOffers.length} ${pendingOffers.length === 1 ? "offerta" : "offerte"} in attesa`
            : null,
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
        onMarkDone={isCleaner ? (id) => setMarkDoneBookingId(id) : undefined}
        onStartTracking={isCleaner ? handleStartTracking : undefined}
        onStopTracking={isCleaner ? handleStopTracking : undefined}
        isBroadcasting={isCleaner ? broadcastingIds.has(item.id) : false}
        isTrackingLoading={isCleaner ? trackingLoadingId === item.id : false}
        isClientView={isClientView}
        theme={theme}
      />
    ),
    [handleBookingPress, handleReview, handleConfirmWorkDone, isCleaner, handleStartTracking, handleStopTracking, broadcastingIds, trackingLoadingId, isClientView, theme]
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
              {isCleaner ? "I tuoi incarichi" : "Le tue prenotazioni"}
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
        ) : hasError && filteredBookings.length === 0 ? (
          // Full-screen error only when there's nothing cached to show.
          // If we already have bookings, we keep the list visible and let
          // pull-to-refresh act as the retry path (stale data > blank screen).
          <View style={styles.errorState}>
            <View style={styles.errorIconWrap}>
              <Ionicons name="cloud-offline-outline" size={36} color={C.outline} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.primary }]}>Errore di rete</Text>
            <Text style={styles.emptySubtitle}>
              Impossibile caricare le prenotazioni. Controlla la connessione e riprova.
            </Text>
            <Pressable
              onPress={loadBookings}
              accessibilityRole="button"
              accessibilityLabel="Riprova caricamento prenotazioni"
              style={({ pressed }) => [
                styles.retryBtn,
                { backgroundColor: theme.secondary },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.retryBtnText}>Riprova</Text>
            </Pressable>
          </View>
        ) : filteredBookings.length === 0 && (isClientView || (activeFilter !== "all" && activeFilter !== "pending") || pendingOffers.length === 0) ? (
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
              ListHeaderComponent={
                isCleaner && pendingOffers.length > 0 && (activeFilter === "all" || activeFilter === "pending")
                  ? () => (
                      <View>
                        {pendingOffers.map((offer) => {
                          const bk = offer.booking;
                          if (!bk) return null;
                          const earnings = ((bk.base_price ?? 0) - (bk.cleaner_fee ?? 0)).toFixed(2);
                          const minsLeft = Math.max(0, Math.round((new Date(offer.expires_at).getTime() - Date.now()) / 60_000));
                          const expiresLabel = minsLeft <= 0 ? "Scaduta" : minsLeft < 60 ? `Scade tra ${minsLeft} min` : `Scade tra ${Math.round(minsLeft / 60)}h`;
                          const isActing = actingOfferId === offer.id;
                          return (
                            <View key={offer.id} style={styles.offerCard}>
                              <View style={styles.offerExpiryRow}>
                                <View style={styles.offerExpiryBadge}>
                                  <Ionicons name="time-outline" size={12} color={theme.secondary} />
                                  <Text style={[styles.offerExpiryText, { color: theme.secondary }]}>{expiresLabel}</Text>
                                </View>
                                <View style={[styles.offerEarningsBadge, { backgroundColor: `${theme.secondary}15` }]}>
                                  <Text style={[styles.offerEarningsText, { color: theme.secondary }]}>€{earnings}</Text>
                                </View>
                              </View>
                              <View style={styles.offerTitleRow}>
                                <View style={[styles.offerIconWrap, { backgroundColor: `${theme.secondary}15` }]}>
                                  <Ionicons name="briefcase-outline" size={20} color={theme.secondary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.offerTitle, { color: theme.primary }]} numberOfLines={1}>{bk.service_type}</Text>
                                  <Text style={[styles.offerSubtitle, { color: theme.secondary }]}>Richiesta in attesa</Text>
                                </View>
                              </View>
                              {bk.address ? (
                                <View style={styles.offerDetailRow}>
                                  <Ionicons name="location-outline" size={13} color={C.onSurfaceVariant} />
                                  <Text style={styles.offerDetailText} numberOfLines={1}>{bk.address}</Text>
                                </View>
                              ) : null}
                              {bk.booking_date ? (
                                <View style={styles.offerDetailRow}>
                                  <Ionicons name="calendar-outline" size={13} color={C.onSurfaceVariant} />
                                  <Text style={styles.offerDetailText}>{bk.booking_date}{bk.time_slot ? ` · ${bk.time_slot}` : ""}</Text>
                                </View>
                              ) : null}
                              <View style={styles.offerActionsRow}>
                                <Pressable
                                  style={({ pressed }) => [styles.offerDeclineBtn, { borderColor: theme.secondary }, (pressed || isActing) && { opacity: 0.6 }]}
                                  disabled={isActing}
                                  onPress={() => handleDeclineOffer(offer.id, offer.booking_id)}
                                  accessibilityRole="button"
                                  accessibilityLabel="Rifiuta incarico"
                                >
                                  {isActing ? <ActivityIndicator size="small" color={theme.secondary} /> : (
                                    <>
                                      <Ionicons name="close" size={16} color={theme.secondary} />
                                      <Text style={[styles.offerDeclineBtnText, { color: theme.secondary }]}>Rifiuta</Text>
                                    </>
                                  )}
                                </Pressable>
                                <Pressable
                                  style={({ pressed }) => [styles.offerAcceptBtn, { backgroundColor: theme.secondary }, (pressed || isActing) && { opacity: 0.6 }]}
                                  disabled={isActing}
                                  onPress={() => handleAcceptOffer(offer.id, offer.booking_id)}
                                  accessibilityRole="button"
                                  accessibilityLabel="Accetta incarico"
                                >
                                  {isActing ? <ActivityIndicator size="small" color="#fff" /> : (
                                    <>
                                      <Ionicons name="checkmark" size={16} color="#fff" />
                                      <Text style={styles.offerAcceptBtnText}>Accetta</Text>
                                    </>
                                  )}
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )
                  : undefined
              }
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

      {/* MarkDoneModal — cleaner photo-based work completion */}
      {markDoneBookingId != null && (
        <MarkDoneModal
          visible={true}
          bookingId={markDoneBookingId}
          onClose={() => setMarkDoneBookingId(null)}
          onSuccess={() => {
            setMarkDoneBookingId(null);
            loadBookings();
          }}
        />
      )}
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

  // ── Error state ─────────────────────────────────────────────────────────────
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingBottom: 32,
    gap: 8,
  },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 9999,
    paddingVertical: 11,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
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

  // ── Offer card (cleaner dispatch offers) ─────────────────────────────────────
  offerCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "rgba(0,107,85,0.18)",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  offerExpiryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  offerExpiryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,107,85,0.08)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  offerExpiryText: {
    fontSize: 11,
    fontWeight: "600",
  },
  offerEarningsBadge: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  offerEarningsText: {
    fontSize: 15,
    fontWeight: "800",
  },
  offerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  offerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  offerTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  offerSubtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  offerDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 4,
  },
  offerDetailText: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    flex: 1,
  },
  offerActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  offerDeclineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  offerDeclineBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  offerAcceptBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  offerAcceptBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },

  // ── Cleaner job actions ───────────────────────────────────────────────────────
  cleanerWaitBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.amber50,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  travelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  travelBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  arrivedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  arrivedBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  markDoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  markDoneBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
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
