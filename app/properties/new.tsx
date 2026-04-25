// New property wizard — 4-step flow for creating a property listing.
//
//   Step 1  Property type     (apartment / house / office / restaurant / bnb / shop / other)
//   Step 2  Cleaning frequency (monthly / biweekly / weekly / twice_weekly)
//   Step 3  Type-specific details (changes shape based on Step 1)
//   Step 4  Address + name + cover photo
//
// Per the design brief: "fai una scelta a step con animazioni per ogni step".
// We use Reanimated entering/exiting transitions on every step container so
// the experience feels alive without depending on external Lottie files.
//
// Editing existing properties still goes through /properties/edit — this
// route is creation-only and will redirect any incoming `id` param there.

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth";
import { createClientProperty, searchAddresses } from "../../lib/api";
import type { AddressSuggestion } from "../../lib/api";
import { Colors, Radius, Shadows, Spacing } from "../../lib/theme";
import type {
  CleaningFrequency,
  PropertyType,
  PropertyTypeDetails,
} from "../../lib/types";

// ─────────────────────────── Static config ───────────────────────────

const PROPERTY_TYPES: {
  id: PropertyType;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  tint: string;
}[] = [
  { id: "apartment",  icon: "business-outline",     label: "Appartamento",            sub: "In condominio",           tint: "#006b55" },
  { id: "house",      icon: "home-outline",         label: "Casa indipendente / Villa", sub: "Singola con esterni",   tint: "#0d7d6c" },
  { id: "office",     icon: "briefcase-outline",    label: "Ufficio / Studio",        sub: "Spazio di lavoro",        tint: "#3a7bd5" },
  { id: "restaurant", icon: "restaurant-outline",   label: "Ristorante / Bar",        sub: "Locale di ristoro",       tint: "#e85d4f" },
  { id: "bnb",        icon: "bed-outline",          label: "B&B / Airbnb",            sub: "Casa vacanze",            tint: "#b85ca0" },
  { id: "shop",       icon: "storefront-outline",   label: "Negozio",                 sub: "Vetrina commerciale",     tint: "#d97a3a" },
  { id: "other",      icon: "ellipsis-horizontal-circle-outline", label: "Altro",     sub: "Tipologia non in lista",  tint: "#6e7c80" },
];

const FREQUENCIES: {
  id: CleaningFrequency;
  label: string;
  sub: string;
  perMonth: string;
}[] = [
  { id: "monthly",      label: "1 volta al mese",      sub: "Ogni 30 giorni",        perMonth: "1×/mese" },
  { id: "biweekly",     label: "2 volte al mese",      sub: "Ogni 15 giorni",        perMonth: "2×/mese" },
  { id: "weekly",       label: "1 volta a settimana",  sub: "Ogni 7 giorni",         perMonth: "4×/mese" },
  { id: "twice_weekly", label: "2 volte a settimana",  sub: "Ogni 3-4 giorni",       perMonth: "8×/mese" },
];

const APARTMENT_TYPOLOGIES = [
  { id: "monolocale",   label: "Monolocale",   sub: "1 ambiente"   },
  { id: "bilocale",     label: "Bilocale",     sub: "1 camera"     },
  { id: "trilocale",    label: "Trilocale",    sub: "2 camere"     },
  { id: "quadrilocale", label: "Quadrilocale", sub: "3 camere"     },
  { id: "5locali",      label: "5 locali",     sub: "Grande"       },
  { id: "6locali",      label: "6 locali",     sub: "Molto grande" },
  { id: "7locali",      label: "7+ locali",    sub: "Villa/attico" },
];

const TYPOLOGY_TO_ROOMS: Record<string, number> = {
  monolocale: 1, bilocale: 2, trilocale: 3, quadrilocale: 4,
  "5locali": 5, "6locali": 6, "7locali": 7,
};

const TOTAL_STEPS = 4;
const NAME_MAX = 60;
const ADDRESS_MAX = 255;

// ─────────────────────────── Main component ───────────────────────────

