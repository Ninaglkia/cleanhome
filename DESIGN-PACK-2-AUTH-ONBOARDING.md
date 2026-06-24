# CleanHome — Pack 2 — Auth + Onboarding

Stack: React Native + Expo Router v3 + NativeWind + TypeScript
Vedi DESIGN-AUDIT-README.md per il contesto completo.

---

### `app/(auth)/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="welcome-rocket" />
    </Stack>
  );
}
```

---

### `app/(auth)/login.tsx`

```tsx
import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { GoogleLogo } from "../../components/icons/GoogleLogo";
import { AppleLogo } from "../../components/icons/AppleLogo";

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

export default function LoginScreen() {
  const { signInWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Always return to security.tsx (slide 2 of onboarding) instead of going
  // all the way back to features.tsx (slide 1) — better UX since security
  // is the immediate previous slide in the marketing tour.
  const handleBack = useCallback(() => {
    router.replace("/onboarding/security");
  }, [router]);

  const handleLogin = useCallback(async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      Alert.alert("Errore", "Inserisci email e password");
      return;
    }
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(trimmedEmail)) {
      Alert.alert("Email non valida", "Controlla l'indirizzo email inserito");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(trimmedEmail, password);
      // Check first-login flag: if not set, route to rocket welcome screen.
      // The root layout's onAuthStateChange will also fire, but since we
      // navigate explicitly here first, the layout redirect won't double-fire
      // because hasRedirected.current prevents it on subsequent renders.
      const firstLoginDone = await AsyncStorage.getItem("cleanhome.first_login_done");
      if (!firstLoginDone) {
        router.replace("/(auth)/welcome-rocket");
      }
      // If flag IS already set, the root layout handles the redirect to home
      // as usual — no action needed here.
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Login fallito";
      // Translate common Supabase auth errors to friendly Italian
      let friendly = raw;
      if (raw.includes("Invalid login credentials")) {
        friendly = "Email o password errati";
      } else if (raw.includes("Email not confirmed")) {
        friendly =
          "Email non confermata. Controlla la tua casella per il link di verifica.";
      } else if (raw.toLowerCase().includes("network")) {
        friendly = "Connessione non disponibile. Riprova.";
      }
      Alert.alert("Errore", friendly);
    } finally {
      setLoading(false);
    }
  }, [email, password, signInWithEmail, router]);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore con Google";
      Alert.alert("Errore", message);
    }
  }, [signInWithGoogle]);

  const handleAppleSignIn = useCallback(async () => {
    try {
      await signInWithApple();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore con Apple";
      Alert.alert("Errore", message);
    }
  }, [signInWithApple]);

  const handleForgotPassword = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert(
        "Email richiesta",
        "Inserisci prima la tua email nel campo qui sopra, poi tocca nuovamente 'Password dimenticata'."
      );
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      Alert.alert(
        "Email inviata",
        "Controlla la tua casella di posta: ti abbiamo inviato le istruzioni per reimpostare la password."
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Impossibile inviare l'email";
      Alert.alert("Errore", message);
    }
  }, [email]);

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand bar (centered, back button absolute) */}
          <View style={styles.topBar}>
            <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={10}>
              <Ionicons name="arrow-back" size={20} color={C.primary} />
            </Pressable>
            <View style={styles.brandCenter}>
              <Image
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                source={require("../../assets/icon.png")}
                style={styles.brandLogo}
              />
              <Text style={styles.brandText}>CleanHome</Text>
            </View>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.headline}>Bentornato</Text>
            <Text style={styles.subheadline}>Accedi per gestire la tua casa</Text>

            {/* Email */}
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="nome@esempio.it"
              placeholderTextColor={`${C.outline}80`}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Password */}
            <View style={styles.passwordLabelRow}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <Pressable hitSlop={8} onPress={handleForgotPassword}>
                <Text style={styles.forgotLink}>PASSWORD DIMENTICATA?</Text>
              </Pressable>
            </View>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={`${C.outline}80`}
                secureTextEntry={!showPassword}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={10}
                accessibilityLabel={showPassword ? "Nascondi password" : "Mostra password"}
                accessibilityRole="button"
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={`${C.outline}99`}
                />
              </Pressable>
            </View>

            {/* Accedi button — disabled when fields empty or while loading */}
            <View
              style={[
                styles.accediOuter,
                (loading || !email.trim() || !password) && styles.accediOuterDisabled,
              ]}
            >
              <Pressable
                onPress={handleLogin}
                disabled={loading || !email.trim() || !password}
                style={styles.accediTap}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: loading || !email.trim() || !password,
                  busy: loading,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.accediText}>Accedi</Text>
                )}
              </Pressable>
            </View>

            {/* Legal links — must be accessible before login */}
            <Text style={styles.legalText}>
              Accedendo accetti i nostri{" "}
              <Text
                style={styles.legalLink}
                onPress={() => router.push("/legal/terms")}
                accessibilityRole="link"
              >
                Termini
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

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OPPURE</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google — View wrapper */}
            <View style={styles.googleOuter}>
              <Pressable onPress={handleGoogleSignIn} style={styles.socialTap}>
                {/* Inner View wraps the row content — fixes iOS Pressable+flex-row layout bug
                    when Pressable has flexDirection: "row" with multiple direct children */}
                <View style={styles.socialInner}>
                  <GoogleLogo size={20} />
                  <Text style={styles.googleText}>Accedi con Google</Text>
                </View>
              </Pressable>
            </View>

            {/* Apple — View wrapper */}
            <View style={styles.appleOuter}>
              <Pressable
                onPress={Platform.OS === "ios" ? handleAppleSignIn : undefined}
                disabled={Platform.OS !== "ios"}
                style={styles.socialTap}
              >
                <View style={styles.socialInner}>
                  <AppleLogo size={20} color="#ffffff" />
                  <Text style={styles.appleText}>Accedi con Apple</Text>
                </View>
              </Pressable>
            </View>

            {/* Register link */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Non hai ancora un account? </Text>
              <Pressable onPress={() => router.push("/(auth)/register")} hitSlop={8}>
                <Text style={styles.registerLink}>Registrati ora</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.copyright}>
            © 2025 CleanHome. Tutti i diritti riservati.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  scroll: { flexGrow: 1, paddingBottom: 32 },

  topBar: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: 12,
    height: Platform.OS === "ios" ? 108 : 96,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    position: "absolute",
    left: 24,
    top: Platform.OS === "ios" ? 60 : 48,
    bottom: 12,
    justifyContent: "center",
    paddingRight: 8,
  },
  brandCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandLogo: { width: 26, height: 26, borderRadius: 6 },
  brandText: {
    fontSize: 20,
    fontWeight: "900",
    color: C.primary,
    letterSpacing: -0.3,
  },

  card: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 32,
    elevation: 4,
  },

  headline: {
    fontSize: 42,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subheadline: {
    fontSize: 16,
    color: C.onSurfaceVariant,
    marginBottom: 24,
  },

  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.outline,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginLeft: 2,
  },
  input: {
    backgroundColor: C.surfaceLow,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 20,
    fontSize: 15,
    color: C.onSurface,
    marginBottom: 16,
  },

  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginLeft: 2,
  },
  forgotLink: {
    fontSize: 10,
    fontWeight: "700",
    color: C.secondary,
    letterSpacing: 1,
  },
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceLow,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: C.onSurface,
    height: "100%",
  },

  // Accedi — green CTA
  accediOuter: {
    height: 54,
    backgroundColor: C.primary,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 24,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  accediOuterDisabled: {
    backgroundColor: `${C.primary}99`,
    shadowOpacity: 0.05,
    elevation: 2,
  },
  accediTap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  accediText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  legalText: {
    fontSize: 11,
    color: C.outline,
    textAlign: "center",
    marginTop: 14,
    marginBottom: 8,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  legalLink: {
    color: C.primary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  // Divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: `${C.outlineVariant}4D` },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 10,
    fontWeight: "700",
    color: C.outline,
    letterSpacing: 1.2,
  },

  // Google
  googleOuter: {
    height: 48,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dadce0",
    overflow: "hidden",
    marginBottom: 12,
  },
  googleText: { fontSize: 14, fontWeight: "600", color: "#333333" },

  // Apple
  appleOuter: {
    height: 48,
    backgroundColor: "#000000",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 24,
  },
  appleText: { fontSize: 14, fontWeight: "600", color: "#ffffff" },

  // Shared social tap area — Pressable should NOT carry the row layout
  // when it has multiple direct children (iOS bug). Inner View handles
  // the row layout instead.
  socialTap: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "center",
  },
  socialInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  // Register
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  registerText: { fontSize: 14, color: C.onSurfaceVariant },
  registerLink: { fontSize: 14, fontWeight: "700", color: C.secondary },

  copyright: {
    textAlign: "center",
    fontSize: 11,
    color: `${C.outline}99`,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 20,
    paddingHorizontal: 24,
  },
});
```

---

### `app/(auth)/register.tsx`

```tsx
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
      const message =
        err instanceof Error ? err.message : "Registrazione fallita";
      Alert.alert("Errore", message);
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
```

---

### `app/(auth)/welcome-rocket.tsx`

```tsx
/**
 * welcome-rocket.tsx
 *
 * Post-login rocket splash shown ONLY on the first login.
 * Reads profile from AuthContext to personalise the greeting and
 * determine the correct home route (client vs cleaner).
 *
 * Flow:
 *  1. Screen mounts → logo + text fade/scale in
 *  2. Lottie astronaut plays at normal speed (~1.5 s)
 *  3. Rocket fades out → WelcomeModal slides up
 *  4. User picks "Sì, mostrami" → navigates home with tour flag
 *     User picks "Esplora subito" → navigates home directly
 *  5. AsyncStorage flags `cleanhome.first_login_done` and
 *     `cleanhome.welcome_choice_made` are set so this screen and
 *     modal never show again.
 *
 * Total on-screen time before choice: ~2.0 seconds.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LottieView from "lottie-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { useAuth } from "../../lib/auth";
import WelcomeModal from "../../components/WelcomeModal";

// Storage key for signalling the home screen to open the tour
export const START_TOUR_KEY = "cleanhome.start_tour_on_next_home";

// SH is intentionally unused for now — kept available for future responsive sizing.
const { width: SW } = Dimensions.get("window");

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const BG = "#062a23";      // dark forest green background
const MINT = "#3ee0a8";    // mint accent
const WHITE = "#ffffff";

export default function WelcomeRocketScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const lottieRef = useRef<LottieView>(null);

  // Whether the welcome modal is shown (after the rocket fades out)
  const [showModal, setShowModal] = useState(false);

  // Determine first name for greeting
  const rawFirstName =
    profile?.full_name?.split(" ")[0] ??
    user?.user_metadata?.full_name?.split(" ")[0] ??
    "";
  const hasName = rawFirstName.trim().length > 0;
  const firstName = hasName ? rawFirstName : "";

  // Animated values
  const screenOpacity = useSharedValue(1);
  const contentScale = useSharedValue(0.3);
  const contentOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

  const navigateToHome = useCallback(() => {
    const destination =
      profile?.active_role === "cleaner"
        ? "/(tabs)/cleaner-home"
        : "/(tabs)/home";
    router.replace(destination as never);
  }, [profile?.active_role, router]);

  const markFirstLogin = useCallback(async () => {
    try {
      await AsyncStorage.setItem("cleanhome.first_login_done", "1");
    } catch {
      // non-critical — proceed anyway
    }
  }, []);

  const handleShowModal = useCallback(() => {
    setShowModal(true);
  }, []);

  // User chose to start the guided tour — set flag so the home screen
  // opens the coach marks on next mount, then navigate
  const handleStartTour = useCallback(async () => {
    try {
      await AsyncStorage.setItem(START_TOUR_KEY, "1");
    } catch {
      // non-critical — proceed anyway
    }
    navigateToHome();
  }, [navigateToHome]);

  const handleSkipTour = useCallback(() => {
    navigateToHome();
  }, [navigateToHome]);

  useEffect(() => {
    markFirstLogin();

    // Step 1: Lottie content pops in with spring
    contentScale.value = withSpring(1.05, { damping: 14, stiffness: 120 });
    contentOpacity.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });

    // Settle to 1.0 after the overshoot
    setTimeout(() => {
      contentScale.value = withSpring(1, { damping: 18, stiffness: 200 });
    }, 300);

    // Step 2: Title slides up
    titleTranslateY.value = withDelay(
      320,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) })
    );
    titleOpacity.value = withDelay(
      320,
      withTiming(1, { duration: 380 })
    );

    // Step 3: Subtitle fades in
    subtitleOpacity.value = withDelay(
      560,
      withTiming(1, { duration: 380 })
    );

    // Step 4: After ~2s, fade the rocket content out and show the welcome modal
    const exitTimer = setTimeout(() => {
      screenOpacity.value = withTiming(
        0,
        { duration: 420, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(handleShowModal)();
          }
        }
      );
    }, 2000);

    return () => clearTimeout(exitTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Animated styles ─────────────────────────────────────────────────────────

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: contentScale.value }],
    opacity: contentOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  return (
    <>
      {/* ── Rocket splash (fades out after ~2s) ── */}
      <Animated.View style={[styles.root, screenStyle]} pointerEvents={showModal ? "none" : "auto"}>
        {/* Lottie astronaut — centred, fills most of the screen */}
        <Animated.View style={[styles.lottieWrap, contentStyle]}>
          <LottieView
            ref={lottieRef}
            source={require("../../assets/lottie/rocket.json")}
            autoPlay
            loop={false}
            style={styles.lottie}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Text block — sits below the animation */}
        <View style={styles.textBlock}>
          <Animated.Text style={[styles.title, titleStyle]}>
            {hasName ? `Benvenuto, ${firstName}!` : "Benvenuto!"}
          </Animated.Text>
          <Animated.Text style={[styles.subtitle, subtitleStyle]}>
            Pronti al decollo
          </Animated.Text>

          {/* Mint decorative accent bar */}
          <Animated.View style={[styles.accentBar, subtitleStyle]} />
        </View>
      </Animated.View>

      {/* ── Welcome modal — slides up once rocket fades ── */}
      <WelcomeModal
        visible={showModal}
        firstName={firstName}
        onStartTour={handleStartTour}
        onSkipTour={handleSkipTour}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  lottieWrap: {
    width: SW * 0.72,
    height: SW * 0.72,
    marginBottom: 8,
  },
  lottie: {
    width: "100%",
    height: "100%",
  },
  textBlock: {
    alignItems: "center",
    paddingHorizontal: 32,
    marginTop: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: WHITE,
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: MINT,
    textAlign: "center",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 20,
  },
  accentBar: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: MINT,
    opacity: 0.7,
  },
});
```

---

### `app/onboarding/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="cleaner" />
      <Stack.Screen name="cleaner-setup-checklist" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="features" />
      <Stack.Screen name="security" />
    </Stack>
  );
}
```

---

### `app/onboarding/welcome.tsx`

```tsx
import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Dimensions,
  StatusBar,
  FlatList,
  ViewToken,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { markCleanerOnboarded } from "../../lib/api";
