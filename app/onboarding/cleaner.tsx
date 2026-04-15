import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import {
  upsertCleanerProfile,
  markCleanerOnboarded,
  searchAddresses,
} from "../../lib/api";
import type { AddressSuggestion } from "../../lib/api";
import { ALL_SERVICES } from "../../lib/types";
import { Colors } from "../../lib/theme";

const TOTAL_STEPS = 3;

// Services we pre-select when the cleaner picks their profile type. The
// intent is to make step 1 of the wizard feel responsive: tapping
// "Privato" vs "Azienda" on step 0 actually changes what the user sees
// next. These are sensible defaults — the user can freely add or remove
// any service at step 1 regardless of type.
const DEFAULT_SERVICES_BY_TYPE: Record<"privato" | "azienda", string[]> = {
  privato: [
    "Pulizia ordinaria",
    "Pulizia profonda",
    "Stiratura",
    "Pulizia vetri",
  ],
  azienda: [
    "Pulizia uffici",
    "Pulizia condominiale",
    "Pulizia post-ristrutturazione",
    "Pulizia profonda",
  ],
};

export default function CleanerOnboardingScreen() {
  const { user, setActiveRole, refreshProfile } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  // Tracks whether `city` came from the Google Places dropdown (validated
  // real Italian city) vs. free-typed text. "Continua" requires a verified
  // selection so users can't proceed with junk like "Mi" or "asdfgh".
  const [cityPlaceId, setCityPlaceId] = useState<string | null>(null);
  const [citySuggestions, setCitySuggestions] = useState<AddressSuggestion[]>(
    []
  );
  const [citySearching, setCitySearching] = useState(false);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cityAbortRef = useRef<AbortController | null>(null);
  const [hourlyRate, setHourlyRate] = useState("15");
  const [cleanerType, setCleanerType] = useState<"privato" | "azienda">("privato");
  // Initialize with the defaults for the initial type so the user sees
  // a pre-filled list the first time they land on step 1.
  const [selectedServices, setSelectedServices] = useState<string[]>(
    DEFAULT_SERVICES_BY_TYPE.privato
  );
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // City autocomplete — delegates to lib/api.searchAddresses (Google
  // Places with Nominatim fallback). Debounced 300ms, abortable.
  const handleCityChange = useCallback((text: string) => {
    setCity(text);
    setCityPlaceId(null);

    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    if (cityAbortRef.current) cityAbortRef.current.abort();

    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setCitySuggestions([]);
      setCitySearching(false);
      return;
    }

    setCitySearching(true);
    cityDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      cityAbortRef.current = controller;
      try {
        const rows = await searchAddresses(trimmed, controller.signal);
        setCitySuggestions(rows);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setCitySuggestions([]);
        }
      } finally {
        setCitySearching(false);
      }
    }, 300);
  }, []);

  const handleSelectCity = useCallback((suggestion: AddressSuggestion) => {
    setCity(suggestion.mainText);
    setCityPlaceId(suggestion.placeId);
    setCitySuggestions([]);
    setFocusedField(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
      if (cityAbortRef.current) cityAbortRef.current.abort();
    };
  }, []);

  // When the user flips between Privato / Azienda, swap the selected
  // services to the typical set for the new type. This is intentional:
  // if the user is changing their profile type on step 0 it means they
  // haven't made final service choices yet, so resetting to the new
  // defaults is the right behavior. They can still freely toggle
  // individual services on step 1.
  const handleTypeChange = useCallback((newType: "privato" | "azienda") => {
    setCleanerType(newType);
    setSelectedServices(DEFAULT_SERVICES_BY_TYPE[newType]);
  }, []);

  const toggleService = (s: string) => {
    setSelectedServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const canProceed = () => {
    // Step 0 requires a bio AND a city that was picked from the Google
    // Places dropdown (cityPlaceId is only set after a valid selection).
    // Free-typed text like "Mi" or "asdfgh" must not pass validation.
    if (step === 0) return !!bio.trim() && !!city.trim() && !!cityPlaceId;
    if (step === 1) return selectedServices.length > 0;
    if (step === 2) return parseFloat(hourlyRate) > 0;
    return true;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await upsertCleanerProfile(user.id, {
        full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? "Professionista",
        bio,
        city,
        hourly_rate: parseFloat(hourlyRate),
        cleaner_type: cleanerType,
        services: selectedServices,
        is_available: true,
        avg_rating: 0,
        review_count: 0,
        distance_km: 0,
      });

      // Mark onboarding completed so role-switch won't redirect here again
      await markCleanerOnboarded(user.id);
      await setActiveRole("cleaner");
      await refreshProfile();

      // Forward to the post-wizard checklist instead of dropping the user
      // straight on /(tabs)/cleaner-home. The checklist walks them through
      // the remaining setup (photo, Stripe KYC, first listing) with an
      // animated "next step" pulse so they don't miss anything critical.
      router.replace("/onboarding/cleaner-setup-checklist");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Impossibile creare il profilo";
      Alert.alert("Errore", message);
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = ["Il tuo profilo", "I tuoi servizi", "Tariffa oraria"];
  const stepSubtitles = [
    "Queste info appariranno nel tuo profilo pubblico",
    "Seleziona almeno un servizio che offri",
    "Imposta quanto vuoi guadagnare",
  ];

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View>
            {/* Type selector */}
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: Colors.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 10,
              }}
            >
              Tipo profilo
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
              {(["privato", "azienda"] as const).map((t) => {
                const selected = cleanerType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => handleTypeChange(t)}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      borderRadius: 16,
                      paddingVertical: 16,
                      alignItems: "center",
                      backgroundColor: selected ? Colors.accentLight : Colors.surface,
                      borderWidth: 1.5,
                      borderColor: selected ? Colors.secondary : Colors.border,
                    }}
                  >
                    <Ionicons
                      name={t === "privato" ? "person-outline" : "business-outline"}
                      size={24}
                      color={selected ? Colors.secondary : Colors.textTertiary}
                    />
                    <Text
                      style={{
                        marginTop: 6,
                        fontSize: 14,
                        fontWeight: "600",
                        textTransform: "capitalize",
                        color: selected ? Colors.secondary : Colors.textSecondary,
                      }}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bio */}
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: Colors.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 10,
              }}
            >
              Bio
            </Text>
            <View
              style={{
                backgroundColor: Colors.surface,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: focusedField === "bio" ? Colors.secondary : Colors.border,
                paddingHorizontal: 16,
                paddingVertical: 12,
                minHeight: 110,
                marginBottom: 20,
              }}
            >
              <TextInput
                style={{
                  fontSize: 15,
                  color: Colors.text,
                  textAlignVertical: "top",
                }}
                placeholder="Descrivi la tua esperienza, punti di forza e approccio al lavoro..."
                placeholderTextColor={Colors.textTertiary}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                onFocus={() => setFocusedField("bio")}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* City — Google Places autocomplete (Italian cities only) */}
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: Colors.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 10,
              }}
            >
              Città
            </Text>
            <View
              style={{
                backgroundColor: Colors.surface,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor:
                  focusedField === "city" ? Colors.secondary : Colors.border,
                paddingHorizontal: 16,
                height: 52,
                justifyContent: "center",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="location-outline"
                size={18}
                color={
                  cityPlaceId
                    ? Colors.secondary
                    : focusedField === "city"
                    ? Colors.secondary
                    : Colors.textTertiary
                }
              />
              <TextInput
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontSize: 15,
                  color: Colors.text,
                }}
                placeholder="Inizia a scrivere (es. Mila...)"
                placeholderTextColor={Colors.textTertiary}
                value={city}
                onChangeText={handleCityChange}
                onFocus={() => setFocusedField("city")}
                onBlur={() => {
                  // Small delay so tapping a suggestion still works
                  setTimeout(() => setFocusedField(null), 150);
                }}
                autoCorrect={false}
                autoCapitalize="words"
              />
              {citySearching ? (
                <ActivityIndicator size="small" color={Colors.secondary} />
              ) : cityPlaceId ? (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={Colors.success}
                />
              ) : null}
            </View>

            {/* Suggestion dropdown — visible only while typing and with
                results. Tapping a row locks the city in state. */}
            {citySuggestions.length > 0 && (
              <View
                style={{
                  marginTop: 8,
                  backgroundColor: Colors.surface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  overflow: "hidden",
                }}
              >
                {citySuggestions.map((s, idx) => (
                  <Pressable
                    key={s.placeId}
                    onPress={() => handleSelectCity(s)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      backgroundColor: pressed
                        ? Colors.backgroundAlt
                        : "transparent",
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: Colors.borderLight,
                    })}
                  >
                    <Ionicons
                      name="location"
                      size={16}
                      color={Colors.secondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: Colors.text,
                        }}
                        numberOfLines={1}
                      >
                        {s.mainText}
                      </Text>
                      {s.secondaryText ? (
                        <Text
                          style={{
                            fontSize: 12,
                            color: Colors.textSecondary,
                            marginTop: 2,
                          }}
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

            {/* Helpful hint when no suggestions yet */}
            {city.trim().length >= 2 &&
              !citySearching &&
              citySuggestions.length === 0 &&
              !cityPlaceId && (
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: Colors.textTertiary,
                  }}
                >
                  Nessuna città trovata — controlla lo spelling
                </Text>
              )}
          </View>
        );

      case 1:
        return (
          <View style={{ gap: 10 }}>
            {/* ── Type-aware hint banner ── */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: Colors.accentLight,
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: Colors.accent,
                marginBottom: 6,
              }}
            >
              <Ionicons name="sparkles" size={18} color={Colors.secondary} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: Colors.secondary,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Consigliati per {cleanerType}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textSecondary,
                    marginTop: 2,
                    lineHeight: 16,
                  }}
                >
                  Abbiamo pre-selezionato i servizi più richiesti per il tuo
                  profilo. Aggiungi o togli come preferisci.
                </Text>
              </View>
            </View>

            {ALL_SERVICES.map((s) => {
              const selected = selectedServices.includes(s);
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => toggleService(s)}
                  activeOpacity={0.8}
                  style={{
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: selected ? Colors.accentLight : Colors.surface,
                    borderWidth: 1.5,
                    borderColor: selected ? Colors.secondary : Colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: selected ? Colors.secondary : Colors.border,
                      backgroundColor: selected ? Colors.secondary : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 14,
                    }}
                  >
                    {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: selected ? "600" : "400",
                      color: selected ? Colors.secondary : Colors.text,
                      flex: 1,
                    }}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );

      case 2:
        return (
          <View>
            {/* Big rate input */}
            <View
              style={{
                alignItems: "center",
                paddingVertical: 40,
                backgroundColor: Colors.surface,
                borderRadius: 24,
                marginBottom: 24,
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 10,
                elevation: 3,
              }}
            >
              <Text style={{ fontSize: 13, color: Colors.textTertiary, marginBottom: 12 }}>
                Tariffa oraria netta
              </Text>
              <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                <Text
                  style={{
                    fontSize: 36,
                    color: Colors.textSecondary,
                    marginRight: 4,
                    marginBottom: 6,
                  }}
                >
                  €
                </Text>
                <TextInput
                  style={{
                    fontSize: 72,
                    fontWeight: "800",
                    color: Colors.secondary,
                    letterSpacing: -2,
                    minWidth: 100,
                    textAlign: "center",
                  }}
                  value={hourlyRate}
                  onChangeText={setHourlyRate}
                  keyboardType="numeric"
                />
                <Text
                  style={{
                    fontSize: 22,
                    color: Colors.textSecondary,
                    marginLeft: 4,
                    marginBottom: 10,
                  }}
                >
                  /h
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: Colors.accentLight,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  marginTop: 8,
                }}
              >
                <Text style={{ fontSize: 13, color: Colors.secondary, fontWeight: "600" }}>
                  Il cliente paghera €{(parseFloat(hourlyRate || "0") * 1.09).toFixed(2)}/h
                </Text>
              </View>
            </View>

            {/* Quick presets */}
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: Colors.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              Preset rapidi
            </Text>
            <View
              style={{ flexDirection: "row", justifyContent: "center", gap: 10 }}
            >
              {["10", "15", "20", "25", "30"].map((rate) => {
                const selected = hourlyRate === rate;
                return (
                  <TouchableOpacity
                    key={rate}
                    onPress={() => setHourlyRate(rate)}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: selected ? Colors.secondary : Colors.surface,
                      borderWidth: 1.5,
                      borderColor: selected ? Colors.secondary : Colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: selected ? "#fff" : Colors.textSecondary,
                      }}
                    >
                      €{rate}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            if (step > 0) {
              setStep((prev) => prev - 1);
            } else if (router.canGoBack()) {
              router.back();
            } else {
              // Wizard was opened via router.replace() from welcome.tsx,
              // so the back stack is empty. Fall back to the welcome
              // screen which is the logical parent of this flow.
              router.replace("/onboarding/welcome");
            }
          }}
          activeOpacity={0.8}
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: Colors.surface,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>
            Diventa professionista
          </Text>
          <Text style={{ fontSize: 12, color: Colors.textTertiary, marginTop: 1 }}>
            Passo {step + 1} di {TOTAL_STEPS}
          </Text>
        </View>
      </View>

      {/* Progress */}
      <View
        style={{
          marginHorizontal: 20,
          height: 4,
          backgroundColor: Colors.borderLight,
          borderRadius: 4,
          marginBottom: 8,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: 4,
            backgroundColor: Colors.secondary,
            borderRadius: 4,
            width: `${((step + 1) / TOTAL_STEPS) * 100}%`,
          }}
        />
      </View>

      {/* Step heading */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: Colors.text,
            letterSpacing: -0.5,
            marginBottom: 4,
          }}
        >
          {stepTitles[step]}
        </Text>
        <Text style={{ fontSize: 14, color: Colors.textSecondary }}>
          {stepSubtitles[step]}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 36,
          paddingTop: 16,
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.borderLight,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            if (step < TOTAL_STEPS - 1) setStep(step + 1);
            else handleSubmit();
          }}
          disabled={!canProceed() || loading}
          activeOpacity={0.85}
          style={{
            height: 56,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: canProceed() ? Colors.secondary : Colors.border,
            flexDirection: "row",
            gap: 8,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                {step < TOTAL_STEPS - 1 ? "Continua" : "Attiva profilo"}
              </Text>
              <Ionicons
                name={step < TOTAL_STEPS - 1 ? "arrow-forward" : "checkmark-circle-outline"}
                size={18}
                color="#fff"
              />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
