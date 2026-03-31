import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  StatusBar,
  ScrollView,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { UserProfile } from "../../lib/types";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  background: "#f6faf9",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  surfaceHigh: "#e5e9e8",
  primary: "#022420",
  primaryContainer: "#1a3a35",
  secondary: "#006b55",
  secondaryContainer: "#82f4d1",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  // Cleaner role
  cleanerPrimary: "#8B5E3C",
  cleanerDark: "#5C3D24",
  cleanerAmber: "#D4A574",
  cleanerLight: "#F5EBE0",
} as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MenuRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
  loading?: boolean;
}

function MenuRow({
  icon,
  label,
  sublabel,
  onPress,
  danger = false,
  loading = false,
}: MenuRowProps) {
  const iconColor = danger ? C.error : C.onSurfaceVariant;
  const iconBg = danger ? C.errorContainer : C.surfaceLow;
  const textColor = danger ? C.error : C.onSurface;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
    >
      <View style={[styles.menuRowIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>
      <View style={styles.menuRowBody}>
        <Text style={[styles.menuRowLabel, { color: textColor }]}>{label}</Text>
        {sublabel ? (
          <Text style={styles.menuRowSublabel}>{sublabel}</Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={C.outline} />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={C.outlineVariant} />
      )}
    </Pressable>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

// ─── Client profile view ──────────────────────────────────────────────────────

interface ClientProfileProps {
  initials: string;
  fullName: string;
  email: string;
  isSwitching: boolean;
  onEditProfile: () => void;
  onPayments: () => void;
  onDocuments: () => void;
  onLegal: () => void;
  onPrivacy: () => void;
  onSwitchRole: () => void;
  onSignOut: () => void;
}

function ClientProfile({
  initials,
  fullName,
  email,
  isSwitching,
  onEditProfile,
  onPayments,
  onDocuments,
  onLegal,
  onPrivacy,
  onSwitchRole,
  onSignOut,
}: ClientProfileProps) {
  return (
    <>
      {/* ── Hero card ── */}
      <View style={styles.heroCard}>
        <View style={[styles.avatarRing, { borderColor: C.secondary }]}>
          <View style={[styles.avatarCircle, { backgroundColor: C.primary }]}>
            <Text style={[styles.avatarInitials, { color: "#00c896" }]}>
              {initials}
            </Text>
          </View>
        </View>
        <Text style={styles.profileName}>{fullName}</Text>
        <Text style={styles.profileEmail}>{email}</Text>
        <View style={[styles.roleBadge, { backgroundColor: C.secondaryContainer }]}>
          <Text style={[styles.roleBadgeText, { color: C.secondary }]}>
            CLIENTE PREMIUM
          </Text>
        </View>
      </View>

      {/* ── Account ── */}
      <View style={styles.menuSection}>
        <SectionHeader label="Account" />
        <View style={styles.menuCard}>
          <MenuRow
            icon="person-outline"
            label="Modifica Profilo"
            onPress={onEditProfile}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="card-outline"
            label="Metodo di Pagamento"
            sublabel="Mastercard **** 4312"
            onPress={onPayments}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="document-text-outline"
            label="I miei documenti"
            onPress={onDocuments}
          />
        </View>
      </View>

      {/* ── Legale ── */}
      <View style={styles.menuSection}>
        <SectionHeader label="Legale e Privacy" />
        <View style={styles.menuCard}>
          <MenuRow
            icon="scale-outline"
            label="Legale"
            onPress={onLegal}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="shield-checkmark-outline"
            label="Informativa sulla privacy"
            onPress={onPrivacy}
          />
        </View>
      </View>

      {/* ── Modalità Cleaner toggle ── */}
      <View style={styles.menuSection}>
        <SectionHeader label="Ruolo" />
        <Pressable
          style={({ pressed }) => [
            styles.toggleCard,
            { backgroundColor: C.primaryContainer },
            pressed && { opacity: 0.9 },
          ]}
          onPress={onSwitchRole}
        >
          <View style={styles.toggleLeft}>
            <View style={styles.toggleIconWrap}>
              <Ionicons name="briefcase-outline" size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.toggleLabel}>Modalità Cleaner</Text>
              <Text style={styles.toggleSub}>Passa a professionista</Text>
            </View>
          </View>
          {isSwitching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Switch
              value={false}
              onValueChange={onSwitchRole}
              trackColor={{
                false: "rgba(255,255,255,0.25)",
                true: "rgba(255,255,255,0.80)",
              }}
              thumbColor="#fff"
              ios_backgroundColor="rgba(255,255,255,0.25)"
            />
          )}
        </Pressable>
      </View>

      {/* ── Sign out ── */}
      <View style={styles.menuSection}>
        <Pressable
          onPress={onSignOut}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.signOutText}>Esci dall'account</Text>
        </Pressable>
      </View>
    </>
  );
}

// ─── Cleaner profile view ─────────────────────────────────────────────────────

