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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";

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
  badge?: string;
  onPress?: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PaymentMethodRow({ icon, title, subtitle, onPress }: PaymentMethodRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.methodRow, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.methodIconWrap}>
        <Ionicons name={icon} size={22} color={Colors.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.methodTitle}>{title}</Text>
        <Text style={styles.methodSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </Pressable>
  );
}

function InfoRow({ icon, title, badge, onPress }: InfoRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.infoRow, pressed && onPress && { opacity: 0.75 }]}
    >
      <Ionicons name={icon} size={16} color={Colors.textSecondary} />
      <Text style={styles.infoRowText}>{title}</Text>
      {badge ? (
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>{badge}</Text>
        </View>
      ) : null}
      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      ) : null}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PaymentsScreen() {
  const router = useRouter();

  const handleUpdatePayment = useCallback(() => {
    // Navigate to payment details update screen when implemented
  }, []);

  const handleChat = useCallback(() => {
    // Open support chat
  }, []);

  const handleEmailBilling = useCallback(async () => {
    await Linking.openURL("mailto:billing@cleanhome.it").catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.75 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.breadcrumb}>Supporto</Text>
          <Text style={styles.headerBrand}>CleanHome</Text>
        </View>
        <View style={styles.helpCenterBadge}>
          <Text style={styles.helpCenterText}>HELP CENTER</Text>
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
              onPress={() => {}}
            />
            <View style={styles.cardDivider} />
            <PaymentMethodRow
              icon="wallet-outline"
              title="Portafogli digitali"
              subtitle={Platform.OS === "ios" ? "Apple Pay, Google Pay" : "Google Pay"}
              onPress={() => {}}
            />
            <View style={styles.cardDivider} />
            <Pressable
              onPress={handleUpdatePayment}
              style={({ pressed }) => [styles.updateLink, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="create-outline" size={16} color={Colors.secondary} />
              <Text style={styles.updateLinkText}>Aggiorna metodo di pagamento</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.secondary} />
            </Pressable>
          </View>
        </View>

        {/* ── Security card ── */}
        <View style={styles.securityCard}>
          <View style={styles.securityLeft}>
            <View style={styles.shieldWrap}>
              <Ionicons name="shield-checkmark" size={28} color={Colors.textOnDark} />
            </View>
            <View>
              <Text style={styles.securityTitle}>Sicurezza prima di tutto</Text>
              <Text style={styles.securitySub}>PCI DSS Compliant</Text>
            </View>
          </View>
          <View style={styles.securityBadge}>
            <Ionicons name="lock-closed" size={12} color={Colors.accent} />
            <Text style={styles.securityBadgeText}>SICURO</Text>
          </View>
        </View>

        {/* ── Refund Policy ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Politica di rimborso</Text>
          <View style={styles.card}>
            <InfoRow
              icon="checkmark-circle-outline"
              title="Garanzia di soddisfazione"
              onPress={() => {}}
            />
            <View style={styles.cardDivider} />
            <InfoRow
              icon="calendar-outline"
              title="Politica di cancellazione"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* ── Invoice Issues ── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Problemi con le fatture</Text>
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>ATTIVO</Text>
            </View>
          </View>
          <View style={styles.card}>
            <InfoRow
              icon="alert-circle-outline"
              title="Segnala un addebito duplicato"
              onPress={() => {}}
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
        <View style={styles.assistanceCard}>
          <View style={styles.assistanceIconWrap}>
            <Ionicons name="help-buoy-outline" size={24} color={Colors.secondary} />
          </View>
          <Text style={styles.assistanceTitle}>Hai ancora bisogno di aiuto?</Text>
          <Text style={styles.assistanceSub}>
            Il nostro team di assistenza è disponibile 7 giorni su 7.
          </Text>
          <View style={styles.assistanceBtns}>
            <Pressable
              onPress={handleChat}
              style={({ pressed }) => [styles.assistanceBtnPrimary, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={17} color={Colors.textOnDark} />
              <Text style={styles.assistanceBtnPrimaryText}>Chat con noi</Text>
            </Pressable>
            <Pressable
              onPress={handleEmailBilling}
              style={({ pressed }) => [styles.assistanceBtnSecondary, pressed && { opacity: 0.75 }]}
            >
              <Ionicons name="mail-outline" size={17} color={Colors.secondary} />
              <Text style={styles.assistanceBtnSecondaryText}>Email al team</Text>
            </Pressable>
          </View>
        </View>

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
    fontSize: 16,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  helpCenterBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
  },
  helpCenterText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textOnDark,
    letterSpacing: 1.5,
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
    marginBottom: Spacing.sm,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.6,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },

  // Sections
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  activePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.full,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.success,
    letterSpacing: 1,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: "hidden",
    ...Shadows.sm,
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 56,
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
  },
  methodSub: {
    fontSize: 12,
    color: Colors.textTertiary,
  },

  // Update link
  updateLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.accentLight,
  },
  updateLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.secondary,
  },

  // Security card
  securityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.secondary,
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

  // Info row
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
  },
  infoRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: Colors.text,
  },
  activeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.secondary,
    letterSpacing: 0.8,
  },

  // Assistance card
  assistanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
    ...Shadows.md,
  },
  assistanceIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  assistanceTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  assistanceSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  assistanceBtns: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  assistanceBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 50,
    backgroundColor: Colors.secondary,
    borderRadius: Radius.md,
    ...Shadows.sm,
  },
  assistanceBtnPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textOnDark,
  },
  assistanceBtnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 50,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
  },
  assistanceBtnSecondaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.secondary,
  },
});
