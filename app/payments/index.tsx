import { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StatusBar,
  StyleSheet,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Colors, Spacing, Radius, Shadows, SpringConfig } from "../../lib/theme";
import AssistanceFooter from "../../components/AssistanceFooter";

// ─── Types ────────────────────────────────────────────────────────────────────

type AccentTone = "neutral" | "info" | "warning" | "success";

interface RowItemProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  tone?: AccentTone;
  onPress?: () => void;
}

// ─── Tone palette ─────────────────────────────────────────────────────────────
// Subtle differentiation: most rows are mint, but contextual ones (disputes,
// duplicates) get a warm warning tone so they don't feel monotonous.

const TONE_STYLES: Record<
  AccentTone,
  { bg: string; fg: string }
> = {
  neutral: { bg: Colors.accentLight, fg: Colors.secondary },
  info: { bg: "#eaf1ff", fg: Colors.info },
  warning: { bg: "#fdf1e3", fg: "#a85d12" },
  success: { bg: Colors.successLight, fg: Colors.success },
};

// ─── Reusable Row ─────────────────────────────────────────────────────────────

function RowItem({
  icon,
  title,
  subtitle,
  tone = "neutral",
  onPress,
}: RowItemProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const palette = TONE_STYLES[tone];
  const interactive = !!onPress;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          if (interactive) scale.value = withSpring(0.98, SpringConfig.press);
        }}
        onPressOut={() => {
          if (interactive) scale.value = withSpring(1, SpringConfig.press);
        }}
        accessibilityRole={interactive ? "button" : undefined}
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
        android_ripple={
          interactive
            ? { color: "rgba(0,107,85,0.08)", borderless: false }
            : undefined
        }
      >
        {/* Inner View — enforces flexDirection on iOS even with function-based
            Pressable style. */}
        <View style={styles.row}>
          <View style={[styles.rowIconWrap, { backgroundColor: palette.bg }]}>
            <Ionicons name={icon} size={20} color={palette.fg} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>{title}</Text>
            {subtitle ? (
              <Text style={styles.rowSubtitle}>{subtitle}</Text>
            ) : null}
          </View>
          {interactive ? (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.textTertiary}
            />
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Section Header (accent + label + optional kicker) ────────────────────────

function SectionHeader({
  kicker,
  title,
}: {
  kicker?: string;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAccent} />
      <View style={{ flex: 1 }}>
        {kicker ? <Text style={styles.sectionKicker}>{kicker}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PaymentsScreen() {
  const router = useRouter();

  const handleExplainPayment = useCallback(() => {
    Alert.alert(
      "Come funziona il pagamento",
      "La carta viene richiesta in fase di prenotazione tramite Stripe. L'addebito è immediato e i fondi vengono custoditi da CleanHome (escrow): il pagamento al cleaner viene rilasciato solo dopo la tua conferma del servizio o automaticamente dopo 48 ore dal completamento.",
      [{ text: "Ho capito", style: "default" }]
    );
  }, []);

  const handleInfoRow = useCallback((title: string, message: string) => {
    Alert.alert(title, message);
  }, []);

  const handleSupportContact = useCallback(() => {
    router.push("/support");
  }, [router]);

  const handleChat = useCallback(() => {
    router.push("/support/chat");
  }, [router]);

  const handleEmailBilling = useCallback(async () => {
    await Linking.openURL(
      "mailto:info@cleanhomeapp.com?subject=Pagamenti%20e%20fatture%20%E2%80%94%20Richiesta"
    ).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Refined header — no debug-like brand thumbnail ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.backBtn,
            pressed && styles.backBtnPressed,
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Pagamenti
        </Text>
        {/* Right spacer for visual balance */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero title block ── */}
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Help center</Text>
          <Text style={styles.pageTitle}>Pagamenti e rimborsi</Text>
          <Text style={styles.pageSubtitle}>
            Gestisci i tuoi metodi di pagamento, consulta le politiche di
            rimborso e ottieni assistenza per i tuoi estratti conto.
          </Text>
        </View>

        {/* ── Security card ── */}
        <View style={styles.securityCard}>
          <View style={styles.securityLeft}>
            <View style={styles.shieldWrap}>
              <Ionicons
                name="shield-checkmark"
                size={22}
                color={Colors.textOnDark}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.securityTitle}>Sicurezza prima di tutto</Text>
              <Text style={styles.securitySub}>PCI DSS Compliant</Text>
            </View>
          </View>
          <View style={styles.securityBadge}>
            <Ionicons name="lock-closed" size={11} color={Colors.accent} />
            <Text style={styles.securityBadgeText}>SICURO</Text>
          </View>
        </View>

        {/* ── Payment Methods ── */}
        <View style={styles.section}>
          <SectionHeader title="Metodi di pagamento" />
          <View style={styles.card}>
            <RowItem
              icon="card-outline"
              title="Carte di credito e debito"
              subtitle="Visa, Mastercard, Amex"
              onPress={() =>
                handleInfoRow(
                  "Carte accettate",
                  "Accettiamo tutte le principali carte di credito e debito: Visa, Mastercard, American Express. Il pagamento è processato in modo sicuro da Stripe."
                )
              }
            />
            <View style={styles.cardDivider} />
            <RowItem
              icon="wallet-outline"
              title="Portafogli digitali"
              subtitle={
                Platform.OS === "ios" ? "Apple Pay, Google Pay" : "Google Pay"
              }
              onPress={() =>
                handleInfoRow(
                  "Portafogli digitali",
                  Platform.OS === "ios"
                    ? "Puoi pagare con Apple Pay o Google Pay direttamente dal Payment Sheet al momento della prenotazione."
                    : "Puoi pagare con Google Pay direttamente dal Payment Sheet al momento della prenotazione."
                )
              }
            />
            <View style={styles.cardDivider} />
            <View style={styles.explainLink}>
              <Pressable
                onPress={handleExplainPayment}
                accessibilityRole="button"
                accessibilityLabel="Come funziona il pagamento"
                android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={Colors.textOnDark}
                pointerEvents="none"
              />
              <Text style={styles.explainLinkText} pointerEvents="none">
                Come funziona il pagamento
              </Text>
              <Ionicons
                name="arrow-forward"
                size={14}
                color={Colors.textOnDark}
                pointerEvents="none"
              />
            </View>
          </View>
        </View>

        {/* ── Refund Policy ── */}
        <View style={styles.section}>
          <SectionHeader title="Politica di rimborso" />
          <View style={styles.card}>
            <RowItem
              icon="lock-closed-outline"
              tone="success"
              title="Modalità escrow"
              subtitle="Hold-until-confirm — i fondi restano custoditi"
              onPress={() =>
                handleInfoRow(
                  "Come funziona l'escrow",
                  "L'addebito sulla tua carta è immediato, ma i fondi restano custoditi da CleanHome. Vengono trasferiti al cleaner solo dopo che confermi il servizio o automaticamente dopo 48 ore dal completamento del lavoro. Se apri una contestazione, i fondi restano congelati fino alla risoluzione."
                )
              }
            />
            <View style={styles.cardDivider} />
            <RowItem
              icon="calendar-outline"
              tone="neutral"
              title="Politica di cancellazione"
              subtitle="Regole di rimborso in base ai tempi"
              onPress={() =>
                handleInfoRow(
                  "Cancellazioni",
                  "Più di 24h prima del servizio: rimborso completo. Tra 24h e 2h prima: rimborso 50% + commissione. Meno di 2h o no-show: nessun rimborso. Noi processiamo il rimborso immediatamente; l'accredito sulla tua carta dipende dalla banca emittente, tipicamente 3-7 giorni lavorativi."
                )
              }
            />
            <View style={styles.cardDivider} />
            <RowItem
              icon="alert-circle-outline"
              tone="warning"
              title="Contestazione del servizio"
              subtitle="Hai 48 ore per aprire un caso"
              onPress={() =>
                handleInfoRow(
                  "Hai 48 ore per contestare",
                  "Quando il cleaner segna il lavoro come completato, hai 48 ore per confermarlo o aprire una contestazione. Devi caricare almeno una foto del problema e descrivere cosa è successo (minimo 20 caratteri). CleanHome esamina entro 5 giorni lavorativi e decide rimborso totale, parziale o conferma del pagamento al cleaner."
                )
              }
            />
          </View>
        </View>

        {/* ── Invoice Issues ── */}
        <View style={styles.section}>
          <SectionHeader title="Problemi con le fatture" />
          <View style={styles.card}>
            <RowItem
              icon="alert-circle-outline"
              tone="warning"
              title="Segnala un addebito duplicato"
              subtitle="Apri un ticket col supporto"
              onPress={handleSupportContact}
            />
            <View style={styles.cardDivider} />
            <RowItem
              icon="document-text-outline"
              tone="info"
              title="Richiedi fattura / ricevuta IVA"
              subtitle="Scarica i tuoi documenti fiscali"
              onPress={() => router.push("/payments/invoices")}
            />
          </View>
        </View>

        {/* ── Footer assistance ── */}
        <AssistanceFooter
          onChatPress={handleChat}
          onEmailPress={handleEmailBilling}
        />

        <View style={{ height: Platform.OS === "ios" ? 40 : 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Header — clean detail-page chrome, no brand thumbnail ────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.sm,
  },
  backBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },

  // ── Scroll content ───────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    gap: Spacing.xxl, // 32 — wider rhythm between sections for premium feel
  },

  // ── Title block ─────────────────────────────────────────────────────────
  titleBlock: {
    gap: Spacing.sm,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: Colors.secondary,
    textTransform: "uppercase",
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    letterSpacing: -0.1,
  },

  // ── Section ─────────────────────────────────────────────────────────────
  section: {
    gap: Spacing.md, // 12 — tight rhythm between header and card
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  sectionAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: Colors.accent,
  },
  sectionKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: Colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: -0.3,
  },

  // ── Card shell ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, // 16
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
    marginLeft: 60, // aligns with text column (icon 40 + gap 12 + padding 16 - 8)
  },

  // ── Row ─────────────────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    minHeight: 64,
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    letterSpacing: -0.1,
  },
  rowSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: -0.05,
    lineHeight: 16,
  },

  // ── Explain CTA inside card ─────────────────────────────────────────────
  explainLink: {
    marginHorizontal: Spacing.base,
    marginVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: Spacing.base,
  },
  explainLinkText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textOnDark,
    letterSpacing: 0.1,
  },

  // ── Security card ───────────────────────────────────────────────────────
  securityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadows.md,
  },
  securityLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  shieldWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  securityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textOnDark,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  securitySub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  securityBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.accent,
    letterSpacing: 1,
  },
});
