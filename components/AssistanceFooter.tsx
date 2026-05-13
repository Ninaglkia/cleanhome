import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, Shadows } from "../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssistanceFooterProps {
  onChatPress: () => void;
  onEmailPress: () => void;
  title?: string;
  subtitle?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssistanceFooter({
  onChatPress,
  onEmailPress,
  title = "Hai bisogno di aiuto?",
  subtitle = "Il nostro team è disponibile 7 giorni su 7",
}: AssistanceFooterProps) {
  return (
    <View style={styles.card}>
      {/* Icon chip */}
      <View style={styles.iconChip}>
        <Ionicons name="help-buoy-outline" size={24} color={Colors.secondary} />
      </View>

      {/* Title */}
      <Text style={styles.title}>{title}</Text>

      {/* Subtitle */}
      <Text style={styles.subtitle} numberOfLines={2}>
        {subtitle}
      </Text>

      {/* Buttons row */}
      <View style={styles.buttonsRow}>
        {/* Chat button — dark primary */}
        <Pressable
          onPress={onChatPress}
          accessibilityRole="button"
          accessibilityLabel="Apri la chat con il supporto"
          style={({ pressed }) => [
            styles.chatBtn,
            pressed && styles.btnPressed,
          ]}
        >
          {/* Inner View — prevents iOS Pressable+flexDirection collapse bug
              when the style prop is a function (see payments/index.tsx InfoRow) */}
          <View style={styles.btnInner}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={18}
              color={Colors.textOnDark}
            />
            <Text style={styles.chatBtnText}>Chat</Text>
          </View>
        </Pressable>

        {/* Email button — secondary outline */}
        <Pressable
          onPress={onEmailPress}
          accessibilityRole="button"
          accessibilityLabel="Contatta il supporto via email"
          style={({ pressed }) => [
            styles.emailBtn,
            pressed && styles.btnPressed,
          ]}
        >
          {/* Inner View — same iOS Pressable flex fix */}
          <View style={styles.btnInner}>
            <Ionicons
              name="mail-outline"
              size={18}
              color={Colors.secondary}
            />
            <Text style={styles.emailBtnText}>Email</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    ...Shadows.sm,
  },

  // Icon chip — 56×56, mint bg, borderRadius 16
  iconChip: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
    textAlign: "center",
    marginTop: 16,
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
  },

  // Buttons row — side-by-side 50/50
  buttonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    alignSelf: "stretch",
  },

  // Chat button — dark filled
  chatBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.text,
    overflow: "hidden",
  },

  // Email button — secondary outline
  emailBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
    overflow: "hidden",
  },

  // Inner View — enforces horizontal layout on iOS (Pressable flex fix)
  btnInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  chatBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textOnDark,
  },

  emailBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.secondary,
  },

  btnPressed: {
    opacity: 0.85,
  },
});
