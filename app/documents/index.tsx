import { useCallback, useEffect, useState } from "react";
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
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useStripeIdentity } from "@stripe/stripe-identity-react-native";
import type { IdentityVerificationSheetStatus } from "@stripe/stripe-identity-react-native";
import { useAuth } from "../../lib/auth";
import { useIdentityVerification } from "../../lib/hooks/useIdentityVerification";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateIT(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}


// ─── FAQ Modal ────────────────────────────────────────────────────────────────

function FaqModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.faqOverlay}>
        <Pressable style={styles.faqBackdrop} onPress={onClose} />
        <View style={styles.faqSheet}>
          <View style={styles.faqHandle} />
          <Text style={styles.faqTitle}>Come funziona la verifica?</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {FAQ_ITEMS.map((item, i) => (
              <View key={i} style={styles.faqItem}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}
          </ScrollView>
          <Pressable
            style={({ pressed }) => [
              styles.faqCloseBtn,
              pressed && { opacity: 0.85 },
            ]}
            onPress={onClose}
            accessibilityLabel="Chiudi"
            accessibilityRole="button"
          >
            <Text style={styles.faqCloseBtnText}>Chiudi</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const FAQ_ITEMS = [
  {
    q: "Quali documenti posso usare?",
    a: "Puoi usare carta d'identità, passaporto o patente di guida. Il documento deve essere in corso di validità.",
  },
  {
    q: "Come avviene la verifica?",
    a: "Stripe verifica automaticamente l'autenticità del documento e confronta il tuo selfie con la foto sul documento tramite liveness check.",
  },
  {
    q: "Quanto tempo ci vuole?",
    a: "La verifica è generalmente automatica e richiede 2-5 minuti. In alcuni casi può richiedere fino a 24 ore per la revisione manuale.",
  },
  {
    q: "I miei dati sono al sicuro?",
    a: "Sì. I dati biometrici e i documenti sono trattati direttamente da Stripe nel rispetto del GDPR. CleanHome non accede mai alle immagini del tuo documento.",
  },
  {
    q: "Posso ripetere la verifica?",
    a: "Sì, se la verifica non va a buon fine puoi ripeterla in qualsiasi momento.",
  },
];

// ─── Animated pulse for processing state ─────────────────────────────────────

function PulsingDot() {
  const opacity = useSharedValue(1);
  opacity.value = withRepeat(
    withSequence(
      withTiming(0.3, { duration: 600 }),
      withTiming(1, { duration: 600 })
    ),
    -1,
    false
  );
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.pulsingDot, animStyle]} />
  );
}

// ─── State-specific content components ────────────────────────────────────────

