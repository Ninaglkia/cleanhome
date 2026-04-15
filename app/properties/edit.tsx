// ============================================================================
// Screen: Aggiungi / Modifica casa
// ----------------------------------------------------------------------------
// Single screen that handles both the "add new property" and "edit existing"
// flows. If navigated to with a `?id=<uuid>` param, it fetches the existing
// row, populates the form, and shows a Delete button. Otherwise it behaves as
// an empty creation form. Saves via `createClientProperty` / `updateClientProperty`
// and routes back to the list on success.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import {
  createClientProperty,
  deleteClientProperty,
  fetchClientProperties,
  updateClientProperty,
} from "../../lib/api";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";
import type { ClientProperty } from "../../lib/types";

const ROOM_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const NAME_MAX = 60;
const ADDRESS_MAX = 255;
const NOTES_MAX = 500;

export default function PropertyEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const { user } = useAuth();
  const router = useRouter();

  // ── Form state ────────────────────────────────────────────
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [numRooms, setNumRooms] = useState<number>(2);
  const [sqm, setSqm] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Load existing row when editing ────────────────────────
  useEffect(() => {
    if (!isEdit || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await fetchClientProperties(user.id);
        if (cancelled) return;
        const row = all.find((p) => p.id === id) as ClientProperty | undefined;
        if (!row) {
          Alert.alert("Casa non trovata", "Potrebbe essere stata eliminata.", [
            { text: "OK", onPress: () => router.back() },
          ]);
          return;
        }
        setName(row.name);
        setAddress(row.address);
        setNumRooms(row.num_rooms);
        setSqm(row.sqm ? String(row.sqm) : "");
        setNotes(row.notes ?? "");
        setIsDefault(row.is_default);
      } catch (err) {
        console.error("[property edit] load error", err);
        Alert.alert("Errore", "Impossibile caricare la casa.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, id, user, router]);

  // ── Validation ────────────────────────────────────────────
  // Per-field error messages so the user can see exactly what's wrong
  // instead of just a disabled save button with no explanation.
  const fieldErrors = useMemo(() => {
    const errors: { name?: string; address?: string; sqm?: string; notes?: string } = {};
    if (name.trim().length === 0) {
      errors.name = "Dai un nome alla casa";
    } else if (name.trim().length > NAME_MAX) {
      errors.name = `Massimo ${NAME_MAX} caratteri`;
    }
    if (address.trim().length === 0) {
      errors.address = "L'indirizzo è obbligatorio";
    } else if (address.trim().length > ADDRESS_MAX) {
      errors.address = `Massimo ${ADDRESS_MAX} caratteri`;
    }
    if (sqm) {
      const n = Number(sqm);
      if (!Number.isFinite(n)) {
        errors.sqm = "Inserisci un numero";
      } else if (n < 10) {
        errors.sqm = "Minimo 10 m²";
      } else if (n > 2000) {
        errors.sqm = "Massimo 2000 m²";
      }
    }
    if (notes.length > NOTES_MAX) {
      errors.notes = `Massimo ${NOTES_MAX} caratteri`;
    }
    return errors;
  }, [name, address, sqm, notes]);

  const isValid = useMemo(
    () => Object.keys(fieldErrors).length === 0 && numRooms >= 1 && numRooms <= 50,
    [fieldErrors, numRooms]
  );

  // Only show errors AFTER the user has attempted to save at least once.
  // Showing validation errors on the very first render (when the form is
  // empty) would be noisy and confusing for the user.
  const [showErrors, setShowErrors] = useState(false);

  // ── Save ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!user || saving) return;
    if (!isValid) {
      // Reveal inline errors and scroll to the first invalid field via
      // a re-render — better than a blocking alert.
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        num_rooms: numRooms,
        sqm: sqm ? Number(sqm) : null,
        notes: notes.trim() ? notes.trim() : null,
        photo_url: null,
        is_default: isDefault,
      };

      if (isEdit && id) {
        await updateClientProperty(id, payload);
      } else {
        await createClientProperty(user.id, payload);
      }
      router.back();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Impossibile salvare la casa.";
      Alert.alert("Errore", msg);
    } finally {
      setSaving(false);
    }
  }, [
    user,
    isValid,
    saving,
    name,
    address,
    numRooms,
    sqm,
    notes,
    isDefault,
    isEdit,
    id,
    router,
  ]);

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!isEdit || !id) return;
    Alert.alert(
      "Eliminare questa casa?",
      "Le prenotazioni passate restano nello storico, ma non potrai più riusarla per nuove prenotazioni.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteClientProperty(id);
              router.back();
            } catch (err) {
              const msg =
                err instanceof Error
                  ? err.message
                  : "Impossibile eliminare la casa.";
              Alert.alert("Errore", msg);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [isEdit, id, router]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  // ── Render ────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        <Pressable
          onPress={handleClose}
          hitSlop={10}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isEdit ? "Modifica casa" : "Nuova casa"}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Nome ── */}
            <FieldGroup label="Dai un nome alla casa">
              <View
                style={[
                  styles.inputWrap,
                  showErrors && fieldErrors.name && styles.inputWrapError,
                ]}
              >
                <Ionicons
                  name="pricetag-outline"
                  size={18}
                  color={Colors.textTertiary}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Es. Casa mamma, Airbnb Navigli"
                  placeholderTextColor={Colors.textTertiary}
                  value={name}
                  onChangeText={(t) => setName(t.slice(0, NAME_MAX))}
                  maxLength={NAME_MAX}
                  returnKeyType="next"
                />
              </View>
              {showErrors && fieldErrors.name ? (
                <Text style={styles.fieldError}>{fieldErrors.name}</Text>
              ) : (
                <Text style={styles.fieldHint}>
                  Un nome che ti aiuta a riconoscerla al volo.
                </Text>
              )}
            </FieldGroup>

            {/* ── Indirizzo ── */}
            <FieldGroup label="Indirizzo">
              <View
                style={[
                  styles.inputWrap,
                  { alignItems: "flex-start", minHeight: 80, paddingTop: 14 },
                  showErrors && fieldErrors.address && styles.inputWrapError,
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={Colors.textTertiary}
                  style={{ marginTop: 2 }}
                />
                <TextInput
                  style={[styles.input, { textAlignVertical: "top", flex: 1 }]}
                  placeholder="Via, numero civico, città, CAP"
                  placeholderTextColor={Colors.textTertiary}
                  value={address}
                  onChangeText={(t) => setAddress(t.slice(0, ADDRESS_MAX))}
                  multiline
                  maxLength={ADDRESS_MAX}
                />
              </View>
              {showErrors && fieldErrors.address ? (
                <Text style={styles.fieldError}>{fieldErrors.address}</Text>
              ) : null}
            </FieldGroup>

            {/* ── Stanze ── */}
            <FieldGroup label="Numero di stanze">
              <View style={styles.roomRow}>
                {ROOM_OPTIONS.map((n) => {
                  const selected = numRooms === n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setNumRooms(n)}
                      style={({ pressed }) => [
                        styles.roomChip,
                        selected && styles.roomChipSelected,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.roomChipText,
                          selected && styles.roomChipTextSelected,
                        ]}
                      >
                        {n}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </FieldGroup>

            {/* ── Metri quadri (opzionale) ── */}
            <FieldGroup label="Metri quadri (opzionale)">
              <View
                style={[
                  styles.inputWrap,
                  showErrors && fieldErrors.sqm && styles.inputWrapError,
                ]}
              >
                <Ionicons
                  name="resize-outline"
                  size={18}
                  color={Colors.textTertiary}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Es. 85"
                  placeholderTextColor={Colors.textTertiary}
                  value={sqm}
                  onChangeText={(t) => setSqm(t.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  maxLength={4}
                />
                <Text style={{ color: Colors.textTertiary, fontSize: 14 }}>
                  m²
                </Text>
              </View>
              {showErrors && fieldErrors.sqm ? (
                <Text style={styles.fieldError}>{fieldErrors.sqm}</Text>
              ) : null}
            </FieldGroup>

            {/* ── Note per il pulitore ── */}
            <FieldGroup label="Note per il pulitore (opzionale)">
              <View
                style={[
                  styles.inputWrap,
                  { alignItems: "flex-start", minHeight: 100, paddingTop: 14 },
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={Colors.textTertiary}
                  style={{ marginTop: 2 }}
                />
                <TextInput
                  style={[styles.input, { textAlignVertical: "top", flex: 1 }]}
                  placeholder="Es. Le chiavi sono dal portinaio, c'è un gatto, materiali già presenti"
                  placeholderTextColor={Colors.textTertiary}
                  value={notes}
                  onChangeText={(t) => setNotes(t.slice(0, NOTES_MAX))}
                  multiline
                  maxLength={NOTES_MAX}
                />
              </View>
              <Text style={styles.fieldHint}>
                {notes.length}/{NOTES_MAX} caratteri
              </Text>
            </FieldGroup>

            {/* ── Imposta come predefinita ── */}
            <View style={styles.defaultCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.defaultTitle}>Casa predefinita</Text>
                <Text style={styles.defaultSub}>
                  Appare sempre per prima quando prenoti una pulizia.
                </Text>
              </View>
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{
                  false: Colors.border,
                  true: Colors.secondary,
                }}
                thumbColor="#fff"
                ios_backgroundColor={Colors.border}
              />
            </View>

            {/* ── Elimina (solo in edit) ── */}
            {isEdit && (
              <Pressable
                onPress={handleDelete}
                disabled={deleting}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  pressed && { opacity: 0.5 },
                ]}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
                <Text style={styles.deleteBtnText}>
                  {deleting ? "Eliminazione..." : "Elimina questa casa"}
                </Text>
              </Pressable>
            )}
          </ScrollView>

          {/* ── Save bar ── */}
          <View style={styles.saveBar}>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.saveBtn,
                saving && styles.saveBtnDisabled,
                pressed && !saving && { transform: [{ scale: 0.98 }] },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>
                    {isEdit ? "Salva modifiche" : "Salva casa"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

// ─── FieldGroup ────────────────────────────────────────────────────────────

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: Spacing.xl }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: Colors.text },

  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  scroll: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: 140,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.textTertiary,
  },
  fieldError: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: Colors.error,
  },
  inputWrapError: {
    borderColor: Colors.error,
  },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    height: "100%",
  },

  roomRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  roomChip: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  roomChipSelected: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  roomChipText: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  roomChipTextSelected: { color: "#fff" },

  defaultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
    marginBottom: Spacing.lg,
  },
  defaultTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
  },
  defaultSub: {
    marginTop: 3,
    fontSize: 13,
    color: Colors.textSecondary,
  },

  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: Spacing.base,
    borderRadius: Radius.md,
    backgroundColor: Colors.errorLight,
    marginTop: Spacing.sm,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.error,
  },

  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Platform.OS === "ios" ? 28 : Spacing.base,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
    ...Shadows.md,
  },
  saveBtnDisabled: {
    backgroundColor: Colors.textTertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
});
