import { useState, useCallback } from "react";
import { Linking } from "react-native";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Colors, Radius, Shadows, Spacing, SpringConfig } from "../../lib/theme";
import AssistanceFooter from "../../components/AssistanceFooter";

// ─── Types ────────────────────────────────────────────────────────────────────

type AccentTone = "neutral" | "info" | "warning" | "success";

interface TopicItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  tone: AccentTone;
}

// ─── Tone palette — same as payments for visual consistency ──────────────────

const TONE_STYLES: Record<AccentTone, { bg: string; fg: string }> = {
  neutral: { bg: Colors.accentLight, fg: Colors.secondary },
  info: { bg: "#eaf1ff", fg: Colors.info },
  warning: { bg: "#fdf1e3", fg: "#a85d12" },
  success: { bg: Colors.successLight, fg: Colors.success },
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const TOPICS: TopicItem[] = [
  {
    id: "booking",
    icon: "calendar-outline",
    label: "Prenotazioni & Programmazione",
    description: "Gestisci le tue prenotazioni",
    tone: "neutral",
  },
  {
    id: "payments",
    icon: "card-outline",
    label: "Pagamenti & Rimborsi",
    description: "Fatture, rimborsi e metodi di pagamento",
    tone: "info",
  },
  {
    id: "trust",
    icon: "shield-checkmark-outline",
    label: "Fiducia & Sicurezza",
    description: "Verifica identità, segnalazioni",
    tone: "success",
  },
  {
    id: "account",
    icon: "person-circle-outline",
    label: "Impostazioni Account",
    description: "Profilo, preferenze, notifiche",
    tone: "neutral",
  },
];

// ─── Section Header (mirror payments) ────────────────────────────────────────

function SectionHeader({
  kicker,
  title,
}: {
  kicker?: string;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAccent} />
      <View style={{ flex: 1 }}>
        {kicker ? <Text style={styles.sectionKicker}>{kicker}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    </View>
  );
}

// ─── Topic Row with spring press ─────────────────────────────────────────────

interface TopicRowProps {
  item: TopicItem;
  onPress: (id: string) => void;
}

function TopicRow({ item, onPress }: TopicRowProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const palette = TONE_STYLES[item.tone];

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.label}. ${item.description}`}
        onPress={() => onPress(item.id)}
        onPressIn={() => {
          scale.value = withSpring(0.98, SpringConfig.press);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, SpringConfig.press);
        }}
        android_ripple={{ color: "rgba(0,107,85,0.08)", borderless: false }}
      >
        {/* Inner View — iOS Pressable + flex layout safety */}
        <View style={styles.topicRow}>
          <View style={[styles.topicIconWrap, { backgroundColor: palette.bg }]}>
            <Ionicons name={item.icon} size={20} color={palette.fg} />
          </View>
          <View style={styles.topicContent}>
            <Text style={styles.topicLabel}>{item.label}</Text>
            <Text style={styles.topicDescription}>{item.description}</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={Colors.textTertiary}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SupportScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");

  const handleTopicPress = useCallback(
    (id: string) => {
      router.push(`/support/faq/${id}` as never);
    },
    [router]
  );

  const handleStartAIChat = useCallback(() => {
    router.push("/support/chat");
  }, [router]);

  const handleTalkToConcierge = useCallback(() => {
    router.push("/support/chat");
  }, [router]);

  const handleEmailSupport = useCallback(async () => {
    await Linking.openURL(
      "mailto:info@cleanhomeapp.com?subject=Richiesta%20supporto%20CleanHome"
    ).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* ── Dark green hero header ── */}
        <View style={styles.hero}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.backBtnPressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={Colors.textOnDark}
            />
          </Pressable>

          <Text style={styles.heroLabel}>Centro supporto</Text>
          <Text style={styles.heroTitle}>
            Come possiamo{"\n"}aiutarti oggi?
          </Text>

          {/* Search bar inside hero */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cerca nell'assistenza..."
              placeholderTextColor={Colors.textTertiary}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchText.length > 0 && (
              <Pressable
                onPress={() => setSearchText("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={17}
                  color={Colors.textTertiary}
                />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.body}>
          {/* ── AI / Concierge card ── */}
          <View style={styles.aiCard}>
            <View style={styles.aiCardHeader}>
              <View style={styles.aiAlwaysBadge}>
                <View style={styles.aiDot} />
                <Text style={styles.aiAlwaysText}>AI SEMPRE DISPONIBILE</Text>
              </View>
            </View>

            <Text style={styles.aiTitle}>Supporto Ibrido Intelligente</Text>
            <Text style={styles.aiDescription}>
              Combiniamo intelligenza artificiale avanzata con il tocco umano
              dei nostri concierge dedicati per offrirti il massimo del
              supporto, 24 ore su 24.
            </Text>

            <View style={styles.aiButtons}>
              <View style={styles.btnPrimary}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Inizia chat con assistente AI"
                  onPress={handleStartAIChat}
                  android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={16}
                  color={Colors.textOnDark}
                  pointerEvents="none"
                />
                <Text style={styles.btnPrimaryText} pointerEvents="none">
                  Inizia Chat AI
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Parla con il concierge"
                style={({ pressed }) => [
                  styles.btnOutline,
                  pressed && styles.btnPressed,
                ]}
                onPress={handleTalkToConcierge}
              >
                <Ionicons name="headset-outline" size={16} color={Colors.secondary} />
                <Text style={styles.btnOutlineText}>Parla col Concierge</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Topics section ── */}
          <View style={styles.section}>
            <SectionHeader
              kicker="Sfoglia per argomento"
              title="Domande frequenti"
            />
            <View style={styles.topicsCard}>
              {TOPICS.map((topic, index) => (
                <View key={topic.id}>
                  <TopicRow item={topic} onPress={handleTopicPress} />
                  {index < TOPICS.length - 1 && (
                    <View style={styles.divider} />
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* ── Still have questions ── */}
          <AssistanceFooter
            onChatPress={handleTalkToConcierge}
            onEmailPress={handleEmailSupport}
            title="Hai ancora bisogno di aiuto?"
            subtitle="Il nostro team è disponibile 7 giorni su 7"
          />

          {/* ── Footer links ── */}
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/legal/terms")}
            >
              <Text style={styles.footerLink}>Termini di Servizio</Text>
            </Pressable>
            <View style={styles.footerDot} />
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/legal/privacy")}
            >
              <Text style={styles.footerLink}>Privacy</Text>
            </Pressable>
          </View>

          <View style={{ height: Platform.OS === "ios" ? 16 : 8 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Hero ────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xxl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  backBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    color: Colors.textOnDarkSecondary,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.textOnDark,
    lineHeight: 36,
    letterSpacing: -0.6,
    marginBottom: Spacing.xl,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base,
    height: 48,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },

  // ── Body ────────────────────────────────────────────────────────────────
  body: {
    padding: Spacing.xl,
    gap: Spacing.xxl, // 32 — wider rhythm between major blocks
  },

  // ── AI card ─────────────────────────────────────────────────────────────
  aiCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.md,
  },
  aiCardHeader: {
    marginBottom: Spacing.md,
  },
  aiAlwaysBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  aiDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  aiAlwaysText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: Colors.secondary,
  },
  aiTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: -0.3,
    marginBottom: Spacing.sm,
  },
  aiDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: Spacing.lg,
  },
  aiButtons: {
    gap: Spacing.sm,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textOnDark,
  },
  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
  },
  btnOutlineText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.secondary,
  },
  btnPressed: {
    opacity: 0.82,
  },

  // ── Section ─────────────────────────────────────────────────────────────
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  sectionAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: Colors.accent,
  },
  sectionKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: Colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: -0.3,
  },

  // ── Topics card ─────────────────────────────────────────────────────────
  topicsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, // 16 — matches payments card radius
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    gap: Spacing.md,
    minHeight: 64,
  },
  topicIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  topicContent: {
    flex: 1,
    gap: 2,
  },
  topicLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    letterSpacing: -0.1,
  },
  topicDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: -0.05,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
    marginLeft: 60,
  },

  // ── Footer ──────────────────────────────────────────────────────────────
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
    flexWrap: "wrap",
  },
  footerLink: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: "500",
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.textTertiary,
  },
});
