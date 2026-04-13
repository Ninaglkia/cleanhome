import { useState, useCallback, useEffect } from "react";
import LottieView from "lottie-react-native";
import {
  View,
  Text,
  Pressable,
  Alert,
  StatusBar,
  ScrollView,
  // Switch nativo rimosso — usiamo AnimatedToggle
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
} from "react-native";
// ImagePicker caricato dinamicamente — richiede rebuild nativo
let ImagePicker: any = null;
try { ImagePicker = require("expo-image-picker"); } catch {}
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedToggle } from "../../components/AnimatedToggle";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { UserProfile } from "../../lib/types";
import { uploadAvatar, removeAvatar } from "../../lib/api";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Avatar logic ─────────────────────────────────────────────────────────────

function useAvatarActions(
  userId: string | undefined,
  avatarUrl: string | undefined | null,
  refreshProfile: () => Promise<UserProfile | null>
) {
  const [uploading, setUploading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  const requestPermission = async (type: "camera" | "gallery"): Promise<boolean> => {
    if (!ImagePicker) {
      Alert.alert("Non disponibile", "La funzionalità foto richiede un rebuild dell'app.");
      return false;
    }
    if (type === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permesso negato", "Abilita l'accesso alla fotocamera nelle impostazioni.");
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permesso negato", "Abilita l'accesso alla libreria foto nelle impostazioni.");
        return false;
      }
    }
    return true;
  };

  const handlePickResult = async (result: any) => {
    if (result.canceled || !result.assets?.length || !userId) return;
    const uri = result.assets[0].uri;
    setUploading(true);
    try {
      await uploadAvatar(userId, uri);
      await refreshProfile();
    } catch (err: unknown) {
      Alert.alert("Errore upload", err instanceof Error ? err.message : "Riprova.");
    } finally {
      setUploading(false);
    }
  };

  const openCamera = async () => {
    if (!(await requestPermission("camera"))) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      await handlePickResult(result);
    } catch {
      Alert.alert("Fotocamera non disponibile", "Prova a scegliere dalla libreria.");
    }
  };

  const openGallery = async () => {
    if (!(await requestPermission("gallery"))) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    await handlePickResult(result);
  };

  const handleRemove = async () => {
    if (!userId || !avatarUrl) return;
    Alert.alert("Rimuovi foto", "Sei sicuro di voler rimuovere la foto profilo?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Rimuovi",
        style: "destructive",
        onPress: async () => {
          setUploading(true);
          try {
            await removeAvatar(userId, avatarUrl);
            await refreshProfile();
          } catch (err: unknown) {
            Alert.alert("Errore", err instanceof Error ? err.message : "Riprova.");
          } finally {
            setUploading(false);
          }
        },
      },
    ]);
  };

  const showOptions = () => {
    const options: Parameters<typeof Alert.alert>[2] = [
      ...(avatarUrl
        ? [{ text: "Visualizza foto", onPress: () => setPreviewVisible(true) }]
        : []),
      { text: "Scatta foto", onPress: openCamera },
      { text: "Scegli dalla libreria", onPress: openGallery },
      ...(avatarUrl
        ? [{ text: "Rimuovi foto", style: "destructive" as const, onPress: handleRemove }]
        : []),
      { text: "Annulla", style: "cancel" as const },
    ];
    Alert.alert("Foto profilo", "Cosa vuoi fare?", options);
  };

  return { uploading, previewVisible, setPreviewVisible, showOptions };
}

// ─── Avatar display component ─────────────────────────────────────────────────

interface AvatarDisplayProps {
  avatarUrl?: string | null;
  initials: string;
  size?: number;
  backgroundColor?: string;
  initialsColor?: string;
  borderRadius?: number;
  uploading?: boolean;
}