export default function NewPropertyWizard() {
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null);

  // Step 2
  const [frequency, setFrequency] = useState<CleaningFrequency | null>(null);

  // Step 3 — flexible per-type state. We keep it as a discriminated union
  // so TS can narrow correctly when reading.
  const [details, setDetails] = useState<DraftDetails>({});

  // Step 4
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [addressLatLng, setAddressLatLng] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // ── Step gating ──────────────────────────────────────────
  const canAdvance = useMemo(() => {
    switch (step) {
      case 1: return !!propertyType;
      case 2: return !!frequency;
      case 3: return isStep3Valid(propertyType, details);
      case 4: return name.trim().length > 0 && !!addressLatLng;
    }
  }, [step, propertyType, frequency, details, name, addressLatLng]);

  // ── Address autocomplete ─────────────────────────────────
  const onAddressChange = useCallback((text: string) => {
    setAddress(text);
    setAddressLatLng(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (text.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearchingAddress(true);
      try {
        const results = await searchAddresses(text, ctrl.signal);
        if (!ctrl.signal.aborted) setAddressSuggestions(results);
      } catch {
        // swallow — user is still typing
      } finally {
        if (!ctrl.signal.aborted) setSearchingAddress(false);
      }
    }, 300);
  }, []);

  const pickSuggestion = useCallback((s: AddressSuggestion) => {
    const fullLabel = s.secondaryText
      ? `${s.mainText}, ${s.secondaryText}`
      : s.mainText;
    setAddress(fullLabel);
    setAddressLatLng({ latitude: s.latitude, longitude: s.longitude });
    setAddressSuggestions([]);
  }, []);

  // ── Save ─────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!user || !propertyType || saving) return;
    if (!canAdvance) return;
    setSaving(true);
    try {
      const persistedDetails = buildPersistedDetails(propertyType, details);
      const numRooms = deriveNumRooms(propertyType, details);
      const sqm = deriveSqm(propertyType, details);

      await createClientProperty(user.id, {
        name: name.trim(),
        address: address.trim(),
        num_rooms: numRooms,
        sqm,
        notes: null,
        photo_url: null,
        cover_photo_url: null,
        room_photo_urls: [],
        is_default: false,
        property_type: propertyType,
        cleaning_frequency: frequency,
        type_details: persistedDetails,
        latitude: addressLatLng?.latitude ?? null,
        longitude: addressLatLng?.longitude ?? null,
      });
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Impossibile creare la casa.";
      Alert.alert("Errore", msg);
    } finally {
      setSaving(false);
    }
  }, [user, propertyType, frequency, details, name, address, addressLatLng, saving, canAdvance, router]);

  const onPrimary = useCallback(() => {
    if (step < TOTAL_STEPS) setStep((s) => (s + 1) as typeof step);
    else handleSave();
  }, [step, handleSave]);

  const onBack = useCallback(() => {
    if (step > 1) setStep((s) => (s - 1) as typeof step);
    else router.back();
  }, [step, router]);

  // ── Render ───────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <Header step={step} onBack={onBack} />
      <ProgressBar step={step} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <Animated.View
              key="step-1"
              entering={SlideInRight.duration(280)}
              exiting={SlideOutLeft.duration(180)}
            >
              <StepHeading
                kicker="Step 1 di 4"
                title="Cosa vuoi far pulire?"
                subtitle="Scegli il tipo di proprietà — useremo i pulitori specializzati per questo ambiente"
              />
              <View style={styles.typeGrid}>
                {PROPERTY_TYPES.map((t, i) => (
                  <TypeCard
                    key={t.id}
                    delay={i * 40}
                    selected={propertyType === t.id}
                    onPress={() => setPropertyType(t.id)}
                    icon={t.icon}
                    label={t.label}
                    sub={t.sub}
                    tint={t.tint}
                  />
                ))}
              </View>
            </Animated.View>
          )}

          {step === 2 && (
            <Animated.View
              key="step-2"
              entering={SlideInRight.duration(280)}
              exiting={SlideOutLeft.duration(180)}
            >
              <StepHeading
                kicker="Step 2 di 4"
                title="Ogni quanto vuoi pulire?"
                subtitle="Più frequenza = prezzo per sessione più conveniente. Puoi cambiarla in qualsiasi momento"
              />
              <View style={{ gap: 12 }}>
                {FREQUENCIES.map((f, i) => (
                  <FreqCard
                    key={f.id}
                    delay={i * 60}
                    selected={frequency === f.id}
                    onPress={() => setFrequency(f.id)}
                    label={f.label}
                    sub={f.sub}
                    badge={f.perMonth}
                  />
                ))}
              </View>
            </Animated.View>
          )}

          {step === 3 && (
            <Animated.View
              key="step-3"
              entering={SlideInRight.duration(280)}
              exiting={SlideOutLeft.duration(180)}
            >
              <StepHeading
                kicker="Step 3 di 4"
                title={titleForType(propertyType)}
                subtitle="Aiuta il pulitore a stimare il lavoro"
              />
              <Step3Details
                propertyType={propertyType}
                details={details}
                setDetails={setDetails}
              />
            </Animated.View>
          )}

          {step === 4 && (
            <Animated.View
              key="step-4"
              entering={SlideInRight.duration(280)}
              exiting={SlideOutLeft.duration(180)}
            >
              <StepHeading
                kicker="Step 4 di 4"
                title="Dove si trova?"
                subtitle="Indirizzo + un nome per riconoscerla nella lista"
              />

              <FieldLabel>Nome della casa</FieldLabel>
              <View style={styles.inputWrap}>
                <Ionicons name="bookmark-outline" size={18} color={Colors.textTertiary} />
                <TextInput
                  value={name}
                  onChangeText={(t) => setName(t.slice(0, NAME_MAX))}
                  placeholder='Es. "Casa principale"'
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.inputText}
                  maxLength={NAME_MAX}
                  autoCapitalize="sentences"
                />
              </View>

              <FieldLabel style={{ marginTop: 18 }}>Indirizzo</FieldLabel>
              <View style={styles.inputWrap}>
                <Ionicons name="location-outline" size={18} color={Colors.textTertiary} />
                <TextInput
                  value={address}
                  onChangeText={onAddressChange}
                  placeholder="Via, numero civico, città"
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.inputText}
                  maxLength={ADDRESS_MAX}
                  autoCapitalize="none"
                />
                {addressLatLng && (
                  <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
                )}
              </View>
              {searchingAddress && (
                <Text style={styles.searchingHint}>Cerco indirizzi…</Text>
              )}
              {addressSuggestions.length > 0 && (
                <View style={styles.suggestionsBox}>
                  {addressSuggestions.slice(0, 5).map((s) => (
                    <Pressable
                      key={s.placeId}
                      onPress={() => pickSuggestion(s)}
                      style={({ pressed }) => [
                        styles.suggestionRow,
                        pressed && { backgroundColor: Colors.surfaceElevated },
                      ]}
                    >
                      <Ionicons name="location" size={14} color={Colors.secondary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionTxt} numberOfLines={1}>
                          {s.mainText}
                        </Text>
                        {!!s.secondaryText && (
                          <Text style={styles.suggestionSubTxt} numberOfLines={1}>
                            {s.secondaryText}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
              {!addressLatLng && address.trim().length > 2 && addressSuggestions.length === 0 && !searchingAddress && (
                <Text style={styles.errorHint}>
                  Seleziona un indirizzo dalla lista per continuare
                </Text>
              )}
            </Animated.View>
          )}
        </ScrollView>

        {/* CTA */}
        <View style={styles.ctaWrap}>
          <Pressable
            disabled={!canAdvance || saving}
            onPress={onPrimary}
            style={({ pressed }) => [
              styles.cta,
              (!canAdvance || saving) && styles.ctaDisabled,
              pressed && canAdvance && !saving && { opacity: 0.92 },
            ]}
          >
            <Text style={styles.ctaTxt}>
              {step < TOTAL_STEPS ? "Avanti" : saving ? "Salvo…" : "Crea casa"}
            </Text>
            {step < TOTAL_STEPS && !saving && (
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────── Sub-components ───────────────────────────

function Header({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.headerBtn}>
        <Ionicons name="chevron-back" size={22} color={Colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>Nuova casa</Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

function ProgressBar({ step }: { step: number }) {
  const ratio = useSharedValue(step / TOTAL_STEPS);
  React.useEffect(() => {
    ratio.value = withTiming(step / TOTAL_STEPS, { duration: 300 });
  }, [step, ratio]);
  const style = useAnimatedStyle(() => ({
    width: `${ratio.value * 100}%`,
  }));
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, style]} />
    </View>
  );
}

function StepHeading({
  kicker, title, subtitle,
}: { kicker: string; title: string; subtitle: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(250)} style={{ marginBottom: 24 }}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.headTitle}>{title}</Text>
      <Text style={styles.headSubtitle}>{subtitle}</Text>
    </Animated.View>
  );
}

// Animated card for property types — scales up + shows checkmark when selected.
function TypeCard({
  selected, onPress, icon, label, sub, tint, delay,
}: {
  selected: boolean;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  tint: string;
  delay: number;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      entering={FadeInDown.duration(280).delay(delay)}
      style={[styles.typeCardWrap, aStyle]}
    >
      <Pressable
        onPress={() => {
          scale.value = withSpring(0.96, { damping: 12 }, () => {
            scale.value = withSpring(1, { damping: 10 });
          });
          onPress();
        }}
        style={[
          styles.typeCard,
          selected && { borderColor: tint, backgroundColor: `${tint}10` },
        ]}
      >
        <View style={[styles.typeIconCircle, { backgroundColor: `${tint}1a` }]}>
          <Ionicons name={icon} size={26} color={tint} />
        </View>
        <Text style={styles.typeLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.typeSub} numberOfLines={1}>{sub}</Text>
        {selected && (
          <Animated.View entering={FadeIn.duration(180)} style={[styles.typeCheck, { backgroundColor: tint }]}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function FreqCard({
  selected, onPress, label, sub, badge, delay,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  sub: string;
  badge: string;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(280).delay(delay)}>
      <Pressable
        onPress={onPress}
        style={[styles.freqCard, selected && styles.freqCardOn]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.freqLabel, selected && { color: Colors.primary }]}>{label}</Text>
          <Text style={styles.freqSub}>{sub}</Text>
        </View>
        <View style={[styles.freqBadge, selected && styles.freqBadgeOn]}>
          <Text style={[styles.freqBadgeTxt, selected && { color: "#fff" }]}>{badge}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function FieldLabel({
  children, style,
}: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.fieldLabel, style]}>{children}</Text>;
}

// Step 3 details — branch on property_type
type DraftDetails = Record<string, string | number | boolean>;

function Step3Details({
  propertyType, details, setDetails,
}: {
  propertyType: PropertyType | null;
  details: DraftDetails;
  setDetails: React.Dispatch<React.SetStateAction<DraftDetails>>;
}) {
  const set = (k: string, v: string | number | boolean) =>
    setDetails((d) => ({ ...d, [k]: v }));
  const onlyDigits = (s: string) => s.replace(/\D/g, "");

  if (propertyType === "apartment") {
    return (
      <>
        <FieldLabel>Tipologia</FieldLabel>
        <View style={styles.chipsGrid}>
          {APARTMENT_TYPOLOGIES.map((t) => {
            const on = details.typology === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => set("typology", t.id)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{t.label}</Text>
                <Text style={[styles.chipSub, on && styles.chipSubOn]}>{t.sub}</Text>
              </Pressable>
            );
          })}
        </View>
        <FieldLabel style={{ marginTop: 18 }}>Superficie (mq)</FieldLabel>
        <SqmInput value={String(details.sqm ?? "")} onChange={(v) => set("sqm", onlyDigits(v))} />
      </>
    );
  }

  if (propertyType === "house") {
    return (
      <>
        <FieldLabel>Superficie (mq)</FieldLabel>
        <SqmInput value={String(details.sqm ?? "")} onChange={(v) => set("sqm", onlyDigits(v))} />
        <FieldLabel style={{ marginTop: 18 }}>N° piani</FieldLabel>
        <Stepper
          value={Number(details.floors ?? 1)}
          onChange={(n) => set("floors", n)}
          min={1} max={5}
        />
        <FieldLabel style={{ marginTop: 18 }}>Giardino</FieldLabel>
        <YesNoToggle value={!!details.has_garden} onChange={(v) => set("has_garden", v)} />
      </>
    );
  }

  if (propertyType === "office") {
    return (
      <>
        <FieldLabel>Superficie (mq)</FieldLabel>
        <SqmInput value={String(details.sqm ?? "")} onChange={(v) => set("sqm", onlyDigits(v))} />
        <FieldLabel style={{ marginTop: 18 }}>N° postazioni</FieldLabel>
        <Stepper
          value={Number(details.desks ?? 1)}
          onChange={(n) => set("desks", n)}
          min={1} max={200}
        />
      </>
    );
  }

  if (propertyType === "restaurant") {
    return (
      <>
        <FieldLabel>Superficie (mq)</FieldLabel>
        <SqmInput value={String(details.sqm ?? "")} onChange={(v) => set("sqm", onlyDigits(v))} />
        <FieldLabel style={{ marginTop: 18 }}>N° coperti</FieldLabel>
        <Stepper
          value={Number(details.covers ?? 20)}
          onChange={(n) => set("covers", n)}
          min={1} max={500}
        />
        <FieldLabel style={{ marginTop: 18 }}>Cucina interna da pulire</FieldLabel>
        <YesNoToggle value={!!details.has_kitchen} onChange={(v) => set("has_kitchen", v)} />
      </>
    );
  }

  if (propertyType === "bnb") {
    return (
      <>
        <FieldLabel>N° camere</FieldLabel>
        <Stepper
          value={Number(details.bedrooms ?? 1)}
          onChange={(n) => set("bedrooms", n)}
          min={1} max={20}
        />
        <FieldLabel style={{ marginTop: 18 }}>N° bagni</FieldLabel>
        <Stepper
          value={Number(details.bathrooms ?? 1)}
          onChange={(n) => set("bathrooms", n)}
          min={1} max={10}
        />
      </>
    );
  }

  if (propertyType === "shop") {
    return (
      <>
        <FieldLabel>Superficie (mq)</FieldLabel>
        <SqmInput value={String(details.sqm ?? "")} onChange={(v) => set("sqm", onlyDigits(v))} />
        <FieldLabel style={{ marginTop: 18 }}>Vetrine</FieldLabel>
        <YesNoToggle value={!!details.has_windows} onChange={(v) => set("has_windows", v)} />
      </>
    );
  }

  if (propertyType === "other") {
    return (
      <>
        <FieldLabel>Superficie (mq)</FieldLabel>
        <SqmInput value={String(details.sqm ?? "")} onChange={(v) => set("sqm", onlyDigits(v))} />
        <FieldLabel style={{ marginTop: 18 }}>Descrizione</FieldLabel>
        <View style={[styles.inputWrap, { alignItems: "flex-start", paddingVertical: 14 }]}>
          <TextInput
            value={String(details.description ?? "")}
            onChangeText={(t) => set("description", t.slice(0, 200))}
            placeholder="Descrivi cosa vuoi far pulire"
            placeholderTextColor={Colors.textTertiary}
            multiline
            style={[styles.inputText, { minHeight: 60 }]}
          />
        </View>
      </>
    );
  }

  return null;
}

function SqmInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.inputWrap}>
      <Ionicons name="resize-outline" size={18} color={Colors.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Es. 85"
        placeholderTextColor={Colors.textTertiary}
        keyboardType="number-pad"
        style={styles.inputText}
        maxLength={4}
      />
      <Text style={styles.unitTxt}>m²</Text>
    </View>
  );
}

function Stepper({
  value, onChange, min, max,
}: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={[styles.stepBtn, value <= min && styles.stepBtnDisabled]}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        hitSlop={8}
      >
        <Ionicons name="remove" size={20} color={value <= min ? Colors.textTertiary : Colors.text} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        style={[styles.stepBtn, value >= max && styles.stepBtnDisabled]}
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        hitSlop={8}
      >
        <Ionicons name="add" size={20} color={value >= max ? Colors.textTertiary : Colors.text} />
      </Pressable>
    </View>
  );
}

function YesNoToggle({
  value, onChange,
}: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Pressable
        onPress={() => onChange(false)}
        style={[styles.toggleBtn, !value && styles.toggleBtnOn]}
      >
        <Text style={[styles.toggleTxt, !value && styles.toggleTxtOn]}>No</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange(true)}
        style={[styles.toggleBtn, value && styles.toggleBtnOn]}
      >
        <Text style={[styles.toggleTxt, value && styles.toggleTxtOn]}>Sì</Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────── Helpers ───────────────────────────

function titleForType(t: PropertyType | null): string {
  switch (t) {
    case "apartment":  return "Dettagli appartamento";
    case "house":      return "Dettagli casa";
    case "office":     return "Dettagli ufficio";
    case "restaurant": return "Dettagli ristorante";
    case "bnb":        return "Dettagli B&B";
    case "shop":       return "Dettagli negozio";
    case "other":      return "Dettagli proprietà";
    default:           return "Dettagli";
  }
}

function isStep3Valid(t: PropertyType | null, d: DraftDetails): boolean {
  if (!t) return false;
  switch (t) {
    case "apartment":  return !!d.typology;
    case "house":      return Number(d.floors ?? 0) >= 1;
    case "office":     return Number(d.desks ?? 0) >= 1;
    case "restaurant": return Number(d.covers ?? 0) >= 1;
    case "bnb":        return Number(d.bedrooms ?? 0) >= 1 && Number(d.bathrooms ?? 0) >= 1;
    case "shop":       return Number(d.sqm ?? 0) >= 1;
    case "other":      return String(d.description ?? "").trim().length > 0;
  }
}

function deriveNumRooms(t: PropertyType | null, d: DraftDetails): number {
  if (t === "apartment" && typeof d.typology === "string") {
    return TYPOLOGY_TO_ROOMS[d.typology] ?? 1;
  }
  if (t === "bnb") return Number(d.bedrooms ?? 1);
  // Non-residential: pricing engine doesn't care about num_rooms; default to 1
  return 1;
}

function deriveSqm(t: PropertyType | null, d: DraftDetails): number | null {
  if (t === "bnb") return null;
  const n = Number(d.sqm ?? 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildPersistedDetails(t: PropertyType, d: DraftDetails): PropertyTypeDetails {
  switch (t) {
    case "apartment":
      return {
        kind: "apartment",
        typology: String(d.typology ?? ""),
        bedrooms: undefined,
        bathrooms: undefined,
      };
    case "house":
      return {
        kind: "house",
        floors: Number(d.floors ?? 1),
        has_garden: !!d.has_garden,
      };
    case "office":
      return { kind: "office", desks: Number(d.desks ?? 1) };
    case "restaurant":
      return {
        kind: "restaurant",
        covers: Number(d.covers ?? 1),
        has_kitchen: !!d.has_kitchen,
      };
    case "bnb":
      return {
        kind: "bnb",
        bedrooms: Number(d.bedrooms ?? 1),
        bathrooms: Number(d.bathrooms ?? 1),
      };
    case "shop":
      return { kind: "shop", has_windows: !!d.has_windows };
    case "other":
      return { kind: "other", description: String(d.description ?? "") };
  }
}

// ─────────────────────────── Styles ───────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: 0.2,
  },

  progressTrack: {
    height: 3,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 0,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.secondary,
  },

  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 18,
    paddingBottom: 130,
  },

  kicker: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.secondary,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  headTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: Colors.text,
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: 8,
  },
  headSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Step 1 grid
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  typeCardWrap: {
    width: "48%",
  },
  typeCard: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    borderRadius: Radius.lg,
    padding: 14,
    minHeight: 124,
    ...Shadows.sm,
  },
  typeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 2,
  },
  typeSub: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  typeCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  // Step 2 frequency cards
  freqCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  freqCardOn: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.accentLight,
  },
  freqLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 2,
  },
  freqSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  freqBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.surfaceElevated,
  },
  freqBadgeOn: {
    backgroundColor: Colors.secondary,
  },
  freqBadgeTxt: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: 0.3,
  },

  // Inputs
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: "600",
  },
  unitTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  searchingHint: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  errorHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#c95c5c",
  },
  suggestionsBox: {
    marginTop: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionTxt: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: "600",
  },
  suggestionSubTxt: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },

  // Chips (apartment typology)
  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    width: "48%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipOn: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.accentLight,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
  },
  chipLabelOn: { color: Colors.primary },
  chipSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chipSubOn: { color: Colors.secondary },

  // Stepper (-/+ control)
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  stepBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  stepBtnDisabled: {
    backgroundColor: Colors.surfaceElevated,
  },
  stepValue: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.text,
    minWidth: 40,
    textAlign: "center",
  },

  // Yes/No toggle
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
  },
  toggleBtnOn: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondary,
  },
  toggleTxt: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
  },
  toggleTxtOn: { color: "#fff" },

  // CTA bottom
  ctaWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 18,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
  },
  ctaDisabled: {
    backgroundColor: Colors.textTertiary,
  },
  ctaTxt: {
    fontSize: 15,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
  },
});
