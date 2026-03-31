import { useState, useCallback } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { Ionicons } from "@expo/vector-icons";

// ─── Design tokens (dal Stitch HTML) ──────────────────────────────────────────
const C = {
  background: "#f0f4f3",          // body bg del design HTML
  surface: "#ffffff",             // card white
  surfaceLow: "#f0f4f3",          // input fill
  primary: "#022420",             // deep forest — CTA, headline
  primaryContainer: "#1a3a35",    // decorative card bg
  secondary: "#006b55",           // link color, focus ring
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
} as const;

// ─── Login Screen ─────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const { signInWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = useCallback(async () => {
    if (!email || !password) {
      Alert.alert("Errore", "Inserisci email e password");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login fallito";
      Alert.alert("Errore", message);
    } finally {
      setLoading(false);
    }
  }, [email, password, signInWithEmail]);

  const handleTogglePassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleRegister = useCallback(() => {
    router.push("/(auth)/register");
  }, [router]);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Top bar: brand mark ── */}
          <View style={styles.topBar}>
            <Text style={styles.brandMark}>CleanHome</Text>
          </View>

          {/* ── Form card ── */}
          <View style={styles.card}>
            {/* Hero headline */}
            <View style={styles.heroSection}>
              <Text style={styles.headline}>Bentornato</Text>
              <Text style={styles.subheadline}>Accedi per gestire la tua casa</Text>
            </View>

            {/* EMAIL */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="nome@esempio.it"
                  placeholderTextColor={`${C.outline}80`}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* PASSWORD */}
            <View style={styles.fieldGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
                <Pressable hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.forgotLink}>Password dimenticata?</Text>
                </Pressable>
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={`${C.outline}80`}
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  onPress={handleTogglePassword}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={`${C.outline}99`}
                  />
                </Pressable>
              </View>
            </View>

            {/* ── CTA primary ── */}
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Accedi</Text>
              )}
            </Pressable>

            {/* ── Divider ── */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Oppure continua con</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── Social buttons ── */}
            <View style={styles.socialRow}>
              {/* Google */}
              <Pressable
                onPress={signInWithGoogle}
                style={({ pressed }) => [
                  styles.socialButton,
                  pressed && styles.socialButtonPressed,
                ]}
              >
                <Ionicons name="logo-google" size={18} color={C.onSurface} />
                <Text style={styles.socialButtonText}>Google</Text>
              </Pressable>

              {/* Apple — attivo su iOS, disabilitato su Android per layout simmetrico */}
              <Pressable
                onPress={Platform.OS === "ios" ? signInWithApple : undefined}
                disabled={Platform.OS !== "ios"}
                style={({ pressed }) => [
                  styles.socialButton,
                  pressed && Platform.OS === "ios" && styles.socialButtonPressed,
                  Platform.OS !== "ios" && { opacity: 0.38 },
                ]}
              >
                <Ionicons name="logo-apple" size={18} color={C.onSurface} />
                <Text style={styles.socialButtonText}>Apple</Text>
              </Pressable>
            </View>

            {/* ── Register link ── */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Non hai ancora un account? </Text>
              <Pressable
                onPress={handleRegister}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.registerLink}>Registrati ora</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Footer copyright ── */}
          <Text style={styles.copyright}>
            © 2025 CleanHome. Tutti i diritti riservati. La tua privacy è la nostra priorità.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 32,
  },

  // ── Top bar ──────────────────────────────────────────────────────────────────
  topBar: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: 16,
    alignItems: "center",
  },
  brandMark: {
    // Simula "Noto Serif" font con italic bold
    fontSize: 22,
    fontWeight: "900",
    fontStyle: "italic",
    color: C.primaryContainer,
    letterSpacing: 0.5,
  },

  // ── Card ──────────────────────────────────────────────────────────────────────
  card: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 32,
    elevation: 4,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────────
  heroSection: {
    marginBottom: 28,
  },
  headline: {
    fontSize: 40,
    fontWeight: "700",
    fontStyle: "italic",
    color: C.primary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subheadline: {
    fontSize: 16,
    fontWeight: "400",
    color: C.onSurfaceVariant,
    lineHeight: 22,
  },

  // ── Form fields ───────────────────────────────────────────────────────────────
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.outline,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 2,
  },
  passwordLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    marginLeft: 2,
  },
  forgotLink: {
    fontSize: 10,
    fontWeight: "700",
    color: C.secondary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  inputContainer: {
    backgroundColor: C.surfaceLow,
    borderRadius: 14,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: C.onSurface,
    paddingVertical: 0,
  },
  eyeButton: {
    paddingLeft: 8,
  },

  // ── CTA ────────────────────────────────────────────────────────────────────────
  primaryButton: {
    backgroundColor: C.primary,
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 32,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // ── Divider ───────────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: `${C.outlineVariant}4D`, // ~30% opacity
  },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 10,
    fontWeight: "700",
    color: C.outline,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  // ── Social buttons ─────────────────────────────────────────────────────────────
  socialRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    height: 52,
    borderWidth: 1,
    borderColor: `${C.outlineVariant}4D`,
    backgroundColor: "transparent",
  },
  socialButtonPressed: {
    backgroundColor: C.surfaceLow,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.onSurface,
  },

  // ── Register link ──────────────────────────────────────────────────────────────
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  registerText: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    lineHeight: 20,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: C.secondary,
  },

  // ── Footer ─────────────────────────────────────────────────────────────────────
  copyright: {
    textAlign: "center",
    fontSize: 11,
    color: `${C.outline}99`,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 24,
    paddingHorizontal: 24,
    lineHeight: 16,
  },
});
