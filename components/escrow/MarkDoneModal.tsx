import { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  markBookingDone,
  PhotoRejectedError,
  uploadAndModerateBookingPhoto,
} from "../../lib/api";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 6;
const ROOM_SUGGESTIONS = ["Cucina", "Bagno", "Soggiorno", "Camera", "Altro"];

interface MarkDoneModalProps {
  visible: boolean;
  bookingId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface PhotoSlot {
  uri: string;
  uploading: boolean;
  uploaded: boolean;
  photoUrl?: string;
  roomLabel?: string;
  error?: string;
}

export function MarkDoneModal({
  visible,
  bookingId,
  onClose,
  onSuccess,
}: MarkDoneModalProps) {
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const pickPhoto = async (mode: "camera" | "library") => {
    if (photos.length >= MAX_PHOTOS) return;

    if (mode === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permesso fotocamera", "Abilita l'accesso alla fotocamera nelle impostazioni.");
        return;
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permesso galleria", "Abilita l'accesso alle foto nelle impostazioni.");
        return;
      }
    }

    const launcher =
      mode === "camera"
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

    const result = await launcher({
      mediaTypes: ["images"],
      quality: 0.6,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;

    setPhotos((prev) => [
      ...prev,
      { uri, uploading: false, uploaded: false },
    ]);
  };

  const choosePhoto = () => {
    Alert.alert(
      "Aggiungi foto",
      "Scatta una foto del lavoro completato",
      [
        { text: "Fotocamera", onPress: () => pickPhoto("camera") },
        { text: "Galleria", onPress: () => pickPhoto("library") },
        { text: "Annulla", style: "cancel" },
      ]
    );
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const setRoomLabel = (idx: number, label: string) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], roomLabel: label };
      return next;
    });
  };

  const handleSubmit = async () => {
    if (photos.length < MIN_PHOTOS) {
      Alert.alert(
        "Servono più foto",
        `Carica almeno ${MIN_PHOTOS} foto del lavoro completato per procedere.`
      );
      return;
    }
    setSubmitting(true);

    try {
      // Upload + moderation in sequenza per gestione errori chiara
      const updated = [...photos];
      for (let i = 0; i < updated.length; i++) {
        if (updated[i].uploaded) continue;
        updated[i] = { ...updated[i], uploading: true, error: undefined };
        setPhotos([...updated]);

        try {
          const { photoUrl } = await uploadAndModerateBookingPhoto({
            bookingId,
            uri: updated[i].uri,
            type: "after_cleaner",
            roomLabel: updated[i].roomLabel,
          });
          updated[i] = {
            ...updated[i],
            uploading: false,
            uploaded: true,
            photoUrl,
          };
        } catch (err) {
          if (err instanceof PhotoRejectedError) {
            updated[i] = {
              ...updated[i],
              uploading: false,
              error: err.friendlyMessage,
            };
            setPhotos([...updated]);
            Alert.alert("Foto non ammessa", err.friendlyMessage);
            setSubmitting(false);
            return;
          }
          throw err;
        }
        setPhotos([...updated]);
      }

      // Mark done after all photos uploaded
      await markBookingDone(bookingId);

      Alert.alert(
        "Lavoro segnalato come completato",
        "Il cliente ha 48h per confermare. Riceverai il pagamento dopo la conferma o automaticamente dopo 48h.",
        [{ text: "Ok", onPress: onSuccess }]
      );
    } catch (err: any) {
      Alert.alert("Errore", err?.message ?? "Riprova più tardi");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = photos.length >= MIN_PHOTOS && !submitting;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} disabled={submitting}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Lavoro completato</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.intro}>
            Carica almeno {MIN_PHOTOS} foto del lavoro completato.{"\n"}
            Servono come prova in caso di contestazione.
          </Text>

          <View style={styles.photoGrid}>
            {photos.map((photo, idx) => (
              <View key={idx} style={styles.photoCard}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                {photo.uploading && (
                  <View style={styles.photoOverlay}>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.photoOverlayText}>Verifica...</Text>
                  </View>
                )}
                {photo.uploaded && (
                  <View style={[styles.photoOverlay, styles.photoOverlaySuccess]}>
                    <Ionicons name="checkmark-circle" size={28} color="#22c55e" />
                  </View>
                )}
                {photo.error && (
                  <View style={[styles.photoOverlay, styles.photoOverlayError]}>
                    <Ionicons name="alert-circle" size={28} color="#ef4444" />
                  </View>
                )}
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => removePhoto(idx)}
                  disabled={submitting}
                  hitSlop={10}
                >
                  <Ionicons name="close-circle" size={22} color="#fff" />
                </Pressable>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.roomChips}
                >
                  {ROOM_SUGGESTIONS.map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setRoomLabel(idx, r)}
                      disabled={submitting}
                      style={[
                        styles.roomChip,
                        photo.roomLabel === r && styles.roomChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roomChipText,
                          photo.roomLabel === r && styles.roomChipTextActive,
                        ]}
                      >
                        {r}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ))}

            {photos.length < MAX_PHOTOS && (
              <Pressable
                style={styles.addPhotoBtn}
                onPress={choosePhoto}
                disabled={submitting}
              >
                <Ionicons name="camera-outline" size={28} color={Colors.primary} />
                <Text style={styles.addPhotoText}>Aggiungi foto</Text>
                <Text style={styles.addPhotoSubtext}>
                  {photos.length}/{MAX_PHOTOS}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.warning}>
            <Ionicons name="information-circle" size={18} color="#9a6c00" />
            <Text style={styles.warningText}>
              Le foto vengono verificate automaticamente. Carica solo foto del lavoro di pulizia.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                Conferma lavoro completato
              </Text>
            )}
          </Pressable>
          <Text style={styles.footerHint}>
            {photos.length}/{MIN_PHOTOS} foto minime
            {photos.length < MIN_PHOTOS &&
              ` — mancano ${MIN_PHOTOS - photos.length}`}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
  body: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  intro: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  photoCard: {
    width: "47%",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: "hidden",
    ...Shadows.sm,
  },
  photo: { width: "100%", height: 140 },
  photoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 60,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoOverlaySuccess: { backgroundColor: "rgba(34,197,94,0.15)" },
  photoOverlayError: { backgroundColor: "rgba(239,68,68,0.15)" },
  photoOverlayText: { color: "#fff", fontSize: 12 },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
  roomChips: { paddingHorizontal: 8, paddingVertical: 8, gap: 6 },
  roomChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 6,
  },
  roomChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roomChipText: { fontSize: 11, color: Colors.textSecondary },
  roomChipTextActive: { color: "#fff", fontWeight: "600" },
  addPhotoBtn: {
    width: "47%",
    height: 192,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: "dashed",
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addPhotoText: { fontSize: 14, color: Colors.primary, fontWeight: "600" },
  addPhotoSubtext: { fontSize: 11, color: Colors.textSecondary },
  warning: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#fef3c7",
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
  },
  warningText: { flex: 1, fontSize: 13, color: "#9a6c00", lineHeight: 18 },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  submitBtnDisabled: { backgroundColor: Colors.textSecondary, opacity: 0.5 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  footerHint: {
    textAlign: "center",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});