interface CleanerProfileProps {
  initials: string;
  fullName: string;
  email: string;
  isSwitching: boolean;
  onEditProfile: () => void;
  onBankData: () => void;
  onDocuments: () => void;
  onPrivacy: () => void;
  onSwitchRole: () => void;
  onSignOut: () => void;
  onViewListing: () => void;
}

function CleanerProfileView({
  initials,
  fullName,
  email,
  isSwitching,
  onEditProfile,
  onBankData,
  onDocuments,
  onPrivacy,
  onSwitchRole,
  onSignOut,
  onViewListing,
}: CleanerProfileProps) {
  const services = [
    "Pulizia Standard",
    "Pulizia Profonda",
    "Stiratura",
    "Pulizia Vetri",
  ];

  return (
    <>
      {/* ── Hero card ── */}
      <View style={styles.heroCard}>
        <View style={[styles.avatarRing, { borderColor: C.cleanerAmber }]}>
          <View
            style={[styles.avatarCircle, { backgroundColor: C.cleanerPrimary }]}
          >
            <Text style={[styles.avatarInitials, { color: C.cleanerLight }]}>
              {initials}
            </Text>
          </View>
        </View>
        <Text style={styles.profileName}>{fullName}</Text>
        <Text style={styles.profileEmail}>{email}</Text>
        <View
          style={[styles.roleBadge, { backgroundColor: C.cleanerLight }]}
        >
          <Text style={[styles.roleBadgeText, { color: C.cleanerPrimary }]}>
            PROFESSIONISTA
          </Text>
        </View>
      </View>

      {/* ── Il mio annuncio ── */}
      <View style={styles.menuSection}>
        <SectionHeader label="Il mio annuncio" />
        <View style={styles.listingCard}>
          <View style={styles.listingTop}>
            <View>
              <Text style={styles.listingRateLabel}>PREZZO BASE</Text>
              <Text style={styles.listingRate}>25€/ora</Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.viewListingBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={onViewListing}
            >
              <Text style={styles.viewListingBtnText}>Visualizza profilo</Text>
              <Ionicons name="arrow-forward" size={13} color={C.cleanerPrimary} />
            </Pressable>
          </View>
          <View style={styles.servicesRow}>
            {services.map((s) => (
              <View key={s} style={styles.serviceTag}>
                <Text style={styles.serviceTagText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── Impostazioni account ── */}
      <View style={styles.menuSection}>
        <SectionHeader label="Impostazioni Account" />
        <View style={styles.menuCard}>
          <MenuRow
            icon="person-outline"
            label="Modifica Profilo"
            onPress={onEditProfile}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="business-outline"
            label="Dati Bancari / IBAN"
            onPress={onBankData}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="document-text-outline"
            label="I miei documenti"
            onPress={onDocuments}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="shield-checkmark-outline"
            label="Informativa sulla privacy"
            onPress={onPrivacy}
          />
        </View>
      </View>

      {/* ── Modalità Cliente toggle ── */}
      <View style={styles.menuSection}>
        <SectionHeader label="Ruolo" />
        <Pressable
          style={({ pressed }) => [
            styles.toggleCard,
            { backgroundColor: C.cleanerDark },
            pressed && { opacity: 0.9 },
          ]}
          onPress={onSwitchRole}
        >
          <View style={styles.toggleLeft}>
            <View style={styles.toggleIconWrap}>
              <Ionicons name="home-outline" size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.toggleLabel}>Modalità Cliente</Text>
              <Text style={styles.toggleSub}>Passa a modalità cliente</Text>
            </View>
          </View>
          {isSwitching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Switch
              value={true}
              onValueChange={onSwitchRole}
              trackColor={{
                false: "rgba(255,255,255,0.25)",
                true: C.cleanerAmber,
              }}
              thumbColor="#fff"
              ios_backgroundColor="rgba(255,255,255,0.25)"
            />
          )}
        </Pressable>
      </View>

      {/* ── Esci ── */}
      <View style={styles.menuSection}>
        <Pressable
          onPress={onSignOut}
          style={({ pressed }) => [
            styles.signOutButtonFilled,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.signOutFilledText}>ESCI DALL'ACCOUNT</Text>
        </Pressable>
      </View>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, profile, signOut, setActiveRole, refreshProfile } = useAuth();
  const router = useRouter();
  const [switchingRole, setSwitchingRole] = useState(false);

  const isCleaner = profile?.active_role === "cleaner";

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSwitchRole = useCallback(async () => {
    const newRole: UserProfile["active_role"] = isCleaner ? "client" : "cleaner";
    setSwitchingRole(true);
    try {
      await setActiveRole(newRole);
      const updatedProfile = await refreshProfile();
      await new Promise((r) => setTimeout(r, 150));

      if (newRole === "client") {
        router.replace("/(tabs)/home");
      } else {
        const isOnboarded =
          updatedProfile?.cleaner_onboarded ?? profile?.cleaner_onboarded;
        if (isOnboarded) {
          router.replace("/(tabs)/cleaner-home");
        } else {
          router.push("/onboarding/cleaner");
        }
      }
    } catch {
      Alert.alert("Errore", "Impossibile cambiare ruolo");
    } finally {
      setSwitchingRole(false);
    }
  }, [isCleaner, setActiveRole, refreshProfile, router, profile]);

  const handleSignOut = useCallback(() => {
    Alert.alert("Esci dall'account", "Sei sicuro di voler uscire?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Esci",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }, [signOut, router]);

  const handleEditProfile = useCallback(() => {
    Alert.alert("Modifica profilo", "Funzionalità in arrivo");
  }, []);

  const handlePayments = useCallback(() => {
    Alert.alert("Metodo di pagamento", "Prossimamente");
  }, []);

  const handleDocuments = useCallback(() => {
    Alert.alert("I miei documenti", "Prossimamente");
  }, []);

  const handleLegal = useCallback(() => {
    Alert.alert("Legale", "Prossimamente");
  }, []);

  const handlePrivacy = useCallback(() => {
    Alert.alert("Privacy", "Prossimamente");
  }, []);

  const handleBankData = useCallback(() => {
    Alert.alert("Dati bancari", "Prossimamente");
  }, []);

  const handleViewListing = useCallback(() => {
    router.push("/cleaner/profile-view");
  }, [router]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={C.background}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <Text style={styles.topBarBrand}>CleanHome</Text>
          <Pressable
            style={({ pressed }) => [
              styles.bellWrap,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => Alert.alert("Notifiche", "Prossimamente")}
          >
            <Ionicons
              name="notifications-outline"
              size={21}
              color={C.onSurface}
            />
          </Pressable>
        </View>

        {isCleaner ? (
          <CleanerProfileView
            initials={initials}
            fullName={profile?.full_name ?? "Utente"}
            email={user?.email ?? ""}
            isSwitching={switchingRole}
            onEditProfile={handleEditProfile}
            onBankData={handleBankData}
            onDocuments={handleDocuments}
            onPrivacy={handlePrivacy}
            onSwitchRole={handleSwitchRole}
            onSignOut={handleSignOut}
            onViewListing={handleViewListing}
          />
        ) : (
          <ClientProfile
            initials={initials}
            fullName={profile?.full_name ?? "Utente"}
            email={user?.email ?? ""}
            isSwitching={switchingRole}
            onEditProfile={handleEditProfile}
            onPayments={handlePayments}
            onDocuments={handleDocuments}
            onLegal={handleLegal}
            onPrivacy={handlePrivacy}
            onSwitchRole={handleSwitchRole}
            onSignOut={handleSignOut}
          />
        )}

        <Text style={styles.versionText}>CleanHome v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  scroll: {
    paddingBottom: 48,
  },

  // ── Top bar ───────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topBarBrand: {
    fontSize: 18,
    fontWeight: "900",
    fontStyle: "italic",
    color: C.primaryContainer,
    letterSpacing: 0.3,
  },
  bellWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // ── Hero card ─────────────────────────────────────────────────────────────────
  heroCard: {
    alignItems: "center",
    backgroundColor: C.surface,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    padding: 4,
    marginBottom: 16,
  },
  avatarCircle: {
    flex: 1,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    fontStyle: "italic",
    color: C.onSurface,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    marginBottom: 14,
  },
  roleBadge: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // ── Menu sections ─────────────────────────────────────────────────────────────
  menuSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: C.outline,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: `${C.outlineVariant}26`,
    marginLeft: 62,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  menuRowPressed: {
    backgroundColor: C.surfaceLow,
  },
  menuRowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuRowBody: {
    flex: 1,
  },
  menuRowLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  menuRowSublabel: {
    fontSize: 12,
    color: C.outline,
    marginTop: 2,
  },

  // ── Toggle card ───────────────────────────────────────────────────────────────
  toggleCard: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  toggleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.1,
  },
  toggleSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
  },

  // ── Sign out ──────────────────────────────────────────────────────────────────
  signOutButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.error,
  },
  signOutButtonFilled: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: C.error,
    borderRadius: 16,
    paddingVertical: 16,
  },
  signOutFilledText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },

  // ── Listing card ──────────────────────────────────────────────────────────────
  listingCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 18,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  listingTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  listingRateLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: C.outline,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  listingRate: {
    fontSize: 22,
    fontWeight: "800",
    color: "#8B5E3C",
    letterSpacing: -0.5,
  },
  viewListingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F5EBE0",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  viewListingBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8B5E3C",
  },
  servicesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  serviceTag: {
    backgroundColor: "#F5EBE0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  serviceTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8B5E3C",
  },

  // ── Version ───────────────────────────────────────────────────────────────────
  versionText: {
    textAlign: "center",
    fontSize: 11,
    color: `${C.outline}99`,
    letterSpacing: 0.3,
    marginTop: 28,
  },
});
