import { useCallback } from "react";
import {
  View,
  Text,
  Image,
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
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";
import AssistanceFooter from "../../components/AssistanceFooter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentMethodRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  onPress: () => void;
}

interface InfoRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  onPress?: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PaymentMethodRow({ icon, title, subtitle, onPress }: PaymentMethodRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => [pressed && { opacity: 0.75 }]}
    >
      {/* Inner View enforces the horizontal layout — Pressable on iOS can
          silently drop flexDirection when the press style is a function. */}
      <View style={styles.methodRow}>
        <View style={styles.methodIconWrap}>
          <Ionicons name={icon} size={22} color={Colors.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.methodTitle}>{title}</Text>
          <Text style={styles.methodSub}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
      </View>
    </Pressable>
  );
}

function InfoRow({ icon, title, onPress }: InfoRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={title}
      style={({ pressed }) => [pressed && onPress && { opacity: 0.75 }]}
    >
      {/* Inner View ensures the horizontal layout survives on iOS even
          when the Pressable style is a function-based style array. */}
      <View style={styles.infoRow}>
        <View style={styles.infoIconWrap}>
          <Ionicons name={icon} size={18} color={Colors.textSecondary} />
        </View>
        <Text style={styles.infoRowText}>{title}</Text>
        {onPress ? (
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        ) : null}
      </View>
    </Pressable>
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

  const handleInfoRow = useCallback(
    (title: string, message: string) => {
      Alert.alert(title, message);
    },
    []
  );

  const handleSupportContact = useCallback(() => {
    router.push("/support");
  }, [router]);

  const handleChat = useCallback(() => {
    router.push("/support/chat");
  }, [router]);

  const handleEmailBilling = useCallback(async () => {
    await Linking.openURL("mailto:billing@cleanhomeapp.com").catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.75 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.breadcrumb}>Supporto · Help Center</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../../assets/icon.png")}
              style={{ width: 26, height: 26, borderRadius: 6 }}
            />
            <Text style={styles.headerBrand}>CleanHome</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Title block ── */}
        <View style={styles.titleBlock}>
          <Text style={styles.pageTitle}>Pagamenti e rimborsi</Text>
          <Text style={styles.pageSubtitle}>
            Gestisci i tuoi metodi di pagamento, visualizza le politiche di rimborso e ottieni assistenza per i tuoi estratti conto.
          </Text>
        </View>

        {/* ── Payment Methods ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metodi di pagamento</Text>
          <View style={styles.card}>
            <PaymentMethodRow
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
            <PaymentMethodRow
              icon="wallet-outline"
              title="Portafogli digitali"
              subtitle={Platform.OS === "ios" ? "Apple Pay, Google Pay" : "Google Pay"}
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
            <View style={styles.updateLink}>
              <Pressable
                onPress={handleExplainPayment}
                accessibilityRole="button"
                accessibilityLabel="Come funziona il pagamento"
                android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="information-circle-outline" size={16} color={Colors.textOnDark} pointerEvents="none" />
              <Text style={styles.updateLinkText} pointerEvents="none">Come funziona il pagamento</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.textOnDark} pointerEvents="none" />
            </View>
          </View>
        </View>

        {/* ── Security card ── */}
        <View style={styles.securityCard}>
          <View style={styles.securityLeft}>
            <View style={styles.shieldWrap}>
              <Ionicons name="shield-checkmark" size={22} color={Colors.textOnDark} />
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

        {/* ── Refund Policy ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Politica di rimborso</Text>
          <View style={styles.card}>
            <InfoRow
              icon="checkmark-circle-outline"
              title="Modalità escrow (hold-until-confirm)"
              onPress={() =>
                handleInfoRow(
                  "Come funziona l'escrow",
                  "L'addebito sulla tua carta è immediato, ma i fondi restano custoditi da CleanHome. Vengono trasferiti al cleaner solo dopo che confermi il servizio o automaticamente dopo 48 ore dal completamento del lavoro. Se apri una contestazione, i fondi restano congelati fino alla risoluzione."
                )
              }
            />
            <View style={styles.cardDivider} />
            <InfoRow
              icon="calendar-outline"
              title="Politica di cancellazione"
              onPress={() =>
                handleInfoRow(
                  "Cancellazioni",
                  "Più di 24h prima del servizio: rimborso completo. Tra 24h e 2h prima: rimborso 50% + commissione. Meno di 2h o no-show: nessun rimborso. Noi processiamo il rimborso immediatamente; l'accredito sulla tua carta dipende dalla banca emittente, tipicamente 3-7 giorni lavorativi."
                )
              }
            />
            <View style={styles.cardDivider} />
            <InfoRow
              icon="alert-circle-outline"
              title="Contestazione del servizio"
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
          <Text style={styles.sectionTitle}>Problemi con le fatture</Text>
          <View style={styles.card}>
            <InfoRow
              icon="alert-circle-outline"
              title="Segnala un addebito duplicato"
              onPress={handleSupportContact}
            />
            <View style={styles.cardDivider} />
            <InfoRow
              icon="document-text-outline"
              title="Richiedi fattura / ricevuta IVA"
              onPress={() => router.push("/payments/invoices")}
            />
          </View>
        </View>

        {/* ── Footer assistance ── */}
        <AssistanceFooter
          onChatPress={handleChat}
          onEmailPress={handleEmailBilling}
        />

        <View style={{ height: Platform.OS === "ios" ? 32 : 24 }} />
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

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  breadcrumb: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  headerBrand: {
    fontSize: 20,
    fontWeight: "700",
    fontStyle: "italic",
    color: "#181c1c",
    letterSpacing: -0.3,
  },
  helpCenterBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  helpCenterText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textOnDark,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    gap: Spacing.xl,
  },

  // Title block
  titleBlock: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: -0.6,
    fontFamily: "NotoSerif-Bold",
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans-Regular",
  },

  // Sections
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: -0.2,
    fontFamily: "NotoSerif-Bold",
  },
  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: "hidden",
    ...Shadows.sm,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
    marginLeft: 56,
    opacity: 0.6,
  },

  // Method row
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
  },
  methodIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  methodTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 2,
    fontFamily: "PlusJakartaSans-SemiBold",
  },
  methodSub: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: "PlusJakartaSans-Regular",
  },

  // Update link
  updateLink: {
    marginHorizontal: Spacing.base,
    marginVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: Spacing.base,
  },
  updateLinkText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textOnDark,
  },

  // Security card
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

  // Info row — keeps same outer dimensions as methodRow for visual parity
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  infoRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: Colors.text,
    fontFamily: "PlusJakartaSans-Medium",
  },
});
