import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";

import { useAuth } from "../../lib/auth";
import {
  fetchMyListings,
  createListing,
  deleteListing,
} from "../../lib/api";
import { NotificationBell } from "../../components/NotificationBell";
import { supabase } from "../../lib/supabase";
import type { CleanerListing } from "../../lib/types";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary: "#022420",
  secondary: "#006b55",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  background: "#f6faf9",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  danger: "#b3261e",
  warning: "#b45309",
  success: "#006b55",
};

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80";

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function MyListingsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [listings, setListings] = useState<CleanerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  // Stripe Connect onboarding state
  const [stripeVerified, setStripeVerified] = useState(true); // assume true until loaded
  const [verifying, setVerifying] = useState(false);

  // Re-check Stripe Connect onboarding status. Called on mount and again
  // every time the screen is focused (e.g. when the user comes back from
  // Stripe's hosted KYC flow in an external browser).
  // First syncs status from Stripe API (fallback for missed webhooks),
  // then reads the canonical state from the DB.
  const refreshStripeStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Best-effort sync from Stripe to DB. Ignore errors (e.g. no account yet).
      await supabase.functions.invoke("stripe-connect-sync-status", { body: {} }).catch(() => {});

      const { data } = await supabase
        .from("cleaner_profiles")
        .select("stripe_onboarding_complete, stripe_charges_enabled")
        .eq("id", user.id)
        .maybeSingle();
      setStripeVerified(
        !!data?.stripe_onboarding_complete && !!data?.stripe_charges_enabled
      );
    } catch {
      setStripeVerified(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshStripeStatus();
  }, [refreshStripeStatus]);

  // Open Stripe Connect onboarding in browser
  const handleStartVerification = useCallback(async () => {
    if (!user?.id) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "stripe-connect-onboarding-link",
        { body: {} }
      );
      if (error) throw error;
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error("Nessun URL ricevuto");

      // Open Stripe KYC in an in-app browser (WKWebView on iOS).
      // openAuthSessionAsync intercepts the deep-link return URL and
      // closes the browser automatically, returning the user to the app.
      await WebBrowser.openAuthSessionAsync(
        url,
        "cleanhome://stripe-connect/return"
      );
      // Refresh Stripe status after the user returns from onboarding
      refreshStripeStatus();
    } catch (err) {
      Alert.alert(
        "Errore",
        err instanceof Error ? err.message : "Impossibile avviare la verifica"
      );
    } finally {
      setVerifying(false);
    }
  }, [user?.id]);

  // Load listings for the current cleaner
  const load = useCallback(
    async (showSpinner = true) => {
      if (!user?.id) {
        setListings([]);
        setLoading(false);
        return;
      }
      if (showSpinner) setLoading(true);
      setLoadError(null);
      try {
        const rows = await fetchMyListings(user.id);
        setListings(rows);
      } catch (err) {
        // Persist the error into state so the UI can render a proper
        // error view with a retry button, instead of a silent blank list.
        const msg =
          err instanceof Error
            ? err.message
            : "Impossibile caricare gli annunci.";
        setLoadError(msg);
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  // Reload on mount
  useEffect(() => {
    load();
  }, [load]);

  // Reload every time the screen is focused again (after edit OR
  // after returning from Stripe's hosted KYC flow in the browser)
  useFocusEffect(
    useCallback(() => {
      load(false);
      refreshStripeStatus();
    }, [load, refreshStripeStatus])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  }, [load]);

  // ── Create a new listing ────────────────────────────────────────────
  // First listing is free; additional listings need an active Stripe
  // subscription.
  //
  // Flow for paid listings:
  //  1. Insert a fresh row with subscription_status='incomplete' so we
  //     have a listing_id to pass to the Edge Function.
  //  2. Call `stripe-subscription-create` which creates the Stripe
  //     Customer + Subscription in default_incomplete state and
  //     returns the Payment Sheet params.
  //  3. Initialize + present the Payment Sheet. User enters card.
  //  4. On success, the Stripe webhook flips the listing's
  //     subscription_status to 'active' — we just reload the list.
  //  5. On cancel/error we roll back by deleting the incomplete row.
  const handleCreate = useCallback(async () => {
    if (!user?.id) {
      Alert.alert(
        "Accesso richiesto",
        "Devi essere loggato come professionista per creare un annuncio."
      );
      return;
    }

    const hasFree = listings.some((l) => l.is_first_listing);

    // ─── First listing is free ─────────────────────────────────
    if (!hasFree) {
      setCreating(true);
      try {
        const created = await createListing(user.id, true);
        router.push(`/listing?id=${created.id}`);
      } catch (err) {
        Alert.alert(
          "Errore",
          err instanceof Error ? err.message : "Impossibile creare l'annuncio."
        );
      } finally {
        setCreating(false);
      }
      return;
    }

    // ─── Additional listing — Stripe subscription flow ─────────
    setCreating(true);
    let pendingListingId: string | null = null;
    try {
      // 1) create the placeholder row
      const created = await createListing(user.id, false);
      pendingListingId = created.id;

      // 2) ask the edge function for a Payment Sheet.
      // Use supabase.functions.invoke() which correctly sets both the
      // apikey header and the Authorization Bearer header with the
      // currently logged-in user's access_token.
      const { data: invokeData, error: invokeError } =
        await supabase.functions.invoke("stripe-subscription-create", {
          body: { listing_id: created.id },
        });

      if (__DEV__) {
        console.log(
          "[stripe-subscription-create]",
          JSON.stringify({ data: invokeData, error: invokeError?.message })
        );
      }

      if (invokeError) {
        // Extract richer error details from the Edge Function response
        // body when the function returned a non-2xx status.
        type EdgeFnError = Error & { context?: { text?: () => Promise<string> } };
        let details = invokeError.message;
        const ctx = (invokeError as EdgeFnError).context;
        if (ctx && typeof ctx.text === "function") {
          try {
            const txt = await ctx.text();
            details = `${invokeError.message}: ${txt}`;
          } catch {}
        }
        throw new Error(details);
      }

      const payload = (invokeData ?? {}) as {
        customer?: string;
        ephemeralKey?: string;
        paymentIntent?: string;
        error?: string;
      };
      if (!payload.paymentIntent) {
        throw new Error(
          payload.error || "Nessun PaymentIntent ricevuto dal server"
        );
      }

      // 3) init + present Payment Sheet
      const { error: initErr } = await initPaymentSheet({
        merchantDisplayName: "CleanHome",
        customerId: payload.customer,
        customerEphemeralKeySecret: payload.ephemeralKey,
        paymentIntentClientSecret: payload.paymentIntent,
        allowsDelayedPaymentMethods: false,
        returnURL: "cleanhome://stripe-redirect",
      });
      if (initErr) throw new Error(initErr.message);

      const { error: presentErr } = await presentPaymentSheet();
      if (presentErr) {
        // User cancelled or card declined — roll back the placeholder row.
        if (pendingListingId) {
          await deleteListing(pendingListingId).catch(() => {});
        }
        if (presentErr.code !== "Canceled") {
          Alert.alert("Pagamento non riuscito", presentErr.message);
        }
        return;
      }

      // 4) payment succeeded — webhook will flip status, reload list
      Alert.alert(
        "Annuncio creato",
        "L'abbonamento è attivo. Ora puoi configurare il tuo nuovo annuncio.",
        [
          {
            text: "Configura ora",
            onPress: () => router.push(`/listing?id=${created.id}`),
          },
        ]
      );
      await load(false);
    } catch (err) {
      if (pendingListingId) {
        await deleteListing(pendingListingId).catch(() => {});
      }
      Alert.alert(
        "Errore",
        err instanceof Error ? err.message : "Impossibile creare l'annuncio."
      );
    } finally {
      setCreating(false);
    }
  }, [
    listings,
    router,
    user?.id,
    initPaymentSheet,
    presentPaymentSheet,
    load,
  ]);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={10}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={C.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>I miei annunci</Text>
        <NotificationBell color={C.primary} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stripe Connect verification banner — pending */}
        {!stripeVerified && !loading && (
          <Pressable
            onPress={handleStartVerification}
            disabled={verifying}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#FEF3C7",
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                gap: 12,
                borderWidth: 1,
                borderColor: "#F59E0B",
              },
              (pressed || verifying) && { opacity: pressed ? 0.8 : 0.6 },
            ]}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "#FEF9C3",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {verifying ? (
                <ActivityIndicator size="small" color="#D97706" />
              ) : (
                <Ionicons name="shield-checkmark" size={24} color="#D97706" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: "#92400E",
                  marginBottom: 2,
                }}
              >
                Verifica identità e IBAN
              </Text>
              <Text style={{ fontSize: 12, color: "#A16207", lineHeight: 17 }}>
                Per ricevere prenotazioni e pagamenti dai clienti, completa la
                verifica Stripe. Ci vogliono 2 minuti.
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color="#D97706" />
          </Pressable>
        )}

        {/* Stripe Connect verification banner — verified */}
        {stripeVerified && !loading && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#ECFDF5",
              borderRadius: 16,
              padding: 14,
              marginBottom: 16,
              gap: 12,
              borderWidth: 1,
              borderColor: "#10B981",
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#D1FAE5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="checkmark-circle" size={22} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#065F46",
                  marginBottom: 2,
                }}
              >
                Verifica completata
              </Text>
              <Text style={{ fontSize: 12, color: "#047857", lineHeight: 16 }}>
                Identità e IBAN verificati. Pronto a ricevere pagamenti.
              </Text>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={C.secondary} />
          </View>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={() => load(true)} />
        ) : listings.length === 0 ? (
          <EmptyState onCreate={handleCreate} creating={creating} />
        ) : (
          <>
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                onPress={() => router.push(`/listing?id=${l.id}`)}
                onDelete={() => {
                  Alert.alert(
                    "Elimina annuncio",
                    "Sei sicuro? L'azione non può essere annullata.",
                    [
                      { text: "Annulla", style: "cancel" },
                      {
                        text: "Elimina",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            await deleteListing(l.id);
                            await load(false);
                          } catch (err) {
                            Alert.alert(
                              "Errore",
                              err instanceof Error
                                ? err.message
                                : "Impossibile eliminare."
                            );
                          }
                        },
                      },
                    ]
                  );
                }}
              />
            ))}

            <Pressable
              onPress={handleCreate}
              disabled={creating}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: 22,
                padding: 20,
                marginTop: 4,
                borderWidth: 2,
                borderColor: "#006b5540",
                borderStyle: "dashed",
                alignItems: "center",
                opacity: creating ? 0.5 : 1,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: "#006b5515",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#006b55" />
                ) : (
                  <Ionicons name="add" size={32} color="#006b55" />
                )}
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: "#181c1c",
                  marginBottom: 4,
                  textAlign: "center",
                }}
              >
                Crea un nuovo annuncio
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: "#414846",
                  textAlign: "center",
                  lineHeight: 18,
                  marginBottom: 12,
                  paddingHorizontal: 8,
                }}
              >
                Pubblica più annunci per coprire altre zone o servizi
              </Text>
              <View
                style={{
                  backgroundColor: "#006b55",
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 999,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: "#ffffff",
                  }}
                >
                  {listings.some((l) => l.is_first_listing)
                    ? "4,99 €/mese"
                    : "Gratis"}
                </Text>
              </View>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function ListingCard({
  listing,
  onPress,
  onDelete,
}: {
  listing: CleanerListing;
  onPress: () => void;
  onDelete: () => void;
}) {
  const statusInfo = getStatusInfo(listing);
  const hasZone =
    listing.coverage_mode === "circle" || listing.coverage_mode === "polygon";
  const zoneLabel = hasZone
    ? listing.coverage_mode === "circle" && listing.coverage_radius_km
      ? `${listing.city || "Zona"} · ${listing.coverage_radius_km} km`
      : listing.city || "Zona personalizzata"
    : "Nessuna zona impostata";
  const rateLabel = listing.hourly_rate
    ? `€${Number(listing.hourly_rate).toFixed(0)}/ora`
    : "Tariffa non impostata";
  const isIncomplete = !hasZone || !listing.hourly_rate;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: "#ffffff",
          borderRadius: 22,
          overflow: "hidden",
          marginBottom: 16,
          shadowColor: "#022420",
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {/* Cover */}
      <View>
        <Image
          source={{ uri: listing.cover_url || FALLBACK_COVER }}
          style={{ width: "100%", height: 170, backgroundColor: "#eef3f1" }}
          resizeMode="cover"
        />
        {/* Top-left: status badge */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: statusInfo.bg,
            paddingHorizontal: 11,
            paddingVertical: 6,
            borderRadius: 999,
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: statusInfo.color,
              marginRight: 6,
            }}
          />
          <Text
            style={{ fontSize: 12, fontWeight: "700", color: statusInfo.color }}
          >
            {statusInfo.label}
          </Text>
        </View>
        {/* Top-right: free/paid badge */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            backgroundColor: "rgba(0,0,0,0.55)",
            paddingHorizontal: 11,
            paddingVertical: 6,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#ffffff" }}>
            {listing.is_first_listing ? "GRATIS" : "4,99 €/mese"}
          </Text>
        </View>
      </View>

      {/* Body */}
      <View style={{ padding: 16 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: "#181c1c",
            marginBottom: 2,
          }}
          numberOfLines={1}
        >
          {listing.title || "Il mio annuncio"}
        </Text>
        {isIncomplete && (
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: "#b45309",
              marginBottom: 10,
            }}
          >
            ⚠ Annuncio incompleto — tocca per finire di configurarlo
          </Text>
        )}

        {/* Meta rows */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 4,
            gap: 8,
          }}
        >
          <Ionicons name="location" size={15} color="#006b55" />
          <Text
            style={{ fontSize: 13, color: "#414846", flex: 1 }}
            numberOfLines={1}
          >
            {zoneLabel}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 6,
            gap: 8,
          }}
        >
          <Ionicons name="pricetag" size={15} color="#006b55" />
          <Text style={{ fontSize: 13, color: "#414846" }}>{rateLabel}</Text>
        </View>

        {/* Modify CTA */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#e6f4f1",
            borderRadius: 12,
            paddingVertical: 12,
            marginTop: 16,
            gap: 8,
          }}
        >
          <Ionicons name="create-outline" size={18} color="#006b55" />
          <Text
            style={{ fontSize: 14, fontWeight: "700", color: "#006b55" }}
          >
            Modifica annuncio
          </Text>
        </View>

        {/* Elimina */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              paddingVertical: 10,
              marginTop: 8,
              gap: 6,
            },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="trash-outline" size={16} color="#b3261e" />
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#b3261e" }}>
            Elimina annuncio
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderRadius: 22,
        padding: 28,
        marginTop: 20,
        borderWidth: 1,
        borderColor: "#fee2e2",
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: "#fee2e2",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Ionicons name="alert-circle-outline" size={32} color="#dc2626" />
      </View>
      <Text
        style={{
          fontSize: 17,
          fontWeight: "800",
          color: C.primary,
          marginBottom: 6,
          textAlign: "center",
        }}
      >
        Caricamento fallito
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: "#6b7280",
          textAlign: "center",
          lineHeight: 18,
          marginBottom: 18,
          paddingHorizontal: 8,
        }}
      >
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: C.secondary,
          },
          pressed && { opacity: 0.9 },
        ]}
      >
        <Ionicons name="refresh" size={18} color="#ffffff" />
        <Text style={{ fontSize: 14, fontWeight: "800", color: "#ffffff" }}>
          Riprova
        </Text>
      </Pressable>
    </View>
  );
}

