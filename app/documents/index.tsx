import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Colors, Radius, Shadows, Spacing } from "../../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadState = "empty" | "uploading" | "done" | "error";

interface DocumentSide {
  side: "front" | "back";
  label: string;
  state: UploadState;
  fileName: string | null;
}

// ─── Upload Card ──────────────────────────────────────────────────────────────

interface UploadCardProps {
  doc: DocumentSide;
  onUpload: (side: "front" | "back") => void;
}

function UploadCard({ doc, onUpload }: UploadCardProps) {
  const isDone = doc.state === "done";
  const isUploading = doc.state === "uploading";

  return (
    <View style={styles.uploadCard}>
      <Text style={styles.uploadCardTitle}>{doc.label}</Text>

      {/* Document placeholder preview */}
      <View style={[styles.docPreview, isDone && styles.docPreviewDone]}>
        {isDone ? (
          <>
            <View style={styles.docDoneIcon}>
              <Ionicons name="checkmark-circle" size={36} color={Colors.secondary} />
            </View>
            <Text style={styles.docFileName} numberOfLines={1}>
              {doc.fileName ?? "documento.jpg"}
            </Text>
          </>
        ) : (
          <>
            {/* ID card outline illustration */}
            <View style={styles.idOutline}>
              <View style={styles.idChip} />
              <View style={styles.idLines}>
                <View style={styles.idLine} />
                <View style={[styles.idLine, { width: "55%" }]} />
              </View>
            </View>
            <Text style={styles.docPreviewHint}>
              {isUploading ? "Caricamento in corso..." : "Anteprima documento"}
            </Text>
          </>
        )}
      </View>

      {/* Upload button */}
      <Pressable
        style={({ pressed }) => [
          styles.uploadBtn,
          isDone && styles.uploadBtnDone,
          (isUploading || isDone) && styles.uploadBtnDisabled,
          pressed && !isDone && !isUploading && styles.uploadBtnPressed,
        ]}
        onPress={() => onUpload(doc.side)}
        disabled={isUploading || isDone}
      >
        <Ionicons
          name={isDone ? "checkmark-outline" : "cloud-upload-outline"}
          size={16}
          color={isDone ? Colors.success : Colors.textOnDark}
        />
        <Text style={[styles.uploadBtnText, isDone && styles.uploadBtnTextDone]}>
          {isUploading ? "Caricamento..." : isDone ? "Caricato" : `Carica ${doc.side === "front" ? "fronte" : "retro"}`}
        </Text>
      </Pressable>

      <Text style={styles.uploadNote}>Max 10 MB · PNG / JPEG</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DocumentsScreen() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [docs, setDocs] = useState<DocumentSide[]>([
    { side: "front", label: "Fronte Documento", state: "empty", fileName: null },
    { side: "back", label: "Retro Documento", state: "empty", fileName: null },
  ]);

  const handleUpload = useCallback(async (side: "front" | "back") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permesso richiesto",
        "Abilita l'accesso alle foto nelle impostazioni per caricare il documento."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [16, 10],
    });

    if (result.canceled || !result.assets?.[0]) return;

    setDocs((prev) =>
      prev.map((d) => (d.side === side ? { ...d, state: "uploading" } : d))
    );

    // Upload happens client-side — the URI is kept locally until the
    // user taps "Invia per verifica" which persists to storage.
    const asset = result.assets[0];
    const fileName = asset.fileName ?? `id_${side}_${Date.now()}.jpg`;

    setDocs((prev) =>
      prev.map((d) =>
        d.side === side ? { ...d, state: "done", fileName } : d
      )
    );
  }, []);

  const allDone = docs.every((d) => d.state === "done");

  const handleSubmit = useCallback(() => {
    if (!allDone || isSubmitting) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1800);
  }, [allDone, isSubmitting]);

  const progressValue = docs.filter((d) => d.state === "done").length / docs.length;

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
      >
        {/* ── Title block ── */}
        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.pageHeading}>SICUREZZA E IDENTITÀ</Text>
          <Text style={styles.pageTitle}>Verifica documento</Text>
          <Text style={styles.subtitle}>
            Per garantire la sicurezza della nostra community, carica una fotografia
            chiara del tuo documento d'identità rilasciato dal governo.
          </Text>
        </View>

        {/* ── Status indicator ── */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusIconWrap}>
              <Ionicons
                name={submitted ? "checkmark-circle" : "hourglass-outline"}
                size={20}
                color={submitted ? Colors.success : Colors.warning}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusLabel}>
                {submitted ? "Inviato per Revisione" : "Verifica in Sospeso"}
              </Text>
              <Text style={styles.statusSub}>
                {submitted
                  ? "Riceverai una notifica entro 24 ore"
                  : "Carica entrambi i lati del documento"}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressValue * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {docs.filter((d) => d.state === "done").length} di {docs.length} lati caricati
          </Text>
        </View>

        {/* ── Upload sections ── */}
        {docs.map((doc) => (
          <UploadCard key={doc.side} doc={doc} onUpload={handleUpload} />
        ))}

        {/* ── Verification guide ── */}
        <View style={styles.guideCard}>
          <View style={styles.guideHeader}>
            <Ionicons name="information-circle" size={20} color={Colors.secondary} />
            <Text style={styles.guideTitle}>Guida alla Verifica</Text>
          </View>
          <View style={styles.guideTips}>
            {[
              "Assicurati che il documento sia ben illuminato e leggibile",
              "Tutti e quattro gli angoli devono essere visibili",
              "Evita riflessi o ombre che coprono i dati",
              "Il documento deve essere in corso di validità",
            ].map((tip, i) => (
              <View key={i} style={styles.guideTipRow}>
                <View style={styles.guideTipDot} />
                <Text style={styles.guideTipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Submit button ── */}
        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            !allDone && styles.submitBtnDisabled,
            submitted && styles.submitBtnSuccess,
            pressed && allDone && !submitted && styles.submitBtnPressed,
          ]}
          onPress={handleSubmit}
          disabled={!allDone || isSubmitting || submitted}
        >
          {submitted ? (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={Colors.textOnDark} />
              <Text style={styles.submitBtnText}>Inviato per Revisione</Text>
            </>
          ) : (
            <>
              <Ionicons
                name={isSubmitting ? "hourglass-outline" : "shield-checkmark-outline"}
                size={18}
                color={allDone ? Colors.textOnDark : Colors.textTertiary}
              />
              <Text style={[styles.submitBtnText, !allDone && styles.submitBtnTextDisabled]}>
                {isSubmitting ? "Invio in corso..." : "Invia per Revisione"}
              </Text>
            </>
          )}
        </Pressable>

        <Text style={styles.footerNote}>
          I tuoi documenti vengono trattati in modo sicuro e confidenziale nel rispetto
          del GDPR e delle normative sulla privacy.
        </Text>
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
    fontFamily: "PlusJakartaSans-ExtraBold",
  },

  // Scroll content
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },

  // Page heading
  pageHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: "PlusJakartaSans-ExtraBold",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: -0.6,
    fontFamily: "NotoSerif-Bold",
  },
  // Subtitle
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans-Regular",
  },

  // Status card
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  statusIconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.warningLight,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
    marginBottom: 2,
    fontFamily: "PlusJakartaSans-Bold",
  },
  statusSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: "PlusJakartaSans-Regular",
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: "500",
    textAlign: "right",
  },

  // Upload card
  uploadCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  uploadCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
    fontFamily: "PlusJakartaSans-Bold",
  },
  docPreview: {
    height: 140,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  docPreviewDone: {
    borderStyle: "solid",
    borderColor: Colors.secondary,
    backgroundColor: Colors.accentLight,
  },
  docDoneIcon: {
    marginBottom: 4,
  },
  docFileName: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.secondary,
    maxWidth: "70%",
    textAlign: "center",
  },
  // ID outline illustration
  idOutline: {
    width: 120,
    height: 76,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    ...Shadows.sm,
  },
  idChip: {
    width: 28,
    height: 22,
    borderRadius: 4,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  idLines: {
    flex: 1,
    gap: 6,
    justifyContent: "center",
  },
  idLine: {
    height: 6,
    width: "100%",
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 3,
  },
  docPreviewHint: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: "500",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 0,
    borderColor: Colors.secondary,
    backgroundColor: Colors.primary,
  },
  uploadBtnDone: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  uploadBtnDisabled: {
    opacity: 0.7,
  },
  uploadBtnPressed: {
    opacity: 0.88,
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textOnDark,
    fontFamily: "PlusJakartaSans-Bold",
  },
  uploadBtnTextDone: {
    color: Colors.success,
  },
  uploadNote: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: "center",
    fontWeight: "500",
  },

  // Guide card
  guideCard: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  guideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
    fontFamily: "PlusJakartaSans-Bold",
  },
  guideTips: {
    gap: Spacing.sm,
  },
  guideTipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  guideTipDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
    marginTop: 6,
    flexShrink: 0,
  },
  guideTipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    flex: 1,
    fontFamily: "PlusJakartaSans-Regular",
  },

  // Submit
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: 16,
    ...Shadows.md,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.surfaceElevated,
    ...Shadows.sm,
  },
  submitBtnSuccess: {
    backgroundColor: Colors.success,
  },
  submitBtnPressed: {
    opacity: 0.88,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textOnDark,
    fontFamily: "PlusJakartaSans-Bold",
  },
  submitBtnTextDisabled: {
    color: Colors.textTertiary,
  },

  // Footer note
  footerNote: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: "center",
    lineHeight: 18,
  },
});