function AvatarDisplay({
  avatarUrl,
  initials,
  size = 96,
  backgroundColor,
  initialsColor,
  borderRadius = 999,
  uploading = false,
}: AvatarDisplayProps) {
  const containerStyle = {
    width: size,
    height: size,
    borderRadius,
    overflow: "hidden" as const,
    backgroundColor: backgroundColor ?? C.primaryContainer,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  };

  if (uploading) {
    return (
      <View style={containerStyle}>
        <ActivityIndicator color={initialsColor ?? "#abcec6"} />
      </View>
    );
  }

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={containerStyle}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={containerStyle}>
      <Text
        style={{
          fontSize: size * 0.33,
          fontWeight: "800",
          color: initialsColor ?? "#abcec6",
          letterSpacing: 1,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

// ─── Photo preview modal ──────────────────────────────────────────────────────

function PhotoPreviewModal({
  uri,
  visible,
  onClose,
}: {
  uri: string;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" }}
        onPress={onClose}
      >
        <Image
          source={{ uri }}
          style={{ width: SCREEN_W, height: SCREEN_W }}
          resizeMode="contain"
        />
      </Pressable>
    </Modal>
  );
}

// ─── Design tokens (Stitch) ───────────────────────────────────────────────────

const C = {
  background: "#f8fbfa",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  primary: "#022420",
  primaryContainer: "#022420",
  secondary: "#006b55",
  secondaryContainer: "#82f4d1",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  // Cleaner role palette
  cleanerPrimary: "#8B5E3C",
  cleanerDark: "#5C3D24",
  cleanerAmber: "#D4A574",
  cleanerLight: "#F5EBE0",
  cleanerIconBg: "#F5EBE0",
} as const;

// ─── Menu row ─────────────────────────────────────────────────────────────────

interface MenuRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
  loading?: boolean;
  iconBgColor?: string;
  iconColor?: string;
}

function MenuRow({
  icon,
  label,
  sublabel,
  onPress,
  danger = false,
  loading = false,
  iconBgColor,
  iconColor,
  cardStyle = false,
}: MenuRowProps & { cardStyle?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        cardStyle && styles.menuRowCard,
        pressed && (cardStyle ? styles.menuRowCardPressed : styles.menuRowPressed),
      ]}
    >
      <View
        style={[
          styles.menuRowIconBox,
          { backgroundColor: danger ? C.errorContainer : (iconBgColor || C.surfaceLow) },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={danger ? C.error : (iconColor || C.primary)}
        />
      </View>

      <View style={styles.menuRowBody}>
        <Text
          style={[
            styles.menuRowLabel,
            { color: danger ? C.error : C.primary },
          ]}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text style={styles.menuRowSublabel}>{sublabel}</Text>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={C.outline} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={C.outlineVariant} />
      )}
    </Pressable>
  );
}

// ─── Client profile view ──────────────────────────────────────────────────────

interface CleanerViewProps {
  initials: string;
  fullName: string;
  avatarUrl?: string | null;
  avatarUploading?: boolean;
  previewVisible?: boolean;
  onAvatarPress: () => void;
  onPreviewClose: () => void;
  onEditProfile: () => void;
  onListing: () => void;
  onPayments: () => void;
  onDocuments: () => void;
  onLegal: () => void;
  onPrivacy: () => void;
  onSwitchRole: () => void;
  onSignOut: () => void;
}

