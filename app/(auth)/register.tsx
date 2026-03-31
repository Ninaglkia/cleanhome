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

// ─── Design tokens — dal Stitch HTML registration_screen_italian_luxury_2 ──────
const C = {
  background: "#f6faf9",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  surfaceContainer: "#ebefee",
  primary: "#022420",
  primaryContainer: "#1a3a35",
  secondary: "#006b55",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
} as const;

// ─── Role card ────────────────────────────────────────────────────────────────

interface RoleCardProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}

function RoleCard({ icon, title, subtitle, selected, onPress }: RoleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleCard,
        selected && styles.roleCardSelected,
        pressed && !selected && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.roleIconWrap, selected && styles.roleIconWrapSelected]}>
        <Ionicons
          name={icon}
          size={22}
          color={selected ? "#ffffff" : C.primary}
        />
      </View>
      <Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>
        {title}
      </Text>
      <Text style={styles.roleSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type Role = "client" | "cleaner";

export default function RegisterScreen() {
  const { signUpWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("client");
  const [loading, setLoading] = useState(false);

  const handleRegister = useCallback(async () => {
    if (!fullName || !email || !password) {
      Alert.alert("Errore", "Compila tutti i campi");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Errore", "La password deve avere almeno 6 caratteri");
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email, password, fullName);
      Alert.alert(
        "Registrazione completata",
        "Controlla la tua email per confermare l'account"
      );
      router.back();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registrazione fallita";
      Alert.alert("Errore", message);
    } finally {
      setLoading(false);
    }
  }, [fullName, email, password, signUpWithEmail, router]);

  const handleSelectClient = useCallback(() => setSelectedRole("client"), []);
  const handleSelectCleaner = useCallback(() => setSelectedRole("cleaner"), []);

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
          {/* ── Header: close + brand ── */}
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <Ionicons name="close" size={24} color={C.primary} />
            </Pressable>
            {/* "THE CURATOR" — esatto dal Stitch HTML */}
            <Text style={styles.brandMark}>THE CURATOR</Text>
            {/* spacer per allineamento centrale */}
            <View style={{ width: 24 }} />
          </View>

          {/* ── Hero headline ── */}
          <View style={styles.heroSection}>
            <Text style={styles.eyebrow}>Benvenuto in CleanHome</Text>
            <Text style={styles.headline}>Crea il tuo{"\n"}account</Text>
          </View>

          {/* ── Role selection ── */}
          <View style={styles.roleRow}>
            <RoleCard
              icon="home-outline"
              title="Cliente"
              subtitle="Cerco servizi per la mia casa"
              selected={selectedRole === "client"}
              onPress={handleSelectClient}
            />
            <RoleCard
              icon="briefcase-outline"
              title="Professionista"
              subtitle="Offro le mie competenze"
              selected={selectedRole === "cleaner"}
              onPress={handleSelectCleaner}
            />
          </View>

          {/* ── Form ── */}
          <View style={styles.formSection}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nome completo"
                placeholderTextColor={`${C.onSurfaceVariant}80`}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={`${C.onSurfaceVariant}80`}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={`${C.onSurfaceVariant}80`}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* CTA */}
            <Pressable
              onPress={handleRegister}
              disabled={loading}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Registrati</Text>
              )}
            </Pressable>
          </View>

          {/* ── Divider ── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Oppure continua con</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Social buttons ── */}
          <View style={styles.socialRow}>
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

            <Pressable
              onPress={Platform.OS === "ios" ? signInWithApple : undefined}
              disabled={Platform.OS !== "ios"}
              style={({ pressed }) => [
                styles.socialButtonDark,
                pressed && Platform.OS === "ios" && { opacity: 0.88 },
                Platform.OS !== "ios" && { opacity: 0.38 },
              ]}
            >
              <Ionicons name="logo-apple" size={18} color="#ffffff" />
              <Text style={styles.socialButtonDarkText}>Apple</Text>
            </Pressable>
          </View>

          {/* ── Login link ── */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Hai già un account? </Text>
            <Pressable
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text style={styles.loginLink}>Accedi</Text>
            </Pressable>
          </View>

          {/* spacer per la bottom nav */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Bottom nav bar — esatta dal Stitch HTML ── */}
      <View style={styles.bottomNav}>
        {/* Sign In — active state (filled pill) */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.bottomNavItemActive,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="log-in-outline" size={20} color="#f6faf9" />
          <Text style={styles.bottomNavLabelActive}>Sign In</Text>
        </Pressable>

        {/* Help */}
        <Pressable
          onPress={() => {
            /* help action — placeholder */
          }}
          style={({ pressed }) => [
            styles.bottomNavItem,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="help-circle-outline" size={20} color={C.onSurface} />
          <Text style={styles.bottomNavLabel}>Help</Text>
        </Pressable>
      </View>
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
    paddingBottom: 0,
  },

  // ── Top bar ──────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 8,
  },
  brandMark: {
    fontSize: 16,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: 3.5,
    textTransform: "uppercase",
    // Noto Serif non è caricato nativamente — si usa il serif di sistema
    // In produzione: fontFamily: 'NotoSerif' se caricato con expo-font
  },

  // ── Hero ──────────────────────────────────────────────────────────────────────
  heroSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 3.5,
    color: C.secondary,
    marginBottom: 12,
  },
  headline: {
    fontSize: 44,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.8,
    lineHeight: 50,
  },

  // ── Role cards ────────────────────────────────────────────────────────────────
  roleRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 14,
    marginBottom: 24,
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
    shadowRadius: 16,
    elevation: 3,
  },
  roleCardSelected: {
    borderColor: C.secondary,
  },
  roleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  roleIconWrapSelected: {
    backgroundColor: C.secondary,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: C.primary,
    marginBottom: 4,
  },
  roleTitleSelected: {
    color: C.primary,
  },
  roleSubtitle: {
    fontSize: 11,
    color: C.onSurfaceVariant,
    lineHeight: 16,
  },

  // ── Form ──────────────────────────────────────────────────────────────────────
  formSection: {
    paddingHorizontal: 24,
    gap: 14,
    marginBottom: 4,
  },
  inputContainer: {
    backgroundColor: C.surfaceLow,
    borderRadius: 14,
    height: 56,
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  textInput: {
    fontSize: 15,
    color: C.onSurface,
    paddingVertical: 0,
  },

  // ── CTA ────────────────────────────────────────────────────────────────────────
  primaryButton: {
    backgroundColor: C.primary,
    borderRadius: 14,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
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
    marginHorizontal: 24,
    marginTop: 28,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: `${C.outlineVariant}4D`,
  },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 10,
    fontWeight: "700",
    color: `${C.onSurfaceVariant}99`,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  // ── Social buttons ─────────────────────────────────────────────────────────────
  socialRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 14,
    marginBottom: 28,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: C.surface,
    borderRadius: 14,
    height: 52,
    borderWidth: 1,
    borderColor: `${C.outlineVariant}33`,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  socialButtonPressed: {
    backgroundColor: C.surfaceLow,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.onSurface,
  },
  socialButtonDark: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: C.primary,
    borderRadius: 14,
    height: 52,
  },
  socialButtonDarkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },

  // ── Login link ─────────────────────────────────────────────────────────────────
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    paddingHorizontal: 24,
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

  // ── Bottom nav bar — dal Stitch HTML ──────────────────────────────────────────
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: `${C.onSurface}1A`,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.04,
    shadowRadius: 32,
    elevation: 12,
  },
  // Sign In — pill attivo (dark background)
  bottomNavItemActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.primaryContainer,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  bottomNavLabelActive: {
    fontSize: 11,
    fontWeight: "700",
    color: "#f6faf9",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  // Help — icona senza sfondo
  bottomNavItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    opacity: 0.6,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  bottomNavLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.onSurface,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
});
