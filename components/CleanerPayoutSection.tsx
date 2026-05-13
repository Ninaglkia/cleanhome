import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";
import { useCleanerStripeStatus } from "../lib/hooks/useCleanerStripeStatus";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CleanerPayoutSectionProps {
  cleanerId: string | null | undefined;
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const TOKEN = {
  // State A: not-configured — amber/yellow
  unconfiguredBg: "#FEF3C7",
  unconfiguredBorder: "#F59E0B",
  unconfiguredIconBg: "#FEF9C3",
  unconfiguredIcon: "#D97706",
  unconfiguredTitle: "#92400E",
  unconfiguredBody: "#A16207",
  unconfiguredCta: "#D97706",
  unconfiguredCtaBg: "#FDE68A",

  // State B: pending — orange
  pendingBg: "#FFF7ED",
  pendingBorder: "#F97316",
  pendingIconBg: "#FFEDD5",
  pendingIcon: "#EA580C",
  pendingTitle: "#7C2D12",
  pendingBody: "#9A3412",
  pendingCta: "#EA580C",
  pendingCtaBg: "#FED7AA",

  // State C: active — green brand
  activeBg: "#ECFDF5",
  activeBorder: "#10B981",
  activeIconBg: "#D1FAE5",
  activeIcon: "#059669",
  activeTitle: "#065F46",
  activeBody: "#047857",
  activeLink: "#059669",
} as const;

// ─── Sub-components ──────────────────────────────────────────────────────────

interface StatusIconProps {
  name: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  bgColor: string;
  loading?: boolean;
}

function StatusIcon({ name, color, bgColor, loading = false }: StatusIconProps) {
  return (
    <View
      style={[styles.iconCircle, { backgroundColor: bgColor }]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={name} size={24} color={color} />
      )}
    </View>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CleanerPayoutSection({ cleanerId }: CleanerPayoutSectionProps) {
  const { status, isLoading, refetch } = useCleanerStripeStatus(cleanerId);
  const [invoking, setInvoking] = useState(false);

  const openOnboardingLink = useCallback(async () => {
    if (!cleanerId) return;
    setInvoking(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "stripe-connect-onboarding-link",
        { body: {} }
      );
      if (error) throw error;
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error("Nessun URL ricevuto");

      await WebBrowser.openAuthSessionAsync(
        url,
        "cleanhome://stripe-connect/return"
      );
      // Refresh status after the user returns from Stripe
      refetch();
    } catch (err) {
      Alert.alert(
        "Errore",
        err instanceof Error ? err.message : "Impossibile avviare la configurazione"
      );
    } finally {
      setInvoking(false);
    }
  }, [cleanerId, refetch]);

  const openUpdateLink = useCallback(async () => {
    if (!cleanerId) return;
    setInvoking(true);
    try {
      // Re-use the same onboarding link endpoint — for an active
      // account it returns an Express Dashboard login link; for one
      // still in KYC it returns an account_onboarding link.
      const { data, error } = await supabase.functions.invoke(
        "stripe-connect-onboarding-link",
        { body: {} }
      );

      if (error) {
        // The Edge Function returns the underlying Stripe error in
        // `detail` (added temporarily for debugging) when it returns
        // 500. Pull it out so the alert shows the real cause instead
        // of the generic message.
        type EdgeError = Error & {
          context?: { json?: () => Promise<unknown> };
        };
        let detail: string | undefined;
        const ctx = (error as EdgeError).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const payload = (await ctx.json()) as {
              error?: string;
              detail?: string;
            };
            detail = payload?.detail;
          } catch {
            // best-effort — fall back to the generic error.message
          }
        }
        throw new Error(detail ?? error.message ?? "Errore sconosciuto");
      }

      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error("Nessun URL ricevuto");

      await WebBrowser.openAuthSessionAsync(
        url,
        "cleanhome://stripe-connect/return"
      );
      refetch();
    } catch (err) {
      Alert.alert(
        "Errore",
        err instanceof Error ? err.message : "Impossibile aprire la dashboard"
      );
    } finally {
      setInvoking(false);
    }
  }, [cleanerId, refetch]);

  // Don't render while loading — avoids flicker between states
  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: "#f0f4f3", borderColor: "#c1c8c5" }]}>
        <View style={styles.cardInner}>
          <ActivityIndicator size="small" color="#006b55" style={{ marginVertical: 8 }} />
        </View>
      </View>
    );
  }

  // ── State A: not-configured ───────────────────────────────────────────────
  if (status === "not-configured") {
    return (
      <Pressable
        onPress={openOnboardingLink}
        disabled={invoking}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: TOKEN.unconfiguredBg,
            borderColor: TOKEN.unconfiguredBorder,
          },
          (pressed || invoking) && { opacity: pressed ? 0.85 : 0.6 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Configura i tuoi pagamenti"
      >
        <View style={styles.cardInner}>
          <StatusIcon
            name="wallet-outline"
            color={TOKEN.unconfiguredIcon}
            bgColor={TOKEN.unconfiguredIconBg}
            loading={invoking}
          />
          <View style={styles.textBlock}>
            <Text style={[styles.title, { color: TOKEN.unconfiguredTitle }]}>
              Configura i tuoi pagamenti
            </Text>
            <Text style={[styles.body, { color: TOKEN.unconfiguredBody }]}>
              Aggiungi un IBAN o carta prepagata per ricevere i soldi delle pulizie.
              È sicuro, gestito da Stripe.
            </Text>
            <View
              style={[
                styles.ctaChip,
                { backgroundColor: TOKEN.unconfiguredCtaBg },
              ]}
            >
              <Text style={[styles.ctaText, { color: TOKEN.unconfiguredCta }]}>
                Configura ora
              </Text>
              <Ionicons name="arrow-forward" size={14} color={TOKEN.unconfiguredCta} />
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  // ── State B: pending ──────────────────────────────────────────────────────
  if (status === "pending") {
    return (
      <Pressable
        onPress={openUpdateLink}
        disabled={invoking}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: TOKEN.pendingBg,
            borderColor: TOKEN.pendingBorder,
          },
          (pressed || invoking) && { opacity: pressed ? 0.85 : 0.6 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Continua la configurazione pagamenti"
      >
        <View style={styles.cardInner}>
          <StatusIcon
            name="time-outline"
            color={TOKEN.pendingIcon}
            bgColor={TOKEN.pendingIconBg}
            loading={invoking}
          />
          <View style={styles.textBlock}>
            <Text style={[styles.title, { color: TOKEN.pendingTitle }]}>
              Verifica in corso
            </Text>
            <Text style={[styles.body, { color: TOKEN.pendingBody }]}>
              Stripe sta verificando i tuoi dati. Riceverai una notifica quando
              sarà completato.
            </Text>
            <View
              style={[styles.ctaChip, { backgroundColor: TOKEN.pendingCtaBg }]}
            >
              <Text style={[styles.ctaText, { color: TOKEN.pendingCta }]}>
                Continua la configurazione
              </Text>
              <Ionicons name="arrow-forward" size={14} color={TOKEN.pendingCta} />
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  // ── State C: active ───────────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: TOKEN.activeBg,
          borderColor: TOKEN.activeBorder,
        },
      ]}
    >
      <View style={styles.cardInner}>
        <StatusIcon
          name="checkmark-circle"
          color={TOKEN.activeIcon}
          bgColor={TOKEN.activeIconBg}
        />
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: TOKEN.activeTitle }]}>
            Pagamenti attivi
          </Text>
          <Text style={[styles.body, { color: TOKEN.activeBody }]}>
            I tuoi guadagni vengono accreditati automaticamente sul conto
            collegato a Stripe.
          </Text>
          <Pressable
            onPress={openUpdateLink}
            disabled={invoking}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            accessibilityRole="link"
            accessibilityLabel="Gestisci pagamenti e dati bancari"
          >
            <Text style={[styles.linkText, { color: TOKEN.activeLink }]}>
              {invoking
                ? "Apertura in corso…"
                : "Gestisci pagamenti e dati bancari →"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Outer wrapper for Pressable — no flexDirection here. iOS collapses
  // Pressable's row layout under certain conditions when flexDirection
  // is set directly on the outer touchable; we move the row layout to
  // an inner View instead.
  card: {
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  // Inner row that carries flexDirection + padding for the actual layout.
  cardInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  textBlock: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
  },
  ctaChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: "600",
  },
  linkText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
});
