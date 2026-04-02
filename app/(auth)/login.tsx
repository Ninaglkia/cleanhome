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
import { GoogleLogo } from "../../components/icons/GoogleLogo";
import { AppleLogo } from "../../components/icons/AppleLogo";

// Design tokens — Stitch login_with_social_buttons/code.html
const C = {
  background: "#f0f4f3",         // body bg = surface-container-low
  surface: "#ffffff",            // surface-container-lowest — card bg
  surfaceLow: "#f0f4f3",         // surface-container-low — input bg
  primary: "#022420",            // primary — "Bentornato" headline, CTA bg
  primaryContainer: "#1a3a35",   // primary-container — brand header text
  secondary: "#006b55",          // secondary — links, forgot password
  onSurface: "#181c1c",          // on-surface — input text
  onSurfaceVariant: "#414846",   // on-surface-variant — subtitle
  outline: "#717976",            // outline — field labels, divider text
  outlineVariant: "#c1c8c5",     // outline-variant — divider line
} as const;

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
          {/* ── Brand header: sticky-style top bar ── */}
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
              <Ionicons name="arrow-back" size={20} color="#022420" />
              <Text style={styles.backText}>Indietro</Text>
            </Pressable>
            <Text style={styles.brandMark}>CleanHome</Text>
          </View>

          {/* ── Form card: bg-surface-container-lowest, shadow ── */}
          <View style={styles.card}>
            {/* Hero */}
            <View style={styles.heroSection}>
              <Text style={styles.headline}>Bentornato</Text>
              <Text style={styles.subheadline}>
                Accedi per gestire la tua casa
              </Text>
            </View>

            {/* Email field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
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

            {/* Password field */}
            <View style={styles.fieldGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
                <Pressable hitSlop={8}>
                  <Text style={styles.forgotLink}>Password dimenticata?</Text>
                </Pressable>
              </View>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={[styles.textInput, styles.passwordTextInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={`${C.outline}80`}
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={10}
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

            {/* Primary CTA — "Accedi" */}
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

            {/* Divider "oppure" */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>oppure</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google button: bg-white, border #dadce0, h-48, rounded-[12px] */}
            <Pressable
              onPress={signInWithGoogle}
              style={({ pressed }) => [
                styles.googleButton,
                pressed && { backgroundColor: "#f8f9fa" },
              ]}
            >
              <GoogleLogo size={20} />
              <Text style={styles.googleButtonText}>Accedi con Google</Text>
            </Pressable>

            {/* Apple button: bg-black, h-48, rounded-[12px] */}
            <Pressable
              onPress={Platform.OS === "ios" ? signInWithApple : undefined}
              disabled={Platform.OS !== "ios"}
              style={({ pressed }) => [
                styles.appleButton,
                pressed && { opacity: 0.9 },
                Platform.OS !== "ios" && { opacity: 0.4 },
              ]}
            >
              <AppleLogo size={20} color="#ffffff" />
              <Text style={styles.appleButtonText}>Accedi con Apple</Text>
            </Pressable>

            {/* Register link */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>
                Non hai ancora un account?{" "}
              </Text>
              <Pressable
                onPress={() => router.push("/(auth)/register")}
                hitSlop={8}
              >
                <Text style={styles.registerLink}>Registrati ora</Text>
              </Pressable>
            </View>
          </View>

          {/* Footer copyright */}
          <Text style={styles.copyright}>
            © 2024 CleanHome. Tutti i diritti riservati. La tua privacy è la
            nostra priorità.
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

  // ── Top bar (brand) ───────────────────────────────────────────────────────
  topBar: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: 16,
    backgroundColor: C.background,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    marginBottom: 6,
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#022420",
  },
  // Noto Serif, font-black, text-2xl, color #1a3a35
  brandMark: {
    fontSize: 24,
    fontWeight: "900",
    color: C.primaryContainer,
    letterSpacing: -0.5,
  },

  // ── Card: bg-surface-container-lowest, p-8 md:p-12, rounded-lg, shadow ───
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

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroSection: {
    marginBottom: 28,
  },
  // DM Serif Display, text-5xl (#022420) — fontSize 48, fontWeight "700"
  headline: {
    fontSize: 48,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  // text-lg text-on-surface-variant
  subheadline: {
    fontSize: 18,
    color: C.onSurfaceVariant,
    lineHeight: 26,
  },

  // ── Fields ────────────────────────────────────────────────────────────────
  fieldGroup: {
    marginBottom: 20,
  },
  // text-[10px] font-bold uppercase tracking-widest text-outline (#717976)
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
  // text-[10px] font-bold uppercase tracking-widest text-secondary
  forgotLink: {
    fontSize: 10,
    fontWeight: "700",
    color: C.secondary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  // bg-surface-container-low border-none rounded-md px-5 py-4
  textInput: {
    backgroundColor: C.surfaceLow,
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 20,
    fontSize: 15,
    color: C.onSurface,
  },
  // Password input: row with eye toggle
  passwordInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceLow,
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 20,
  },
  passwordTextInput: {
    backgroundColor: "transparent",
    flex: 1,
    paddingHorizontal: 0,
    height: "100%",
  },
  eyeButton: {
    paddingLeft: 8,
  },

  // ── Primary CTA — bg-primary, py-5, rounded-lg, text-lg, shadow-lg ───────
  primaryButton: {
    backgroundColor: C.primary,
    borderRadius: 16,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 28,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryButtonPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: `${C.outlineVariant}4D`,
  },
  // text-[10px] font-bold uppercase tracking-widest text-outline
  dividerText: {
    marginHorizontal: 14,
    fontSize: 10,
    fontWeight: "700",
    color: C.outline,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  // ── Google button: bg-white, border #dadce0, h-[48px], rounded-[12px] ────
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dadce0",
    marginBottom: 12,
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
  },

  // ── Apple button: bg-black, h-[48px], rounded-[12px] ─────────────────────
  appleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#000000",
    marginBottom: 28,
  },
  appleButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },

  // ── Register link ─────────────────────────────────────────────────────────
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  registerText: {
    fontSize: 14,
    color: C.onSurfaceVariant,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: C.secondary,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
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