import LottieView from "lottie-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const C = {
  bg: "#f0f4f3",
  surface: "#ffffff",
  primary: "#022420",
  secondary: "#006b55",
  mint: "#4fc4a3",
  mintDark: "#1a3a35",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outlineVariant: "#c1c8c5",
} as const;

const ROLES = [
  { id: "client" as const, title: "Cliente", desc: "Cerco servizi di pulizia professionali" },
  { id: "cleaner" as const, title: "Pulitore", desc: "Voglio offrire i miei servizi" },
  { id: "both" as const, title: "Entrambi", desc: "Entrambe le opzioni" },
];

// Lottie animations per ruolo (slide 0)
const ROLE_ANIMATIONS = {
  client: require("../../assets/lottie/cleaning.json"),
  cleaner: require("../../assets/lottie/money.json"),
  both: require("../../assets/lottie/rocket.json"),
};

// Lottie animations
const SLIDES = [
  {
    id: "1",
    animation: null, // dynamic — set by role selection
    eyebrow: "BENVENUTO",
    title: "Come ti piacerebbe\nusare CleanHome?",
    description:
      "Trova i migliori professionisti della pulizia o offri i tuoi servizi. Un'app, infinite possibilità.",
  },
  {
    id: "2",
    animation: require("../../assets/lottie/booking.json"),
    eyebrow: "L'ARTE DELLA CURA",
    title: "Prenotazione\nSemplice",
    description:
      "Dimentica le lunghe attese. Trova i migliori professionisti certificati e prenota in pochi tocchi.",
  },
  {
    id: "3",
    animation: require("../../assets/lottie/security.json"),
    eyebrow: "SECURITY FIRST",
    title: "Pagamenti\nSicuri",
    description:
      "Ogni transazione è protetta da crittografia end-to-end di livello bancario. I tuoi dati sono al sicuro.",
  },
];

