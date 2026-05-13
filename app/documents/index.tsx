import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { useStripeIdentity } from "@stripe/stripe-identity-react-native";
import type { IdentityVerificationSheetStatus } from "@stripe/stripe-identity-react-native";
import { useAuth } from "../../lib/auth";
import { useIdentityVerification } from "../../lib/hooks/useIdentityVerification";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateIT(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const FAQ_ITEMS = [
  {
    icon: "card-outline" as const,
    q: "Quali documenti posso usare?",
    a: "Puoi usare carta d'identità, passaporto o patente di guida. Il documento deve essere in corso di validità.",
  },
  {
    icon: "scan-outline" as const,
    q: "Come avviene la verifica?",
    a: "Stripe verifica automaticamente l'autenticità del documento e confronta il tuo selfie con la foto sul documento tramite liveness check.",
  },
  {
    icon: "timer-outline" as const,
    q: "Quanto tempo ci vuole?",
    a: "La verifica è generalmente automatica e richiede 2-5 minuti. In alcuni casi può richiedere fino a 24 ore per la revisione manuale.",
  },
  {
    icon: "lock-closed-outline" as const,
    q: "I miei dati sono al sicuro?",
    a: "Sì. I dati biometrici e i documenti sono trattati direttamente da Stripe nel rispetto del GDPR. CleanHome non accede mai alle immagini del tuo documento.",
  },
  {
    icon: "refresh-outline" as const,
    q: "Posso ripetere la verifica?",
    a: "Sì, se la verifica non va a buon fine puoi ripeterla in qualsiasi momento.",
  },
];

const BENEFITS = [
  {
    icon: "card-outline" as const,
    label: "Documento d'identità",
    sub: "Carta, passaporto o patente",
  },
  {
    icon: "camera-outline" as const,
    label: "Selfie con liveness check",
    sub: "Verifica rapida in tempo reale",
  },
  {
    icon: "checkmark-done-circle-outline" as const,
    label: "Verifica in 2-5 minuti",
    sub: "Automatica, verificato per sempre",
  },
];

const PROCESSING_MESSAGES = [
  "Stiamo analizzando il documento...",
  "Verifica del selfie in corso...",
  "Confronto dati biometrici...",
  "Quasi pronto, ancora un momento...",
];

// ─── Trust Badges ────────────────────────────────────────────────────────────

function TrustBadges() {
  return (
    <Animated.View
      entering={FadeInDown.delay(260).springify().damping(22)}
      style={styles.trustRow}
    >
      <View style={styles.trustChip}>
        <Ionicons name="shield-checkmark-outline" size={12} color={Colors.secondary} />
        <Text style={styles.trustChipText}>Stripe Identity</Text>
      </View>
      <View style={styles.trustChip}>
        <Ionicons name="lock-closed-outline" size={12} color={Colors.secondary} />
        <Text style={styles.trustChipText}>Crittografato</Text>
      </View>
      <View style={styles.trustChip}>
        <Ionicons name="document-text-outline" size={12} color={Colors.secondary} />
        <Text style={styles.trustChipText}>GDPR</Text>
      </View>
    </Animated.View>
  );
}

// ─── FAQ Modal ────────────────────────────────────────────────────────────────

function FaqAccordionItem({
  item,
  index,
}: {
  item: (typeof FAQ_ITEMS)[number];
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const rotation = useSharedValue(0);
  const height = useSharedValue(0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    rotation.value = withSpring(next ? 90 : 0, { damping: 18, stiffness: 200 });
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(22)}
      style={styles.faqAccordion}
    >
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.faqAccordionHeader,
          pressed && { opacity: 0.8 },
        ]}
        accessibilityRole="button"
      >
        <View style={styles.faqAccordionIconWrap}>
          <Ionicons name={item.icon} size={16} color={Colors.secondary} />
        </View>
        <Text style={styles.faqAccordionQ}>{item.q}</Text>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </Animated.View>
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn.duration(180)} style={styles.faqAccordionBody}>
          <Text style={styles.faqAccordionA}>{item.a}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function FaqModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.faqOverlay}>
        <Pressable style={styles.faqBackdrop} onPress={onClose} />
        <View style={styles.faqSheet}>
          <View style={styles.faqHandle} />
          <Text style={styles.faqTitle}>Come funziona la verifica?</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {FAQ_ITEMS.map((item, i) => (
              <FaqAccordionItem key={i} item={item} index={i} />
            ))}
          </ScrollView>
          <View style={styles.faqCloseBtn}>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Chiudi"
              accessibilityRole="button"
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={({ pressed }) => ({
                width: "100%",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 16,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={styles.faqCloseBtnText}>Chiudi</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Shield Glow Hero ────────────────────────────────────────────────────────

function ShieldHero() {
  const pulse = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);

  const shieldStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.heroIconContainer}>
      {/* Glow rings */}
      <Animated.View style={[styles.glowRing, styles.glowRingOuter, glowStyle]} />
      <Animated.View style={[styles.glowRing, styles.glowRingMid, glowStyle]} />
      {/* Shield */}
      <Animated.View style={[styles.shieldInner, shieldStyle]}>
        <Ionicons name="shield-checkmark" size={48} color={Colors.secondary} />
      </Animated.View>
    </View>
  );
}

