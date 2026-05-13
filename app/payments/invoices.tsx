import { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { fetchBookings } from "../../lib/api";
import { Booking } from "../../lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceStatus = "paid" | "pending" | "overdue";

interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: InvoiceStatus;
}

const IT_MONTHS = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

function bookingToInvoice(b: Booking): Invoice {
  const d = new Date(b.date);
  const status: InvoiceStatus =
    b.status === "completed" || b.status === "work_done"
      ? "paid"
      : b.status === "accepted"
      ? "pending"
      : b.status === "declined" ||
        b.status === "cancelled" ||
        b.status === "auto_cancelled"
      ? "overdue"
      : "pending";
  return {
    id: b.id,
    date: `${IT_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    description: b.service_type,
    amount: b.total_price,
    status,
  };
}

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
  const { user, profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const loadInvoices = useCallback(async () => {
    if (!user || !profile) return;
    try {
      const bookings = await fetchBookings(user.id, profile.active_role);
      setInvoices(bookings.map(bookingToInvoice));
    } catch {
      setInvoices([]);
    }
  }, [user, profile]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

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
    await loadInvoices();
    setRefreshing(false);
  }, [loadInvoices]);

  const handleInvoicePress = useCallback((_id: string) => {
    Alert.alert(
      "Prossimamente",
      "Il dettaglio delle fatture sarà disponibile a breve. Puoi consultare lo storico pagamenti dal Dashboard Stripe.",
    );
  }, []);

  const handleExport = useCallback(() => {
    Alert.alert(
      "Prossimamente",
      "L'esportazione PDF delle fatture sarà disponibile a breve.",
    );
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
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.75 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.breadcrumb}>Supporto</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../../assets/icon.png")}
              style={{ width: 26, height: 26, borderRadius: 6 }}
            />
            <Text style={styles.headerBrand}>CleanHome</Text>
          </View>
        </View>
        <Pressable style={styles.downloadBtn} onPress={handleExport}>
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
    fontSize: 20,
    fontWeight: "700",
    fontStyle: "italic",
    color: "#181c1c",
    letterSpacing: -0.3,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: "PlusJakartaSans-ExtraBold",
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: -0.8,
    fontFamily: "NotoSerif-Bold",
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans-Regular",
  },

  // Summary cards
  summaryRow: {
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  summaryCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
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
    fontSize: 28,
    fontWeight: "800",
    color: Colors.textOnDark,
    letterSpacing: -0.5,
    fontFamily: "NotoSerif-Bold",
  },
  summaryCardIcon: {
    position: "absolute",
    top: Spacing.base,
    right: Spacing.base,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Membership badge
  membershipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  membershipTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textOnDark,
    marginBottom: 2,
    fontFamily: "PlusJakartaSans-Bold",
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
    fontSize: 17,
    fontWeight: "700",
    color: Colors.primary,
    fontFamily: "PlusJakartaSans-Bold",
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
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    height: ITEM_HEIGHT,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
    fontFamily: "PlusJakartaSans-SemiBold",
  },
  invoiceRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  invoiceAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: -0.3,
    fontFamily: "PlusJakartaSans-ExtraBold",
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