function VerifiedCard({ verifiedAt }: { verifiedAt: string | null }) {
  return (
    <Animated.View entering={FadeInDown.springify().damping(20)}>
      <View style={styles.verifiedCard}>
        <View style={styles.verifiedIconWrap}>
          <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
        </View>
        <Text style={styles.verifiedTitle}>Identità verificata</Text>
        {verifiedAt ? (
          <Text style={styles.verifiedDate}>
            Verificato il {formatDateIT(verifiedAt)}
          </Text>
        ) : null}
        <Text style={styles.verifiedSub}>
          Sei pronto per ricevere pagamenti e prenotazioni.
        </Text>
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

  useEffect(() => {
    const timer = setTimeout(() => setRestartVisible(true), 15000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View entering={FadeInDown.springify().damping(20)}>
      <View style={styles.processingCard}>
        <View style={styles.processingIconRow}>
          <PulsingDot />
          <ActivityIndicator size="small" color={Colors.secondary} />
          <PulsingDot />
        </View>
        <Text style={styles.processingTitle}>Verifica in corso...</Text>
        <Text style={styles.processingSub}>
          Stiamo controllando i tuoi dati. Riceverai una notifica appena pronto.{"\n"}
          (di solito 2-5 minuti)
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.processingRefreshBtn,
            pressed && { opacity: 0.85 },
          ]}
          onPress={onRefresh}
          disabled={isRefreshing}
          accessibilityLabel="Aggiorna stato verifica"
          accessibilityRole="button"
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={Colors.secondary} />
          ) : (
            <Text style={styles.processingRefreshBtnText}>Aggiorna stato</Text>
          )}
        </Pressable>

        {restartVisible && (
          <Animated.View entering={FadeInDown.springify().damping(20)}>
            <Pressable
              style={({ pressed }) => [
                styles.processingRestartBtn,
                pressed && { opacity: 0.75 },
              ]}
              onPress={onRestart}
              disabled={isRestarting}
              accessibilityLabel="Ricomincia la verifica identità"
              accessibilityRole="button"
            >
              {isRestarting ? (
                <ActivityIndicator size="small" color={Colors.textSecondary} />
              ) : (
                <Text style={styles.processingRestartBtnText}>
                  Ricomincia verifica
                </Text>
              )}
            </Pressable>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

interface RequiresInputCardProps {
  lastError: string | null;
  onRetry: () => void;
  isLoading: boolean;
}

function RequiresInputCard({
  lastError,
  onRetry,
  isLoading,
}: RequiresInputCardProps) {
  return (
    <Animated.View entering={FadeInDown.springify().damping(20)}>
      <View style={styles.warningCard}>
        <Ionicons name="warning" size={36} color={Colors.warning} />
        <Text style={styles.warningTitle}>Verifica non completata</Text>
        <Text style={styles.warningSub}>
          {lastError ?? "Riprova la verifica per completare l'identificazione."}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.retryCta,
            pressed && { opacity: 0.85 },
          ]}
          onPress={onRetry}
          disabled={isLoading}
          accessibilityLabel="Riprova verifica"
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.retryCtaText}>Riprova</Text>
          )}
        </Pressable>
      </View>
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
      {/* Hero block */}
      <Animated.View entering={FadeInDown.delay(80).springify().damping(22)} style={styles.heroBlock}>
        <View style={styles.heroIconWrap}>
          <Ionicons
            name="shield-checkmark-outline"
            size={56}
            color={Colors.success}
          />
        </View>
        <Text style={styles.heroTitle}>Verifica la tua identità</Text>
        <Text style={styles.heroSub}>
          {wasCanceled
            ? "Hai annullato la verifica precedente. Ricomincia quando vuoi."
            : "Pochi minuti, verificato per sempre. Richiesto per ricevere pagamenti e fiducia dei clienti."}
        </Text>
      </Animated.View>

      {/* Benefits list */}
      <Animated.View entering={FadeInDown.delay(160).springify().damping(22)} style={styles.benefitsList}>
        {BENEFITS.map((benefit, i) => (
          <View key={i} style={styles.benefitRow}>
            <View style={styles.benefitCheck}>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </Animated.View>

      {/* CTA */}
      <Animated.View
        entering={FadeInDown.delay(240).springify().damping(22)}
        style={styles.mainCtaWrapper}
      >
        <Pressable
          style={({ pressed }) => [
            styles.mainCta,
            pressed && { opacity: 0.9 },
            isLoading && styles.mainCtaDisabled,
          ]}
          onPress={onStart}
          disabled={isLoading}
          accessibilityLabel="Inizia verifica identità"
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={24} color="#fff" />
              <Text style={styles.mainCtaText}>Inizia verifica</Text>
            </>
          )}
        </Pressable>
      </Animated.View>

      {/* FAQ link */}
      <Pressable
        style={({ pressed }) => [
          styles.faqLink,
          pressed && { opacity: 0.7 },
        ]}
        onPress={onFaq}
        accessibilityLabel="Come funziona la verifica? Apri FAQ"
        accessibilityRole="button"
      >
        <Ionicons
          name="information-circle-outline"
          size={16}
          color={Colors.textSecondary}
        />
        <Text style={styles.faqLinkText}>Come funziona la verifica?</Text>
      </Pressable>
    </>
  );
}

