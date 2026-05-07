import { useState, useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import CoachMarkOverlay, {
  CoachMarkStep,
} from "../../components/CoachMarks/CoachMarkOverlay";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../../lib/supabase";
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedToggle } from "../../components/AnimatedToggle";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { UserProfile } from "../../lib/types";
import { uploadAvatar, removeAvatar, deleteOwnAccount } from "../../lib/api";
import { measureInWindow } from "../../lib/measureInWindow";
import { NotificationBell } from "../../components/NotificationBell";
import { CleanerPayoutSection } from "../../components/CleanerPayoutSection";

const { width: SCREEN_W, height: SH } = Dimensions.get("window");

// ─── Avatar logic ─────────────────────────────────────────────────────────────

function useAvatarActions(
  userId: string | undefined,
  avatarUrl: string | undefined | null,
  refreshProfile: () => Promise<UserProfile | null>
) {
  const [uploading, setUploading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  const requestPermission = async (type: "camera" | "gallery"): Promise<boolean> => {
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

  const handlePickResult = async (result: ImagePicker.ImagePickerResult) => {
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      await handlePickResult(result);
    } catch (err) {
      console.warn("[camera] launchCameraAsync error", err);
      Alert.alert("Fotocamera non disponibile", err instanceof Error ? err.message : "Prova a scegliere dalla libreria.");
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
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}. ${sublabel}` : label}
      accessibilityHint={danger ? "Azione irreversibile" : undefined}
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
  cleanerId: string | null | undefined;
  initials: string;
  fullName: string;
  avatarUrl?: string | null;
  avatarUploading?: boolean;
  previewVisible?: boolean;
  onAvatarPress: () => void;
  onPreviewClose: () => void;
  onEditProfile: () => void;
  onListing: () => void;
  onDocuments: () => void;
  onBankData: () => void;
  onLegal: () => void;
  onPrivacy: () => void;
  onSwitchRole: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  // Coach mark refs — measureInWindow gives screen-absolute coords for the Modal overlay
  avatarSectionRef?: React.RefObject<View | null>;
  editProfileRef?: React.RefObject<View | null>;
  listingRef?: React.RefObject<View | null>;
  documentsRef?: React.RefObject<View | null>;
  payoutSectionRef?: React.RefObject<View | null>;
  highlightStripe?: boolean;
}

function CleanerView({
  cleanerId,
  initials,
  fullName,
  avatarUrl,
  avatarUploading,
  previewVisible,
  onAvatarPress,
  onPreviewClose,
  onEditProfile,
  onListing,
  onDocuments,
  onBankData,
  onLegal,
  onPrivacy,
  onSwitchRole,
  onSignOut,
  onDeleteAccount,
  avatarSectionRef,
  editProfileRef,
  listingRef,
  documentsRef,
  payoutSectionRef,
  highlightStripe,
}: CleanerViewProps) {
  const stripeHighlightOpacity = useSharedValue(0);

  useEffect(() => {
    if (highlightStripe) {
      stripeHighlightOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0, { duration: 300 })
        ),
        6,
        false
      );
    }
  }, [highlightStripe, stripeHighlightOpacity]);

  const stripeHighlightStyle = useAnimatedStyle(() => ({
    borderWidth: 2,
    borderColor: `rgba(79, 196, 163, ${stripeHighlightOpacity.value})`,
    borderRadius: 12,
  }));
  return (
    <>
      {/* ── Photo preview modal ── */}
      {avatarUrl && previewVisible ? (
        <PhotoPreviewModal uri={avatarUrl} visible={previewVisible} onClose={onPreviewClose} />
      ) : null}

      {/* ── Hero ── */}
      <View
        ref={avatarSectionRef}
        style={clientStyles.heroSection}
      >
        <Pressable
          style={clientStyles.avatarWrapper}
          onPress={onAvatarPress}
          disabled={avatarUploading}
          accessibilityLabel="Cambia foto profilo"
          accessibilityRole="button"
        >
          <AvatarDisplay
            avatarUrl={avatarUrl}
            initials={initials}
            size={88}
            backgroundColor="#006b55"
            initialsColor="#ffffff"
            borderRadius={999}
            uploading={avatarUploading}
          />
          <View style={clientStyles.editBadge}>
            <Ionicons name="camera-outline" size={12} color="#022420" />
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

      {/* ── Sezione pagamenti / Stripe Connect ── */}
      <View ref={payoutSectionRef} style={payoutStyles.section}>
        <Animated.View style={highlightStripe ? stripeHighlightStyle : undefined}>
          <CleanerPayoutSection cleanerId={cleanerId} />
        </Animated.View>
      </View>

      {/* ── Menu rows (card indipendenti) — monocolore verde ── */}
      <View style={clientStyles.menuSection}>
        <View ref={editProfileRef}>
          <MenuRow
            icon="person-outline"
            label="Modifica Profilo"
            sublabel="Gestisci le tue informazioni personali"
            onPress={onEditProfile}
            iconBgColor={C.surfaceLow}
            cardStyle
          />
        </View>
        <View ref={listingRef}>
          <MenuRow
            icon="megaphone-outline"
            label="I miei annunci"
            sublabel="Gestisci i tuoi annunci e zone di copertura"
            onPress={onListing}
            iconBgColor={C.surfaceLow}
            cardStyle
          />
        </View>
        <MenuRow
          icon="card-outline"
          label="Dati bancari"
          sublabel="Conto collegato a Stripe"
          onPress={onBankData}
          iconBgColor={C.surfaceLow}
          cardStyle
        />
        <View ref={documentsRef}>
          <MenuRow
            icon="document-text-outline"
            label="I miei documenti"
            sublabel="Fatture e contratti di servizio"
            onPress={onDocuments}
            iconBgColor={C.surfaceLow}
            cardStyle
          />
        </View>
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

      {/* ── Zona Account ── */}
      <View style={dangerStyles.section}>
        <Text style={dangerStyles.sectionLabel}>ACCOUNT</Text>

        <MenuRow
          icon="log-out-outline"
          label="Esci dall'account"
          sublabel="Termina la sessione su questo dispositivo"
          onPress={onSignOut}
          danger
          cardStyle
        />

        <MenuRow
          icon="trash-outline"
          label="Elimina account"
          sublabel="Cancellazione definitiva e irreversibile dei tuoi dati"
          onPress={onDeleteAccount}
          danger
          cardStyle
        />
      </View>

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
  onProperties: () => void;
  onSwitchRole: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  onViewListing: () => void;
  // Coach mark refs — measureInWindow gives screen-absolute coords for the Modal overlay
  avatarSectionRef?: React.RefObject<View | null>;
  editProfileRef?: React.RefObject<View | null>;
  propertiesRef?: React.RefObject<View | null>;
  paymentRef?: React.RefObject<View | null>;
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
  onProperties,
  onPrivacy,
  onBookings,
  onSwitchRole,
  onSignOut,
  onDeleteAccount,
  onViewListing,
  avatarSectionRef,
  editProfileRef,
  propertiesRef,
  paymentRef,
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

      <View
        ref={avatarSectionRef}
        style={styles.heroSection}
      >
        <Pressable
          style={styles.avatarWrapper}
          onPress={onAvatarPress}
          disabled={avatarUploading}
          accessibilityLabel="Cambia foto profilo"
          accessibilityRole="button"
        >
          <AvatarDisplay
            avatarUrl={avatarUrl}
            initials={initials}
            size={88}
            backgroundColor="#6f4627"
            initialsColor="#ffffff"
            borderRadius={999}
            uploading={avatarUploading}
          />
          <View style={styles.editBadge}>
            <Ionicons name="camera-outline" size={12} color="#6f4627" />
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
        <View ref={editProfileRef}>
          <MenuRow
            icon="person-outline"
            label="Modifica Profilo"
            sublabel="Gestisci le tue informazioni personali"
            onPress={onEditProfile}
            iconBgColor={C.cleanerIconBg}
            iconColor={C.cleanerPrimary}
            cardStyle
          />
        </View>
        <MenuRow
          icon="calendar-outline"
          label="Le mie prenotazioni"
          sublabel="Vedi lo stato delle tue richieste di pulizia"
          onPress={onBookings}
          iconBgColor={C.cleanerIconBg}
          iconColor={C.cleanerPrimary}
          cardStyle
        />
        <View ref={propertiesRef}>
          <MenuRow
            icon="home-outline"
            label="Le mie case"
            sublabel="Salva gli indirizzi che usi più spesso"
            onPress={onProperties}
            iconBgColor={C.cleanerIconBg}
            iconColor={C.cleanerPrimary}
            cardStyle
          />
        </View>
        <View ref={paymentRef}>
          <MenuRow
            icon="card-outline"
            label="Metodo di Pagamento"
            sublabel="Gestisci le tue carte di pagamento"
            onPress={onBankData}
            iconBgColor={C.cleanerIconBg}
            iconColor={C.cleanerPrimary}
            cardStyle
          />
        </View>
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

      {/* ── Zona Account ── */}
      <View style={dangerStyles.section}>
        <Text style={dangerStyles.sectionLabel}>ACCOUNT</Text>

        <MenuRow
          icon="log-out-outline"
          label="Esci dall'account"
          sublabel="Termina la sessione su questo dispositivo"
          onPress={onSignOut}
          danger
          cardStyle
        />

        <MenuRow
          icon="trash-outline"
          label="Elimina account"
          sublabel="Cancellazione definitiva e irreversibile dei tuoi dati"
          onPress={onDeleteAccount}
          danger
          cardStyle
        />
      </View>

    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, profile, signOut, setActiveRole, refreshProfile } = useAuth();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const isCleaner = profile?.active_role === "cleaner";

  const scrollViewRef = useRef<ScrollView>(null);

  const [showLogoutAnim, setShowLogoutAnim] = useState(false);
  // Track the logout setTimeout so it can be cleared on unmount and
  // avoid setState-after-unmount + stuck animation if user navigates away.
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prevent double-tap while Stripe Connect link is loading
  const [invokingBank, setInvokingBank] = useState(false);

  // ── Stripe focus highlight ─────────────────────────────────────────────────
  const [highlightStripe, setHighlightStripe] = useState(false);
  const payoutSectionRef = useRef<View>(null);

  useEffect(() => {
    if (focus === "stripe" && isCleaner) {
      const timer = setTimeout(() => {
        payoutSectionRef.current?.measureInWindow((_x, y) => {
          scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
          setHighlightStripe(true);
          setTimeout(() => setHighlightStripe(false), 3600);
        });
      }, 400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [focus, isCleaner]);

  // ── Profile coach marks ────────────────────────────────────────────────────
  const [showProfileCoach, setShowProfileCoach] = useState(false);
  const [profileCoachSteps, setProfileCoachSteps] = useState<CoachMarkStep[]>([]);

  // Refs passed directly to sub-components. measureInWindow gives screen-absolute
  // coordinates that work correctly in the Modal-based CoachMarkOverlay.
  const avatarSectionRef = useRef<View>(null);
  const editProfileRef = useRef<View>(null);
  const paymentRef = useRef<View>(null);
  const propertiesRef = useRef<View>(null);
  const listingRef = useRef<View>(null);
  const documentsRef = useRef<View>(null);

  // Coach marks DISABLED while we rework them. Re-enable when ready.
  useEffect(() => {
    setShowProfileCoach(false);
  }, []);

  // Gate logic disabled — kept here for when we re-enable
  useEffect(() => {
    AsyncStorage.getItem("cleanhome.first_profile_tour_done")
      .then(() => {
        // setShowProfileCoach(false); // disabled
      })
      .catch(() => {});
  }, []);

  // Build profile coach steps by measuring real screen positions.
  //
  // For elements that live inside a ScrollView (menu rows), we scroll to
  // ensure they are visible before measuring — otherwise they may be
  // off-screen and measureInWindow returns y outside the viewport.
  // Strategy: scroll to top first so the hero/avatar is in view, then for
  // lower rows scroll incrementally and re-measure after a short settle.
  useEffect(() => {
    if (!showProfileCoach) return;
    const timer = setTimeout(async () => {
      // Step 1 — scroll to top so the avatar hero is fully visible
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });

      // Step 2 — allow one frame for scroll to settle, then measure
      await new Promise<void>((r) => setTimeout(r, 80));

      const avatarRect = await measureInWindow(avatarSectionRef);
      const editRect = await measureInWindow(editProfileRef);

      // For lower rows we may need to scroll them into view.
      // measureInWindow on a ref that is outside the visible viewport
      // returns a y larger than SH, making the spotlight invisible.
      // We scroll to bring the element near the center, wait, then remeasure.
      const scrollAndMeasure = async (ref: React.RefObject<View | null>) => {
        const preliminary = await measureInWindow(ref);
        if (!preliminary) return null;
        if (preliminary.y > SH * 0.75 || preliminary.y < 0) {
          // Element is below (or above) the visible area — scroll to expose it
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, preliminary.y - SH / 3),
            animated: true,
          });
          await new Promise<void>((r) => setTimeout(r, 260));
          return measureInWindow(ref); // re-measure after scroll settles
        }
        return preliminary;
      };

      const steps: CoachMarkStep[] = [];

      if (isCleaner) {
        if (avatarRect) {
          steps.push({
            rect: avatarRect,
            title: "Carica la tua foto",
            description:
              "Un profilo con foto riceve il 3x più richieste. Tocca l'avatar per aggiungerne una.",
          });
        }
        if (editRect) {
          steps.push({
            rect: editRect,
            title: "Completa info personali",
            description:
              "Aggiungi una bio, la tua specializzazione e i tuoi contatti per presentarti ai clienti.",
          });
        }
        const listingMeasured = await scrollAndMeasure(listingRef);
        if (listingMeasured) {
          steps.push({
            rect: listingMeasured,
            title: "Aggiungi servizi e tariffe",
            description:
              "Crea il tuo annuncio con i servizi offerti, la tariffa oraria e la zona di copertura.",
          });
        }
        const docsMeasured = await scrollAndMeasure(documentsRef);
        if (docsMeasured) {
          steps.push({
            rect: docsMeasured,
            title: "Verifica la tua identità",
            description:
              "Carica un documento d'identità per ricevere il badge Verificato e accedere a più richieste.",
          });
        }
      } else {
        if (avatarRect) {
          steps.push({
            rect: avatarRect,
            title: "Personalizza il tuo profilo",
            description:
              "Aggiungi una foto profilo per essere riconoscibile dai professionisti.",
          });
        }
        if (editRect) {
          steps.push({
            rect: editRect,
            title: "Completa le info personali",
            description:
              "Inserisci nome, numero di telefono e preferenze per un'esperienza su misura.",
          });
        }
        const propsMeasured = await scrollAndMeasure(propertiesRef);
        if (propsMeasured) {
          steps.push({
            rect: propsMeasured,
            title: "Aggiungi indirizzo casa",
            description:
              "Salva l'indirizzo della tua casa per trovare subito i professionisti vicini a te.",
          });
        }
        const payMeasured = await scrollAndMeasure(paymentRef);
        if (payMeasured) {
          steps.push({
            rect: payMeasured,
            title: "Aggiungi metodo di pagamento",
            description:
              "Collega una carta per prenotare in un tap. Sicuro e protetto da Stripe.",
          });
        }
      }

      // After all measurements, scroll back to top so the first spotlight is visible
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });

      if (steps.length >= 1) {
        setProfileCoachSteps(steps);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [showProfileCoach, isCleaner]);

  const handleProfileCoachDone = useCallback(() => {
    setShowProfileCoach(false);
  }, []);

  useEffect(() => {
    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, []);

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
          setShowLogoutAnim(true);
          logoutTimerRef.current = setTimeout(async () => {
            logoutTimerRef.current = null;
            // Mark the marketing onboarding as seen so logout sends the
            // user straight to login instead of the welcome tour again.
            try {
              await AsyncStorage.setItem("cleanhome.onboarding_seen", "true");
            } catch {
              // non-fatal
            }
            await signOut();
            setShowLogoutAnim(false);
            router.replace("/(auth)/login");
          }, 1800);
        },
      },
    ]);
  }, [signOut, router]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Eliminare il tuo account?",
      "Questa azione è IRREVERSIBILE. Verranno cancellati definitivamente:\n\n• Il tuo profilo\n• Le tue prenotazioni passate e future\n• I tuoi annunci (se sei un professionista)\n• Le tue conversazioni e recensioni\n\nNon potrai recuperare i dati. Sei sicuro?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina definitivamente",
          style: "destructive",
          onPress: () => {
            // Second confirmation for irreversible action
            Alert.alert(
              "Conferma finale",
              "Tocca 'Sì, elimina' per procedere. Non potrai più accedere a questo account.",
              [
                { text: "Annulla", style: "cancel" },
                {
                  text: "Sì, elimina",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteOwnAccount();
                      await signOut();
                      router.replace("/(auth)/login");
                    } catch (err: unknown) {
                      const msg =
                        err instanceof Error
                          ? err.message
                          : "Impossibile eliminare l'account";
                      Alert.alert("Errore", msg);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
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

  // Used by ClientView "Metodo di Pagamento" row
  const handleBankData = useCallback(() => {
    router.push("/payments");
  }, [router]);

  const handleCleanerBankData = useCallback(async () => {
    if (invokingBank) return;
    setInvokingBank(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "stripe-connect-onboarding-link",
        { body: {} }
      );
      if (error) throw error;
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error("Nessun URL ricevuto");
      await WebBrowser.openAuthSessionAsync(url, "cleanhome://stripe-connect/return");
    } catch (err) {
      Alert.alert(
        "Errore",
        err instanceof Error ? err.message : "Impossibile aprire la dashboard Stripe"
      );
    } finally {
      setInvokingBank(false);
    }
  }, [invokingBank]);

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
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── TopAppBar ── */}
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Image
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                source={require("../../assets/icon.png")}
                style={{ width: 28, height: 28, borderRadius: 6 }}
              />
              <Text style={styles.topBarBrand}>CleanHome</Text>
            </View>
          </View>
          <NotificationBell
            color={isCleaner ? C.cleanerPrimary : C.primary}
          />
        </View>

        <Animated.View
          key={isCleaner ? "cleaner" : "client"}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(150)}
          layout={Layout.duration(300)}
        >
          {isCleaner ? (
            <CleanerView
              cleanerId={user?.id}
              initials={initials}
              fullName={profile?.full_name ?? "Utente"}
              avatarUrl={profile?.avatar_url}
              avatarUploading={avatarUploading}
              previewVisible={previewVisible}
              onAvatarPress={handleAvatarPress}
              onPreviewClose={() => setPreviewVisible(false)}
              onEditProfile={handleEditProfile}
              onListing={handleListing}
              onDocuments={handleDocuments}
              onBankData={handleCleanerBankData}
              onLegal={handleLegal}
              onPrivacy={handlePrivacy}
              onSwitchRole={handleSwitchRole}
              onSignOut={handleSignOut}
              onDeleteAccount={handleDeleteAccount}
              avatarSectionRef={avatarSectionRef}
              editProfileRef={editProfileRef}
              listingRef={listingRef}
              documentsRef={documentsRef}
              payoutSectionRef={payoutSectionRef}
              highlightStripe={highlightStripe}
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
              onProperties={() => router.push("/properties")}
              onSwitchRole={handleSwitchRole}
              onSignOut={handleSignOut}
              onDeleteAccount={handleDeleteAccount}
              onViewListing={handleViewListing}
              avatarSectionRef={avatarSectionRef}
              editProfileRef={editProfileRef}
              propertiesRef={propertiesRef}
              paymentRef={paymentRef}
            />
          )}
        </Animated.View>

        <Text style={styles.versionText}>CleanHome v1.0.0</Text>
      </ScrollView>

      {/* ── Profile coach mark tour (first visit only) ── */}
      {showProfileCoach && profileCoachSteps.length >= 1 && (
        <CoachMarkOverlay
          steps={profileCoachSteps}
          storageKey="cleanhome.first_profile_tour_done"
          onDone={handleProfileCoachDone}
        />
      )}

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
            source={require("../../assets/lottie/cleaning.json")}
            autoPlay
            loop
            speed={1}
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
    paddingTop: 19,
    paddingBottom: 6,
    paddingHorizontal: 24,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  // Square avatar: w-22 h-22 rounded-lg
  avatarSquare: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: "#6f4627",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarInitials: {
    fontSize: 29,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 1,
  },
  // Edit badge: bottom-right, white circle with camera icon
  editBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  // name: font-headline text-2xl bold
  heroName: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 23,
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
    paddingTop: 22,
    paddingBottom: 6,
    paddingHorizontal: 24,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  // 88x88, rounded-lg (12px), bg surface-container-low
  avatarSquare: {
    width: 88,
    height: 88,
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
    fontSize: 29,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 1,
  },
  // edit badge: bottom-right, white circle with camera icon
  editBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  // name: 25px bold, primary dark green
  heroName: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 25,
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

// ─── Payout section container ─────────────────────────────────────────────────
const payoutStyles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
});

// ─── Danger zone styles (logout + delete account) ───────────────────────────
const dangerStyles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginTop: 28,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.outline,
    letterSpacing: 1.4,
    marginLeft: 4,
    marginBottom: 4,
  },
});
