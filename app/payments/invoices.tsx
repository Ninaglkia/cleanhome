import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceStatus = "paid" | "pending" | "overdue";

interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: InvoiceStatus;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
// In production these would come from a hook / Supabase query

const MOCK_INVOICES: Invoice[] = [
  { id: "inv-001", date: "Set 2025", description: "Anticipo settembre", amount: 340.0, status: "paid" },
  { id: "inv-002", date: "Ago 2025", description: "Manutenzione agosto", amount: 280.0, status: "paid" },
  { id: "inv-003", date: "Ago 2025", description: "Pulizia profonda", amount: 180.0, status: "paid" },
  { id: "inv-004", date: "Lug 2025", description: "Pulizia ordinaria", amount: 120.0, status: "paid" },
  { id: "inv-005", date: "Lug 2025", description: "Anticipo luglio", amount: 340.0, status: "paid" },
  { id: "inv-006", date: "Giu 2025", description: "Stiratura premium", amount: 95.0, status: "paid" },
  { id: "inv-007", date: "Giu 2025", description: "Pulizia vetri", amount: 145.0, status: "paid" },
  { id: "inv-008", date: "Mag 2025", description: "Pulizia profonda", amount: 180.0, status: "paid" },
  { id: "inv-009", date: "Ott 2025", description: "Anticipo ottobre", amount: 340.0, status: "pending" },
  { id: "inv-010", date: "Ott 2025", description: "Pulizia post-ristrutturazione", amount: 258.0, status: "pending" },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 76;
const SEPARATOR_HEIGHT = 8;

const STATUS_CONFIG: Record<InvoiceStatus, { color: string; bg: string; label: string }> = {
  paid: { color: Colors.success, bg: Colors.successLight, label: "Pagata" },
  pending: { color: Colors.warning, bg: Colors.warningLight, label: "In attesa" },
  overdue: { color: Colors.error, bg: Colors.errorLight, label: "Scaduta" },
};

// ─── Invoice row ──────────────────────────────────────────────────────────────

interface InvoiceRowProps {
  item: Invoice;
  onPress: (id: string) => void;
}

function InvoiceRow({ item, onPress }: InvoiceRowProps) {
  const cfg = STATUS_CONFIG[item.status];

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [styles.invoiceRow, pressed && { opacity: 0.8 }]}
    >
      {/* Left icon */}
      <View style={styles.invoiceIconWrap}>
        <Ionicons name="document-text-outline" size={20} color={Colors.secondary} />
      </View>

      {/* Center text */}
      <View style={{ flex: 1 }}>
        <Text style={styles.invoiceDate}>{item.date}</Text>
        <Text style={styles.invoiceDesc} numberOfLines={1}>{item.description}</Text>
      </View>

      {/* Right: amount + status dot */}
      <View style={styles.invoiceRight}>
        <Text style={styles.invoiceAmount}>€{item.amount.toFixed(2)}</Text>
        <View style={styles.statusDotRow}>
          <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.statusDotLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InvoicesScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);

  const totalPaid = useMemo(
    () => invoices.filter((i) => i.status === "paid").reduce((acc, i) => acc + i.amount, 0),
    [invoices]
  );

  const totalPending = useMemo(
    () => invoices.filter((i) => i.status === "pending").reduce((acc, i) => acc + i.amount, 0),
    [invoices]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulated refresh delay — replace with real API call
    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    setRefreshing(false);
  }, []);

  const handleInvoicePress = useCallback((_id: string) => {
    // Navigate to invoice detail when implemented
  }, []);

  const keyExtractor = useCallback((item: Invoice) => item.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<Invoice> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT + SEPARATOR_HEIGHT,
      offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: Invoice }) => (
      <InvoiceRow item={item} onPress={handleInvoicePress} />
    ),
    [handleInvoicePress]
  );

  const ListHeader = (
    <>
      {/* ── Page title ── */}
      <View style={styles.titleBlock}>
        <Text style={styles.labelOverline}>FATTURAZIONE E FATTURE</Text>
        <Text style={styles.pageTitle}>Le tue fatture</Text>
        <Text style={styles.pageSubtitle}>
          Tieni traccia di tutti i pagamenti e scarica le ricevute in qualsiasi momento.
        </Text>
      </View>

      {/* ── Summary cards ── */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
          <Text style={styles.summaryCardLabel}>Totale pagato</Text>
          <Text style={styles.summaryCardAmount}>
            €{totalPaid.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </Text>
          <View style={styles.summaryCardIcon}>
            <Ionicons name="trending-up" size={18} color={Colors.textOnDarkSecondary} />
          </View>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardSecondary]}>
          <Text style={[styles.summaryCardLabel, { color: Colors.warning }]}>In sospeso</Text>
          <Text style={[styles.summaryCardAmount, { color: Colors.text }]}>
            €{totalPending.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </Text>
          <View style={[styles.summaryCardIcon, { backgroundColor: Colors.warningLight }]}>
            <Ionicons name="time-outline" size={18} color={Colors.warning} />
          </View>
        </View>
      </View>

      {/* ── Membership badge ── */}
      <View style={styles.membershipBadge}>
        <Ionicons name="diamond" size={20} color={Colors.textOnDarkSecondary} />
        <View>
          <Text style={styles.membershipTitle}>Premium Curator</Text>
          <Text style={styles.membershipSub}>Accesso prioritario e fatture illimitate</Text>
        </View>
        <View style={styles.membershipCheck}>
          <Ionicons name="checkmark" size={14} color={Colors.textOnDark} />
        </View>
      </View>

      {/* ── Section header ── */}
      <View style={styles.recentHeader}>
        <Text style={styles.sectionTitle}>Fatturazione recente</Text>
        <Text style={styles.invoiceCount}>{invoices.length} fatture</Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Nav header ── */}
      <View style={styles.navHeader}>
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
        <Pressable style={styles.downloadBtn}>
          <Ionicons name="download-outline" size={18} color={Colors.secondary} />
          <Text style={styles.downloadBtnText}>Esporta</Text>
        </Pressable>
      </View>

      {/* ── List ── */}
      <FlatList
        data={invoices}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: SEPARATOR_HEIGHT }} />}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={12}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.secondary}
            colors={[Colors.secondary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={36} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>Nessuna fattura</Text>
            <Text style={styles.emptySub}>
              Le tue fatture appariranno qui dopo la prima prenotazione.
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: Platform.OS === "ios" ? 40 : 24 }} />}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Nav header
  navHeader: {
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
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
  },
  downloadBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.secondary,
  },

  listContent: {
    paddingHorizontal: Spacing.base,
  },

  // Title block
  titleBlock: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.base,
    gap: Spacing.sm,
  },
  labelOverline: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.8,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },

  // Summary cards
  summaryRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  summaryCard: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.xs,
    ...Shadows.sm,
    position: "relative",
    overflow: "hidden",
  },
  summaryCardPrimary: {
    backgroundColor: Colors.primary,
  },
  summaryCardSecondary: {
    backgroundColor: Colors.surface,
  },
  summaryCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textOnDarkTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryCardAmount: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.textOnDark,
    letterSpacing: -0.5,
  },
  summaryCardIcon: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Membership badge
  membershipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  membershipTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textOnDark,
    marginBottom: 2,
  },
  membershipSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  membershipCheck: {
    marginLeft: "auto",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Recent section header
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  invoiceCount: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: "500",
  },

  // Invoice row
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    height: ITEM_HEIGHT,
    ...Shadows.sm,
  },
  invoiceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  invoiceDate: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  invoiceDesc: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  invoiceRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  invoiceAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.3,
  },
  statusDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusDotLabel: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Empty
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 32,
  },
});
