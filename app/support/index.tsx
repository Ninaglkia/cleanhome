import { useState, useCallback } from "react";
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
    (_id: string) => {
      // Navigazione futura verso sottocategorie
    },
    []
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.textOnDark} />
          </Pressable>

          <Text style={styles.heroLabel}>CENTRO ASSISTENZA</Text>
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
              <Pressable
                style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
                onPress={handleStartAIChat}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.textOnDark} />
                <Text style={styles.btnPrimaryText}>Inizia Chat AI</Text>
              </Pressable>
              <Pressable
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
            <Text style={styles.sectionTitle}>Argomenti di Assistenza</Text>
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
              Il nostro team è pronto ad assisterti tramite email o chat dal vivo.
            </Text>
            <View style={styles.stillButtons}>
              <Pressable
                style={({ pressed }) => [styles.stillBtn, pressed && styles.btnPressed]}
                onPress={() => {}}
              >
                <Ionicons name="mail-outline" size={16} color={Colors.secondary} />
                <Text style={styles.stillBtnText}>Supporto Email</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.stillBtn, pressed && styles.btnPressed]}
                onPress={handleTalkToConcierge}
              >
                <Ionicons name="chatbubbles-outline" size={16} color={Colors.secondary} />
                <Text style={styles.stillBtnText}>Chat dal Vivo</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Footer links ── */}
          <View style={styles.footer}>
            <Pressable onPress={() => {}}>
              <Text style={styles.footerLink}>Termini di Servizio</Text>
            </Pressable>
            <View style={styles.footerDot} />
            <Pressable onPress={() => {}}>
              <Text style={styles.footerLink}>Privacy</Text>
            </Pressable>
            <View style={styles.footerDot} />
            <Pressable onPress={() => {}}>
              <Text style={styles.footerLink}>Cookie Policy</Text>
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
    fontSize: 18,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
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
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
  },
  stillTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textOnDark,
    marginBottom: Spacing.xs,
  },
  stillSubtitle: {
    fontSize: 13,
    color: Colors.textOnDarkTertiary,
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
    borderRadius: Radius.lg,
    paddingVertical: 12,
  },
  stillBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.secondary,
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
