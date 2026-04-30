import { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Colors, Radius, Shadows, Spacing } from "../../lib/theme";

// ─── Quick FAQ topics ─────────────────────────────────────────────────────────

const FAQ_SHORTCUTS = [
  { id: "booking", label: "Prenotazioni", icon: "calendar-outline" as const },
  { id: "payments", label: "Pagamenti", icon: "card-outline" as const },
  { id: "account", label: "Account", icon: "person-circle-outline" as const },
  { id: "trust", label: "Sicurezza", icon: "shield-checkmark-outline" as const },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SupportChatScreen() {
  const router = useRouter();

  const handleEmail = useCallback(() => {
    Linking.openURL(
      "mailto:support@cleanhome.app?subject=Richiesta%20supporto&body=Ciao%20team%20CleanHome%2C"
    ).catch(() => {});
  }, []);

  const handleFaq = useCallback(
    (topicId: string) => {
      router.push(`/support/faq/${topicId}` as never);
    },
    [router]
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerBackBtn}
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.textOnDark} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerName}>Centro Supporto</Text>
          <Text style={styles.headerSubtitle}>CLEANHOME</Text>
        </View>

        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Hero ── */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.heroBlock}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="headset-outline" size={36} color={Colors.secondary} />
          </View>
          <Text style={styles.heroTitle}>Come possiamo aiutarti?</Text>
          <Text style={styles.heroSub}>
            Il nostro team è disponibile dal lunedì al venerdì,{"\n"}
            ore 9:00–18:00. Ti risponderemo entro 24 ore.
          </Text>
        </Animated.View>

        {/* ── Contact card — Email ── */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={styles.contactCard}>
            <View style={styles.contactCardHeader}>
              <View style={styles.onlineDotRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineDotText}>SUPPORTO EMAIL</Text>
              </View>
            </View>

            <Text style={styles.contactTitle}>Scrivi al nostro team</Text>
            <Text style={styles.contactDescription}>
              Hai una domanda specifica o un problema con una prenotazione?
              Inviaci un'email e ti risponderemo con una soluzione personalizzata.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.emailBtn,
                pressed && { opacity: 0.88 },
              ]}
              onPress={handleEmail}
              accessibilityLabel="Invia email a support@cleanhome.app"
              accessibilityRole="button"
            >
              <Ionicons name="mail-outline" size={18} color="#fff" />
              <Text style={styles.emailBtnText}>
                Invia email a support@cleanhome.app
              </Text>
            </Pressable>

            <View style={styles.responseTimeRow}>
              <Ionicons name="time-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.responseTimeText}>
                Risposta tipica entro 4–8 ore lavorative
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── FAQ shortcuts ── */}
        <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.faqSection}>
          <Text style={styles.faqSectionTitle}>Sfoglia le FAQ</Text>
          <Text style={styles.faqSectionSub}>
            Trova subito la risposta alle domande più comuni.
          </Text>

          <View style={styles.faqGrid}>
            {FAQ_SHORTCUTS.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.faqChip,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => handleFaq(item.id)}
                accessibilityLabel={`FAQ: ${item.label}`}
                accessibilityRole="button"
              >
                <View style={styles.faqChipIcon}>
                  <Ionicons name={item.icon} size={20} color={Colors.secondary} />
                </View>
                <Text style={styles.faqChipText}>{item.label}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={Colors.textTertiary}
                />
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* ── Response hours ── */}
        <Animated.View entering={FadeInDown.delay(240).springify()}>
          <View style={styles.hoursCard}>
            <View style={styles.hoursHeader}>
              <Ionicons name="business-outline" size={18} color={Colors.secondary} />
              <Text style={styles.hoursTitle}>Orari del supporto</Text>
            </View>
            {[
              { day: "Lunedì–Venerdì", hours: "09:00 – 18:00" },
              { day: "Sabato", hours: "10:00 – 14:00" },
              { day: "Domenica", hours: "Chiuso" },
            ].map((row) => (
              <View key={row.day} style={styles.hoursRow}>
                <Text style={styles.hoursDay}>{row.day}</Text>
                <Text
                  style={[
                    styles.hoursTime,
                    row.hours === "Chiuso" && styles.hoursTimeClosed,
                  ]}
                >
                  {row.hours}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── Back to support ── */}
        <Pressable
          style={({ pressed }) => [
            styles.backToSupportBtn,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => router.back()}
          accessibilityLabel="Torna al centro supporto"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back-outline" size={16} color={Colors.secondary} />
          <Text style={styles.backToSupportText}>Torna al centro supporto</Text>
        </Pressable>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  headerName: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textOnDark,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: Colors.textOnDarkSecondary,
  },
  scrollContent: {
    padding: Spacing.xl,
    gap: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },

  // Hero
  heroBlock: {
    alignItems: "center",
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
  heroIconWrap: {
    width: 80,
    height: 80,
    borderRadius: Radius.xl,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  heroSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },

  // Contact card
  contactCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.md,
  },
  contactCardHeader: {
    marginBottom: 4,
  },
  onlineDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  onlineDotText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: Colors.secondary,
  },
  contactTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  contactDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 15,
  },
  emailBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  responseTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  responseTimeText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },

  // FAQ section
  faqSection: {
    gap: Spacing.md,
  },
  faqSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.2,
  },
  faqSectionSub: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  faqGrid: {
    gap: Spacing.sm,
  },
  faqChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  faqChipIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  faqChipText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },

  // Hours card
  hoursCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  hoursHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  hoursTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hoursDay: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  hoursTime: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  hoursTimeClosed: {
    color: Colors.textTertiary,
    fontWeight: "500",
  },

  // Back link
  backToSupportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.base,
  },
  backToSupportText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.secondary,
  },
});