const BENEFITS = [
  "Documento d'identità (carta, passaporto o patente)",
  "Selfie con liveness check",
  "Verifica automatica in 2-5 minuti",
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DocumentsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { status, verifiedAt, lastError, isLoading, error, startVerification, refetch } =
    useIdentityVerification(user?.id);

  const [sdkLoading, setSdkLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [faqVisible, setFaqVisible] = useState(false);

  // useStripeIdentity requires a stable optionsProvider ref.
  // We use a ref-stable callback that calls startVerification internally.
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
      // The realtime subscription in useIdentityVerification will update status
      // automatically when the webhook fires. Trigger a manual refetch as fallback.
      await refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore durante la verifica";
      Alert.alert("Errore", msg);
    } finally {
      setSdkLoading(false);
    }
  }, [isCtaLoading, present, refetch]);

  const handleRefetch = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleFaqOpen = useCallback(() => setFaqVisible(true), []);
  const handleFaqClose = useCallback(() => setFaqVisible(false), []);

  // Derive sheet status result for cancel detection
  const wasCanceled =
    status === "canceled" ||
    (sdkStatus as IdentityVerificationSheetStatus | undefined) === "FlowCanceled";

  // ── Render states ──────────────────────────────────────────────────────────

  const renderMainContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.loadingText}>Caricamento stato verifica...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorBlock}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.error} />
          <Text style={styles.errorText}>{error.message}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.retrySmall,
              pressed && { opacity: 0.8 },
            ]}
            onPress={refetch}
            accessibilityRole="button"
            accessibilityLabel="Riprova caricamento"
          >
            <Text style={styles.retrySmallText}>Riprova</Text>
          </Pressable>
        </View>
      );
    }

    if (status === "verified") {
      return <VerifiedCard verifiedAt={verifiedAt} />;
    }

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

    // null | "not_started" | "canceled"
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

      {/* ── Header ── */}
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
        <Animated.View entering={FadeIn.duration(200)}>
          {renderMainContent()}
        </Animated.View>

        {/* Footer */}
        {status !== "verified" && !isLoading && (
          <View style={styles.footer}>
            <Ionicons
              name="lock-closed-outline"
              size={12}
              color={Colors.textTertiary}
            />
            <Text style={styles.footerText}>
              Powered by Stripe · GDPR compliant
            </Text>
          </View>
        )}
      </ScrollView>

      <FaqModal visible={faqVisible} onClose={handleFaqClose} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
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

  // Scroll
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },

  // Loading / Error block
  loadingBlock: {
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorBlock: {
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: "center",
    lineHeight: 21,
  },
  retrySmall: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorLight,
  },
  retrySmallText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.error,
  },

  // Hero block (welcome state)
  heroBlock: {
    alignItems: "center",
    gap: Spacing.md,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  heroIconWrap: {
    width: 96,
    height: 96,
    borderRadius: Radius.xl,
    backgroundColor: Colors.successLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -0.5,
    fontFamily: "NotoSerif_700Bold",
  },
  heroSub: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 23,
    paddingHorizontal: Spacing.md,
  },

  // Benefits
  benefitsList: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  benefitCheck: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
    lineHeight: 20,
  },

  // Main CTA
  mainCtaWrapper: {
    alignSelf: "stretch",
    marginHorizontal: 20,
    marginTop: 24,
  },
  mainCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    height: 56,
    paddingHorizontal: 20,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  mainCtaDisabled: {
    opacity: 0.65,
  },
  mainCtaText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },

  // FAQ link
  faqLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  faqLinkText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "600",
  },

  // Verified card
  verifiedCard: {
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1.5,
    borderColor: Colors.success,
    ...Shadows.sm,
  },
  verifiedIconWrap: {
    marginBottom: Spacing.sm,
  },
  verifiedTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.success,
    textAlign: "center",
    letterSpacing: -0.3,
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
    lineHeight: 21,
  },

  // Processing card
  processingCard: {
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.accent,
    ...Shadows.sm,
  },
  processingIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  processingSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  processingRefreshBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
    minWidth: 160,
    height: 44,
    ...Shadows.sm,
  },
  processingRefreshBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  processingRestartBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    paddingVertical: 10,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xs,
    minWidth: 160,
    height: 40,
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
  },
  processingRestartBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },

  // Warning card (requires_input)
  warningCard: {
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.warning,
    ...Shadows.sm,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.warning,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  warningSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  retryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.warning,
    borderRadius: Radius.full,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
    minWidth: 140,
    height: 48,
    ...Shadows.sm,
  },
  retryCtaText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing.sm,
  },
  footerText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },

  // FAQ Modal
  faqOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  faqBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  faqSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: 40,
    maxHeight: "80%",
    gap: Spacing.md,
    ...Shadows.lg,
  },
  faqHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  faqTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: -0.3,
    marginBottom: Spacing.sm,
  },
  faqItem: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  faqQ: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    lineHeight: 20,
  },
  faqA: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  faqCloseBtn: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.full,
    alignItems: "center",
    paddingVertical: 14,
    marginTop: Spacing.sm,
  },
  faqCloseBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
  },
});
