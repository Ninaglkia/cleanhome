// ============================================================================
// Screen: Nuova casa / Modifica casa — premium rebuild
// ----------------------------------------------------------------------------
// Rebuilt from scratch to feel premium: photo-hero layout, card-based
// sections with proper breathing room, animated room chips, inline error
// messages per field, cover photo (mandatory) + optional room photos
// uploaded to Supabase Storage, and a Google Vision API content check
// that rejects non-house images before the photo is persisted on DB.
// ============================================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useAuth } from "../../lib/auth";
import {
  createClientProperty,
  deleteClientProperty,
  fetchClientProperties,
  updateClientProperty,
  uploadPropertyPhoto,
  validatePropertyPhoto,
} from "../../lib/api";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";
import type { ClientProperty } from "../../lib/types";

const ROOM_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const NAME_MAX = 60;
const ADDRESS_MAX = 255;
const NOTES_MAX = 500;
const MAX_ROOM_PHOTOS = 6;

export default function PropertyEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const { user } = useAuth();
  const router = useRouter();

  // ── Form state ────────────────────────────────────────────
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  // Address autocomplete state — mirrors the cleaner wizard city
  // picker but filtered to full Italian addresses instead of cities.
  // addressLatLng is only set when the user taps a real Google Places
  // suggestion, so free-typed junk can never pass validation.
  const [addressLatLng, setAddressLatLng] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<
    Array<{ placeId: string; mainText: string; secondaryText: string }>
  >([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressAbortRef = useRef<AbortController | null>(null);
  const [numRooms, setNumRooms] = useState<number>(2);
  const [sqm, setSqm] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [roomPhotos, setRoomPhotos] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || "";

  // ── Google Places address autocomplete ────────────────────
  const handleAddressChange = useCallback(
    (text: string) => {
      setAddress(text);
      // Invalidate the previous latlng pick on any edit — force the
      // user to re-pick from the dropdown before they can save.
      setAddressLatLng(null);

      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
      if (addressAbortRef.current) addressAbortRef.current.abort();

      const trimmed = text.trim();
      if (trimmed.length < 3 || !GOOGLE_PLACES_KEY) {
        setAddressSuggestions([]);
        setAddressSearching(false);
        return;
      }

      setAddressSearching(true);
      addressDebounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        addressAbortRef.current = controller;
        try {
          const res = await fetch(
            "https://places.googleapis.com/v1/places:autocomplete",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
              },
              body: JSON.stringify({
                input: trimmed,
                languageCode: "it",
                regionCode: "it",
                includedRegionCodes: ["it"],
                // Street addresses, not cities or POIs.
                includedPrimaryTypes: ["street_address", "premise", "route"],
              }),
              signal: controller.signal,
            }
          );
          const data = (await res.json()) as {
            suggestions?: Array<{
              placePrediction?: {
                placeId: string;
                structuredFormat?: {
                  mainText?: { text: string };
                  secondaryText?: { text: string };
                };
                text?: { text: string };
              };
            }>;
          };

          const mapped = (data.suggestions || [])
            .map((s) => s.placePrediction)
            .filter((p): p is NonNullable<typeof p> => !!p)
            .map((p) => ({
              placeId: p.placeId,
              mainText: p.structuredFormat?.mainText?.text || p.text?.text || "",
              secondaryText: p.structuredFormat?.secondaryText?.text || "",
            }))
            .filter((p) => p.mainText.length > 0)
            .slice(0, 5);

          setAddressSuggestions(mapped);
        } catch (err) {
          if ((err as Error).name !== "AbortError") {
            setAddressSuggestions([]);
          }
        } finally {
          setAddressSearching(false);
        }
      }, 300);
    },
    [GOOGLE_PLACES_KEY]
  );

  const handleSelectAddress = useCallback(
    async (suggestion: { placeId: string; mainText: string; secondaryText: string }) => {
      // Lock the text to the full formatted address so saving captures
      // the canonical form from Google rather than whatever the user typed.
      const fullText = suggestion.secondaryText
        ? `${suggestion.mainText}, ${suggestion.secondaryText}`
        : suggestion.mainText;
      setAddress(fullText);
      setAddressSuggestions([]);

      // Fetch the place details to get coordinates. Using the Location-only
      // field mask keeps the Place Details billing tier at its minimum.
      if (!GOOGLE_PLACES_KEY) return;
      try {
        const res = await fetch(
          `https://places.googleapis.com/v1/places/${suggestion.placeId}`,
          {
            headers: {
              "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
              "X-Goog-FieldMask": "location",
            },
          }
        );
        const data = (await res.json()) as {
          location?: { latitude: number; longitude: number };
        };
        if (data.location) {
          setAddressLatLng({
            latitude: data.location.latitude,
            longitude: data.location.longitude,
          });
        }
      } catch {
        // Non-fatal: the address is set, just no coordinates. Save will
        // still fail validation until the user picks again.
      }
    },
    [GOOGLE_PLACES_KEY]
  );

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingRoom, setUploadingRoom] = useState(false);

  // Entrance animation for the hero photo zone — soft scale-in
  const heroOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.96);

  useEffect(() => {
    heroOpacity.value = withTiming(1, { duration: 500 });
    heroScale.value = withSpring(1, { damping: 18, stiffness: 170 });
  }, []);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));

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
        // When editing, trust the coordinates already stored on DB —
        // they were previously validated when first picked. The address
        // field is still editable, but editing clears the latlng so the
        // user has to re-pick if they change it.
        if (row.latitude != null && row.longitude != null) {
          setAddressLatLng({
            latitude: row.latitude,
            longitude: row.longitude,
          });
        }
        setNumRooms(row.num_rooms);
        setSqm(row.sqm ? String(row.sqm) : "");
        setNotes(row.notes ?? "");
        setIsDefault(row.is_default);
        setCoverPhoto(row.cover_photo_url ?? row.photo_url ?? null);
        setRoomPhotos(row.room_photo_urls ?? []);
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

  // ── Photo pick + validate + upload ────────────────────────
  const pickAndUpload = useCallback(
    async (kind: "cover" | "room") => {
      if (!user) return;
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permesso richiesto",
          "Per caricare una foto dobbiamo accedere alla tua libreria foto."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
        exif: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      if (kind === "cover") setUploadingCover(true);
      else setUploadingRoom(true);

      try {
        // First: validate content with Google Vision API
        const validation = await validatePropertyPhoto(asset.uri);
        if (!validation.isValid) {
          Alert.alert(
            "Foto non valida",
            validation.reason ??
              "La foto non sembra rappresentare una casa. Riprova con una foto dell'interno della tua abitazione."
          );
          return;
        }
        // Then: upload to storage
        const publicUrl = await uploadPropertyPhoto(user.id, asset.uri, kind);
        if (kind === "cover") {
          setCoverPhoto(publicUrl);
        } else {
          setRoomPhotos((prev) => [...prev, publicUrl]);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Caricamento fallito";
        Alert.alert("Errore", msg);
      } finally {
        if (kind === "cover") setUploadingCover(false);
        else setUploadingRoom(false);
      }
    },
    [user]
  );

  const removeCoverPhoto = useCallback(() => {
    Alert.alert(
      "Rimuovere la foto di copertina?",
      "Dovrai caricarne un'altra prima di salvare.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Rimuovi",
          style: "destructive",
          onPress: () => setCoverPhoto(null),
        },
      ]
    );
  }, []);

  const removeRoomPhoto = useCallback((index: number) => {
    setRoomPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Validation ────────────────────────────────────────────
  const fieldErrors = useMemo(() => {
    const errors: {
      name?: string;
      address?: string;
      sqm?: string;
      notes?: string;
      cover?: string;
    } = {};
    if (name.trim().length === 0) {
      errors.name = "Dai un nome alla casa";
    } else if (name.trim().length > NAME_MAX) {
      errors.name = `Massimo ${NAME_MAX} caratteri`;
    }
    if (address.trim().length === 0) {
      errors.address = "L'indirizzo è obbligatorio";
    } else if (address.trim().length > ADDRESS_MAX) {
      errors.address = `Massimo ${ADDRESS_MAX} caratteri`;
    } else if (!addressLatLng) {
      // Address was typed free-hand but never picked from the Google
      // autocomplete dropdown — it might be fake. Force the user to
      // pick a verified address.
      errors.address = "Seleziona un indirizzo dalla lista suggerita";
    }
    if (sqm) {
      const n = Number(sqm);
      if (!Number.isFinite(n)) errors.sqm = "Inserisci un numero";
      else if (n < 10) errors.sqm = "Minimo 10 m²";
      else if (n > 2000) errors.sqm = "Massimo 2000 m²";
    }
    if (notes.length > NOTES_MAX) {
      errors.notes = `Massimo ${NOTES_MAX} caratteri`;
    }
    if (!coverPhoto) {
      errors.cover = "La foto di copertina è obbligatoria";
    }
    return errors;
  }, [name, address, addressLatLng, sqm, notes, coverPhoto]);

  const isValid = useMemo(
    () => Object.keys(fieldErrors).length === 0 && numRooms >= 1 && numRooms <= 50,
    [fieldErrors, numRooms]
  );

  // ── Save ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!user || saving) return;
    if (!isValid) {
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
        photo_url: coverPhoto, // backward compat
        cover_photo_url: coverPhoto,
        room_photo_urls: roomPhotos,
        is_default: isDefault,
        // lat/lng persisted so the home map can render a pin for this
        // property without having to re-geocode the address.
        latitude: addressLatLng?.latitude ?? null,
        longitude: addressLatLng?.longitude ?? null,
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
    saving,
    isValid,
    name,
    address,
    addressLatLng,
    numRooms,
    sqm,
    notes,
    coverPhoto,
    roomPhotos,
    isDefault,
    isEdit,
    id,
    router,
  ]);

  // Cleanup debounce + abort on unmount
  useEffect(() => {
    return () => {
      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
      if (addressAbortRef.current) addressAbortRef.current.abort();
    };
  }, []);

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
                err instanceof Error ? err.message : "Impossibile eliminare.";
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
    if (router.canGoBack()) router.back();
    else router.replace("/properties");
  }, [router]);

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        <Pressable
          onPress={handleClose}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isEdit ? "Modifica casa" : "Nuova casa"}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─────────────────────── HERO: Cover photo ─────────────────────── */}
          <Animated.View style={[styles.heroWrap, heroStyle]}>
            {coverPhoto ? (
              <View style={styles.coverPhotoContainer}>
                <Image source={{ uri: coverPhoto }} style={styles.coverPhoto} />
                <View style={styles.coverPhotoOverlay} />
                <Pressable
                  onPress={removeCoverPhoto}
                  style={styles.coverRemoveBtn}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() => pickAndUpload("cover")}
                  style={styles.coverReplaceBtn}
                >
                  <Ionicons name="camera-reverse-outline" size={16} color="#fff" />
                  <Text style={styles.coverReplaceText}>Cambia</Text>
                </Pressable>
                <View style={styles.coverBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />
                  <Text style={styles.coverBadgeText}>Verificata</Text>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => pickAndUpload("cover")}
                disabled={uploadingCover}
                style={({ pressed }) => [
                  styles.coverPlaceholder,
                  showErrors && fieldErrors.cover && styles.coverPlaceholderError,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {uploadingCover ? (
                  <>
                    <ActivityIndicator size="large" color={Colors.secondary} />
                    <Text style={styles.coverPlaceholderHint}>
                      Verifica con AI in corso...
                    </Text>
                  </>
                ) : (
                  <>
                    <View style={styles.coverPlaceholderIconCircle}>
                      <Ionicons
                        name="camera"
                        size={32}
                        color={Colors.secondary}
                      />
                    </View>
                    <Text style={styles.coverPlaceholderTitle}>
                      Foto di copertina
                    </Text>
                    <Text style={styles.coverPlaceholderHint}>
                      Tocca per scegliere una foto dell'ingresso o del salone{"\n"}
                      della casa. Obbligatoria.
                    </Text>
                  </>
                )}
              </Pressable>
            )}
            {showErrors && fieldErrors.cover && !coverPhoto ? (
              <Text style={styles.fieldError}>{fieldErrors.cover}</Text>
            ) : null}
          </Animated.View>

          {/* ─────────────────────── Dettagli ─────────────────────── */}
          <View style={styles.card}>
            <SectionHeader
              icon="information-circle-outline"
              title="Dettagli"
              subtitle="Come riconoscerla al volo"
            />

            <FieldBlock label="Nome della casa">
              <InputRow
                icon="pricetag-outline"
                value={name}
                onChangeText={(t) => setName(t.slice(0, NAME_MAX))}
                placeholder="Es. Casa mamma, Airbnb Navigli"
                error={showErrors ? fieldErrors.name : undefined}
                maxLength={NAME_MAX}
                showLength
              />
            </FieldBlock>

            <FieldBlock label="Indirizzo">
              <View>
                <InputRow
                  icon="location-outline"
                  value={address}
                  onChangeText={(t) => handleAddressChange(t.slice(0, ADDRESS_MAX))}
                  placeholder="Inizia a scrivere (es. Via Roma 12)"
                  error={showErrors ? fieldErrors.address : undefined}
                  maxLength={ADDRESS_MAX}
                  trailing={
                    addressSearching ? (
                      <ActivityIndicator size="small" color={Colors.secondary} />
                    ) : addressLatLng ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={Colors.success}
                      />
                    ) : undefined
                  }
                />
                {addressSuggestions.length > 0 && (
                  <View style={styles.suggestionsList}>
                    {addressSuggestions.map((s, idx) => (
                      <Pressable
                        key={s.placeId}
                        onPress={() => handleSelectAddress(s)}
                        style={({ pressed }) => [
                          styles.suggestionRow,
                          idx > 0 && styles.suggestionRowBordered,
                          pressed && { backgroundColor: Colors.backgroundAlt },
                        ]}
                      >
                        <Ionicons
                          name="location"
                          size={16}
                          color={Colors.secondary}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={styles.suggestionMain}
                            numberOfLines={1}
                          >
                            {s.mainText}
                          </Text>
                          {s.secondaryText ? (
                            <Text
                              style={styles.suggestionSecondary}
                              numberOfLines={1}
                            >
                              {s.secondaryText}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
                {address.trim().length >= 3 &&
                  !addressSearching &&
                  addressSuggestions.length === 0 &&
                  !addressLatLng && (
                    <Text style={styles.fieldHint}>
                      Nessun indirizzo trovato — prova ad aggiungere la città
                    </Text>
                  )}
              </View>
            </FieldBlock>
          </View>

          {/* ─────────────────────── Dimensioni ─────────────────────── */}
          <View style={styles.card}>
            <SectionHeader
              icon="home-outline"
              title="Dimensioni"
              subtitle="Aiuta il pulitore a prepararsi"
            />

            <FieldBlock label="Numero di stanze">
              <View style={styles.roomGrid}>
                {ROOM_OPTIONS.map((n) => (
                  <RoomChip
                    key={n}
                    value={n}
                    selected={numRooms === n}
                    onPress={() => setNumRooms(n)}
                  />
                ))}
              </View>
            </FieldBlock>

            <FieldBlock label="Metri quadri (opzionale)">
              <InputRow
                icon="resize-outline"
                value={sqm}
                onChangeText={(t) => setSqm(t.replace(/[^0-9]/g, ""))}
                placeholder="Es. 85"
                keyboardType="number-pad"
                maxLength={4}
                trailing={<Text style={styles.trailingUnit}>m²</Text>}
                error={showErrors ? fieldErrors.sqm : undefined}
              />
            </FieldBlock>
          </View>

          {/* ─────────────────────── Foto delle stanze ─────────────────────── */}
          <View style={styles.card}>
            <SectionHeader
              icon="images-outline"
              title="Foto delle stanze"
              subtitle="Mostra le aree da pulire al pulitore (opzionale)"
            />

            <View style={styles.roomPhotoGrid}>
              {roomPhotos.map((uri, idx) => (
                <View key={`${uri}-${idx}`} style={styles.roomPhotoThumb}>
                  <Image source={{ uri }} style={styles.roomPhotoImg} />
                  <Pressable
                    onPress={() => removeRoomPhoto(idx)}
                    style={styles.roomPhotoRemove}
                    hitSlop={6}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {roomPhotos.length < MAX_ROOM_PHOTOS && (
                <Pressable
                  onPress={() => pickAndUpload("room")}
                  disabled={uploadingRoom}
                  style={({ pressed }) => [
                    styles.roomPhotoAdd,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  {uploadingRoom ? (
                    <ActivityIndicator color={Colors.secondary} />
                  ) : (
                    <>
                      <Ionicons
                        name="add"
                        size={28}
                        color={Colors.secondary}
                      />
                      <Text style={styles.roomPhotoAddText}>Aggiungi</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            <View style={styles.aiNoticeRow}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color={Colors.secondary}
              />
              <Text style={styles.aiNoticeText}>
                Verificate automaticamente — vengono accettate solo foto di case
                e ambienti domestici
              </Text>
            </View>
          </View>

          {/* ─────────────────────── Note ─────────────────────── */}
          <View style={styles.card}>
            <SectionHeader
              icon="document-text-outline"
              title="Note per il pulitore"
              subtitle="Istruzioni fisse che valgono sempre (opzionale)"
            />

            <InputRow
              icon="create-outline"
              value={notes}
              onChangeText={(t) => setNotes(t.slice(0, NOTES_MAX))}
              placeholder="Es. Le chiavi sono dal portinaio, c'è un gatto, materiali già presenti"
              error={showErrors ? fieldErrors.notes : undefined}
              maxLength={NOTES_MAX}
              multiline
              minHeight={100}
              showLength
            />
          </View>

          {/* ─────────────────────── Predefinita ─────────────────────── */}
          <View style={styles.defaultCard}>
            <View style={styles.defaultIcon}>
              <Ionicons name="star" size={18} color={Colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.defaultTitle}>Casa predefinita</Text>
              <Text style={styles.defaultSub}>
                Appare sempre per prima quando prenoti una pulizia.
              </Text>
            </View>
            <Switch
              value={isDefault}
              onValueChange={setIsDefault}
              trackColor={{ false: Colors.border, true: Colors.secondary }}
              thumbColor="#fff"
              ios_backgroundColor={Colors.border}
            />
          </View>

          {/* ─────────────────────── Delete ─────────────────────── */}
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

        {/* ── Save bar sticky ── */}
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
    </SafeAreaView>
  );
}

// ───────────────────────────── Sub components ─────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={18} color={Colors.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: Spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

interface InputRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  error?: string;
  maxLength?: number;
  keyboardType?: "default" | "number-pad" | "email-address";
  multiline?: boolean;
  minHeight?: number;
  trailing?: React.ReactNode;
  showLength?: boolean;
}

function InputRow({
  icon,
  value,
  onChangeText,
  placeholder,
  error,
  maxLength,
  keyboardType = "default",
  multiline = false,
  minHeight,
  trailing,
  showLength = false,
}: InputRowProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <View
        style={[
          styles.inputWrap,
          focused && styles.inputWrapFocused,
          error && styles.inputWrapError,
          multiline && {
            alignItems: "flex-start",
            paddingTop: 14,
            minHeight: minHeight ?? 64,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={
            error
              ? Colors.error
              : focused
              ? Colors.secondary
              : Colors.textTertiary
          }
          style={multiline ? { marginTop: 2 } : undefined}
        />
        <TextInput
          style={[styles.input, multiline && { textAlignVertical: "top" }]}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          maxLength={maxLength}
          keyboardType={keyboardType}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {trailing}
      </View>
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : showLength && maxLength ? (
        <Text style={styles.fieldHint}>
          {value.length}/{maxLength} caratteri
        </Text>
      ) : null}
    </View>
  );
}

function RoomChip({
  value,
  selected,
  onPress,
}: {
  value: number;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPress={() => {
        scale.value = withSequence(
          withTiming(0.92, { duration: 90, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 150, easing: Easing.out(Easing.back(2)) })
        );
        onPress();
      }}
    >
      <Animated.View
        style={[styles.roomChip, selected && styles.roomChipSelected, animStyle]}
      >
        <Text
          style={[
            styles.roomChipText,
            selected && styles.roomChipTextSelected,
          ]}
        >
          {value}
        </Text>
        <Text
          style={[
            styles.roomChipLabel,
            selected && styles.roomChipLabelSelected,
          ]}
        >
          {value === 1 ? "stanza" : "stanze"}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ───────────────────────────── Styles ─────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

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

  scroll: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 140,
  },

  // ── HERO cover photo ──
  heroWrap: {
    marginBottom: Spacing.lg,
  },
  coverPhotoContainer: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: Radius.xl,
    overflow: "hidden",
    backgroundColor: Colors.surfaceElevated,
    ...Shadows.md,
  },
  coverPhoto: { width: "100%", height: "100%" },
  coverPhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  coverRemoveBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverReplaceBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(2, 36, 32, 0.82)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  coverReplaceText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  coverBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  coverBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  coverPlaceholder: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: "dashed",
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  coverPlaceholderError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  coverPlaceholderIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  coverPlaceholderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  coverPlaceholderHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 17,
  },

  // ── Card containers ──
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textSecondary,
  },

  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  fieldError: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: Colors.error,
  },

  // ── Input rows ──
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.base,
    height: 52,
  },
  inputWrapFocused: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.surface,
  },
  inputWrapError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    height: "100%",
  },
  trailingUnit: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontWeight: "700",
  },

  // --- Suggestions dropdown ---
  suggestionsList: {
    marginTop: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  suggestionRowBordered: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  suggestionMain: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  suggestionSecondary: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // ── Room chips ──
  roomGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  roomChip: {
    width: 74,
    height: 74,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  roomChipSelected: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.accentLight,
  },
  roomChipText: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  roomChipTextSelected: {
    color: Colors.secondary,
  },
  roomChipLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  roomChipLabelSelected: {
    color: Colors.secondary,
  },

  // ── Room photo grid ──
  roomPhotoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: Spacing.md,
  },
  roomPhotoThumb: {
    width: 90,
    height: 90,
    borderRadius: Radius.md,
    overflow: "hidden",
    position: "relative",
  },
  roomPhotoImg: { width: "100%", height: "100%" },
  roomPhotoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  roomPhotoAdd: {
    width: 90,
    height: 90,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceElevated,
  },
  roomPhotoAddText: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "800",
    color: Colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  aiNoticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  aiNoticeText: {
    flex: 1,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },

  // ── Default toggle ──
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
    marginBottom: Spacing.md,
  },
  defaultIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  defaultTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
  },
  defaultSub: {
    marginTop: 3,
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // ── Delete ──
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

  // ── Save bar ──
  saveBar: {
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
