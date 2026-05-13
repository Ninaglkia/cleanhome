import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Modal,
  FlatList,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../lib/auth";
import { Ionicons } from "@expo/vector-icons";
import { GoogleLogo } from "../../components/icons/GoogleLogo";
import { AppleLogo } from "../../components/icons/AppleLogo";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  background: "#f0f4f3",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  primary: "#022420",
  primaryContainer: "#1a3a35",
  secondary: "#006b55",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
type UserRole = "cliente" | "professionista";

interface Country {
  flag: string;
  name: string;
  prefix: string;
}

// ─── Country data ─────────────────────────────────────────────────────────────
const COUNTRIES: Country[] = [
  { flag: "🇮🇹", name: "Italia", prefix: "+39" },
  { flag: "🇬🇧", name: "UK", prefix: "+44" },
  { flag: "🇺🇸", name: "USA", prefix: "+1" },
  { flag: "🇫🇷", name: "Francia", prefix: "+33" },
  { flag: "🇩🇪", name: "Germania", prefix: "+49" },
  { flag: "🇪🇸", name: "Spagna", prefix: "+34" },
  { flag: "🇨🇭", name: "Svizzera", prefix: "+41" },
  { flag: "🇦🇹", name: "Austria", prefix: "+43" },
];

const COUNTRY_ITEM_HEIGHT = 56;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolveInitialRole(param: string | string[] | undefined): UserRole {
  const raw = Array.isArray(param) ? param[0] : param;
  if (raw === "professionista") return "professionista";
  // "client", "both", undefined → default to "cliente"
  return "cliente";
}

// ─── Country item (memoized for FlatList) ─────────────────────────────────────
interface CountryItemProps {
  item: Country;
  isSelected: boolean;
  onSelect: (country: Country) => void;
}