function CleanerView({
  initials,
  fullName,
  avatarUrl,
  avatarUploading,
  previewVisible,
  onAvatarPress,
  onPreviewClose,
  onEditProfile,
  onListing,
  onPayments,
  onDocuments,
  onLegal,
  onPrivacy,
  onSwitchRole,
  onSignOut,
}: CleanerViewProps) {
  return (
    <>
      {/* ── Photo preview modal ── */}
      {avatarUrl && previewVisible ? (
        <PhotoPreviewModal uri={avatarUrl} visible={previewVisible} onClose={onPreviewClose} />
      ) : null}

      {/* ── Hero ── */}
      <View style={clientStyles.heroSection}>
        <Pressable style={clientStyles.avatarWrapper} onPress={onAvatarPress}>
          <AvatarDisplay
            avatarUrl={avatarUrl}
            initials={initials}
            size={96}
            backgroundColor={clientStyles.avatarSquare.backgroundColor}
            initialsColor={C.primary}
            borderRadius={999}
            uploading={avatarUploading}
          />
          <View style={clientStyles.verifiedBadge}>
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
        </Pressable>
        <Text style={clientStyles.heroName}>{fullName}</Text>
        <Text style={clientStyles.heroRole}>PROFESSIONISTA</Text>
      </View>

      {/* ── Toggle card ── */}
      <View style={clientStyles.toggleSection}>
        <View style={clientStyles.toggleCard}>
          <View style={styles.toggleLeft}>
            <Text style={styles.toggleTitle}>Modalità Professionista</Text>
            <Text style={styles.toggleSub}>Gestisci i tuoi annunci e prenotazioni</Text>
          </View>
          <AnimatedToggle
            value={false}
            onValueChange={() => onSwitchRole()}
            activeColor="#D4A574"
            inactiveColor="#4fc4a3"
          />
        </View>
      </View>

      {/* ── Menu rows (card indipendenti) — monocolore verde ── */}
      <View style={clientStyles.menuSection}>
        <MenuRow
          icon="person-outline"
          label="Modifica Profilo"
          sublabel="Gestisci le tue informazioni personali"
          onPress={onEditProfile}
          iconBgColor={C.surfaceLow}
          cardStyle
        />
        <MenuRow
          icon="megaphone-outline"
          label="I miei annunci"
          sublabel="Gestisci i tuoi annunci e zone di copertura"
          onPress={onListing}
          iconBgColor={C.surfaceLow}
          cardStyle
        />
        <MenuRow
          icon="card-outline"
          label="Metodo di Pagamento"
          sublabel="Mastercard •••• 4242"
          onPress={onPayments}
          iconBgColor={C.surfaceLow}
          cardStyle
        />
        <MenuRow
          icon="document-text-outline"
          label="I miei documenti"
          sublabel="Fatture e contratti di servizio"
          onPress={onDocuments}
          iconBgColor={C.surfaceLow}
          cardStyle
        />
        <MenuRow
          icon="shield-checkmark-outline"
          label="Privacy e Legale"
          sublabel="Termini, condizioni e gestione dati"
          onPress={onPrivacy}
          iconBgColor={C.surfaceLow}
          cardStyle
        />
      </View>

      {/* ── Lottie animation decorativa ── */}
      <View style={{ alignItems: "center", marginTop: 8, marginBottom: -12, opacity: 0.15 }}>
        <LottieView
          source={require("../../assets/lottie/cleaning.json")}
          autoPlay
          loop
          speed={0.5}
          style={{ width: 180, height: 100 }}
        />
      </View>

      {/* ── Esci dall'account ── */}
      <Pressable
        onPress={onSignOut}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          marginHorizontal: 16,
          marginTop: 8,
          marginBottom: 8,
          paddingVertical: 16,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: "#E53E3E",
          backgroundColor: "transparent",
          transform: [{ scale: pressed ? 0.96 : 1 }],
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="log-out-outline" size={20} color="#E53E3E" />
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#E53E3E" }}>
          Esci dall'account
        </Text>
      </Pressable>

      <Text
        style={{
          fontSize: 11,
          color: "#a0a8a6",
          textAlign: "center",
          marginTop: 12,
          marginBottom: 20,
        }}
      >
        CleanHome v1.0.0
      </Text>

    </>
  );
}

// ─── Cleaner profile view ─────────────────────────────────────────────────────

interface ClientViewProps {
  initials: string;
  fullName: string;
  avatarUrl?: string | null;
  avatarUploading?: boolean;
  previewVisible?: boolean;
  onAvatarPress: () => void;
  onPreviewClose: () => void;
  onEditProfile: () => void;
  onBankData: () => void;
  onDocuments: () => void;
  onPrivacy: () => void;
  onBookings: () => void;
  onSwitchRole: () => void;
  onSignOut: () => void;
  onViewListing: () => void;
}

