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
  fetchAddressDetails,
  fetchClientProperties,
  searchAddresses,
  updateClientProperty,
  uploadPropertyPhoto,
  validatePropertyPhoto,
} from "../../lib/api";
import type { AddressSuggestion } from "../../lib/api";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";
import type { ClientProperty } from "../../lib/types";
import TypologySheet, { TypologyValue } from "../../components/TypologySheet";
import { MapPicker } from "./new";

const ROOM_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const NAME_MAX = 60;
const ADDRESS_MAX = 255;
const NOTES_MAX = 500;
const MAX_ROOM_PHOTOS = 6;

// Maps between the property typology id (used in TypologySheet) and the
// num_rooms integer that we persist in the database. The DB column predates
// the typology picker, so we keep saving num_rooms for backward compat with
// the booking flow / pricing engine.
const TYPOLOGY_TO_ROOMS: Record<string, number> = {
  monolocale: 1,
  bilocale: 2,
  trilocale: 3,
  quadrilocale: 4,
  "5locali": 5,
  "6locali": 6,
  "7locali": 7,
};
const ROOMS_TO_TYPOLOGY = (n: number): string => {
  if (n <= 1) return "monolocale";
  if (n === 2) return "bilocale";
  if (n === 3) return "trilocale";
  if (n === 4) return "quadrilocale";
  if (n === 5) return "5locali";
  if (n === 6) return "6locali";
  return "7locali";
};

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
    AddressSuggestion[]
  >([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressAbortRef = useRef<AbortController | null>(null);
  const [notes, setNotes] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [roomPhotos, setRoomPhotos] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  // ── Typology sheet state ───────────────────────────────────
  const [typologyOpen, setTypologyOpen] = useState(false);
  const [typology, setTypology] = useState<TypologyValue>({
    typology: "trilocale",
    bedrooms: 2,
    bathrooms: 1,
    sqm: "",
  });
  // Original new-wizard fields read from the DB on load. We keep them
  // intact across edits because this legacy screen has no UI for them
  // — wiping them would silently demote a B&B/office back to apartment.
  const [originalPropertyType, setOriginalPropertyType] = useState<string | null>(null);
  const [originalNumRooms, setOriginalNumRooms] = useState<number | null>(null);

  // Address autocomplete — delegates to lib/api.searchAddresses which
  // uses Google Places API (New) as primary and falls back to Nominatim
  // if Places is not enabled on the GCP project yet. Debounced 300ms
  // with an AbortController that cancels in-flight requests on fast typing.
  const handleAddressChange = useCallback((text: string) => {
    setAddress(text);
    setAddressLatLng(null);

    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    if (addressAbortRef.current) addressAbortRef.current.abort();

    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setAddressSuggestions([]);
      setAddressSearching(false);
      return;
    }

    setAddressSearching(true);
    addressDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      addressAbortRef.current = controller;
      try {
        const rows = await searchAddresses(trimmed, controller.signal);
        setAddressSuggestions(rows);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setAddressSuggestions([]);
        }
      } finally {
        setAddressSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectAddress = useCallback(
    async (suggestion: AddressSuggestion) => {
      const fullText = suggestion.secondaryText
        ? `${suggestion.mainText}, ${suggestion.secondaryText}`
        : suggestion.mainText;
      setAddress(fullText);
      setAddressSuggestions([]);

      // Nominatim suggestions already include coordinates — just use them.
      if (suggestion.latitude !== 0 || suggestion.longitude !== 0) {
        setAddressLatLng({
          latitude: suggestion.latitude,
          longitude: suggestion.longitude,
        });
        return;
      }

      // Google Places suggestions come without coordinates — fetch them.
      const details = await fetchAddressDetails(suggestion.placeId);
      if (details) {
        setAddressLatLng(details);
      }
    },
    []
  );

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingRoom, setUploadingRoom] = useState(false);

  // Entrance animation for the hero photo zone — soft scale-in
  const heroOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.96);

  // Progress bar — animated width ratio 0..1
  const progressRatio = useSharedValue(0);

  // Star bounce for "Casa predefinita" toggle
  const starScale = useSharedValue(1);

  // Default badge fade-in
  const defaultBadgeOpacity = useSharedValue(0);
  const defaultBadgeScale = useSharedValue(0.6);

  useEffect(() => {
    heroOpacity.value = withTiming(1, { duration: 500 });
    heroScale.value = withSpring(1, { damping: 18, stiffness: 170 });
  }, []);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressRatio.value * 100}%` as unknown as number,
  }));

  const starAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: starScale.value }],
  }));

  const defaultBadgeStyle = useAnimatedStyle(() => ({
    opacity: defaultBadgeOpacity.value,
    transform: [{ scale: defaultBadgeScale.value }],
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
        // Hydrate the typology sheet. For properties created via the new
        // wizard with property_type='apartment' the authoritative typology
        // lives in row.type_details.typology — prefer that over deriving
        // it from num_rooms which is lossy. Legacy rows just fall back.
        const td = (row as { type_details?: { typology?: string; bedrooms?: number; bathrooms?: number } }).type_details ?? {};
        const propertyType = (row as { property_type?: string }).property_type ?? "apartment";
        const isApt = propertyType === "apartment";
        const tdTypology = typeof td.typology === "string" ? td.typology : undefined;
        setOriginalPropertyType(propertyType);
        setOriginalNumRooms(row.num_rooms);
        setTypology({
          typology:
            isApt && tdTypology ? tdTypology : ROOMS_TO_TYPOLOGY(row.num_rooms),
          bedrooms: typeof td.bedrooms === "number" ? td.bedrooms : Math.max(0, row.num_rooms - 1),
          bathrooms: typeof td.bathrooms === "number" ? td.bathrooms : 1,
          sqm: row.sqm ? String(row.sqm) : "",
        });
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
    if (typology.sqm) {
      const n = Number(typology.sqm);
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
  }, [name, address, addressLatLng, typology.sqm, notes, coverPhoto]);

  const isValid = useMemo(
    () => Object.keys(fieldErrors).length === 0 && !!typology.typology,
    [fieldErrors, typology.typology]
  );

  // ── Progress calculation (for header bar + save bar) ──────
  // 5 tracked fields: cover photo, name, address+latlng, typology, notes-no-error
  const completedCount = useMemo(() => {
    let n = 0;
    if (coverPhoto) n++;
    if (name.trim().length > 0 && !fieldErrors.name) n++;
    if (address.trim().length > 0 && addressLatLng && !fieldErrors.address) n++;
    if (typology.typology) n++;
    if (!fieldErrors.notes) n++;
    return n;
  }, [coverPhoto, name, address, addressLatLng, typology.typology, fieldErrors]);

  const PROGRESS_TOTAL = 5;

  // Animate progress bar whenever completedCount changes
  useEffect(() => {
    progressRatio.value = withTiming(completedCount / PROGRESS_TOTAL, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [completedCount]);

  // Toggle with star bounce animation
  const handleDefaultToggle = useCallback((val: boolean) => {
    setIsDefault(val);
    starScale.value = withSequence(
      withSpring(val ? 1.4 : 0.7, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 14, stiffness: 250 })
    );
    if (val) {
      defaultBadgeOpacity.value = withDelay(
        80,
        withSpring(1, { damping: 18, stiffness: 220 })
      );
      defaultBadgeScale.value = withDelay(
        80,
        withSpring(1, { damping: 18, stiffness: 220 })
      );
    } else {
      defaultBadgeOpacity.value = withTiming(0, { duration: 180 });
      defaultBadgeScale.value = withTiming(0.6, { duration: 180 });
    }
  }, []);

  // Seed badge visibility once after the edit-mode data loads
  const badgeSeedDone = useRef(false);
  useEffect(() => {
    if (badgeSeedDone.current) return;
    if (!loading) {
      badgeSeedDone.current = true;
      if (isDefault) {
        defaultBadgeOpacity.value = 1;
        defaultBadgeScale.value = 1;
      }
    }
  }, [loading, isDefault]);

  // ── Save ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!user || saving) return;
    if (!isValid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      // For non-apartment properties (office/restaurant/bnb/...) this legacy
      // edit screen has no UI for the type-specific dimensions, so we keep
      // num_rooms exactly as it was loaded. Computing it from the residential
      // TypologySheet would silently rewrite an "ufficio · 12 postazioni"
      // into "trilocale · 3 camere".
      const isApt = !originalPropertyType || originalPropertyType === "apartment";
      const numRoomsForSave = isApt
        ? TYPOLOGY_TO_ROOMS[typology.typology] ?? 1
        : originalNumRooms ?? 1;

      const payload = {
        name: name.trim(),
        address: address.trim(),
        num_rooms: numRoomsForSave,
        sqm: typology.sqm ? Number(typology.sqm) : null,
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
        // Legacy fallback path — creation now flows through the wizard
        // at /properties/new which sets property_type, cleaning_frequency
        // and type_details properly. This branch defaults them for any
        // entry point that still pushes here.
        await createClientProperty(user.id, {
          ...payload,
          property_type: "apartment",
          cleaning_frequency: null,
          type_details: {},
        });
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
    typology,
    notes,
    coverPhoto,
    roomPhotos,
    isDefault,
    isEdit,
    id,
    router,
    originalPropertyType,
    originalNumRooms,
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

      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={24} color={Colors.text} />
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.headerTitle}>
              {isEdit ? "Modifica casa" : "Nuova casa"}
            </Text>
            <Text style={styles.headerSubCount}>
              {completedCount} di {PROGRESS_TOTAL} completati
            </Text>
          </View>
          <View style={styles.iconBtn} />
        </View>
        {/* Progress bar with percentage label — matches V1 "Progress Hero" design */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressBarStyle]} />
          </View>
          <Text style={styles.progressPercent}>
            {Math.round((completedCount / PROGRESS_TOTAL) * 100)}%
          </Text>
        </View>
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
                  placeholder="Es. Via Roma 12, Milano"
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
                      Nessun indirizzo trovato — aggiungi anche la città (es. "Via
                      Arcivescovo Romilli 11, Milano")
                    </Text>
                  )}
                {address.trim().length > 0 &&
                  address.trim().length < 3 &&
                  !addressLatLng && (
                    <Text style={styles.fieldHint}>
                      Continua a scrivere per vedere i suggerimenti...
                    </Text>
                  )}
              </View>
            </FieldBlock>

            {/* Map picker CTA — dark-green filled, compact size so it's
                clearly a secondary action without competing with the
                primary "Salva" button at the bottom. */}
            <View
              style={{
                marginTop: 10,
                height: 44,
                borderRadius: 12,
                backgroundColor: Colors.primary,
                overflow: "hidden",
                alignSelf: "flex-start",
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.14,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <Pressable
                onPress={() => setMapPickerOpen(true)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 16,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="map-outline" size={16} color="#ffffff" />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: "#ffffff",
                    marginLeft: 8,
                  }}
                >
                  Scegli sulla mappa
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Map picker modal — same component used in /properties/new */}
          <MapPicker
            visible={mapPickerOpen}
            initial={addressLatLng}
            onClose={() => setMapPickerOpen(false)}
            onPick={(coord, formatted) => {
              setMapPickerOpen(false);
              if (formatted) {
                setAddress(formatted.slice(0, ADDRESS_MAX));
              }
              setAddressLatLng(coord);
              setAddressSuggestions([]);
            }}
          />

          {/* ─────────────────────── Dimensioni ─────────────────────── */}
          <View style={styles.card}>
            <SectionHeader
              icon="home-outline"
              title="Dimensioni"
              subtitle="Aiuta il pulitore a prepararsi"
            />

            {/* Riga tipologia — apre il bottom sheet */}
            <Pressable
              onPress={() => setTypologyOpen(true)}
              style={styles.summaryRow}
            >
              <View style={styles.summaryIconWrap}>
                <Ionicons name="home-outline" size={18} color={Colors.secondary} />
              </View>
              <View style={styles.summaryTextWrap}>
                <Text style={styles.summaryLabel}>Tipologia</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {typology.typology.charAt(0).toUpperCase() + typology.typology.slice(1)}
                  {" · "}{typology.bedrooms} {typology.bedrooms === 1 ? "camera" : "camere"}
                  {" · "}{typology.bathrooms} {typology.bathrooms === 1 ? "bagno" : "bagni"}
                  {typology.sqm ? ` · ${typology.sqm} m²` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>
          </View>

          {/* ─────────────────────── Foto delle stanze ─────────────────────── */}
          <View style={styles.card}>
            <SectionHeader
              icon="images-outline"
              title="Foto delle stanze"
              subtitle="Mostra le aree da pulire al pulitore (opzionale)"
            />

            <RoomPhotoGrid
              photos={roomPhotos}
              maxPhotos={MAX_ROOM_PHOTOS}
              uploading={uploadingRoom}
              onAdd={() => pickAndUpload("room")}
              onRemove={removeRoomPhoto}
            />

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

            <NotesInput
              value={notes}
              onChangeText={(t) => setNotes(t.slice(0, NOTES_MAX))}
              maxLength={NOTES_MAX}
              error={showErrors ? fieldErrors.notes : undefined}
            />
          </View>

          {/* ─────────────────────── Predefinita ─────────────────────── */}
          <View style={[styles.defaultCard, isDefault && styles.defaultCardActive]}>
            <Animated.View style={[styles.defaultIcon, starAnimStyle]}>
              <Ionicons
                name={isDefault ? "star" : "star-outline"}
                size={18}
                color={isDefault ? Colors.secondary : Colors.textTertiary}
              />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <View style={styles.defaultTitleRow}>
                <Text style={styles.defaultTitle}>Casa predefinita</Text>
                <Animated.View style={[styles.defaultBadge, defaultBadgeStyle]}>
                  <Text style={styles.defaultBadgeText}>PREDEFINITA</Text>
                </Animated.View>
              </View>
              <Text style={styles.defaultSub}>
                Appare sempre per prima quando prenoti una pulizia.
              </Text>
            </View>
            <Switch
              value={isDefault}
              onValueChange={handleDefaultToggle}
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

        {/* Save bar — intentionally loud so users can't miss it */}
        <View style={styles.saveBar}>
          {/* Progress indicator strip */}
          <View style={styles.saveProgressWrap}>
            <View style={styles.saveProgressTrack}>
              <Animated.View style={[styles.saveProgressFill, progressBarStyle]} />
            </View>
            <Text style={[styles.saveProgressLabel, isValid && { color: Colors.success }]}>
              {isValid
                ? "Tutto pronto"
                : !coverPhoto
                ? "Aggiungi la foto di copertina"
                : !addressLatLng && address.trim().length > 0
                ? "Seleziona l'indirizzo dai suggerimenti"
                : `${completedCount} di ${PROGRESS_TOTAL} campi completati`}
            </Text>
          </View>
          <AnimatedSaveButton
            onPress={handleSave}
            saving={saving}
            isValid={isValid}
            isEdit={isEdit}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Typology bottom sheet */}
      <TypologySheet
        visible={typologyOpen}
        onClose={() => setTypologyOpen(false)}
        value={typology}
        onChange={setTypology}
      />
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

  // ── Header with progress ──
  headerWrap: {
    backgroundColor: Colors.background,
  },
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
  headerSubCount: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textTertiary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: Spacing.base,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: Colors.borderLight,
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.secondary,
    borderRadius: 3,
  },
  progressPercent: {
    marginLeft: Spacing.sm,
    fontSize: 11,
    fontWeight: "800",
    color: Colors.secondary,
    letterSpacing: 0.2,
    minWidth: 32,
    textAlign: "right",
  },

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

  // ── Typology summary row ──
  summaryRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  summaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginTop: Spacing.base,
    marginBottom: 0,
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
  defaultCardActive: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.accentLight,
  },
  defaultIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  defaultTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  defaultTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: Colors.secondary,
  },
  defaultBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  defaultSub: {
    marginTop: 3,
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // ── Room photo grid (premium) ──
  roomPhotoGridWrap: {
    marginTop: Spacing.md,
  },
  roomPhotoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  roomPhotoThumbWrap: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: "hidden",
    position: "relative",
  },
  roomPhotoThumbImg: {
    width: "100%",
    height: "100%",
  },
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
  roomPhotoGhostSlot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: "dashed",
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  roomPhotoGhostPrimary: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.accentLight,
    borderWidth: 2,
  },
  roomPhotoGhostLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "800",
    color: Colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  roomPhotoGhostSub: {
    marginTop: 2,
    fontSize: 9,
    color: Colors.textTertiary,
    textAlign: "center",
  },

  // ── Notes input ──
  notesWrap: {
    marginTop: Spacing.md,
  },
  notesInputContainer: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceElevated,
    padding: Spacing.base,
  },
  notesInputContainerFocused: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.surface,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  notesInputContainerError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  notesInput: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: "top",
  },
  notesFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  notesError: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.error,
    flex: 1,
  },
  notesCounter: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textTertiary,
    textAlign: "right",
  },
  notesCounterWarning: {
    color: Colors.warning,
  },
  notesCounterDanger: {
    color: Colors.error,
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

  // ── Save bar (sticky, loud, always visible) ──
  saveBar: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Platform.OS === "ios" ? 32 : Spacing.lg,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 16,
  },
  saveProgressWrap: {
    marginBottom: 12,
  },
  saveProgressTrack: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  saveProgressFill: {
    height: 4,
    backgroundColor: Colors.secondary,
    borderRadius: 4,
  },
  saveProgressLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.warning,
    textAlign: "center",
  },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  saveBtnDisabled: {
    backgroundColor: Colors.textTertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
});

// ─────────────────────────── New sub-components ───────────────────────────
// Declared after StyleSheet to avoid Hermes TDZ issues with const styles

// ── AnimatedSaveButton ────────────────────────────────────────────────────
function AnimatedSaveButton({
  onPress,
  saving,
  isValid,
  isEdit,
}: {
  onPress: () => void;
  saving: boolean;
  isValid: boolean;
  isEdit: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const onPressIn = () => {
    if (!saving) {
      scale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
    }
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };
  return (
    <Animated.View style={[animStyle, styles.saveBtn, saving && styles.saveBtnDisabled]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={saving}
        accessibilityLabel={isEdit ? "Salva modifiche" : "Salva casa"}
        accessibilityRole="button"
        android_ripple={{ color: "rgba(255,255,255,0.18)" }}
        style={StyleSheet.absoluteFill}
      />
      {saving ? (
        <ActivityIndicator color="#fff" pointerEvents="none" />
      ) : (
        <>
          <Ionicons
            name="checkmark"
            size={18}
            color="#fff"
            pointerEvents="none"
          />
          <Text style={styles.saveBtnText} pointerEvents="none">
            {isEdit ? "Salva modifiche" : "Salva casa"}
          </Text>
        </>
      )}
    </Animated.View>
  );
}

// ── NotesInput ───────────────────────────────────────────────────────────
function NotesInput({
  value,
  onChangeText,
  maxLength,
  error,
}: {
  value: string;
  onChangeText: (t: string) => void;
  maxLength: number;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);

  const counterStyle = (() => {
    if (value.length >= maxLength - 10) return styles.notesCounterDanger;
    if (value.length >= maxLength - 50) return styles.notesCounterWarning;
    return undefined;
  })();

  return (
    <View style={styles.notesWrap}>
      <View
        style={[
          styles.notesInputContainer,
          focused && styles.notesInputContainerFocused,
          error && styles.notesInputContainerError,
        ]}
      >
        <TextInput
          style={styles.notesInput}
          value={value}
          onChangeText={onChangeText}
          placeholder="Es. Le chiavi sono dal portinaio, c'è un gatto, materiali già presenti"
          placeholderTextColor={Colors.textTertiary}
          multiline
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          textAlignVertical="top"
        />
      </View>
      <View style={styles.notesFooter}>
        {error ? (
          <Text style={styles.notesError}>{error}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Text style={[styles.notesCounter, counterStyle]}>
          {value.length} / {maxLength}
        </Text>
      </View>
    </View>
  );
}

// ── RoomPhotoThumbAnimated ────────────────────────────────────────────────
function RoomPhotoThumbAnimated({
  uri,
  onRemove,
}: {
  uri: string;
  onRemove: () => void;
}) {
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 16, stiffness: 220 });
    opacity.value = withTiming(1, { duration: 220 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.roomPhotoThumbWrap, animStyle]}>
      <Image source={{ uri }} style={styles.roomPhotoThumbImg} />
      <Pressable
        onPress={onRemove}
        style={styles.roomPhotoRemove}
        hitSlop={6}
        accessibilityLabel="Rimuovi foto"
      >
        <Ionicons name="close" size={14} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

// ── RoomPhotoGrid ─────────────────────────────────────────────────────────
// Shows photos in pairs of 2 per row. Fills remaining slots with ghost
// placeholders up to a max of 4 visible slots. The first empty ghost
// is the primary CTA; the rest are subtle dashed guides.
function RoomPhotoGrid({
  photos,
  maxPhotos,
  uploading,
  onAdd,
  onRemove,
}: {
  photos: string[];
  maxPhotos: number;
  uploading: boolean;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  // Build a flat list: real photos + ghost slots (max visible = 4 slots or
  // enough to show all real photos plus one add slot)
  const GHOST_SLOTS = 4;
  const totalSlots = Math.max(GHOST_SLOTS, photos.length + (photos.length < maxPhotos ? 1 : 0));
  // Cap rows to show at most 2 rows of 2
  const visibleSlots = Math.min(totalSlots, 4);

  const slots: Array<{ kind: "photo"; uri: string; idx: number } | { kind: "add" } | { kind: "ghost" }> = [];
  for (let i = 0; i < photos.length; i++) {
    slots.push({ kind: "photo", uri: photos[i], idx: i });
  }
  if (photos.length < maxPhotos && slots.length < visibleSlots) {
    slots.push({ kind: "add" });
  }
  while (slots.length < visibleSlots) {
    slots.push({ kind: "ghost" });
  }

  // Split into rows of 2
  const rows: typeof slots[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    rows.push(slots.slice(i, i + 2));
  }

  const isFirstEmpty = photos.length === 0;

  return (
    <View style={styles.roomPhotoGridWrap}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.roomPhotoRow}>
          {row.map((slot, colIdx) => {
            const isFirst = rowIdx === 0 && colIdx === 0 && slot.kind !== "photo";

            if (slot.kind === "photo") {
              return (
                <RoomPhotoThumbAnimated
                  key={`photo-${slot.idx}`}
                  uri={slot.uri}
                  onRemove={() => onRemove(slot.idx)}
                />
              );
            }

            if (slot.kind === "add") {
              return (
                <Pressable
                  key={`add-${rowIdx}-${colIdx}`}
                  onPress={onAdd}
                  disabled={uploading}
                  accessibilityLabel="Aggiungi foto stanza"
                  style={({ pressed }) => [
                    styles.roomPhotoThumbWrap,
                    styles.roomPhotoGhostSlot,
                    isFirst && styles.roomPhotoGhostPrimary,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {uploading ? (
                    <ActivityIndicator color={Colors.secondary} />
                  ) : (
                    <>
                      <Ionicons
                        name="add-circle-outline"
                        size={isFirst ? 32 : 22}
                        color={isFirst ? Colors.secondary : Colors.textTertiary}
                      />
                      {isFirst && (
                        <>
                          <Text style={styles.roomPhotoGhostLabel}>
                            Aggiungi foto
                          </Text>
                          <Text style={styles.roomPhotoGhostSub}>
                            Camera  •  Libreria
                          </Text>
                        </>
                      )}
                    </>
                  )}
                </Pressable>
              );
            }

            // ghost — decorative empty slot
            return (
              <View
                key={`ghost-${rowIdx}-${colIdx}`}
                style={[styles.roomPhotoThumbWrap, styles.roomPhotoGhostSlot]}
              />
            );
          })}
          {/* If row has only 1 slot, add invisible filler for even columns */}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}
