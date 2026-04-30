import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  openBookingDispute,
  PhotoRejectedError,
  uploadAndModerateBookingPhoto,
} from "../../lib/api";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";

const MIN_PHOTOS = 1;
const MAX_PHOTOS = 6;
const MIN_REASON = 20;
const MAX_REASON = 2000;

interface DisputeModalProps {
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
}

export function DisputeModal({
  visible,
  bookingId,
  onClose,
  onSuccess,
}: DisputeModalProps) {
  const [reason, setReason] = useState("");
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reasonLen = reason.trim().length;
  const reasonValid = reasonLen >= MIN_REASON && reasonLen <= MAX_REASON;
  const canSubmit = reasonValid && photos.length >= MIN_PHOTOS && !submitting;

  const pickPhoto = async (mode: "camera" | "library") => {
    if (photos.length >= MAX_PHOTOS) return;

    if (mode === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permesso fotocamera", "Abilita l'accesso nelle impostazioni.");
        return;
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permesso galleria", "Abilita l'accesso nelle impostazioni.");
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

    setPhotos((prev) => [...prev, { uri, uploading: false, uploaded: false }]);
  };

  const choosePhoto = () => {
    Alert.alert("Aggiungi foto", "Mostra il problema riscontrato", [
      { text: "Fotocamera", onPress: () => pickPhoto("camera") },
      { text: "Galleria", onPress: () => pickPhoto("library") },
      { text: "Annulla", style: "cancel" },
    ]);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const updated = [...photos];
      for (let i = 0; i < updated.length; i++) {
        if (updated[i].uploaded) continue;
        updated[i] = { ...updated[i], uploading: true };
        setPhotos([...updated]);

        try {
          const { photoUrl } = await uploadAndModerateBookingPhoto({
            bookingId,
            uri: updated[i].uri,
            type: "dispute_client",
          });
          updated[i] = {
            ...updated[i],
            uploading: false,
            uploaded: true,
            photoUrl,
          };
        } catch (err) {
          if (err instanceof PhotoRejectedError) {
            updated[i] = { ...updated[i], uploading: false };
            setPhotos(updated.filter((_, j) => j !== i));
            Alert.alert("Foto non ammessa", err.friendlyMessage);
            setSubmitting(false);
            return;
          }
          throw err;
        }
        setPhotos([...updated]);
      }

      await openBookingDispute(bookingId, reason);

      Alert.alert(
        "Contestazione aperta",
        "CleanHome esaminerà il caso entro 5 giorni lavorativi. Il pagamento al cleaner è temporaneamente sospeso.",
        [{ text: "Ok", onPress: onSuccess }]
      );
    } catch (err: any) {
      Alert.alert("Errore", err?.message ?? "Riprova più tardi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12} disabled={submitting}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Segnala un problema</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.warning}>
              <Ionicons name="alert-circle" size={20} color="#9a6c00" />
              <Text style={styles.warningText}>
                Apri una contestazione solo se il servizio non è stato eseguito o è stato fatto male. Il pagamento al cleaner verrà sospeso fino alla risoluzione.
              </Text>
            </View>

            <Text style={styles.label}>Cosa è successo?</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={6}
              placeholder="Descrivi il problema in dettaglio: cosa non è stato pulito, com'era prima, com'è adesso..."
              placeholderTextColor={Colors.textSecondary}
              value={reason}
              onChangeText={setReason}
              maxLength={MAX_REASON}
              editable={!submitting}
              textAlignVertical="top"
            />
            <Text
              style={[
                styles.counter,
                !reasonValid && reasonLen > 0 && styles.counterError,
              ]}
            >
              {reasonLen}/{MIN_REASON} caratteri minimi
            </Text>

            <Text style={[styles.label, { marginTop: Spacing.lg }]}>
              Foto del problema (min {MIN_PHOTOS}, max {MAX_PHOTOS})
            </Text>
            <Text style={styles.hint}>
              Fai foto chiare delle aree non pulite o del problema. Le foto non idonee verranno rifiutate.
            </Text>

            <View style={styles.photoGrid}>
              {photos.map((photo, idx) => (
                <View key={idx} style={styles.photoCard}>
                  <Image source={{ uri: photo.uri }} style={styles.photo} />
                  {photo.uploading && (
                    <View style={styles.photoOverlay}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  )}
                  {photo.uploaded && (
                    <View style={[styles.photoOverlay, styles.photoOverlaySuccess]}>
                      <Ionicons name="checkmark-circle" size={28} color="#22c55e" />
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
                <Text style={styles.submitText}>Apri contestazione</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
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
  warning: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fef3c7",
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
  },
  warningText: { flex: 1, fontSize: 13, color: "#9a6c00", lineHeight: 18 },
  label: { fontSize: 14, fontWeight: "600", color: Colors.text, marginBottom: 8 },
  hint: { fontSize: 12, color: Colors.textSecondary, marginBottom: Spacing.md },
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 15,
    color: Colors.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  counter: { fontSize: 12, color: Colors.textSecondary, marginTop: 6, textAlign: "right" },
  counterError: { color: "#ef4444" },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  photoCard: {
    width: "47%",
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: "hidden",
    ...Shadows.sm,
  },
  photo: { width: "100%", height: "100%" },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoOverlaySuccess: { backgroundColor: "rgba(34,197,94,0.15)" },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
  addPhotoBtn: {
    width: "47%",
    aspectRatio: 1,
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
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  submitBtn: {
    backgroundColor: "#dc2626",
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  submitBtnDisabled: { backgroundColor: Colors.textSecondary, opacity: 0.5 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