function CountryItem({ item, isSelected, onSelect }: CountryItemProps) {
  const handlePress = useCallback(() => {
    onSelect(item);
  }, [item, onSelect]);

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.countryItem, isSelected && styles.countryItemSelected]}
    >
      <Text style={styles.countryItemFlag}>{item.flag}</Text>
      <Text style={styles.countryItemName}>{item.name}</Text>
      <Text style={styles.countryItemPrefix}>{item.prefix}</Text>
      {isSelected && (
        <Ionicons name="checkmark" size={18} color={C.secondary} />
      )}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const { signUpWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    resolveInitialRole(params.role)
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedCountry, setSelectedCountry] = useState<Country>(
    COUNTRIES[0]
  );
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  const phoneInputRef = useRef<TextInput>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRoleSelect = useCallback((role: UserRole) => {
    setSelectedRole(role);
  }, []);

  const handleOpenCountryPicker = useCallback(() => {
    setCountryPickerVisible(true);
  }, []);

  const handleSelectCountry = useCallback((country: Country) => {
    setSelectedCountry(country);
    setCountryPickerVisible(false);
    // Focus phone input after selection
    setTimeout(() => phoneInputRef.current?.focus(), 100);
  }, []);

  const handleCloseCountryPicker = useCallback(() => {
    setCountryPickerVisible(false);
  }, []);

  const handleRegister = useCallback(async () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2) {
      Alert.alert("Errore", "Inserisci il tuo nome completo (min. 2 caratteri)");
      return;
    }
    // RFC 5322 simplified — good enough to catch typos client-side
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(trimmedEmail)) {
      Alert.alert("Email non valida", "Controlla l'indirizzo email inserito");
      return;
    }
    if (password.length < 8) {
      Alert.alert(
        "Password troppo corta",
        "Usa almeno 8 caratteri per proteggere il tuo account"
      );
      return;
    }
    // Require at least one letter and one digit — simple but effective
    // check that prevents the worst passwords without being annoying.
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      Alert.alert(
        "Password debole",
        "La password deve contenere almeno una lettera e un numero"
      );
      return;
    }
    setLoading(true);
    try {
      // Map UI role → DB role and build the E.164-ish phone string so
      // both land in raw_user_meta_data and the handle_new_user trigger
      // can populate profiles.active_role + profiles.phone correctly.
      const dbRole: "client" | "cleaner" =
        selectedRole === "professionista" ? "cleaner" : "client";
      const trimmedPhone = phone.trim();
      const fullPhone = trimmedPhone
        ? `${selectedCountry.prefix}${trimmedPhone.replace(/\s+/g, "")}`
        : undefined;

      await signUpWithEmail(trimmedEmail, password, trimmedName, {
        role: dbRole,
        phone: fullPhone,
      });
      Alert.alert(
        "Registrazione completata",
        "Ti abbiamo inviato un'email di conferma. Apri il link nella tua casella per attivare l'account."
      );
      router.back();
    } catch (err: unknown) {
      const rawMessage =
        err instanceof Error ? err.message : "Registrazione fallita";
      // Map known auth errors to a clear Italian copy. Supabase masks
      // "user already exists" as a 200 with empty identities — the auth
      // layer rethrows it as EMAIL_ALREADY_REGISTERED so we can show
      // the right message instead of a fake success state.
      if (rawMessage === "EMAIL_ALREADY_REGISTERED") {
        Alert.alert(
          "Email già registrata",
          "Esiste già un account con questa email. Accedi dalla schermata di login o usa l'opzione \"Password dimenticata?\"."
        );
      } else if (/already.*registered|already.*exists/i.test(rawMessage)) {
        Alert.alert(
          "Email già registrata",
          "Esiste già un account con questa email. Accedi dalla schermata di login."
        );
      } else {
        Alert.alert("Errore", rawMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [
    fullName,
    email,
    password,
    phone,
    selectedRole,
    selectedCountry,
    signUpWithEmail,
    router,
  ]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Accesso con Google fallito";
      Alert.alert("Errore", message);
    }
  }, [signInWithGoogle]);

  const handleAppleSignIn = useCallback(async () => {
    if (Platform.OS !== "ios") return;
    try {
      await signInWithApple();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Accesso con Apple fallito";
      Alert.alert("Errore", message);
    }
  }, [signInWithApple]);

  // ── Country picker keyExtractor / getItemLayout ────────────────────────────
  const countryKeyExtractor = useCallback(
    (item: Country) => item.prefix + item.name,
    []
  );

  const getCountryItemLayout = useCallback(
    (_: ArrayLike<Country> | null | undefined, index: number) => ({
      length: COUNTRY_ITEM_HEIGHT,
      offset: COUNTRY_ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const renderCountryItem = useCallback(
    ({ item }: { item: Country }) => (
      <CountryItem
        item={item}
        isSelected={item.prefix === selectedCountry.prefix}
        onSelect={handleSelectCountry}
      />
    ),
    [selectedCountry.prefix, handleSelectCountry]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />

      {/* ── Country picker modal ────────────────────────────────────────── */}
      <Modal
        visible={countryPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseCountryPicker}
      >
        <TouchableWithoutFeedback onPress={handleCloseCountryPicker}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Seleziona prefisso</Text>
          <FlatList
            data={COUNTRIES}
            keyExtractor={countryKeyExtractor}
            renderItem={renderCountryItem}
            getItemLayout={getCountryItemLayout}
            removeClippedSubviews
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header: X close | CLEANHOME (centered) | spacer ─────────── */}
          <View style={styles.header}>
            <Pressable
              onPress={handleBack}
              hitSlop={12}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={C.primary} />
            </Pressable>
            <Text style={styles.brandMark}>CLEANHOME</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* ── Main content ─────────────────────────────────────────────── */}
          <View style={styles.content}>
            {/* ── Hero ───────────────────────────────────────────────────── */}
            <View style={styles.heroSection}>
              <Text style={styles.overline}>Benvenuto in CleanHome</Text>
              <Text style={styles.headline}>Crea il tuo{"\n"}account</Text>
            </View>

            {/* ── Role selection: 2-column grid ──────────────────────────── */}
            <View style={styles.roleGrid}>
              {/* Cliente card */}
              <Pressable
                onPress={() => handleRoleSelect("cliente")}
                style={[
                  styles.roleCard,
                  selectedRole === "cliente" && styles.roleCardSelected,
                ]}
              >
                <View
                  style={[
                    styles.roleIconWrap,
                    selectedRole === "cliente" && styles.roleIconWrapSelected,
                  ]}
                >
                  <Ionicons
                    name="home-outline"
                    size={22}
                    color={
                      selectedRole === "cliente" ? "#ffffff" : C.primary
                    }
                  />
                </View>
                <Text style={styles.roleTitle}>Cliente</Text>
                <Text style={styles.roleSubtitle}>
                  Cerco servizi per la mia casa
                </Text>
              </Pressable>

              {/* Professionista card */}
              <Pressable
                onPress={() => handleRoleSelect("professionista")}
                style={[
                  styles.roleCard,
                  selectedRole === "professionista" && styles.roleCardSelected,
                ]}
              >
                <View
                  style={[
                    styles.roleIconWrap,
                    selectedRole === "professionista" &&
                      styles.roleIconWrapSelected,
                  ]}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={22}
                    color={
                      selectedRole === "professionista" ? "#ffffff" : C.primary
                    }
                  />
                </View>
                <Text style={styles.roleTitle}>Professionista</Text>
                <Text style={styles.roleSubtitle}>
                  Offro le mie competenze
                </Text>
              </Pressable>
            </View>

            {/* ── Form ───────────────────────────────────────────────────── */}
            <View style={styles.form}>
              {/* Nome completo */}
              <TextInput
                style={styles.textInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nome completo"
                placeholderTextColor={`${C.outline}80`}
                autoCapitalize="words"
                autoCorrect={false}
              />

              {/* Email */}
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={`${C.outline}80`}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Phone number with country prefix picker */}
              <View style={styles.phoneRow}>
                <Pressable
                  onPress={handleOpenCountryPicker}
                  style={styles.prefixBtn}
                >
                  <Text style={styles.prefixFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.prefixCode}>
                    {selectedCountry.prefix}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={14}
                    color={C.onSurfaceVariant}
                  />
                </Pressable>
                <TextInput
                  ref={phoneInputRef}
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Numero di telefono"
                  placeholderTextColor={`${C.outline}80`}
                  keyboardType="phone-pad"
                  autoCorrect={false}
                />
              </View>

              {/* Password */}
              <TextInput
                style={styles.textInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={`${C.outline}80`}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* CTA — "Registrati" — View wrapper pattern per bg garantito */}
              <View style={styles.btnOuter}>
                <Pressable
                  onPress={handleRegister}
                  disabled={loading}
                  style={styles.btnTap}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.btnText}>Registrati</Text>
                  )}
                </Pressable>
              </View>

              {/* Legal disclaimer — required by App Store / Play Store */}
              <Text style={styles.legalText}>
                Registrandoti accetti i nostri{" "}
                <Text
                  style={styles.legalLink}
                  onPress={() => router.push("/legal/terms")}
                  accessibilityRole="link"
                >
                  Termini di Servizio
                </Text>{" "}
                e l'
                <Text
                  style={styles.legalLink}
                  onPress={() => router.push("/legal/privacy")}
                  accessibilityRole="link"
                >
                  Informativa Privacy
                </Text>
                .
              </Text>
            </View>

            {/* ── Divider "Oppure continua con" ──────────────────────────── */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Oppure continua con</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── Social buttons: 2-column grid ──────────────────────────── */}
            <View style={styles.socialGrid}>
              {/* Google */}
              <View style={styles.googleOuter}>
                <Pressable onPress={handleGoogleSignIn} style={styles.socialTap}>
                  <GoogleLogo size={20} />
                  <Text style={styles.googleText}>Google</Text>
                </Pressable>
              </View>

              {/* Apple */}
              <View
                style={[
                  styles.appleOuter,
                  Platform.OS !== "ios" && styles.socialDisabled,
                ]}
              >
                <Pressable
                  onPress={handleAppleSignIn}
                  disabled={Platform.OS !== "ios"}
                  style={styles.socialTap}
                >
                  <AppleLogo size={20} color="#ffffff" />
                  <Text style={styles.appleText}>Apple</Text>
                </Pressable>
              </View>
            </View>

            {/* ── Login link ─────────────────────────────────────────────── */}
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Hai già un account? </Text>
              <Pressable
                onPress={handleBack}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.loginLink}>Accedi</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 48,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 44,
    paddingBottom: 16,
    backgroundColor: C.background,
  },
  closeButton: {
    width: 24,
    alignItems: "center",
  },
  brandMark: {
    fontSize: 18,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: 3.6,
    textTransform: "uppercase",
  },
  headerSpacer: {
    width: 24,
  },

  // ── Content ───────────────────────────────────────────────────────────────
  content: {
    paddingHorizontal: 24,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroSection: {
    marginBottom: 32,
  },
  overline: {
    fontSize: 11,
    fontWeight: "700",
    color: C.secondary,
    letterSpacing: 3.3,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  headline: {
    fontSize: 48,
    fontWeight: "700",
    color: C.primary,
    lineHeight: 52,
    letterSpacing: -0.5,
  },

  // ── Role cards ────────────────────────────────────────────────────────────
  roleGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  roleCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  roleCardSelected: {
    borderColor: C.secondary,
    backgroundColor: "#f0faf7",
  },
  roleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  roleIconWrapSelected: {
    backgroundColor: C.secondary,
  },
  roleTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.primary,
    marginBottom: 4,
  },
  roleSubtitle: {
    fontSize: 11,
    color: C.onSurfaceVariant,
    lineHeight: 16,
  },

  // ── Form ──────────────────────────────────────────────────────────────────
  form: {
    gap: 12,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: C.surface,
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 20,
    fontSize: 15,
    color: C.onSurface,
    borderWidth: 1,
    borderColor: `${C.outlineVariant}40`,
  },

  // ── Phone row ─────────────────────────────────────────────────────────────
  phoneRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  prefixBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surface,
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: `${C.outlineVariant}40`,
  },
  prefixFlag: {
    fontSize: 20,
  },
  prefixCode: {
    fontSize: 14,
    fontWeight: "600",
    color: C.onSurface,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 20,
    fontSize: 15,
    color: C.onSurface,
    borderWidth: 1,
    borderColor: `${C.outlineVariant}40`,
  },

  // ── CTA button — View wrapper pattern ─────────────────────────────────────
  btnOuter: {
    height: 54,
    backgroundColor: C.primary,
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 4,
    marginBottom: 8,
  },
  btnTap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  legalText: {
    fontSize: 11,
    color: C.outline,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  legalLink: {
    color: C.primary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: `${C.outlineVariant}4D`,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 10,
    fontWeight: "700",
    color: `${C.outline}99`,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  // ── Social buttons — View wrapper pattern ─────────────────────────────────
  socialGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 36,
  },
  // Google: white bg, border
  googleOuter: {
    flex: 1,
    height: 48,
    backgroundColor: C.surface,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#dadce0",
  },
  // Apple: black bg
  appleOuter: {
    flex: 1,
    height: 48,
    backgroundColor: "#000000",
    borderRadius: 12,
    overflow: "hidden",
  },
  socialDisabled: {
    opacity: 0.4,
  },
  socialTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  googleText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.onSurface,
  },
  appleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },

  // ── Login link ────────────────────────────────────────────────────────────
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginText: {
    fontSize: 14,
    color: C.onSurfaceVariant,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "700",
    color: C.secondary,
  },

  // ── Country picker modal ──────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: "60%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.outlineVariant,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.onSurface,
    letterSpacing: 0.2,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    height: COUNTRY_ITEM_HEIGHT,
    gap: 14,
  },
  countryItemSelected: {
    backgroundColor: `${C.secondary}12`,
  },
  countryItemFlag: {
    fontSize: 24,
  },
  countryItemName: {
    flex: 1,
    fontSize: 15,
    color: C.onSurface,
    fontWeight: "500",
  },
  countryItemPrefix: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    fontWeight: "600",
    marginRight: 4,
  },
});
