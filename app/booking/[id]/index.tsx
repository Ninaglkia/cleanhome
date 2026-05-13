import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../lib/auth";
import {
  fetchBooking,
  fetchProfile,
  fetchBookingPhotos,
  confirmBookingCompletion,
  subscribeToBooking,
} from "../../../lib/api";
import { Booking, UserProfile } from "../../../lib/types";
import { Colors, Spacing, Radius, Shadows, BookingStatusConfig } from "../../../lib/theme";
import { MarkDoneModal } from "../../../components/escrow/MarkDoneModal";
import { DisputeModal } from "../../../components/escrow/DisputeModal";
import { formatPrice } from "../../../lib/pricing";

interface BookingPhoto {
  id: string;
  photo_url: string;
  type: string;
  room_label: string | null;
  uploaded_by: string;
  created_at: string;
}

export default function BookingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [cleanerProfile, setCleanerProfile] = useState<UserProfile | null>(null);
  const [clientProfile, setClientProfile] = useState<UserProfile | null>(null);
  const [photos, setPhotos] = useState<BookingPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showMarkDone, setShowMarkDone] = useState(false);
  const [showDispute, setShowDispute] = useState(false);

  const isCleaner = user?.id === booking?.cleaner_id;
  const isClient = user?.id === booking?.client_id;

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const b = await fetchBooking(id);
      if (!b) {
        Alert.alert("Errore", "Prenotazione non trovata", [
          { text: "Indietro", onPress: () => router.back() },
        ]);
        return;
      }
      setBooking(b);

      const [cleaner, client, allPhotos] = await Promise.all([
        b.cleaner_id ? fetchProfile(b.cleaner_id) : Promise.resolve(null),
        fetchProfile(b.client_id),
        fetchBookingPhotos(id),
      ]);
      setCleanerProfile(cleaner);
      setClientProfile(client);
      setPhotos(allPhotos as BookingPhoto[]);
    } catch (err: any) {
      if (__DEV__) {
        console.error("[BookingDetail]", err?.message ?? err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time updates: re-fetch when booking row changes
  useEffect(() => {
    if (!id) return;
    const sub = subscribeToBooking(id, () => {
      loadData();
    });
    return () => {
      sub.unsubscribe?.();
    };
  }, [id, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleConfirm = async () => {
    if (!booking) return;
    Alert.alert(
      "Confermare il servizio?",
      "Confermi che il cleaner ha eseguito il servizio correttamente. Il pagamento verrà rilasciato immediatamente.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Conferma",
          style: "default",
          onPress: async () => {
            setConfirming(true);
            try {
              await confirmBookingCompletion(booking.id);
              await loadData();
              Alert.alert("Servizio confermato", "Il pagamento è stato rilasciato al cleaner.");
            } catch (err: any) {
              Alert.alert("Errore", err?.message ?? "Riprova più tardi");
            } finally {
              setConfirming(false);
            }
          },
        },
      ]
    );
  };

  const statusConfig = useMemo(() => {
    if (!booking) return null;
    return BookingStatusConfig[booking.status] ?? BookingStatusConfig.pending;
  }, [booking]);

  const cleanerPhotos = photos.filter((p) => p.type === "after_cleaner");
  const disputePhotos = photos.filter((p) => p.type === "dispute_client");

  if (loading || !booking) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  // ── Action bar logic ──────────────────────────────────────────────
  const canCleanerMarkDone =
    isCleaner && booking.status === "accepted" && !booking.work_done_at;

  const canClientReview =
    isClient &&
    booking.status === "accepted" &&
    !!booking.work_done_at &&
    !booking.client_confirmed_at &&
    !booking.client_dispute_opened_at;

  const formattedDate = new Date(booking.date).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Dettagli prenotazione</Text>
        <Pressable onPress={() => router.push(`/chat/${booking.id}` as never)} hitSlop={12}>
          <Ionicons name="chatbubbles-outline" size={24} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Status badge */}
        {statusConfig && (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusConfig.bgColor },
            ]}
          >
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        )}

        {/* Escrow timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.cardTitle}>Stato del pagamento</Text>
          <TimelineRow
            done={true}
            label="Pagamento ricevuto"
            sublabel={`€${formatPrice(booking.total_price).replace("€","")}`}
          />
          <TimelineRow
            done={booking.status === "accepted" || !!booking.work_done_at || booking.status === "completed"}
            label="Cleaner accettato"
            sublabel={cleanerProfile?.full_name ?? "—"}
          />
          <TimelineRow
            done={!!booking.work_done_at}
            label="Lavoro completato"
            sublabel={
              booking.work_done_at
                ? new Date(booking.work_done_at).toLocaleString("it-IT")
                : "in attesa"
            }
          />
          <TimelineRow
            done={!!booking.client_confirmed_at}
            label={
              booking.client_dispute_opened_at
                ? "In contestazione"
                : "Pagamento al cleaner"
            }
            sublabel={
              booking.client_dispute_opened_at
                ? "Sospeso fino a risoluzione"
                : booking.client_confirmed_at
                ? new Date(booking.client_confirmed_at).toLocaleString("it-IT")
                : booking.work_done_at
                ? "Conferma entro 48h o auto-rilascio"
                : "—"
            }
            warning={!!booking.client_dispute_opened_at}
          />
        </View>

        {/* Service info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Servizio</Text>
          <InfoRow icon="calendar-outline" label="Data" value={formattedDate} />
          <InfoRow icon="time-outline" label="Orario" value={booking.time_slot} />
          <InfoRow icon="home-outline" label="Stanze" value={String(booking.num_rooms)} />
          {booking.address && (
            <InfoRow icon="location-outline" label="Indirizzo" value={booking.address} />
          )}
          {booking.notes && (
            <InfoRow icon="document-text-outline" label="Note" value={booking.notes} />
          )}
        </View>

        {/* Pricing */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pagamento</Text>
          <PriceRow label="Servizio base" value={booking.base_price} />
          {isClient && <PriceRow label="Commissione" value={booking.client_fee} />}
          {isCleaner && <PriceRow label="Commissione cleaner (9%)" value={-booking.cleaner_fee} />}
          <View style={styles.priceTotalRow}>
            <Text style={styles.priceTotalLabel}>
              {isClient ? "Hai pagato" : "Riceverai"}
            </Text>
            <Text style={styles.priceTotalValue}>
              €
              {(isClient
                ? booking.total_price
                : booking.base_price - booking.cleaner_fee
              ).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Cleaner photos */}
        {cleanerPhotos.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Foto del lavoro completato</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
              {cleanerPhotos.map((p) => (
                <View key={p.id} style={styles.photoStripItem}>
                  <Image source={{ uri: p.photo_url }} style={styles.photoStripImg} />
                  {p.room_label && (
                    <Text style={styles.photoStripLabel}>{p.room_label}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Dispute */}
        {booking.client_dispute_opened_at && (
          <View style={[styles.card, styles.disputeCard]}>
            <View style={styles.disputeHeader}>
              <Ionicons name="alert-circle" size={20} color={Colors.warning} />
              <Text style={styles.disputeTitle}>Contestazione aperta</Text>
            </View>
            <Text style={styles.disputeDate}>
              Aperta il{" "}
              {new Date(booking.client_dispute_opened_at).toLocaleDateString("it-IT")}
            </Text>
            {booking.client_dispute_reason && (
              <Text style={styles.disputeReason}>{booking.client_dispute_reason}</Text>
            )}
            {disputePhotos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                {disputePhotos.map((p) => (
                  <View key={p.id} style={styles.photoStripItem}>
                    <Image source={{ uri: p.photo_url }} style={styles.photoStripImg} />
                  </View>
                ))}
              </ScrollView>
            )}
            <Text style={styles.disputeFooter}>
              CleanHome esaminerà entro 5 giorni lavorativi.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Dynamic action bar */}
      {(canCleanerMarkDone || canClientReview) && (
        <View style={styles.actionBar}>
          {canCleanerMarkDone && (
            <View style={styles.primaryBtn}>
              <Pressable
                onPress={() => setShowMarkDone(true)}
                android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="checkmark-circle" size={20} color="#fff" pointerEvents="none" />
              <Text style={styles.primaryBtnText} pointerEvents="none">Lavoro completato</Text>
            </View>
          )}
          {canClientReview && (
            <View style={styles.dualBtn}>
              <View style={[styles.actionBtn, styles.disputeBtn]}>
                <Pressable
                  onPress={() => setShowDispute(true)}
                  disabled={confirming}
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="alert-circle-outline" size={18} color={Colors.error} pointerEvents="none" />
                <Text style={styles.disputeBtnText} pointerEvents="none">Segnala problema</Text>
              </View>
              <View style={[styles.actionBtn, styles.confirmBtn, confirming && { opacity: 0.6 }]}>
                <Pressable
                  onPress={handleConfirm}
                  disabled={confirming}
                  android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                  style={StyleSheet.absoluteFill}
                />
                {confirming ? (
                  <ActivityIndicator color="#fff" size="small" pointerEvents="none" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" pointerEvents="none" />
                    <Text style={styles.confirmBtnText} pointerEvents="none">Conferma</Text>
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      <MarkDoneModal
        visible={showMarkDone}
        bookingId={booking.id}
        onClose={() => setShowMarkDone(false)}
        onSuccess={() => {
          setShowMarkDone(false);
          loadData();
        }}
      />
      <DisputeModal
        visible={showDispute}
        bookingId={booking.id}
        onClose={() => setShowDispute(false)}
        onSuccess={() => {
          setShowDispute(false);
          loadData();
        }}
      />
    </SafeAreaView>
  );
}

// ─── Sub components ───────────────────────────────────────────────────

function TimelineRow({
  done,
  label,
  sublabel,
  warning = false,
}: {
  done: boolean;
  label: string;
  sublabel?: string;
  warning?: boolean;
}) {
  const iconColor = warning ? Colors.warning : done ? Colors.success : Colors.textTertiary;
  const iconName = warning
    ? "alert-circle"
    : done
    ? "checkmark-circle"
    : "ellipse-outline";

  return (
    <View style={styles.timelineRow}>
      <Ionicons name={iconName as any} size={22} color={iconColor} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.timelineLabel, !done && !warning && styles.timelineLabelMuted]}>
          {label}
        </Text>
        {sublabel && <Text style={styles.timelineSublabel}>{sublabel}</Text>}
      </View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.textSecondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function PriceRow({ label, value }: { label: string; value: number }) {
  const isNegative = value < 0;
  return (
    <View style={styles.priceRow}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={[styles.priceValue, isNegative && { color: Colors.textSecondary }]}>
        {isNegative ? "−" : ""}€{Math.abs(value).toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: Colors.text },
  body: { padding: Spacing.lg, paddingBottom: 120, gap: Spacing.md },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full ?? 999,
  },
  statusText: { fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  timelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  timelineLabel: { fontSize: 15, fontWeight: "600", color: Colors.text },
  timelineLabelMuted: { color: Colors.textSecondary, fontWeight: "500" },
  timelineSublabel: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  infoLabel: { fontSize: 13, color: Colors.textSecondary, width: 90 },
  infoValue: { fontSize: 14, color: Colors.text, flex: 1, fontWeight: "500" },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  priceLabel: { fontSize: 14, color: Colors.textSecondary },
  priceValue: { fontSize: 14, color: Colors.text, fontWeight: "500" },
  priceTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  priceTotalLabel: { fontSize: 16, color: Colors.text, fontWeight: "600" },
  priceTotalValue: { fontSize: 18, color: Colors.primary, fontWeight: "700" },
  photoStrip: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  photoStripItem: { marginRight: 8 },
  photoStripImg: {
    width: 120,
    height: 120,
    borderRadius: Radius.sm,
    backgroundColor: Colors.borderLight,
  },
  photoStripLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  disputeCard: { borderWidth: 1, borderColor: Colors.warning, backgroundColor: Colors.warningLight },
  disputeHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  disputeTitle: { fontSize: 15, fontWeight: "600", color: Colors.warning },
  disputeDate: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  disputeReason: { fontSize: 14, color: Colors.text, lineHeight: 20, marginBottom: 12 },
  disputeFooter: { fontSize: 12, color: Colors.textSecondary, marginTop: 8, fontStyle: "italic" },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  dualBtn: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    borderRadius: Radius.md,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: 6,
  },
  disputeBtn: { backgroundColor: Colors.errorLight, borderWidth: 1, borderColor: Colors.error },
  disputeBtnText: { color: Colors.error, fontWeight: "600", fontSize: 14 },
  confirmBtn: { backgroundColor: Colors.success },
  confirmBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
