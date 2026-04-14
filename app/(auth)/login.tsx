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

  // Prefer router.back() so the user returns to whichever onboarding step
  // pushed them here (features, security, deep link, etc.). Fall back to
  // the marketing onboarding root when there's no history — e.g. the app
  // was cold-started directly on /login via a deep link.
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/onboarding/features");
    }
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
  }, [email, password, signInWithEmail]);

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
          {/* Back + Brand */}
          <View style={styles.topBar}>
            <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={10}>
              <Ionicons name="arrow-back" size={20} color={C.primary} />
              <Text style={styles.backText}>Indietro</Text>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="leaf" size={20} color="#022420" />
              <Text style={styles.brandMark}>CleanHome</Text>
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

            {/* Accedi button — View wrapper pattern */}
            <View style={styles.accediOuter}>
              <Pressable onPress={handleLogin} disabled={loading} style={styles.accediTap}>
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
                <GoogleLogo size={20} />
                <Text style={styles.googleText}>Accedi con Google</Text>
              </Pressable>
            </View>

            {/* Apple — View wrapper */}
            <View style={styles.appleOuter}>
              <Pressable
                onPress={Platform.OS === "ios" ? handleAppleSignIn : undefined}
                disabled={Platform.OS !== "ios"}
                style={styles.socialTap}
              >
                <AppleLogo size={20} color="#ffffff" />
                <Text style={styles.appleText}>Accedi con Apple</Text>
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
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  backText: { fontSize: 15, fontWeight: "600", color: C.primary },
  brandMark: { fontSize: 24, fontWeight: "900", color: C.primaryContainer, letterSpacing: -0.5 },

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

  // Shared social tap area
  socialTap: {
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
