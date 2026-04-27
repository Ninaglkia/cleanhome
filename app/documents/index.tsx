import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import { Colors, Radius, Shadows, Spacing } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { useUserDocuments, type UserDocument, type DocumentKind } from "../../lib/hooks/useUserDocuments";
import { getDocumentSignedUrl } from "../../lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getMimeIcon(
  mimeType: string
): React.ComponentProps<typeof Ionicons>["name"] {
  if (mimeType.includes("pdf")) return "document-text-outline";
  if (mimeType.includes("image")) return "image-outline";
  if (mimeType.includes("word") || mimeType.includes("doc")) return "document-outline";
  return "attach-outline";
}

const KIND_LABELS: Record<DocumentKind, string> = {
  id_card: "Carta d'identità",
  passport: "Passaporto",
  driving_license: "Patente",
  tax_code: "Codice fiscale",
  other: "Altro",
};

// ─── Document card ─────────────────────────────────────────────────────────────

interface DocumentCardProps {
  doc: UserDocument;
  onDelete: (id: string) => void;
  onShare: (doc: UserDocument) => void;
}

function DocumentCard({ doc, onDelete, onShare }: DocumentCardProps) {
  const handleDelete = useCallback(() => {
    Alert.alert(
      "Elimina documento",
      `Vuoi eliminare "${doc.name}"? Questa azione non può essere annullata.`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: () => onDelete(doc.id),
        },
      ]
    );
  }, [doc.id, doc.name, onDelete]);

  const handleShare = useCallback(() => {
    onShare(doc);
  }, [doc, onShare]);

  return (
    <Animated.View entering={FadeInDown.springify().damping(22)}>
      <View style={styles.docCard}>
        {/* Icon */}
        <View style={styles.docIconWrap}>
          <Ionicons
            name={getMimeIcon(doc.mime_type)}
            size={26}
            color={Colors.secondary}
          />
        </View>

        {/* Info */}
        <View style={styles.docInfo}>
          <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
          <Text style={styles.docKind}>{KIND_LABELS[doc.kind] ?? doc.kind}</Text>
          <Text style={styles.docMeta}>
            {formatBytes(doc.size_bytes)} · {formatDate(doc.created_at)}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.docActions}>
          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.docActionBtn, pressed && { opacity: 0.6 }]}
            accessibilityLabel="Condividi documento"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="share-outline" size={18} color={Colors.secondary} />
          </Pressable>
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [styles.docActionBtn, pressed && { opacity: 0.6 }]}
            accessibilityLabel="Elimina documento"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Upload progress overlay ──────────────────────────────────────────────────