type Slide = (typeof SLIDES)[number];

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, setActiveRole } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedRole, setSelectedRole] = useState<"client" | "cleaner" | "both">("client");
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useSharedValue(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  // Persist the chosen role then route to the right next step. Clients
  // are done onboarding (mark cleaner_onboarded=true → splash sends them
  // straight to /(tabs)/home next time). Cleaners still need to fill the
  // profile wizard (bio, services, hourly rate) followed by the setup
  // checklist — the wizard screen itself calls markCleanerOnboarded once
  // the profile data is persisted, so we intentionally skip it here.
  const finishOnboarding = useCallback(async () => {
    const isCleaner = selectedRole === "cleaner" || selectedRole === "both";
    try {
      const roleArg = isCleaner ? "cleaner" : "client";
      await setActiveRole(roleArg);
      if (!isCleaner && user?.id) {
        await markCleanerOnboarded(user.id);
      }
    } catch {
      // Non-fatal — the user can always reconfigure from the profile tab.
    }
    router.replace(isCleaner ? "/onboarding/cleaner" : "/(tabs)/home");
  }, [selectedRole, setActiveRole, user?.id, router]);

  const handleNext = useCallback(() => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      // Ultima slide — salva e vai alla home
      finishOnboarding();
    }
  }, [activeIndex, finishOnboarding]);

  const renderSlide = useCallback(
    ({ item, index }: { item: Slide; index: number }) => (
      <View style={styles.slide}>
        {/* Lottie animation — slide 0 changes based on role */}
        <View style={styles.animationWrap}>
          <LottieView
            source={index === 0 ? ROLE_ANIMATIONS[selectedRole] : item.animation}
            autoPlay
            loop
            style={styles.lottie}
            key={index === 0 ? selectedRole : item.id}
          />
        </View>

        {/* Text content */}
        <View style={styles.textContent}>
          <Text style={styles.eyebrow}>{item.eyebrow}</Text>
          <Text style={styles.title}>{item.title}</Text>

          {/* Slide 0: role selection options */}
          {index === 0 ? (
            <View style={styles.rolesContainer}>
              {ROLES.map((r) => {
                const active = selectedRole === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setSelectedRole(r.id)}
                    style={[styles.option, active && styles.optionActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${r.title}. ${r.desc}`}
                  >
                    {/* Inner View carries the row layout — fixes iOS Pressable+row
                        bug when Pressable has 2+ direct children laid out in a row */}
                    <View style={styles.optionInner}>
                      <View style={styles.optionText}>
                        <Text style={[styles.optionTitle, active && { color: C.primary }]}>{r.title}</Text>
                        <Text style={styles.optionDesc}>{r.desc}</Text>
                      </View>
                      <View style={[styles.radio, active && styles.radioActive]}>
                        {active && <View style={styles.radioDot} />}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.description}>{item.description}</Text>
          )}
        </View>
      </View>
    ),
    [selectedRole]
  );

  const isLastSlide = activeIndex === SLIDES.length - 1;

  // Button pulse animation
  const btnScale = useSharedValue(1);
  const btnGlow = useSharedValue(0.3);

  useEffect(() => {
    // Gentle pulse loop
    btnScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // infinite
      true
    );
    btnGlow.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1200 }),
        withTiming(0.25, { duration: 1200 })
      ),
      -1,
      true
    );
    // btnScale / btnGlow are Reanimated shared values — stable refs, no deps needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const btnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
    shadowOpacity: btnGlow.value,
  }));

  const handleBtnPressIn = useCallback(() => {
    btnScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBtnPressOut = useCallback(() => {
    btnScale.value = withSpring(1.03, { damping: 15, stiffness: 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 8 }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        {activeIndex > 0 ? (
          <Pressable
            onPress={() => {
              flatListRef.current?.scrollToIndex({ index: activeIndex - 1, animated: true });
            }}
            style={styles.backBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Torna indietro"
          >
            <View style={styles.backBtnInner}>
              <Ionicons name="arrow-back" size={20} color={C.primary} />
              <Text style={styles.backText}>Indietro</Text>
            </View>
          </Pressable>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../../assets/icon.png")}
              style={{ width: 20, height: 20, borderRadius: 5 }}
            />
            <Text style={styles.brand}>CleanHome</Text>
          </View>
        )}
        {/* No skip button — this onboarding finalizes the user's role choice
            and marks cleaner_onboarded on the profile. Allowing skip silently
            defaults everyone to "client" which breaks cleaners' first-run
            experience. Keep the flow explicit. */}
        <View style={{ width: 40 }} />
      </View>

      {/* Horizontal paging FlatList */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={(e) => {
          scrollX.value = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        style={styles.flatList}
      />

      {/* Bottom: dots + button */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotOn : styles.dotOff,
              ]}
            />
          ))}
        </View>

        {/* CTA button — animated pulse + scale on press.
            Inner View wraps the row content to avoid the iOS Pressable+flex-row
            layout bug when Pressable carries flexDirection:"row" with 2 children. */}
        <Animated.View style={[styles.ctaOuter, isLastSlide && styles.ctaOuterLast, btnAnimStyle]}>
          <Pressable
            onPress={handleNext}
            onPressIn={handleBtnPressIn}
            onPressOut={handleBtnPressOut}
            style={styles.ctaTap}
            accessibilityRole="button"
            accessibilityLabel={isLastSlide ? "Inizia" : "Avanti"}
          >
            <View style={styles.ctaInner}>
              <Text style={[styles.ctaText, isLastSlide && styles.ctaTextLast]}>
                {isLastSlide ? "Inizia" : "Avanti"}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={isLastSlide ? "#ffffff" : C.mintDark}
              />
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    height: 48,
  },
  brand: { fontSize: 22, fontWeight: "900", color: C.primary },
  backBtn: { paddingVertical: 4 },
  backBtnInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 15, fontWeight: "600", color: C.primary },

  flatList: { flex: 1 },

  // Each slide = full screen width
  slide: {
    width: SCREEN_W,
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 32,
  },

  // Lottie animation area — smaller to leave room for options
  animationWrap: {
    flex: 3,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  lottie: {
    width: SCREEN_W * 0.55,
    height: SCREEN_W * 0.55,
  },

  // Text + options content
  textContent: {
    flex: 4,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: C.secondary,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: C.primary,
    textAlign: "center",
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    fontWeight: "500",
    color: C.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 23,
    paddingHorizontal: 8,
  },

  // Role options (slide 0)
  rolesContainer: { width: "100%", gap: 8, marginTop: 8 },
  option: {
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
    borderWidth: 2, borderColor: `${C.outlineVariant}4D`, backgroundColor: C.surface,
  },
  optionInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  optionActive: { borderColor: C.primary, backgroundColor: `${C.primary}08` },
  optionText: { flex: 1, marginRight: 12 },
  optionTitle: { fontSize: 15, fontWeight: "700", color: C.onSurface, marginBottom: 1 },
  optionDesc: { fontSize: 11, color: C.onSurfaceVariant },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: C.outlineVariant,
    alignItems: "center", justifyContent: "center",
  },
  radioActive: { borderColor: C.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },

  // Bottom section
  bottom: {
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 16,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: { height: 6, borderRadius: 3 },
  dotOn: { width: 28, backgroundColor: C.secondary },
  dotOff: { width: 6, backgroundColor: C.outlineVariant },

  // CTA — mint green default, dark green on last slide
  ctaOuter: {
    width: "100%",
    height: 56,
    backgroundColor: C.mint,
    borderRadius: 14,
    overflow: "hidden",
  },
  ctaOuterLast: {
    backgroundColor: C.primary,
  },
  ctaTap: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "center",
  },
  ctaInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "700",
    color: C.mintDark,
  },
  ctaTextLast: {
    color: "#ffffff",
  },
});
```

---

### `app/onboarding/features.tsx`

```tsx
// ============================================================================
// Screen: Pre-login marketing tour — slide 1 of 2 ("Prenotazione Semplice")
// ----------------------------------------------------------------------------
// First-time visitors see this after the splash screen. The slide explains
// the core value proposition (find and book a vetted cleaner in seconds)
// with a Lottie booking animation instead of a generic stock hero photo.
// Swipes to security.tsx on "Avanti" or jumps to /login on "Ho già un
// account".
// ============================================================================

import { useCallback, useEffect, useRef } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from "react-native-reanimated";

const C = {
  bg: "#f6faf9",
  surface: "#ffffff",
  primary: "#022420",
  secondary: "#006b55",
  accent: "#00c896",
  accentLight: "#e8fdf7",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outlineVariant: "#c1c8c5",
} as const;

export default function FeaturesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);

  // Staggered entrance animations — hero pops in first, then content, then CTA
  const heroOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.92);
  const textOpacity = useSharedValue(0);
  const textTranslate = useSharedValue(16);
  const ctaOpacity = useSharedValue(0);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslate.value }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value }));

  useEffect(() => {
    heroOpacity.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
    heroScale.value = withSpring(1, { damping: 20, stiffness: 180 });
    textOpacity.value = withDelay(250, withTiming(1, { duration: 500 }));
    textTranslate.value = withDelay(
      250,
      withSpring(0, { damping: 18, stiffness: 160 })
    );
    ctaOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
    // Reanimated shared values are stable refs — no need to list them as deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = useCallback(() => {
    router.push("/onboarding/security");
  }, [router]);

  // "I already have an account" — push (not replace) so the user can come
  // back to continue the tour if they changed their mind.
  const handleAlreadyHaveAccount = useCallback(() => {
    router.push("/(auth)/login");
  }, [router]);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Brand bar (centered) ── */}
      <View style={styles.brandBar}>
        <View style={styles.brandCenter}>
          <Image
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            source={require("../../assets/icon.png")}
            style={styles.brandLogo}
          />
          <Text style={styles.brandText}>CleanHome</Text>
        </View>
      </View>

      {/* ── Hero Lottie ── */}
      <Animated.View style={[styles.heroWrap, heroStyle]}>
        <View style={styles.heroCircleGlow} />
        <LottieView
          ref={lottieRef}
          source={require("../../assets/lottie/booking.json")}
          autoPlay
          loop
          style={styles.lottie}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Text block ── */}
      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={styles.eyebrow}>L'ARTE DELLA CURA</Text>
        <Text style={styles.headline}>
          Prenotazione{"\n"}in un tocco
        </Text>
        <Text style={styles.body}>
          Dimentica le lunghe attese. Trova professionisti verificati della
          pulizia nella tua zona e prenota in pochi secondi — esattamente quando
          ne hai bisogno.
        </Text>
      </Animated.View>

      {/* ── Dots ── */}
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotOn]} />
        <View style={[styles.dot, styles.dotOff]} />
      </View>

      {/* ── Buttons ── */}
      <Animated.View style={[styles.buttons, ctaStyle]}>
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.82}
          style={styles.ctaBtn}
          accessibilityRole="button"
          accessibilityLabel="Avanti"
        >
          <Text style={styles.ctaText} numberOfLines={1}>
            Avanti →
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleAlreadyHaveAccount}
          activeOpacity={0.5}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.altBtn}
          accessibilityRole="button"
          accessibilityLabel="Ho già un account — Accedi"
        >
          <Text style={styles.altText}>
            Ho già un account
            <Text style={styles.altTextLink}> · Accedi</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 24,
  },

  // --- Brand bar (unified across features/security/login) ---
  brandBar: {
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  brandCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandLogo: { width: 26, height: 26, borderRadius: 6 },
  brandText: {
    fontSize: 20,
    fontWeight: "900",
    color: C.primary,
    letterSpacing: -0.3,
  },

  // --- Hero ---
  heroWrap: {
    flex: 5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  heroCircleGlow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: C.accentLight,
    opacity: 0.6,
  },
  lottie: {
    width: 320,
    height: 320,
  },

  // --- Text ---
  textBlock: {
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: C.secondary,
    letterSpacing: 3.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  headline: {
    fontSize: 34,
    fontWeight: "900",
    color: C.primary,
    lineHeight: 40,
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: C.onSurfaceVariant,
    lineHeight: 22,
  },

  // --- Dots ---
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotOn: {
    width: 28,
    backgroundColor: C.secondary,
  },
  dotOff: {
    width: 6,
    backgroundColor: C.outlineVariant,
  },

  // --- Buttons ---
  buttons: {
    width: "100%",
    alignSelf: "stretch",
    marginTop: 4,
  },
  // TouchableOpacity — carries background, shape, shadow and tap area
  ctaBtn: {
    width: "100%",
    backgroundColor: C.primary,
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#011a17",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
    marginBottom: 4,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.15,
    textAlign: "center",
  },
  altBtn: {
    alignItems: "center",
    paddingVertical: 16,
  },
  altText: {
    fontSize: 14,
    fontWeight: "500",
    color: C.onSurfaceVariant,
    letterSpacing: -0.1,
  },
  altTextLink: {
    color: C.secondary,
    fontWeight: "800",
  },
});
```

---

### `app/onboarding/security.tsx`

```tsx
// ============================================================================
// Screen: Pre-login marketing tour — slide 2 of 2 ("Pagamenti Sicuri")
// ----------------------------------------------------------------------------
// Second and final marketing slide. Explains trust-and-safety: payments are
// escrowed by Stripe, cleaners are vetted, and the client is protected end
// to end. Uses a Lottie security animation instead of a stock image. The
// CTA marks the onboarding as seen (so the tour never shows again) and
// forwards to the login screen.
// ============================================================================

import { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LottieView from "lottie-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from "react-native-reanimated";

// Keep in sync with app/index.tsx
const ONBOARDING_SEEN_KEY = "cleanhome.onboarding_seen";

const C = {
  bg: "#f6faf9",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  primary: "#022420",
  primaryContainer: "#1a3a35",
  secondary: "#006b55",
  accent: "#00c896",
  accentLight: "#e8fdf7",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outlineVariant: "#c1c8c5",
} as const;

interface BulletProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  delay: number;
}

function Bullet({ icon, title, description, delay }: BulletProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(
      delay,
      withSpring(0, { damping: 18, stiffness: 160 })
    );
    // Reanimated shared values are stable refs — no need to list as deps.
    // `delay` is the prop the animation depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay]);

  return (
    <Animated.View style={[styles.bullet, animStyle]}>
      <View style={styles.bulletIcon}>
        <Ionicons name={icon} size={20} color={C.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bulletTitle}>{title}</Text>
        <Text style={styles.bulletDescription}>{description}</Text>
      </View>
    </Animated.View>
  );
}

export default function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);

  const heroOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.9);
  const headlineOpacity = useSharedValue(0);
  const headlineTranslate = useSharedValue(16);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));
  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headlineOpacity.value,
    transform: [{ translateY: headlineTranslate.value }],
  }));

  useEffect(() => {
    heroOpacity.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
    heroScale.value = withSpring(1, { damping: 20, stiffness: 180 });
    headlineOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    headlineTranslate.value = withDelay(
      200,
      withSpring(0, { damping: 18, stiffness: 160 })
    );
    // Reanimated shared values are stable refs — no deps needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Final CTA of the marketing tour — persist "seen" flag so the tour
  // never re-triggers from app/index.tsx, then forward to login.
  const handleGetStarted = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    } catch {
      // Storage failure is non-fatal — worst case the tour shows again
      // next time, which is a harmless redundancy.
    }
    router.replace("/(auth)/login");
  }, [router]);

  const handleBack = useCallback(() => {
    // Guard against an empty back stack — security.tsx can be entered
    // directly via deep link or after a hot reload with state reset.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/onboarding/features");
    }
  }, [router]);

  const handleAlreadyHaveAccount = useCallback(() => {
    handleGetStarted();
  }, [handleGetStarted]);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Brand bar (centered, back button absolute) ── */}
      <View style={styles.brandBar}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </Pressable>
        <View style={styles.brandCenter}>
          <Image
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            source={require("../../assets/icon.png")}
            style={styles.brandLogo}
          />
          <Text style={styles.brandText}>CleanHome</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Lottie ── */}
        <Animated.View style={[styles.heroWrap, heroStyle]}>
          <View style={styles.heroCircleGlow} />
          <LottieView
            ref={lottieRef}
            source={require("../../assets/lottie/security.json")}
            autoPlay
            loop
            style={styles.lottie}
            resizeMode="contain"
          />
        </Animated.View>

        {/* ── Headline ── */}
        <Animated.View style={[styles.textBlock, headlineStyle]}>
          <Text style={styles.eyebrow}>TRANQUILLITÀ GARANTITA</Text>
          <Text style={styles.headline}>Pagamenti{"\n"}Sicuri</Text>
          <Text style={styles.body}>
            Ogni pagamento è protetto da <Text style={styles.bodyBold}>Stripe</Text> con
            crittografia di livello bancario. I tuoi soldi restano in
            <Text style={styles.bodyBold}> escrow</Text> e vengono rilasciati al
            pulitore solo dopo la tua conferma o automaticamente 48 ore dopo il
            completamento.
          </Text>
        </Animated.View>

        {/* ── Trust bullets ── */}
        <View style={styles.bullets}>
          <Bullet
            icon="lock-closed-outline"
            title="Fondi protetti in escrow"
            description="Hai 48 ore dopo il completamento per confermare o segnalare un problema. Senza la tua conferma, il pagamento non parte."
            delay={500}
          />
          <Bullet
            icon="shield-checkmark-outline"
            title="Professionisti verificati"
            description="Ogni pulitore passa un processo di verifica prima di poter offrire il servizio."
            delay={650}
          />
          <Bullet
            icon="refresh-outline"
            title="Rimborso garantito"
            description="Se qualcosa va storto, apri una segnalazione e ti rimborsiamo integralmente."
            delay={800}
          />
        </View>
      </ScrollView>

      {/* ── Dots ── */}
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotOff]} />
        <View style={[styles.dot, styles.dotOn]} />
      </View>

      {/* ── CTA ── */}
      <View style={styles.buttons}>
        <TouchableOpacity
          onPress={handleGetStarted}
          activeOpacity={0.82}
          style={styles.ctaBtn}
          accessibilityRole="button"
          accessibilityLabel="Inizia ora"
        >
          <Text style={styles.ctaText} numberOfLines={1}>
            Inizia ora →
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleAlreadyHaveAccount}
          activeOpacity={0.5}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.altBtn}
          accessibilityRole="button"
          accessibilityLabel="Ho già un account — Accedi"
        >
          <Text style={styles.altText}>
            Ho già un account
            <Text style={styles.altTextLink}> · Accedi</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 24,
  },

  brandBar: {
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  backBtn: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingRight: 8,
  },
  brandCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandLogo: { width: 26, height: 26, borderRadius: 6 },
  brandText: {
    fontSize: 20,
    fontWeight: "900",
    color: C.primary,
    letterSpacing: -0.3,
  },

  scroll: {
    paddingBottom: 12,
  },

  // --- Hero ---
  heroWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 220,
    marginTop: 16,
    marginBottom: 16,
  },
  heroCircleGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: C.accentLight,
    opacity: 0.6,
  },
  lottie: {
    width: 240,
    height: 240,
  },

  // --- Text ---
  textBlock: {
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: C.secondary,
    letterSpacing: 3.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  headline: {
    fontSize: 34,
    fontWeight: "900",
    color: C.primary,
    lineHeight: 40,
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: C.onSurfaceVariant,
    lineHeight: 22,
  },
  bodyBold: {
    fontWeight: "800",
    color: C.primary,
  },

  // --- Bullets ---
  bullets: {
    gap: 12,
    marginBottom: 16,
  },
  bullet: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: C.surfaceLow,
    borderRadius: 14,
    padding: 16,
  },
  bulletIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.primary,
    marginBottom: 3,
  },
  bulletDescription: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    lineHeight: 18,
  },

  // --- Dots ---
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
    marginTop: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotOn: {
    width: 28,
    backgroundColor: C.secondary,
  },
  dotOff: {
    width: 6,
    backgroundColor: C.outlineVariant,
  },

  // --- Buttons ---
  buttons: {
    width: "100%",
    alignSelf: "stretch",
    marginTop: 4,
    gap: 4,
  },
  ctaBtn: {
    width: "100%",
    backgroundColor: C.primary,
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#011a17",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.15,
    textAlign: "center",
  },
  altBtn: {
    alignItems: "center",
    paddingVertical: 16,
  },
  altText: {
    fontSize: 14,
    fontWeight: "500",
    color: C.onSurfaceVariant,
    letterSpacing: -0.1,
  },
  altTextLink: {
    color: C.secondary,
    fontWeight: "800",
  },
});
```

---

### `app/onboarding/cleaner.tsx`

```tsx
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
                    style={({ pressed }) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderTopWidth: idx === 0 ? 0 : 1,
                        borderTopColor: Colors.borderLight,
                      },
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
                  Il cliente pagherà €{(parseFloat(hourlyRate || "0") * 1.09).toFixed(2)}/h
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
```

---

### `app/onboarding/cleaner-setup-checklist.tsx`

```tsx
// ============================================================================
// Screen: Cleaner setup checklist
// ----------------------------------------------------------------------------
// Shown right after the cleaner-profile wizard completes. Gives the new
// professional a visual, step-by-step guide to finish the setup required
// before they can accept bookings: photo, identity verification for
// payouts (Stripe Connect), and publishing their first listing.
//
// Design notes:
//  - Cards display a live completion state computed from the DB on focus
//  - The first PENDING card pulses softly + shows a finger-pointer hint
//    so the eye is drawn to "what to do next"
//  - Tapping a card navigates to the relevant section; returning here
//    triggers a refresh so completed items flip to "Fatto" automatically
//  - When everything is green the big CTA flips to "Vai alla dashboard"
//    and the pulse stops
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  interpolateColor,
  cancelAnimation,
} from "react-native-reanimated";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import {
  fetchCleanerSetupProgress,
  saveCleanerSetupProgress,
  type CleanerSetupProgress,
} from "../../lib/api";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";

// ─── Step config ───────────────────────────────────────────────────────────

type StepKey = "profile" | "photo" | "stripe" | "listing";

interface StepConfig {
  key: StepKey;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  ctaLabel: string;
  navigate: (push: (path: string) => void) => void;
}

const STEPS: StepConfig[] = [
  {
    key: "profile",
    icon: "person-circle-outline",
    title: "Profilo professionale",
    description: "Bio, città, servizi e tariffa — la base che i clienti vedono nella tua scheda.",
    ctaLabel: "Modifica profilo",
    navigate: (push) => push("/profile/edit"),
  },
  {
    key: "photo",
    icon: "camera-outline",
    title: "Aggiungi una foto",
    description: "I profili con foto ricevono 3 volte più richieste. Una foto sorridente fa la differenza.",
    ctaLabel: "Carica foto",
    navigate: (push) => push("/profile/edit"),
  },
  {
    key: "stripe",
    icon: "shield-checkmark-outline",
    title: "Verifica identità per i pagamenti",
    description: "Ti colleghiamo a Stripe per ricevere i compensi in sicurezza. Serve un documento d'identità.",
    ctaLabel: "Verifica ora",
    navigate: (push) => push("/payments"),
  },
  {
    key: "listing",
    icon: "megaphone-outline",
    title: "Pubblica il primo annuncio",
    description: "Il tuo annuncio è ciò che fa trovare te ai clienti. Scegli titolo, foto di copertina e zona.",
    ctaLabel: "Crea annuncio",
    navigate: (push) => push("/listings"),
  },
];

// ─── Main screen ───────────────────────────────────────────────────────────

export default function CleanerSetupChecklistScreen() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<Record<StepKey, boolean>>({
    profile: true, // always true — the wizard just saved these fields
    photo: false,
    stripe: false,
    listing: false,
  });
  const [loading, setLoading] = useState(true);

  // ── Load the live cleaner state from the DB ──────────────────
  const loadStatus = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: cp }, { count: listingCount }, savedProgress] =
        await Promise.all([
          supabase
            .from("cleaner_profiles")
            .select(
              "avatar_url, stripe_onboarding_complete, stripe_charges_enabled"
            )
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("cleaner_listings")
            .select("id", { count: "exact", head: true })
            .eq("cleaner_id", user.id),
          fetchCleanerSetupProgress(user.id).catch(
            (): CleanerSetupProgress => ({})
          ),
        ]);

      const liveStatus: Record<StepKey, boolean> = {
        profile: true, // wizard already saved profile
        photo: !!cp?.avatar_url || !!(savedProgress as CleanerSetupProgress).photo,
        stripe:
          (!!cp?.stripe_onboarding_complete && !!cp?.stripe_charges_enabled) ||
          !!(savedProgress as CleanerSetupProgress).stripe,
        listing:
          (listingCount ?? 0) > 0 ||
          !!(savedProgress as CleanerSetupProgress).listing,
      };

      setStatus(liveStatus);

      // Persist the derived state back so it survives re-installs
      const all = Object.values(liveStatus).every(Boolean);
      saveCleanerSetupProgress(user.id, liveStatus, all).catch(() => {});
    } catch {
      // Silent error: the fallback status reflects defaults (everything incomplete).
      // Better to render the checklist with placeholders than block the user.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus])
  );

  // ── Derived state ─────────────────────────────────────────────
  const completedCount = useMemo(
    () => Object.values(status).filter(Boolean).length,
    [status]
  );
  const total = STEPS.length;
  const allDone = completedCount === total;

  // Index of the first pending step — this is what pulses
  const nextPendingIndex = useMemo(
    () => STEPS.findIndex((s) => !status[s.key]),
    [status]
  );

  // ── Handlers ──────────────────────────────────────────────────
  const handleCardPress = useCallback(
    (step: StepConfig) => {
      step.navigate((path) => router.push(path as never));
    },
    [router]
  );

  const handleFinish = useCallback(async () => {
    await refreshProfile();
    if (allDone && user) {
      // Mark setup as complete before leaving
      saveCleanerSetupProgress(user.id, status, true).catch(() => {});
    }
    router.replace("/(tabs)/cleaner-home");
  }, [router, refreshProfile, allDone, user, status]);

  // ── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.loaderText}>Carico la tua checklist…</Text>
          {/* Escape hatch — if the request hangs, the user is not trapped */}
          <Pressable
            onPress={() => router.replace("/(tabs)/cleaner-home")}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Vai alla dashboard senza attendere"
            style={styles.loaderSkipBtn}
          >
            <Text style={styles.loaderSkipText}>Salta e vai alla dashboard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero: rocket Lottie + celebration ── */}
        <View style={styles.hero}>
          <View style={styles.lottieWrap}>
            <LottieView
              source={require("../../assets/lottie/rocket.json")}
              autoPlay
              loop
              style={styles.lottie}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.eyebrow}>ULTIMI PASSI</Text>
          <Text style={styles.headline}>
            {allDone ? "Sei pronto a decollare!" : "Quasi pronto,\nprofessionista!"}
          </Text>
          <Text style={styles.subheadline}>
            {allDone
              ? "Hai completato tutti i passi. Puoi iniziare a ricevere prenotazioni dai clienti nella tua zona."
              : "Ti mancano pochi passi per iniziare a ricevere prenotazioni. Completali nell'ordine che preferisci."}
          </Text>
        </View>

        {/* ── Progress ring ── */}
        <View style={styles.progressBlock}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Setup completato</Text>
            <Text style={styles.progressCount}>
              {completedCount} <Text style={styles.progressTotal}>/ {total}</Text>
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(completedCount / total) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* ── Step cards ── */}
        <View style={styles.stepsList}>
          {STEPS.map((step, idx) => {
            const done = status[step.key];
            const isNextPending = idx === nextPendingIndex;
            return (
              <StepCard
                key={step.key}
                step={step}
                done={done}
                isNext={isNextPending}
                entranceDelay={idx * 120}
                onPress={() => handleCardPress(step)}
              />
            );
          })}
        </View>

        {/* ── Footer CTA ── */}
        <View style={[styles.finishBtn, allDone && styles.finishBtnPrimary]}>
          <Pressable
            onPress={handleFinish}
            accessibilityRole="button"
            accessibilityLabel={allDone ? "Vai alla dashboard" : "Continua alla dashboard, completa dopo"}
            android_ripple={{ color: allDone ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.06)" }}
            style={StyleSheet.absoluteFill}
          />
          {allDone ? (
            <>
              <Ionicons name="rocket" size={20} color="#fff" pointerEvents="none" />
              <Text style={styles.finishBtnTextPrimary} pointerEvents="none">Vai alla dashboard</Text>
            </>
          ) : (
            <Text style={styles.finishBtnText} pointerEvents="none">
              Continua alla dashboard — completa dopo
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── StepCard ──────────────────────────────────────────────────────────────

interface StepCardProps {
  step: StepConfig;
  done: boolean;
  isNext: boolean;
  entranceDelay: number;
  onPress: () => void;
}

function StepCard({
  step,
  done,
  isNext,
  entranceDelay,
  onPress,
}: StepCardProps) {
  // Entrance animation — slide up + fade
  const entranceOpacity = useSharedValue(0);
  const entranceTranslate = useSharedValue(20);

  // Pulse animation — only active when this is the "next" pending step
  const pulse = useSharedValue(0);

  // Finger pointer bounce — hint to tap
  const fingerX = useSharedValue(0);

  useEffect(() => {
    entranceOpacity.value = withDelay(
      entranceDelay,
      withTiming(1, { duration: 500 })
    );
    entranceTranslate.value = withDelay(
      entranceDelay,
      withSpring(0, { damping: 18, stiffness: 160 })
    );
    // entranceOpacity/entranceTranslate are Reanimated shared values — stable refs,
    // including them would trigger redundant animations on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entranceDelay]);

  useEffect(() => {
    if (isNext && !done) {
      // Continuous breathing pulse on the highlighted card
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      // Finger "tap" bounce
      fingerX.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 600 }),
          withTiming(-6, { duration: 350, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 350, easing: Easing.in(Easing.quad) }),
          withTiming(-6, { duration: 350, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 350, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      );
    } else {
      pulse.value = withTiming(0, { duration: 300 });
      fingerX.value = withTiming(0, { duration: 300 });
    }
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(fingerX);
    };
    // Reanimated shared values are stable refs — no need to list as deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNext, done]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    transform: [{ translateY: entranceTranslate.value }],
  }));

  // Pulse: border color + shadow opacity interpolated
  const pulseStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      pulse.value,
      [0, 1],
      [done ? Colors.success : Colors.borderLight, Colors.secondary]
    ),
    shadowOpacity: 0.06 + pulse.value * 0.14,
    shadowRadius: 10 + pulse.value * 14,
    transform: [{ scale: 1 + pulse.value * 0.015 }],
  }));

  const fingerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: fingerX.value }],
    opacity: isNext && !done ? 1 : 0,
  }));

  return (
    <Animated.View style={[entranceStyle]}>
      <Pressable
        onPress={onPress}
        disabled={done}
        accessibilityRole="button"
        accessibilityLabel={done ? `${step.title} completato` : `${step.title}. ${step.ctaLabel}`}
        accessibilityState={{ disabled: done }}
      >
        <Animated.View
          style={[
            styles.card,
            done && styles.cardDone,
            pulseStyle,
          ]}
        >
          {/* Icon circle */}
          <View
            style={[
              styles.cardIcon,
              done && styles.cardIconDone,
              isNext && !done && styles.cardIconNext,
            ]}
          >
            {done ? (
              <Ionicons name="checkmark" size={22} color="#fff" />
            ) : (
              <Ionicons name={step.icon} size={22} color={Colors.secondary} />
            )}
          </View>

          {/* Text */}
          <View style={{ flex: 1 }}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, done && styles.cardTitleDone]}>
                {step.title}
              </Text>
              {done && (
                <View style={styles.doneChip}>
                  <Text style={styles.doneChipText}>Fatto</Text>
                </View>
              )}
              {isNext && !done && (
                <View style={styles.nextChip}>
                  <Text style={styles.nextChipText}>Inizia qui</Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.cardDescription, done && styles.cardDescriptionDone]}
            >
              {step.description}
            </Text>

            {!done && (
              <View style={styles.cardCtaRow}>
                <Text style={styles.cardCtaText}>{step.ctaLabel}</Text>
                <Animated.View style={fingerStyle}>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={Colors.secondary}
                  />
                </Animated.View>
              </View>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  loaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  loaderSkipBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  loaderSkipText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.secondary,
    textDecorationLine: "underline",
  },

  scroll: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 48,
  },

  // --- Hero ---
  hero: {
    alignItems: "center",
    marginTop: Spacing.base,
    marginBottom: Spacing.lg,
  },
  lottieWrap: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  lottie: { width: 180, height: 180 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.secondary,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  headline: {
    fontSize: 30,
    fontWeight: "900",
    color: Colors.text,
    letterSpacing: -0.8,
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 10,
  },
  subheadline: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 12,
  },

  // --- Progress ---
  progressBlock: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  progressCount: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.secondary,
  },
  progressTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textTertiary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.backgroundAlt,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
  },

  // --- Steps ---
  stepsList: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardDone: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconNext: {
    backgroundColor: Colors.accentLight,
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  cardIconDone: {
    backgroundColor: Colors.success,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    flexShrink: 1,
  },
  cardTitleDone: {
    color: Colors.textSecondary,
  },
  cardDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  cardDescriptionDone: {
    color: Colors.textTertiary,
  },
  cardCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  cardCtaText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  doneChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.success,
  },
  doneChipText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  nextChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.secondary,
  },
  nextChipText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // --- Footer CTA ---
  finishBtn: {
    height: 54,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: "transparent",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  finishBtnPrimary: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
    ...Shadows.md,
  },
  finishBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  finishBtnTextPrimary: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
});
```
