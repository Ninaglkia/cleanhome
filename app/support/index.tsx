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
import { Colors, Radius, Shadows, Spacing } from "../../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const TOPICS: TopicItem[] = [
  {
    id: "booking",
    icon: "calendar-outline",
    label: "Prenotazioni & Programmazione",
    description: "Gestisci le tue prenotazioni",
  },
  {
    id: "payments",
    icon: "card-outline",
    label: "Pagamenti & Rimborsi",
    description: "Fatture, rimborsi e metodi di pagamento",
  },
  {
    id: "trust",
    icon: "shield-checkmark-outline",
    label: "Fiducia & Sicurezza",
    description: "Verifica identità, segnalazioni",
  },
  {
    id: "account",
    icon: "person-circle-outline",
    label: "Impostazioni Account",
    description: "Profilo, preferenze, notifiche",
  },
];

// ─── Topic Row ────────────────────────────────────────────────────────────────

interface TopicRowProps {
  item: TopicItem;
  onPress: (id: string) => void;
}

function TopicRow({ item, onPress }: TopicRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.label}. ${item.description}`}
      style={({ pressed }) => [styles.topicRow, pressed && styles.topicRowPressed]}
      onPress={() => onPress(item.id)}
    >
      <View style={styles.topicIconWrap}>
        <Ionicons name={item.icon} size={22} color={Colors.secondary} />
      </View>
      <View style={styles.topicContent}>
        <Text style={styles.topicLabel}>{item.label}</Text>
        <Text style={styles.topicDescription}>{item.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </Pressable>
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

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* ── Dark green hero header ── */}
        <View style={styles.hero}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.textOnDark} />
          </Pressable>

          <Text style={styles.heroLabel}>Centro supporto</Text>
          <Text style={styles.heroTitle}>Come possiamo{"\n"}aiutarti oggi?</Text>

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
              <Pressable onPress={() => setSearchText("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color={Colors.textTertiary} />
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
              Combiniamo intelligenza artificiale avanzata con il tocco umano dei nostri
              concierge dedicati per offrirti il massimo del supporto, 24 ore su 24.
            </Text>

            <View style={styles.aiButtons}>
              <View style={styles.btnPrimary}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Inizia chat con assistente AI"
                  onPress={handleStartAIChat}
                  android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                  style={({ pressed }) => ({
                    width: "100%",
                    height: "100%",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 14,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.textOnDark} />
                  <Text style={styles.btnPrimaryText}>Inizia Chat AI</Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Parla con il concierge"
                style={({ pressed }) => [styles.btnOutline, pressed && styles.btnPressed]}
                onPress={handleTalkToConcierge}
              >
                <Ionicons name="headset-outline" size={16} color={Colors.secondary} />
                <Text style={styles.btnOutlineText}>Parla col Concierge</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Topics section ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SFOGLIA PER ARGOMENTO</Text>
            <Text style={styles.sectionTitle}>Domande frequenti</Text>
            <View style={styles.topicsCard}>
              {TOPICS.map((topic, index) => (
                <View key={topic.id}>
                  <TopicRow item={topic} onPress={handleTopicPress} />
                  {index < TOPICS.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>

          {/* ── Still have questions ── */}
          <View style={styles.stillCard}>
            <Text style={styles.stillTitle}>Hai ancora domande?</Text>
            <Text style={styles.stillSubtitle}>
              L'assistente AI risponde 24/7 e può trasferirti a un operatore umano per casi complessi.
            </Text>
            <View style={styles.stillBtnFull}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Apri chat assistente"
                onPress={handleTalkToConcierge}
                android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                style={({ pressed }) => ({
                  width: "100%",
                  height: "100%",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.stillBtnFullText}>Parla con l'assistente</Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* ── Footer links ── */}
          <View style={styles.footer}>
            <Pressable accessibilityRole="link" onPress={() => router.push("/legal/terms")}>
              <Text style={styles.footerLink}>Termini di Servizio</Text>
            </Pressable>
            <View style={styles.footerDot} />
            <Pressable accessibilityRole="link" onPress={() => router.push("/legal/privacy")}>
              <Text style={styles.footerLink}>Privacy</Text>
            </Pressable>
          </View>
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

  // Hero
  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xxl,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: Colors.textOnDarkSecondary,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.textOnDark,
    lineHeight: 36,
    letterSpacing: -0.5,
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

  // Body
  body: {
    padding: Spacing.xl,
    gap: Spacing.xl,
  },

  // AI card
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
    borderRadius: Radius.lg,
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

  // Section
  section: {
    gap: Spacing.md,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: Colors.textTertiary,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.2,
  },
  topicsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: "hidden",
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    gap: Spacing.md,
  },
  topicRowPressed: {
    backgroundColor: Colors.backgroundAlt,
  },
  topicIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
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
  },
  topicDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 72,
  },

  // Still have questions
  stillCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  stillTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  stillSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: Spacing.lg,
  },
  stillButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  stillBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  stillBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  stillBtnFull: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  stillBtnFullText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },

  // Footer
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