function ClientView({
  initials,
  fullName,
  avatarUrl,
  avatarUploading,
  previewVisible,
  onAvatarPress,
  onPreviewClose,
  onEditProfile,
  onBankData,
  onDocuments,
  onPrivacy,
  onBookings,
  onSwitchRole,
  onSignOut,
  onViewListing,
}: ClientViewProps) {
  const services = [
    "Pulizia Standard",
    "Pulizia Profonda",
    "Stiratura",
    "Pulizia Vetri",
  ];

  return (
    <>
      {/* ── Photo preview modal ── */}
      {avatarUrl && previewVisible ? (
        <PhotoPreviewModal uri={avatarUrl} visible={previewVisible} onClose={onPreviewClose} />
      ) : null}

      <View style={styles.heroSection}>
        <Pressable style={styles.avatarWrapper} onPress={onAvatarPress}>
          <AvatarDisplay
            avatarUrl={avatarUrl}
            initials={initials}
            size={96}
            backgroundColor="#D4A574"
            initialsColor="#fff"
            borderRadius={999}
            uploading={avatarUploading}
          />
          <View style={[styles.verifiedBadge, { backgroundColor: C.cleanerAmber }]}>
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
        </Pressable>
        <Text style={styles.heroName}>{fullName}</Text>
        <Text style={[styles.heroRole, { color: C.cleanerPrimary }]}>
          CLIENTE PREMIUM
        </Text>
      </View>

      <View style={styles.toggleSection}>
        <View style={[styles.toggleCard, { backgroundColor: C.cleanerPrimary }]}>
          <View style={styles.toggleLeft}>
            <Text style={styles.toggleTitle}>Modalità Cliente</Text>
            <Text style={styles.toggleSub}>Cerca pulitori nella tua zona</Text>
          </View>
          <AnimatedToggle
            value={true}
            onValueChange={() => onSwitchRole()}
            activeColor="#D4A574"
            inactiveColor="#4fc4a3"
          />
        </View>
      </View>

      {/* ── Menu CLIENTE: no annunci, no guadagni — solo prenotazioni,
           pagamenti, documenti e legale ── */}
      <View style={clientStyles.menuSection}>
        <MenuRow
          icon="person-outline"
          label="Modifica Profilo"
          sublabel="Gestisci le tue informazioni personali"
          onPress={onEditProfile}
          iconBgColor={C.cleanerIconBg}
          iconColor={C.cleanerPrimary}
          cardStyle
        />
        <MenuRow
          icon="calendar-outline"
          label="Le mie prenotazioni"
          sublabel="Vedi lo stato delle tue richieste di pulizia"
          onPress={onBookings}
          iconBgColor={C.cleanerIconBg}
          iconColor={C.cleanerPrimary}
          cardStyle
        />
        <MenuRow
          icon="card-outline"
          label="Metodo di Pagamento"
          sublabel="Gestisci le tue carte di pagamento"
          onPress={onBankData}
          iconBgColor={C.cleanerIconBg}
          iconColor={C.cleanerPrimary}
          cardStyle
        />
        <MenuRow
          icon="document-text-outline"
          label="I miei documenti"
          sublabel="Fatture e ricevute di servizio"
          onPress={onDocuments}
          iconBgColor={C.cleanerIconBg}
          iconColor={C.cleanerPrimary}
          cardStyle
        />
        <MenuRow
          icon="shield-checkmark-outline"
          label="Privacy e Legale"
          sublabel="Termini, condizioni e gestione dati"
          onPress={onPrivacy}
          iconBgColor={C.cleanerIconBg}
          iconColor={C.cleanerPrimary}
          cardStyle
        />
      </View>

      {/* ── Esci dall'account — bottone in fondo ── */}
      <Pressable
        onPress={onSignOut}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginHorizontal: 16,
          marginTop: 24,
          marginBottom: 16,
          paddingVertical: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#E53E3E",
          backgroundColor: "transparent",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="log-out-outline" size={18} color="#E53E3E" />
        <Text style={{ fontSize: 15, fontWeight: "600", color: "#E53E3E" }}>
          Esci dall'account
        </Text>
      </Pressable>

    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, profile, signOut, setActiveRole, refreshProfile } = useAuth();
  const router = useRouter();
  const isCleaner = profile?.active_role === "cleaner";

  const [showLogoutAnim, setShowLogoutAnim] = useState(false);

  const { uploading: avatarUploading, previewVisible, setPreviewVisible, showOptions: handleAvatarPress } =
    useAvatarActions(user?.id, profile?.avatar_url, refreshProfile);

  const handleSwitchRole = useCallback(async () => {
    const newRole: UserProfile["active_role"] = isCleaner ? "client" : "cleaner";
    try {
      await setActiveRole(newRole);
    } catch {
      // silently handle
    }
  }, [isCleaner, setActiveRole]);

  const handleSignOut = useCallback(() => {
    Alert.alert("Esci dall'account", "Sei sicuro di voler uscire?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Esci",
        style: "destructive",
        onPress: () => {
          // Show the bye-bye animation, then sign out after it plays
          setShowLogoutAnim(true);
          setTimeout(async () => {
            await signOut();
            setShowLogoutAnim(false);
            router.replace("/(auth)/login");
          }, 2800);
        },
      },
    ]);
  }, [signOut, router]);

  const handleEditProfile = useCallback(() => {
    router.push("/profile/edit");
  }, [router]);

  const handlePayments = useCallback(() => {
    router.push("/payments");
  }, [router]);

  const handleDocuments = useCallback(() => {
    router.push("/documents");
  }, [router]);

  const handleLegal = useCallback(() => {
    router.push("/legal/terms");
  }, [router]);

  const handlePrivacy = useCallback(() => {
    router.push("/legal/privacy");
  }, [router]);

  const handleBankData = useCallback(() => {
    router.push("/payments");
  }, [router]);

  const handleViewListing = useCallback(() => {
    router.push("/cleaner/profile-view");
  }, [router]);

  const handleListing = useCallback(() => {
    router.push("/listings");
  }, [router]);

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
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── TopAppBar ── */}
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="leaf" size={22} color="#022420" />
              <Text style={styles.topBarBrand}>CleanHome</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.bellWrap,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => router.push("/(tabs)/notifications")}
          >
            <Ionicons 
              name="notifications-outline" 
              size={22} 
              color={isCleaner ? C.cleanerPrimary : C.primary} 
            />
          </Pressable>
        </View>

        <Animated.View
          key={isCleaner ? "cleaner" : "client"}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(150)}
          layout={Layout.duration(300)}
        >
          {isCleaner ? (
            <CleanerView
              initials={initials}
              fullName={profile?.full_name ?? "Utente"}
              avatarUrl={profile?.avatar_url}
              avatarUploading={avatarUploading}
              previewVisible={previewVisible}
              onAvatarPress={handleAvatarPress}
              onPreviewClose={() => setPreviewVisible(false)}
              onEditProfile={handleEditProfile}
              onListing={handleListing}
              onPayments={handlePayments}
              onDocuments={handleDocuments}
              onLegal={handleLegal}
              onPrivacy={handlePrivacy}
              onSwitchRole={handleSwitchRole}
              onSignOut={handleSignOut}
            />
          ) : (
            <ClientView
              initials={initials}
              fullName={profile?.full_name ?? "Utente"}
              avatarUrl={profile?.avatar_url}
              avatarUploading={avatarUploading}
              previewVisible={previewVisible}
              onAvatarPress={handleAvatarPress}
              onPreviewClose={() => setPreviewVisible(false)}
              onEditProfile={handleEditProfile}
              onBankData={handleBankData}
              onDocuments={handleDocuments}
              onPrivacy={handlePrivacy}
              onBookings={() => router.push("/(tabs)/bookings")}
              onSwitchRole={handleSwitchRole}
              onSignOut={handleSignOut}
              onViewListing={handleViewListing}
            />
          )}
        </Animated.View>

        <Text style={styles.versionText}>CleanHome v1.0.0</Text>
      </ScrollView>

      {/* ── Logout animation modal ── */}
      <Modal
        visible={showLogoutAnim}
        animationType="fade"
        transparent={false}
        statusBarTranslucent
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#022420",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LottieView
            source={require("../../assets/lottie/rocket.json")}
            autoPlay
            loop={false}
            speed={0.8}
            style={{ width: 280, height: 280 }}
          />
          <Animated.Text
            entering={FadeIn.delay(400).duration(600)}
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: "#ffffff",
              marginTop: 16,
              letterSpacing: -0.5,
            }}
          >
            A presto! 👋
          </Animated.Text>
          <Animated.Text
            entering={FadeIn.delay(800).duration(600)}
            style={{
              fontSize: 15,
              color: "rgba(255,255,255,0.6)",
              marginTop: 8,
            }}
          >
            Ci rivediamo su CleanHome
          </Animated.Text>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  scroll: {
    paddingBottom: 56,
  },

  // ── TopAppBar ─────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topBarCleanerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topBarName: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 22,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.4,
  },
  topBarAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surfaceLow,
    borderWidth: 1,
    borderColor: `${C.outlineVariant}26`,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarAvatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.primary,
  },
  topBarBrand: {
    fontSize: 20,
    fontWeight: "700",
    fontStyle: "italic",
    color: "#181c1c",
    letterSpacing: -0.3,
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

  // ── Profile hero ──────────────────────────────────────────────────────────────
  heroSection: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 8,
    paddingHorizontal: 24,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  // Square avatar: w-24 h-24 rounded-lg
  avatarSquare: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: C.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarInitials: {
    fontSize: 30,
    fontWeight: "800",
    color: "#abcec6",
    letterSpacing: 1,
  },
  // Verified badge: bottom-right -2 -2
  verifiedBadge: {
    position: "absolute",
    bottom: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.secondary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  // name: font-headline text-3xl bold
  heroName: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 28,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.4,
    marginBottom: 4,
    textAlign: "center",
  },
  // role: uppercase small tracking-wide
  heroRole: {
    fontSize: 12,
    fontWeight: "600",
    color: C.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },

  // ── Menu section ──────────────────────────────────────────────────────────────
  menuSection: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  menuCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
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
    marginLeft: 72,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  menuRowPressed: {
    backgroundColor: C.surfaceLow,
  },
  // Card-style variant: ogni row è una card bianca indipendente
  menuRowCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuRowCardPressed: {
    backgroundColor: C.surfaceLow,
    opacity: 0.92,
  },
  // w-12 h-12 rounded-md bg-surface-container-low
  menuRowIconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  menuRowBody: {
    flex: 1,
  },
  menuRowLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  menuRowSublabel: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    marginTop: 2,
  },

  // ── Toggle card ───────────────────────────────────────────────────────────────
  toggleSection: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  toggleCard: {
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 80,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  toggleLeft: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
  },
  toggleSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },

  // ── Sign out ──────────────────────────────────────────────────────────────────
  signOutButton: {
    alignItems: "center",
    paddingVertical: 18,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 14,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.error,
  },

  // ── Listing card (cleaner) ────────────────────────────────────────────────────
  listingCardContainer: {
    backgroundColor: C.surface,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  listingBanner: {
    width: "100%",
    height: 320,
    backgroundColor: C.surfaceLow,
  },
  listingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 320,
    padding: 24,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  listingOverlayText: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 34,
    fontWeight: "700",
    color: "#ffffff",
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  listingContent: {
    padding: 20,
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
    letterSpacing: -0.5,
  },
  viewListingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.cleanerLight,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  viewListingBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.cleanerPrimary,
  },
  servicesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  serviceTag: {
    backgroundColor: C.cleanerLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  serviceTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.cleanerPrimary,
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

// ─── Client profile styles (Stitch client_profile_dashboard) ─────────────────
// Separati per non toccare gli stili condivisi usati da ClientView.

const CLIENT_TOGGLE_BG = "#1A3C34";

const clientStyles = StyleSheet.create({
  // ── Hero ────────────────────────────────────────────────────────────────────
  heroSection: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 8,
    paddingHorizontal: 24,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  // 96x96, rounded-lg (12px), bg surface-container-low
  avatarSquare: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: C.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: "800",
    color: C.primary,
    letterSpacing: 1,
  },
  // verified badge: bottom-right, rounded-md
  verifiedBadge: {
    position: "absolute",
    bottom: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.secondary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  // name: 30px bold, primary dark green
  heroName: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 30,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: "center",
  },
  // role: uppercase, letter-spacing 2, 12px, on-surface-variant
  heroRole: {
    fontSize: 12,
    fontWeight: "600",
    color: C.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },

  // ── Toggle card ─────────────────────────────────────────────────────────────
  toggleSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  // bg: #1a3a35 (primary-container per client)
  toggleCard: {
    backgroundColor: CLIENT_TOGGLE_BG,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 80,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },

  // ── Menu section (rows indipendenti) ────────────────────────────────────────
  menuSection: {
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },

  // ── Sign out ────────────────────────────────────────────────────────────────
  signOutButton: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderTopWidth: 1,
    borderTopColor: `${C.outlineVariant}40`,
    backgroundColor: `${C.error}08`,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.error,
  },
});