// ─── Benefit Card ────────────────────────────────────────────────────────────

function BenefitCard({
  item,
  index,
}: {
  item: (typeof BENEFITS)[number];
  index: number;
}) {
  return (
    <Animated.View
      entering={FadeInRight.delay(200 + index * 80).springify().damping(22)}
      style={styles.benefitCard}
    >
      <View style={styles.benefitIconWrap}>
        <Ionicons name={item.icon} size={20} color={Colors.secondary} />
      </View>
      <View style={styles.benefitTextGroup}>
        <Text style={styles.benefitLabel}>{item.label}</Text>
        <Text style={styles.benefitSub}>{item.sub}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Premium CTA Button ───────────────────────────────────────────────────────

interface PremiumCtaProps {
  label: string;
  onPress: () => void;
  isLoading: boolean;
  iconName?: React.ComponentProps<typeof Ionicons>["name"];
  variant?: "primary" | "warning";
}

function PremiumCta({
  label,
  onPress,
  isLoading,
  iconName = "shield-checkmark",
  variant = "primary",
}: PremiumCtaProps) {
  const scale = useSharedValue(1);
  const iconScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 150 });
    iconScale.value = withSpring(0.9, { damping: 12, stiffness: 200 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
    iconScale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  const bgColor = variant === "warning" ? Colors.warning : Colors.secondary;
  const shadowColor = variant === "warning" ? Colors.warning : Colors.secondary;

  return (
    <Animated.View style={[styles.ctaWrapper, animatedStyle]}>
      <View
        style={[
          styles.ctaInner,
          { backgroundColor: bgColor, shadowColor },
          isLoading && styles.ctaDisabled,
        ]}
      >
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={label}
          android_ripple={{ color: "rgba(255,255,255,0.18)" }}
          style={({ pressed }) => ({
            width: "100%",
            height: "100%",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: Spacing.sm,
            opacity: isLoading ? 1 : pressed ? 0.92 : 1,
          })}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Animated.View style={iconAnimStyle}>
                <Ionicons name={iconName} size={22} color="#ffffff" />
              </Animated.View>
              <Text style={styles.ctaText}>{label}</Text>
            </>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ─── Rotating Processing Message ──────────────────────────────────────────────

function RotatingMessage() {
  const [msgIndex, setMsgIndex] = useState(0);
  const [displayed, setDisplayed] = useState(PROCESSING_MESSAGES[0]);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const interval = setInterval(() => {
      opacity.value = withTiming(0, { duration: 300 }, () => {
        runOnJS(setMsgIndex)((prev) => (prev + 1) % PROCESSING_MESSAGES.length);
        opacity.value = withTiming(1, { duration: 300 });
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setDisplayed(PROCESSING_MESSAGES[msgIndex]);
  }, [msgIndex]);

  const msgStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.Text style={[styles.processingRotMsg, msgStyle]}>{displayed}</Animated.Text>
  );
}

// ─── Processing Ring ─────────────────────────────────────────────────────────

function ProcessingRing() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.processingRingContainer}>
      <Animated.View style={[styles.processingRing, ringStyle]} />
      <View style={styles.processingRingCenter}>
        <Ionicons name="shield-checkmark-outline" size={32} color={Colors.secondary} />
      </View>
    </View>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────

function VerifiedCard({ verifiedAt }: { verifiedAt: string | null }) {
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.92);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    cardScale.value = withSpring(1, { damping: 20, stiffness: 180 });
    cardOpacity.value = withTiming(1, { duration: 300 });
    checkScale.value = withDelay(
      200,
      withSpring(1, { damping: 14, stiffness: 220 })
    );
    checkOpacity.value = withDelay(200, withTiming(1, { duration: 200 }));
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  return (
    <Animated.View style={[styles.verifiedCard, cardStyle]}>
      <Animated.View style={[styles.verifiedIconWrap, checkStyle]}>
        <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
      </Animated.View>
      <Text style={styles.verifiedTitle}>Identità verificata</Text>
      {verifiedAt ? (
        <View style={styles.verifiedDateRow}>
          <Ionicons name="calendar-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.verifiedDate}>Verificato il {formatDateIT(verifiedAt)}</Text>
        </View>
      ) : null}
      <Text style={styles.verifiedSub}>
        Sei pronto per ricevere pagamenti e prenotazioni su CleanHome.
      </Text>
      <View style={styles.verifiedBadge}>
        <Ionicons name="shield-checkmark-outline" size={12} color={Colors.success} />
        <Text style={styles.verifiedBadgeText}>Verifica Stripe · GDPR</Text>
      </View>
    </Animated.View>
  );
}

interface ProcessingCardProps {
  onRefresh: () => void;
  onRestart: () => void;
  isRefreshing: boolean;
  isRestarting: boolean;
}

function ProcessingCard({
  onRefresh,
  onRestart,
  isRefreshing,
  isRestarting,
}: ProcessingCardProps) {
  const [restartVisible, setRestartVisible] = useState(false);
  const restartOpacity = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRestartVisible(true);
      restartOpacity.value = withTiming(1, { duration: 400 });
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  const restartStyle = useAnimatedStyle(() => ({ opacity: restartOpacity.value }));

  const refreshScale = useSharedValue(1);
  const refreshAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: refreshScale.value }],
  }));

  const onRefreshPressIn = () =>
    (refreshScale.value = withSpring(0.97, { damping: 15, stiffness: 150 }));
  const onRefreshPressOut = () =>
    (refreshScale.value = withSpring(1, { damping: 15, stiffness: 150 }));

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(22)}
      style={styles.processingCard}
    >
      <ProcessingRing />
      <Text style={styles.processingTitle}>Verifica in corso</Text>
      <RotatingMessage />
      <Text style={styles.processingSub}>
        Riceverai una notifica appena completata.{"\n"}Di solito 2–5 minuti.
      </Text>
      <Animated.View style={[{ alignSelf: "stretch" }, refreshAnimStyle]}>
        <View style={[styles.processingRefreshBtn, isRefreshing && styles.ctaDisabled]}>
          <Pressable
            onPress={onRefresh}
            onPressIn={onRefreshPressIn}
            onPressOut={onRefreshPressOut}
            disabled={isRefreshing}
            accessibilityLabel="Aggiorna stato verifica"
            accessibilityRole="button"
            android_ripple={{ color: "rgba(255,255,255,0.18)" }}
            style={({ pressed }) => ({
              width: "100%",
              height: "100%",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: Spacing.sm,
              paddingHorizontal: Spacing.xl,
              opacity: isRefreshing ? 1 : pressed ? 0.92 : 1,
            })}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={16} color="#fff" />
                <Text style={styles.processingRefreshBtnText}>Aggiorna stato</Text>
              </>
            )}
          </Pressable>
        </View>
      </Animated.View>
      {restartVisible && (
        <Animated.View style={[{ alignSelf: "stretch" }, restartStyle]}>
          <Pressable
            style={[styles.processingRestartBtn, isRestarting && { opacity: 0.6 }]}
            onPress={onRestart}
            disabled={isRestarting}
            accessibilityLabel="Ricomincia la verifica identità"
            accessibilityRole="button"
          >
            {isRestarting ? (
              <ActivityIndicator size="small" color={Colors.textSecondary} />
            ) : (
              <Text style={styles.processingRestartBtnText}>Ricomincia verifica</Text>
            )}
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}

interface RequiresInputCardProps {
  lastError: string | null;
  onRetry: () => void;
  isLoading: boolean;
}

function RequiresInputCard({ lastError, onRetry, isLoading }: RequiresInputCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(20)}
      style={styles.requiresCard}
    >
      <View style={styles.requiresIconWrap}>
        <Ionicons name="alert-circle" size={44} color={Colors.warning} />
      </View>
      <Text style={styles.requiresTitle}>Quasi ci siamo</Text>
      <Text style={styles.requiresSub}>
        {lastError ??
          "Abbiamo bisogno di qualche informazione in più per completare la verifica. Riprova — richiede solo un minuto."}
      </Text>
      <View style={styles.requiresTipCard}>
        <Ionicons name="bulb-outline" size={14} color={Colors.secondary} />
        <Text style={styles.requiresTipText}>
          Assicurati di usare un documento chiaro e non scaduto.
        </Text>
      </View>
      <PremiumCta
        label="Riprova verifica"
        onPress={onRetry}
        isLoading={isLoading}
        iconName="refresh-outline"
        variant="warning"
      />
    </Animated.View>
  );
}