function UploadProgress({ percent }: { percent: number }) {
  return (
    <View style={styles.uploadOverlay}>
      <View style={styles.uploadCard}>
        <ActivityIndicator size="small" color={Colors.secondary} />
        <Text style={styles.uploadLabel}>Caricamento in corso...</Text>
        <View style={styles.uploadTrack}>
          <View style={[styles.uploadFill, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.uploadPercent}>{percent}%</Text>
      </View>
    </View>
  );
}

// ─── Kind picker ──────────────────────────────────────────────────────────────

const KIND_OPTIONS: Array<{ key: DocumentKind; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = [
  { key: "id_card", label: "Carta d'identità", icon: "card-outline" },
  { key: "passport", label: "Passaporto", icon: "globe-outline" },
  { key: "driving_license", label: "Patente", icon: "car-outline" },
  { key: "tax_code", label: "Codice fiscale", icon: "document-text-outline" },
  { key: "other", label: "Altro documento", icon: "attach-outline" },
];

interface KindPickerProps {
  selected: DocumentKind;
  onSelect: (k: DocumentKind) => void;
}

function KindPicker({ selected, onSelect }: KindPickerProps) {
  return (
    <View style={styles.kindPicker}>
      <Text style={styles.kindPickerLabel}>Tipo di documento</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kindScroll}>
        {KIND_OPTIONS.map((opt) => {
          const isActive = selected === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => onSelect(opt.key)}
              style={[styles.kindChip, isActive && styles.kindChipActive]}
              accessibilityLabel={opt.label}
              accessibilityRole="button"
            >
              <Ionicons
                name={opt.icon}
                size={16}
                color={isActive ? "#fff" : Colors.secondary}
              />
              <Text style={[styles.kindChipText, isActive && styles.kindChipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DocumentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: docs, isLoading, error, refetch, upload, remove } = useUserDocuments(user?.id);

  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [selectedKind, setSelectedKind] = useState<DocumentKind>("id_card");

  const handlePickDocument = useCallback(async () => {
    // expo-document-picker is not installed — use expo-image-picker for images.
    // PDF upload would require expo-document-picker to be added to the project.
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permesso richiesto",
        "Abilita l'accesso alle foto nelle impostazioni per caricare il documento."
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? "image/jpeg";
      const ext = asset.uri.split(".").pop()?.toLowerCase() ?? "jpg";
      const fileName = asset.fileName ?? `documento_${Date.now()}.${ext}`;

      setUploadPercent(10);

      await upload(asset.uri, mimeType, fileName, selectedKind, (pct) => {
        setUploadPercent(pct);
      });

      setUploadPercent(null);
      Alert.alert("Caricato", `Il documento "${fileName}" è stato salvato.`);
    } catch (e) {
      setUploadPercent(null);
      const msg = e instanceof Error ? e.message : "Errore durante il caricamento";
      Alert.alert("Errore", msg);
    }
  }, [upload, selectedKind]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await remove(id);
      } catch {
        Alert.alert("Errore", "Impossibile eliminare il documento. Riprova.");
      }
    },
    [remove]
  );

  const handleShare = useCallback(async (doc: UserDocument) => {
    try {
      const signedUrl = await getDocumentSignedUrl(doc.storage_path);
      await Share.share({
        message: `Documento: ${doc.name}\n${signedUrl}`,
        url: signedUrl,
      });
    } catch {
      // user cancelled or signed URL failed — silent
    }
  }, []);

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
        <Text style={styles.headerTitle}>I miei documenti</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && docs !== null}
            onRefresh={refetch}
            tintColor={Colors.secondary}
            colors={[Colors.secondary]}
          />
        }
      >
        {/* ── Title block ── */}
        <View style={styles.titleBlock}>
          <Text style={styles.pageHeading}>SICUREZZA E IDENTITÀ</Text>
          <Text style={styles.pageTitle}>I miei documenti</Text>
          <Text style={styles.subtitle}>
            Carica e gestisci i tuoi documenti personali in modo sicuro.
            I file sono criptati e accessibili solo a te.
          </Text>
        </View>

        {/* ── Kind picker ── */}
        <KindPicker selected={selectedKind} onSelect={setSelectedKind} />

        {/* ── Upload CTA ── */}
        <Pressable
          style={({ pressed }) => [styles.uploadBtn, pressed && { opacity: 0.88 }]}
          onPress={handlePickDocument}
          disabled={uploadPercent !== null}
          accessibilityLabel="Carica nuovo documento"
          accessibilityRole="button"
        >
          <View style={styles.uploadBtnIconWrap}>
            <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.uploadBtnTitle}>Carica documento</Text>
            <Text style={styles.uploadBtnSub}>PDF o immagine · Max 10 MB</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
        </Pressable>

        {/* ── Error banner ── */}
        {error && !isLoading && (
          <Pressable style={styles.errorBanner} onPress={refetch}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{error.message}</Text>
            <Text style={styles.errorRetry}>Riprova</Text>
          </Pressable>
        )}

        {/* ── Document list ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Documenti caricati
            {docs && docs.length > 0 ? ` (${docs.length})` : ""}
          </Text>
        </View>

        {isLoading && docs === null ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={Colors.secondary} />
            <Text style={styles.loadingText}>Caricamento documenti...</Text>
          </View>
        ) : docs?.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="folder-open-outline" size={40} color={Colors.outlineVariant} />
            </View>
            <Text style={styles.emptyTitle}>Nessun documento caricato</Text>
            <Text style={styles.emptySubtitle}>
              Usa il bottone sopra per caricare il tuo primo documento.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.88 }]}
              onPress={handlePickDocument}
              accessibilityLabel="Carica il tuo primo documento"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyCtaText}>Carica il primo documento</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.docList}>
            {(docs ?? []).map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onDelete={handleDelete}
                onShare={handleShare}
              />
            ))}
          </View>
        )}

        {/* ── GDPR note ── */}
        <View style={styles.gdprNote}>
          <Ionicons name="lock-closed-outline" size={14} color={Colors.textTertiary} />
          <Text style={styles.gdprText}>
            I tuoi documenti sono trattati in modo sicuro nel rispetto del GDPR.
            Nessun dato viene condiviso con terze parti senza il tuo consenso.
          </Text>
        </View>
      </ScrollView>

      {/* ── Upload progress overlay ── */}
      {uploadPercent !== null && <UploadProgress percent={uploadPercent} />}
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

  // Scroll content
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },

  // Title block
  titleBlock: {
    gap: Spacing.sm,
    paddingTop: Spacing.base,
  },
  pageHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: -0.6,
    fontFamily: "NotoSerif_700Bold",
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // Kind picker
  kindPicker: {
    gap: Spacing.sm,
  },
  kindPickerLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  kindScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  kindChipActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  kindChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.secondary,
  },
  kindChipTextActive: {
    color: "#fff",
  },

  // Upload button
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    ...Shadows.md,
  },
  uploadBtnIconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadBtnTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 3,
  },
  uploadBtnSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
  },

  // Error banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.error,
    lineHeight: 18,
  },
  errorRetry: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.error,
  },

  // Section header
  sectionHeader: {
    paddingTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.2,
  },

  // Loading
  loadingBlock: {
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: Radius.xl,
    backgroundColor: Colors.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: Spacing.lg,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
    ...Shadows.md,
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  // Document list
  docList: {
    gap: Spacing.md,
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  docIconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  docInfo: {
    flex: 1,
    gap: 3,
  },
  docName: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  docKind: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.secondary,
  },
  docMeta: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  docActions: {
    flexDirection: "row",
    gap: 4,
    flexShrink: 0,
  },
  docActionBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
  },

  // Upload overlay
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: 220,
    alignItems: "center",
    gap: Spacing.md,
    ...Shadows.lg,
  },
  uploadLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  uploadTrack: {
    width: "100%",
    height: 6,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  uploadFill: {
    height: "100%",
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
  },
  uploadPercent: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.secondary,
  },

  // GDPR note
  gdprNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  gdprText: {
    flex: 1,
    fontSize: 11,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
});