function EmptyState({
  onCreate,
  creating,
}: {
  onCreate: () => void;
  creating: boolean;
}) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="briefcase-outline" size={36} color={C.secondary} />
      </View>
      <Text style={styles.emptyTitle}>Non hai ancora annunci</Text>
      <Text style={styles.emptySubtitle}>
        Crea il tuo primo annuncio gratuitamente e inizia a ricevere clienti
        nella tua zona di copertura.
      </Text>
      <Pressable
        onPress={onCreate}
        disabled={creating}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#006b55",
          paddingHorizontal: 28,
          paddingVertical: 16,
          borderRadius: 999,
          gap: 10,
          opacity: creating ? 0.5 : 1,
          shadowColor: "#006b55",
          shadowOpacity: 0.22,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        {creating ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: "#ffffff",
              }}
            >
              Crea un nuovo annuncio
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

// ─── Status helpers ───────────────────────────────────────────────────────────
function getStatusInfo(l: CleanerListing): {
  label: string;
  color: string;
  bg: string;
} {
  if (!l.is_active) {
    return { label: "In pausa", color: "#8a4502", bg: "#fef0d9" };
  }
  if (!l.is_first_listing && l.subscription_status !== "active") {
    return {
      label: "Pagamento richiesto",
      color: "#b3261e",
      bg: "#fde7e7",
    };
  }
  return { label: "Attivo", color: "#006b55", bg: "#e6f4f1" };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.onSurface,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  loadingWrap: {
    paddingVertical: 64,
    alignItems: "center",
    justifyContent: "center",
  },

  // List card
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 14,
    ...({
      shadowColor: "#022420",
      shadowOpacity: 0.07,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    } as const),
  },
  cardCover: {
    width: "100%",
    height: 160,
    backgroundColor: C.surfaceLow,
  },
  cardStatus: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  cardStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  cardStatusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardBody: { padding: 14 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.onSurface,
    marginBottom: 6,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 6,
  },
  cardMetaText: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    flex: 1,
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5ece9",
  },
  cardFreeBadge: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    fontWeight: "600",
  },

  // New listing CTA
  newCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: 1.5,
    borderColor: "#006b5530",
    borderStyle: "dashed",
    marginTop: 4,
  },
  newIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#006b5515",
    alignItems: "center",
    justifyContent: "center",
  },
  newTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.onSurface,
  },
  newSubtitle: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 16,
  },
  newPriceBadge: {
    backgroundColor: C.secondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  newPriceText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.surface,
  },

  // Empty state
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#006b5515",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: C.onSurface,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#006b55",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    gap: 8,
    shadowColor: "#006b55",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#006b55",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#006b55",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