interface WelcomeContentProps {
  wasCanceled: boolean;
  onStart: () => void;
  isLoading: boolean;
  onFaq: () => void;
}

function WelcomeContent({
  wasCanceled,
  onStart,
  isLoading,
  onFaq,
}: WelcomeContentProps) {
  return (
    <>
      {/* Hero */}
      <Animated.View
        entering={FadeInDown.delay(60).springify().damping(22)}
        style={styles.heroBlock}
      >
        <ShieldHero />
        <View style={styles.heroTextGroup}>
          <Text style={styles.heroTitleLine1}>Verifica</Text>
          <Text style={styles.heroTitleLine2}>la tua identità</Text>
        </View>
        <Text style={styles.heroSub}>
          {wasCanceled
            ? "Hai annullato la verifica precedente. Ricomincia quando sei pronto."
            : "Pochi minuti, verificato per sempre. Richiesto per ricevere pagamenti dai clienti."}
        </Text>
      </Animated.View>

      {/* Benefits */}
      <View style={styles.benefitsSection}>
        {BENEFITS.map((b, i) => (
          <BenefitCard key={i} item={b} index={i} />
        ))}
      </View>

      {/* Trust badges */}
      <TrustBadges />

      {/* CTA */}
      <Animated.View
        entering={FadeInDown.delay(340).springify().damping(22)}
        style={styles.ctaSection}
      >
        <PremiumCta
          label="Inizia verifica"
          onPress={onStart}
          isLoading={isLoading}
          iconName="shield-checkmark"
          variant="primary"
        />
      </Animated.View>

      {/* FAQ link */}
      <Animated.View entering={FadeIn.delay(420).duration(400)}>
        <Pressable
          style={({ pressed }) => [styles.faqLink, pressed && { opacity: 0.7 }]}
          onPress={onFaq}
          accessibilityLabel="Come funziona la verifica? Apri FAQ"
          accessibilityRole="button"
        >
          <Ionicons name="help-circle-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.faqLinkText}>Come funziona la verifica?</Text>
        </Pressable>
      </Animated.View>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DocumentsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const {
    status,
    verifiedAt,
    lastError,
    isLoading,
    error,
    startVerification,
    refetch,
    syncFromStripe,
  } = useIdentityVerification(user?.id);

  const [sdkLoading, setSdkLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [faqVisible, setFaqVisible] = useState(false);

  // ⚠️ FIX: reset sdkLoading on mount per evitare bottone permanently
  // disabled se l'utente è uscito dall'app durante l'onboarding Stripe
  useEffect(() => {
    setSdkLoading(false);
  }, []);

  const optionsProvider = useCallback(async () => {
    const { sessionId, ephemeralKeySecret } = await startVerification();
    return {
      sessionId,
      ephemeralKeySecret,
      brandLogo: Image.resolveAssetSource(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../../assets/icon.png")
      ),
    };
  }, [startVerification]);

  const {
    present,
    loading: sdkPresenting,
    status: sdkStatus,
  } = useStripeIdentity(optionsProvider);

  const isCtaLoading = sdkLoading || sdkPresenting;

  const handleStartVerification = useCallback(async () => {
    if (isCtaLoading) return;
    setSdkLoading(true);
    try {
      await present();
      await refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore durante la verifica";
      Alert.alert("Errore", msg);
    } finally {
      setSdkLoading(false);
    }
  }, [isCtaLoading, present, refetch]);

  // "Aggiorna stato" now syncs directly with Stripe API instead of just rereading
  // the DB. This resolves stuck "processing" states when the webhook hasn't arrived yet.
  const handleRefetch = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await syncFromStripe();
    } catch {
      // Fallback to a plain DB read if the Stripe sync call fails
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [syncFromStripe, refetch]);

  // Auto-sync on mount when status is stuck in "processing" and the DB row
  // hasn't been updated in the last 30 seconds (likely a stale webhook state).
  const autoSyncDoneRef = useRef(false);
  useEffect(() => {
    if (!isLoading && status === "processing" && !autoSyncDoneRef.current) {
      autoSyncDoneRef.current = true;
      syncFromStripe().catch(() => {
        // Silently ignore — the manual "Aggiorna stato" button remains available
      });
    }
  }, [isLoading, status, syncFromStripe]);

  const handleFaqOpen = useCallback(() => setFaqVisible(true), []);
  const handleFaqClose = useCallback(() => setFaqVisible(false), []);

  const wasCanceled =
    status === "canceled" ||
    (sdkStatus as IdentityVerificationSheetStatus | undefined) === "FlowCanceled";

  const renderMainContent = () => {
    if (isLoading) {
      return (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.loadingBlock}
        >
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.loadingText}>Caricamento stato verifica...</Text>
        </Animated.View>
      );
    }
    if (error) {
      return (
        <Animated.View
          entering={FadeInDown.springify().damping(20)}
          style={styles.errorBlock}
        >
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle" size={40} color={Colors.error} />
          </View>
          <Text style={styles.errorTitle}>Qualcosa è andato storto</Text>
          <Text style={styles.errorText}>{error.message}</Text>
          <Pressable
            style={({ pressed }) => [styles.retrySmall, pressed && { opacity: 0.8 }]}
            onPress={refetch}
            accessibilityRole="button"
            accessibilityLabel="Riprova caricamento"
          >
            <Ionicons name="refresh-outline" size={14} color={Colors.error} />
            <Text style={styles.retrySmallText}>Riprova</Text>
          </Pressable>
        </Animated.View>
      );
    }
    if (status === "verified") return <VerifiedCard verifiedAt={verifiedAt} />;
    if (status === "processing") {
      return (
        <ProcessingCard
          onRefresh={handleRefetch}
          onRestart={handleStartVerification}
          isRefreshing={isRefreshing}
          isRestarting={isCtaLoading}
        />
      );
    }
    if (status === "requires_input") {
      return (
        <RequiresInputCard
          lastError={lastError}
          onRetry={handleStartVerification}
          isLoading={isCtaLoading}
        />
      );
    }
    return (
      <WelcomeContent
        wasCanceled={wasCanceled}
        onStart={handleStartVerification}
        isLoading={isCtaLoading}
        onFaq={handleFaqOpen}
      />
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Verifica identità</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderMainContent()}
        {status !== "verified" && !isLoading && (
          <Animated.View
            entering={FadeIn.delay(500).duration(400)}
            style={styles.footer}
          >
            <Ionicons name="lock-closed" size={10} color={Colors.textTertiary} />
            <Text style={styles.footerText}>Powered by Stripe · GDPR compliant</Text>
          </Animated.View>
        )}
      </ScrollView>
      <FaqModal visible={faqVisible} onClose={handleFaqClose} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: -0.2,
  },

  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },

  loadingBlock: {
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  loadingText: { fontSize: 14, color: Colors.textSecondary },

  errorBlock: {
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    ...Shadows.md,
  },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.errorLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.3,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  retrySmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorLight,
    marginTop: Spacing.xs,
  },
  retrySmallText: { fontSize: 14, fontWeight: "700", color: Colors.error },

  // ─── Hero ───────────────────────────────────────────────────────────────────

  heroBlock: {
    alignItems: "center",
    gap: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  heroIconContainer: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  glowRing: {
    position: "absolute",
    borderRadius: 9999,
    backgroundColor: Colors.accentLight,
  },
  glowRingOuter: {
    width: 120,
    height: 120,
    opacity: 0.6,
  },
  glowRingMid: {
    width: 88,
    height: 88,
    backgroundColor: Colors.accentLight,
    opacity: 0.9,
  },
  shieldInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
  heroTextGroup: {
    alignItems: "center",
    gap: 0,
  },
  heroTitleLine1: {
    fontSize: 38,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -1.5,
    lineHeight: 42,
    fontFamily: "NotoSerif_700Bold",
  },
  heroTitleLine2: {
    fontSize: 38,
    fontWeight: "800",
    color: Colors.secondary,
    textAlign: "center",
    letterSpacing: -1.5,
    lineHeight: 44,
    fontFamily: "NotoSerif_700Bold",
  },
  heroSub: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 23,
    paddingHorizontal: Spacing.md,
  },

  // ─── Benefits ────────────────────────────────────────────────────────────────

  benefitsSection: {
    gap: Spacing.sm,
  },
  benefitCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  benefitIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  benefitTextGroup: { flex: 1, gap: 2 },
  benefitLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.1,
  },
  benefitSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },

  // ─── Trust badges ────────────────────────────────────────────────────────────

  trustRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  trustChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  trustChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.secondary,
    letterSpacing: 0.1,
  },

  // ─── CTA ─────────────────────────────────────────────────────────────────────

  ctaSection: { gap: Spacing.sm },
  ctaWrapper: { alignSelf: "stretch" },
  ctaInner: {
    borderRadius: Radius.lg,
    height: 60,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: "hidden",
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.2,
    includeFontPadding: false,
  },

  // ─── FAQ link ────────────────────────────────────────────────────────────────

  faqLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  faqLinkText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },

  // ─── Verified card ───────────────────────────────────────────────────────────

  verifiedCard: {
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1.5,
    borderColor: Colors.success,
    ...Shadows.md,
  },
  verifiedIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.successLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  verifiedTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -0.5,
    fontFamily: "NotoSerif_700Bold",
  },
  verifiedDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  verifiedDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  verifiedSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.full,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.success,
    letterSpacing: 0.2,
  },

  // ─── Processing card ─────────────────────────────────────────────────────────

  processingCard: {
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.md,
  },
  processingRingContainer: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  processingRing: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: Colors.accent,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
  },
  processingRingCenter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  processingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -0.4,
    fontFamily: "NotoSerif_700Bold",
  },
  processingRotMsg: {
    fontSize: 14,
    color: Colors.secondary,
    textAlign: "center",
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  processingSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  processingRefreshBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    marginTop: Spacing.xs,
    height: 48,
    overflow: "hidden",
    ...Shadows.sm,
  },
  processingRefreshBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  processingRestartBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    paddingVertical: 11,
    paddingHorizontal: Spacing.xl,
    height: 44,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  processingRestartBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },

  // ─── Requires input card ──────────────────────────────────────────────────────

  requiresCard: {
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.warningLight,
    ...Shadows.md,
  },
  requiresIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.warningLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  requiresTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -0.4,
    fontFamily: "NotoSerif_700Bold",
  },
  requiresSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  requiresTipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignSelf: "stretch",
  },
  requiresTipText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // ─── Footer ───────────────────────────────────────────────────────────────────

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: Spacing.xs,
  },
  footerText: { fontSize: 11, color: Colors.textTertiary },

  // ─── FAQ Sheet ────────────────────────────────────────────────────────────────

  faqOverlay: { flex: 1, justifyContent: "flex-end" },
  faqBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,36,32,0.45)",
  },
  faqSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.xl,
    paddingBottom: 40,
    maxHeight: "82%",
    gap: Spacing.md,
    ...Shadows.lg,
  },
  faqHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  faqTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: -0.4,
    fontFamily: "NotoSerif_700Bold",
    marginBottom: Spacing.xs,
  },
  faqAccordion: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.lg,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  faqAccordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.base,
  },
  faqAccordionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    ...Shadows.sm,
  },
  faqAccordionQ: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
    lineHeight: 18,
  },
  faqAccordionBody: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
    paddingTop: 0,
  },
  faqAccordionA: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  faqCloseBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 52,
    marginTop: Spacing.xs,
    overflow: "hidden",
  },
  faqCloseBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.1,
  },
});
