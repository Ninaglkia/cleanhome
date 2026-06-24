# CleanHome — Pack 5 — Listings + Cleaner profiles

Stack: React Native + Expo Router v3 + NativeWind + TypeScript
Vedi DESIGN-AUDIT-README.md per il contesto completo.

---

### `app/listings/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function ListingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

---

### `app/listings/index.tsx`

```tsx
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
  fetchListing,
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

      // 4) payment succeeded — poll until webhook flips subscription_status
      let isActive = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        await new Promise<void>((resolve) => setTimeout(resolve, 700));
        const polled = await fetchListing(created.id);
        if (polled?.subscription_status === "active") {
          isActive = true;
          break;
        }
      }

      if (!isActive) {
        Alert.alert(
          "Annuncio creato",
          "Conferma in corso, ricarica tra qualche secondo.",
          [
            {
              text: "OK",
              onPress: () => router.push(`/listing?id=${created.id}`),
            },
          ]
        );
      } else {
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
      }
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
        {listing.cover_url ? (
          <Image
            source={{ uri: listing.cover_url }}
            style={{ width: "100%", height: 170, backgroundColor: "#eef3f1" }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: 170,
              backgroundColor: "#eef3f1",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingHorizontal: 24,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: "rgba(2,36,32,0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="person-outline" size={28} color={C.primary} />
            </View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: C.onSurface,
                textAlign: "center",
              }}
            >
              Aggiungi un tuo selfie
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: C.onSurfaceVariant,
                textAlign: "center",
              }}
            >
              Tocca per caricare la foto del tuo annuncio
            </Text>
          </View>
        )}
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
      <View
        style={{
          borderRadius: 999,
          backgroundColor: C.secondary,
          overflow: "hidden",
        }}
      >
        <Pressable
          onPress={onRetry}
          android_ripple={{ color: "rgba(255,255,255,0.18)" }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 22,
            paddingVertical: 12,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Ionicons name="refresh" size={18} color="#ffffff" />
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#ffffff" }}>
            Riprova
          </Text>
        </Pressable>
      </View>
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
      <View
        style={{
          backgroundColor: "#006b55",
          borderRadius: 999,
          opacity: creating ? 0.5 : 1,
          shadowColor: "#006b55",
          shadowOpacity: 0.22,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
          overflow: "hidden",
        }}
      >
        <Pressable
          onPress={onCreate}
          disabled={creating}
          android_ripple={{ color: "rgba(255,255,255,0.18)" }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 28,
            paddingVertical: 16,
            gap: 10,
            opacity: pressed ? 0.92 : 1,
          })}
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
```

---

### `app/listing/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function ListingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

---

### `app/listing/index.tsx`

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  Alert,
  LayoutChangeEvent,
  Modal,
  StatusBar,
  Vibration,
  Linking,
  Switch,
} from "react-native";
// Loaded lazily so the bundle still works in Expo Go (no native rebuild).
let ImagePicker: any = null;
try {
  ImagePicker = require("expo-image-picker");
} catch {}
// Use gesture-handler's ScrollView so it cooperates correctly with the
// child PanGesture used by the drawing overlay (the standard RN
// ScrollView's native UIScrollView gestures bypass the responder system
// and would steal vertical pans during freeform drawing).
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Circle, Polygon, Marker, MapPressEvent, LatLng } from "react-native-maps";
import Svg, { Path as SvgPath } from "react-native-svg";
import * as Location from "expo-location";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { useAuth } from "../../lib/auth";
import {
  fetchListing,
  updateListing,
  uploadListingCover,
  ListingCoverRejectedError,
} from "../../lib/api";

// ─── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  primary: "#022420",
  secondary: "#006b55",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  background: "#f6faf9",
  onSurface: "#181c1c",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  outlineVariant: "#c1c8c5",
  primaryContainer: "#1a3a35",
  accent: "#00c896",
} as const;

const MAP_CIRCLE_FILL = "#006b5540";
const MAP_CIRCLE_STROKE = "#006b55";
const DRAW_SAMPLE_EVERY = 1; // capture every touch event for smooth drawing
const DRAW_MAX_POINTS = 150; // max vertices after simplification

// ─── Coverage plan types ────────────────────────────────────────────────────────

interface CoveragePlan {
  name: string;
  minKm: number;
  maxKm: number;
  priceLabel: string;
  priceMonthly: number | null;
}

const COVERAGE_PLANS: readonly CoveragePlan[] = [
  { name: "Base", minKm: 0, maxKm: 5, priceLabel: "Gratis", priceMonthly: null },
  { name: "Standard", minKm: 6, maxKm: 15, priceLabel: "4,99 €/mese", priceMonthly: 4.99 },
  { name: "Premium", minKm: 16, maxKm: 30, priceLabel: "9,99 €/mese", priceMonthly: 9.99 },
  { name: "Pro", minKm: 31, maxKm: 50, priceLabel: "14,99 €/mese", priceMonthly: 14.99 },
] as const;

const SLIDER_MIN_KM = 1;
const SLIDER_MAX_KM = 50;

function getPlanForRadius(km: number): CoveragePlan {
  return (
    COVERAGE_PLANS.find((p) => km >= p.minKm && km <= p.maxKm) ??
    COVERAGE_PLANS[COVERAGE_PLANS.length - 1]
  );
}

function kmToMeters(km: number): number {
  return km * 1000;
}

// Chaikin corner-cutting smoothing for a closed polygon.
// Each iteration replaces every edge with two new points at 1/4 and 3/4,
// rounding sharp angles into smooth curves.
function chaikinSmoothLatLng(points: LatLng[], iterations: number): LatLng[] {
  if (points.length < 3) return points;
  let pts = points;
  for (let iter = 0; iter < iterations; iter++) {
    const next: LatLng[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      next.push({
        latitude: 0.75 * p0.latitude + 0.25 * p1.latitude,
        longitude: 0.75 * p0.longitude + 0.25 * p1.longitude,
      });
      next.push({
        latitude: 0.25 * p0.latitude + 0.75 * p1.latitude,
        longitude: 0.25 * p0.longitude + 0.75 * p1.longitude,
      });
    }
    pts = next;
  }
  return pts;
}

// Build an SVG path string from screen-space points (live drawing preview).
function buildSvgPathFromPoints(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`;
  }
  return d;
}

// Distance squared between two screen points (used by simplification).
function distSq(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// Precise geometry helpers for a drawn polygon.
// For small regions (covered by a single city / province) we approximate
// the sphere as a local equirectangular projection anchored at the polygon
// centroid — error is < 0.2% up to ~100 km, which is way below what the
// user can perceive on the map.
function projectToLocalKm(
  lat: number,
  lng: number,
  anchorLat: number
): { x: number; y: number } {
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((anchorLat * Math.PI) / 180);
  return { x: lng * kmPerDegLng, y: lat * kmPerDegLat };
}

function polygonCentroid(points: LatLng[]): { latitude: number; longitude: number } {
  const n = points.length;
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.latitude;
    lng += p.longitude;
  }
  return { latitude: lat / n, longitude: lng / n };
}

// Area in km² via Shoelace on a local planar projection.
function calcPolygonAreaKm2(points: LatLng[]): number {
  if (points.length < 3) return 0;
  const c = polygonCentroid(points);
  const projected = points.map((p) => projectToLocalKm(p.latitude, p.longitude, c.latitude));
  let sum = 0;
  for (let i = 0; i < projected.length; i++) {
    const a = projected[i];
    const b = projected[(i + 1) % projected.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

// Equivalent-area radius in km. Gives a single number the user can compare
// against the subscription plans (which are keyed on a "coverage radius").
function calcPolygonRadiusKm(points: LatLng[]): number {
  const area = calcPolygonAreaKm2(points);
  if (area <= 0) return 0;
  return Math.sqrt(area / Math.PI);
}

// Max distance from centroid — useful as the polygon's "reach" so the user
// understands the farthest point they commit to cover.
function calcPolygonMaxReachKm(points: LatLng[]): number {
  if (points.length < 3) return 0;
  const c = polygonCentroid(points);
  let max = 0;
  for (const p of points) {
    const dLat = (p.latitude - c.latitude) * 111.32;
    const dLng =
      (p.longitude - c.longitude) * 111.32 * Math.cos((c.latitude * Math.PI) / 180);
    const d = Math.sqrt(dLat * dLat + dLng * dLng);
    if (d > max) max = d;
  }
  return max;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type ListingStatus = "active" | "review" | "draft" | "paused";

interface ServiceTag {
  id: string;
  label: string;
  selected: boolean;
}

interface DayAvailability {
  day: string;
  short: string;
  available: boolean;
}

interface CoverageZone {
  id: string;
  city: string;
  radiusKm: number;
  plan: CoveragePlan;
  lat: number;
  lng: number;
  // Optional polygon vertices when the zone was defined via the freeform
  // "Disegna zona" mode. When present, this is the canonical shape and
  // radiusKm is just an approximation for plan/pricing.
  polygon?: LatLng[];
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

// IDs map 1:1 to the canonical labels stored in `cleaner_listings.services`.
// Keep these strings in sync with lib/types.ts → ALL_SERVICES.
const INITIAL_SERVICES: ServiceTag[] = [
  { id: "Pulizia ordinaria", label: "Pulizia ordinaria", selected: true },
  { id: "Pulizia profonda", label: "Pulizia profonda", selected: true },
  { id: "Stiratura", label: "Stiratura", selected: false },
  { id: "Pulizia vetri", label: "Pulizia vetri", selected: true },
  { id: "Pulizia post-ristrutturazione", label: "Pulizia post-ristrutturazione", selected: false },
  { id: "Pulizia uffici", label: "Pulizia uffici", selected: false },
  { id: "Pulizia condominiale", label: "Pulizia condominiale", selected: false },
];

const INITIAL_DAYS: DayAvailability[] = [
  { day: "Lunedì", short: "Lun", available: true },
  { day: "Martedì", short: "Mar", available: true },
  { day: "Mercoledì", short: "Mer", available: false },
  { day: "Giovedì", short: "Gio", available: true },
  { day: "Venerdì", short: "Ven", available: true },
  { day: "Sabato", short: "Sab", available: false },
  { day: "Domenica", short: "Dom", available: false },
];

const STATUS_CONFIG: Record<
  ListingStatus,
  { label: string; color: string; bg: string }
> = {
  active: { label: "Attivo", color: "#006b55", bg: "#e6f4f1" },
  review: { label: "In revisione", color: "#b45309", bg: "#fef3c7" },
  draft: { label: "Bozza", color: "#717976", bg: "#f0f4f3" },
  paused: { label: "In pausa", color: "#8a4502", bg: "#fef0d9" },
};

const ROME_COORDS = { latitude: 41.9028, longitude: 12.4964 };

// ─── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

interface StatusBadgeProps {
  status: ListingStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
      <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

interface ServiceChipProps {
  tag: ServiceTag;
  onToggle: (id: string) => void;
}

function ServiceChip({ tag, onToggle }: ServiceChipProps) {
  const handlePress = useCallback(() => onToggle(tag.id), [tag.id, onToggle]);
  return (
    <Pressable
      onPress={handlePress}
      style={[styles.chip, tag.selected && styles.chipSelected]}
    >
      {tag.selected && (
        <Ionicons
          name="checkmark"
          size={12}
          color={C.surface}
          style={{ marginRight: 4 }}
        />
      )}
      <Text style={[styles.chipText, tag.selected && styles.chipTextSelected]}>
        {tag.label}
      </Text>
    </Pressable>
  );
}

interface DayPillProps {
  day: DayAvailability;
  onToggle: (day: string) => void;
}

function DayPill({ day, onToggle }: DayPillProps) {
  const handlePress = useCallback(() => onToggle(day.day), [day.day, onToggle]);
  return (
    <Pressable
      onPress={handlePress}
      style={[styles.dayPill, day.available && styles.dayPillActive]}
    >
      <Text
        style={[styles.dayPillText, day.available && styles.dayPillTextActive]}
      >
        {day.short}
      </Text>
    </Pressable>
  );
}

// ─── PlanBadge ──────────────────────────────────────────────────────────────────

interface PlanBadgeProps {
  plan: CoveragePlan;
}

function PlanBadge({ plan }: PlanBadgeProps) {
  const isFree = plan.priceMonthly === null;
  return (
    <View style={styles.planBadgeRow}>
      <View
        style={[
          styles.planBadge,
          { backgroundColor: isFree ? "#e6f4f1" : C.primaryContainer },
        ]}
      >
        <Text
          style={[
            styles.planBadgeName,
            { color: isFree ? C.secondary : C.accent },
          ]}
        >
          {plan.name}
        </Text>
      </View>
      <View style={styles.planPriceBlock}>
        <Text style={styles.planPriceLabel}>{plan.priceLabel}</Text>
        {!isFree && (
          <Text style={styles.planPriceSub}>per questa zona</Text>
        )}
      </View>
    </View>
  );
}

// ─── CoverageZoneRow ─────────────────────────────────────────────────────────────

interface CoverageZoneRowProps {
  zone: CoverageZone;
  onDelete: (id: string) => void;
}

function CoverageZoneRow({ zone, onDelete }: CoverageZoneRowProps) {
  const handleDelete = useCallback(() => onDelete(zone.id), [zone.id, onDelete]);
  const isDrawn = !!zone.polygon && zone.polygon.length >= 3;
  return (
    <View style={styles.coverageZoneRow}>
      <View style={styles.coverageZoneLeft}>
        <Ionicons
          name={isDrawn ? "create" : "location"}
          size={15}
          color={C.secondary}
        />
        <View>
          <Text style={styles.coverageZoneCity}>{zone.city}</Text>
          <Text style={styles.coverageZoneMeta}>
            {isDrawn ? "Zona disegnata" : `${zone.radiusKm} km`} · {zone.plan.name} · {zone.plan.priceLabel}
          </Text>
        </View>
      </View>
      <Pressable onPress={handleDelete} hitSlop={10} style={styles.coverageZoneDelete}>
        <Ionicons name="trash-outline" size={16} color="#ef4444" />
      </Pressable>
    </View>
  );
}

// ─── RadiusSlider ─────────────────────────────────────────────────────────────────
// Custom slider built with PanGestureHandler + Reanimated (no @react-native-community/slider needed)

interface RadiusSliderProps {
  radiusKm: number;
  onRadiusChange: (km: number) => void;
}

function RadiusSlider({ radiusKm, onRadiusChange }: RadiusSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const startX = useSharedValue(0);
  const thumbX = useSharedValue(0);

  // Sync thumb position when radiusKm changes from outside
  const fraction = trackWidth > 0
    ? (radiusKm - SLIDER_MIN_KM) / (SLIDER_MAX_KM - SLIDER_MIN_KM)
    : 0;
  const thumbPosition = fraction * trackWidth;

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setTrackWidth(w);
      thumbX.value = ((radiusKm - SLIDER_MIN_KM) / (SLIDER_MAX_KM - SLIDER_MIN_KM)) * w;
    },
    [radiusKm, thumbX]
  );

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const updateRadius = useCallback(
    (x: number) => {
      if (trackWidth === 0) return;
      const clamped = clamp(x, 0, trackWidth);
      const km = Math.round(
        SLIDER_MIN_KM + (clamped / trackWidth) * (SLIDER_MAX_KM - SLIDER_MIN_KM)
      );
      onRadiusChange(clamp(km, SLIDER_MIN_KM, SLIDER_MAX_KM));
    },
    [trackWidth, onRadiusChange]
  );

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startX.value = thumbX.value;
    })
    .onUpdate((e) => {
      const raw = startX.value + e.translationX;
      const newX = Math.min(Math.max(raw, 0), trackWidth);
      thumbX.value = newX;
      runOnJS(updateRadius)(newX);
    });

  const thumbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  const fillWidth = trackWidth > 0 ? thumbPosition : 0;

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderLabelRow}>
        <Text style={styles.sliderLabelLeft}>{SLIDER_MIN_KM} km</Text>
        <Text style={styles.sliderKmValue}>{radiusKm} km</Text>
        <Text style={styles.sliderLabelRight}>{SLIDER_MAX_KM} km</Text>
      </View>
      <View style={styles.sliderTrackWrapper} onLayout={handleLayout}>
        {/* Track background */}
        <View style={styles.sliderTrack} />
        {/* Filled portion */}
        <View style={[styles.sliderFill, { width: fillWidth }]} />
        {/* Thumb */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[styles.sliderThumbWrapper, thumbAnimStyle]}
          >
            <View style={styles.sliderThumb} />
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

// ─── PriceSlider ─────────────────────────────────────────────────────────────
// Hourly rate slider €20 → €35 (1 € step). Mirrors RadiusSlider visually.

const PRICE_MIN = 20;
const PRICE_MAX = 35;

interface PriceSliderProps {
  /** Current value in euros (number). */
  priceEur: number;
  onPriceChange: (eur: number) => void;
}

function PriceSlider({ priceEur, onPriceChange }: PriceSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const startX = useSharedValue(0);
  const thumbX = useSharedValue(0);

  const fraction = trackWidth > 0
    ? (priceEur - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)
    : 0;
  const thumbPosition = fraction * trackWidth;

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setTrackWidth(w);
      thumbX.value = ((priceEur - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * w;
    },
    [priceEur, thumbX]
  );

  const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), max);

  const updatePrice = useCallback(
    (x: number) => {
      if (trackWidth === 0) return;
      const clamped = clamp(x, 0, trackWidth);
      const eur = Math.round(
        PRICE_MIN + (clamped / trackWidth) * (PRICE_MAX - PRICE_MIN)
      );
      onPriceChange(clamp(eur, PRICE_MIN, PRICE_MAX));
    },
    [trackWidth, onPriceChange]
  );

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startX.value = thumbX.value;
    })
    .onUpdate((e) => {
      const raw = startX.value + e.translationX;
      const newX = Math.min(Math.max(raw, 0), trackWidth);
      thumbX.value = newX;
      runOnJS(updatePrice)(newX);
    });

  const thumbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  const fillWidth = trackWidth > 0 ? thumbPosition : 0;

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderLabelRow}>
        <Text style={styles.sliderLabelLeft}>€{PRICE_MIN}</Text>
        <Text style={styles.sliderKmValue}>€{priceEur}/ora</Text>
        <Text style={styles.sliderLabelRight}>€{PRICE_MAX}</Text>
      </View>
      <View style={styles.sliderTrackWrapper} onLayout={handleLayout}>
        <View style={styles.sliderTrack} />
        <View style={[styles.sliderFill, { width: fillWidth }]} />
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.sliderThumbWrapper, thumbAnimStyle]}>
            <View style={styles.sliderThumb} />
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

// ─── Completion banner ────────────────────────────────────────────────────────

interface CompletionItem {
  key: string;
  done: boolean;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}

function CompletionBanner({ items }: { items: CompletionItem[] }) {
  const missing = items.filter((i) => !i.done);
  const progress = items.length - missing.length;

  if (missing.length === 0) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#ECFDF5",
          borderRadius: 16,
          padding: 14,
          marginBottom: 12,
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
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#065F46" }}>
            Annuncio completo
          </Text>
          <Text style={{ fontSize: 12, color: "#047857", lineHeight: 16 }}>
            Pubblicato e visibile ai clienti nella tua zona.
          </Text>
        </View>
      </View>
    );
  }

  // The listing itself is published & visible as soon as the cleaner's
  // subscription is active — completeness is an OPTIONAL quality nudge,
  // not a publication gate. The previous "Completa X campi per
  // pubblicare" copy was misleading because the listing was already
  // online. Re-tone to amber/info ("Migliora") instead of red/error.
  return (
    <View
      style={{
        backgroundColor: "#FFFBEB",
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#FCD34D",
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: "#FEF3C7",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="sparkles-outline" size={22} color="#B45309" />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 15, fontWeight: "700", color: "#92400E", marginBottom: 2 }}
          >
            Migliora l'annuncio ({progress}/{items.length})
          </Text>
          <Text style={{ fontSize: 12, color: "#B45309", lineHeight: 16 }}>
            L'annuncio è già online. Aggiungi questi dettagli per attirare più clienti:
          </Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        {missing.map((item) => (
          <View
            key={item.key}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              padding: 12,
              gap: 10,
              borderWidth: 1,
              borderColor: "#FDE68A",
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: "#FEF3C7",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={item.icon} size={18} color="#B45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#78350F",
                  marginBottom: 2,
                }}
              >
                {item.label}
              </Text>
              <Text style={{ fontSize: 12, color: "#92400E", lineHeight: 16 }}>
                {item.hint}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function ListingScreen() {
  const router = useRouter();

  // Existing state
  const [hourlyRate, setHourlyRate] = useState("25");
  // Start with an empty description — the old hard-coded placeholder
  // ("Professionista con 5 anni di esperienza...") was silently
  // published by cleaners who didn't bother to edit it, which made
  // every cleaner profile look identical. Now the input is empty and
  // the placeholder text (in the TextInput below) guides the user.
  const [description, setDescription] = useState("");
  const [services, setServices] = useState<ServiceTag[]>(INITIAL_SERVICES);
  const [days, setDays] = useState<DayAvailability[]>(INITIAL_DAYS);

  // Coverage zone state
  const [coverageZones, setCoverageZones] = useState<CoverageZone[]>([]);
  const [draftCity, setDraftCity] = useState("");
  const [draftRadiusKm, setDraftRadiusKm] = useState(10);
  const [centerCoords, setCenterCoords] = useState(ROME_COORDS);
  // Ref holding the map's initial region. Set once after hydrate (from saved
  // coverage coords) so cleaners outside Rome don't see the wrong city.
  // Falls back to ROME_COORDS only if no saved zone exists.
  const initialMapRegionRef = useRef<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  // Persistence state for the "Salva" button.
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();

  // Listing ID from the route query (?id=...). Required: without an id
  // we redirect the user back to the listings hub so they can pick or
  // create one. Stored as plain string for the API calls below.
  const params = useLocalSearchParams<{ id?: string }>();
  const listingId = params.id;

  // Cover photo state — synced with cleaner_profiles.avatar_url.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Listing active/inactive — synced with cleaner_profiles.is_available.
  const [isActive, setIsActive] = useState(true);

  // MapView refs
  const mapRef = useRef<MapView>(null);
  const mapRefFullscreen = useRef<MapView>(null);

  // Draw mode
  const [drawnPolygon, setDrawnPolygon] = useState<LatLng[]>([]);
  const [zoneMode, setZoneMode] = useState<"circle" | "draw">("circle");

  // Freeform drawing state
  const [isDrawingActive, setIsDrawingActive] = useState(false);
  const [hasDrawnOnce, setHasDrawnOnce] = useState(false);
  // Guard to prevent handleOverlayTouchEnd from running twice when both
  // .onEnd and .onFinalize fire for the same gesture (BUG 5 fix).
  const touchEndCalledRef = useRef(false);
  // Live screen-space points captured SYNCHRONOUSLY during drag.
  // No async involved → no out-of-order, no lag, instant preview.
  const screenPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  // Live SVG path string for in-progress drawing (rendered as <Path/>).
  const [liveSvgPath, setLiveSvgPath] = useState<string>("");

  // ── Circle drag state ─────────────────────────────────────────────
  // Cached screen-space coordinates of the circle (refreshed whenever
  // centerCoords / draftRadiusKm / map region change). Used for fast
  // synchronous hit-testing inside the touch responder.
  const circleCenterPxRef = useRef<{ x: number; y: number } | null>(null);
  const circleRadiusPxRef = useRef<number | null>(null);
  // Pixel offset between the touch point and the circle center at drag-start.
  // Preserved so the circle does not "snap" under the finger.
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  const [isDraggingCircle, setIsDraggingCircle] = useState(false);
  // Mirror of isDraggingCircle as a ref — updated SYNCHRONOUSLY in
  // the gesture grant so that any same-tick check sees the correct value.
  const isDraggingCircleRef = useRef(false);
  // True after the user confirms the current zone (circle or polygon).
  // While true the on-map "Conferma" / "Ridisegna" controls are hidden
  // and the zone stays visible. Reset on redraw / mode change / edit.
  const [isZoneConfirmed, setIsZoneConfirmed] = useState(false);
  // ── Address search (Google Places API New) ──
  // Uses the modern `places:autocomplete` + `places/{id}` endpoints so we
  // get accurate, disambiguated results for Italian cities and addresses.
  // Autocomplete returns placeId + formatted text only; we fetch coords
  // lazily on select via Place Details ("location" field-mask only, so
  // it's billed as cheap Location-Only).
  type SearchResult = {
    placeId: string;
    title: string; // primary line (e.g. "Milano")
    subtitle: string; // secondary line (e.g. "Lombardia, Italia")
    name: string; // short label stored in draftCity
    latitude: number; // 0 until Place Details resolves it
    longitude: number;
    iconName: keyof typeof Ionicons.glyphMap;
  };

  // Map a Google Places type array to an Ionicons name. Google returns
  // an array like ["restaurant","food","point_of_interest",…] — we pick
  // the most specific icon we know how to render.
  const pickIconForGoogleTypes = (
    types: string[] | undefined
  ): keyof typeof Ionicons.glyphMap => {
    const t = new Set(types || []);
    if (t.has("airport")) return "airplane";
    if (t.has("train_station") || t.has("subway_station") || t.has("transit_station"))
      return "train";
    if (t.has("bus_station")) return "bus";
    if (t.has("restaurant") || t.has("cafe") || t.has("meal_takeaway"))
      return "restaurant";
    if (t.has("bar") || t.has("night_club")) return "wine";
    if (t.has("lodging")) return "bed";
    if (t.has("museum") || t.has("art_gallery")) return "color-palette";
    if (t.has("tourist_attraction")) return "camera";
    if (t.has("hospital") || t.has("pharmacy") || t.has("doctor"))
      return "medkit";
    if (t.has("school") || t.has("university")) return "school";
    if (t.has("bank") || t.has("atm")) return "cash";
    if (t.has("gas_station")) return "car";
    if (t.has("supermarket") || t.has("store") || t.has("shopping_mall"))
      return "storefront";
    if (t.has("park")) return "leaf";
    if (t.has("church") || t.has("place_of_worship")) return "business";
    if (t.has("stadium") || t.has("gym")) return "football";
    // Administrative / locality types
    if (t.has("locality") || t.has("administrative_area_level_3"))
      return "business";
    if (
      t.has("sublocality") ||
      t.has("sublocality_level_1") ||
      t.has("neighborhood")
    )
      return "map";
    if (t.has("route") || t.has("street_address") || t.has("premise"))
      return "navigate";
    return "location";
  };

  const GOOGLE_PLACES_KEY =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || "";

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A per-typing "session token" significantly reduces Google Places cost
  // by grouping autocomplete + details calls as a single session.
  const searchSessionTokenRef = useRef<string>("");
  const newSessionToken = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    if (!GOOGLE_PLACES_KEY) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    if (!searchSessionTokenRef.current) {
      searchSessionTokenRef.current = newSessionToken();
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        // Google Places API (New) — Autocomplete.
        // Restrict to Italy via includedRegionCodes.
        const res = await fetch(
          "https://places.googleapis.com/v1/places:autocomplete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
            },
            body: JSON.stringify({
              input: trimmed,
              languageCode: "it",
              regionCode: "it",
              includedRegionCodes: ["it"],
              sessionToken: searchSessionTokenRef.current,
            }),
          }
        );

        const data = (await res.json()) as {
          suggestions?: Array<{
            placePrediction?: {
              placeId: string;
              text?: { text: string };
              structuredFormat?: {
                mainText?: { text: string };
                secondaryText?: { text: string };
              };
              types?: string[];
            };
          }>;
          error?: { message: string };
        };

        if (data.error) {
          console.warn("[places:autocomplete]", data.error.message);
          setSearchResults([]);
          return;
        }

        const mapped: SearchResult[] = (data.suggestions || [])
          .map((s) => s.placePrediction)
          .filter((p): p is NonNullable<typeof p> => !!p)
          .map((p) => {
            const main = p.structuredFormat?.mainText?.text || p.text?.text || "";
            const secondary = p.structuredFormat?.secondaryText?.text || "";
            return {
              placeId: p.placeId,
              title: main,
              subtitle: secondary,
              name: main,
              latitude: 0, // resolved lazily via Place Details on select
              longitude: 0,
              iconName: pickIconForGoogleTypes(p.types),
            };
          });

        setSearchResults(mapped.slice(0, 6));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectSearchResult = useCallback(
    async (result: SearchResult) => {
      setSearchQuery("");
      setSearchResults([]);

      if (!GOOGLE_PLACES_KEY) return;

      // Google Places (New) — Place Details with a Location-Only FieldMask.
      // This is the cheapest billing tier for Place Details because we ask
      // only for the `location` field.
      let lat = 0;
      let lng = 0;
      try {
        const detailsRes = await fetch(
          `https://places.googleapis.com/v1/places/${encodeURIComponent(
            result.placeId
          )}?sessionToken=${encodeURIComponent(
            searchSessionTokenRef.current || ""
          )}`,
          {
            method: "GET",
            headers: {
              "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
              "X-Goog-FieldMask": "location",
            },
          }
        );
        const details = (await detailsRes.json()) as {
          location?: { latitude: number; longitude: number };
          error?: { message: string };
        };
        if (details.error || !details.location) {
          console.warn("[places:details]", details.error?.message);
          return;
        }
        lat = details.location.latitude;
        lng = details.location.longitude;
      } catch {
        return;
      } finally {
        // Rotate the session token — one autocomplete-then-details cycle
        // counts as a single billable session in Google Places pricing.
        searchSessionTokenRef.current = "";
      }

      const coord = { latitude: lat, longitude: lng };

      // When in circle mode, drop a fresh 1 km circle on the searched
      // location so the user can then reposition / resize it. We also zoom
      // in tighter so the small circle is clearly visible. In draw mode we
      // just pan the map without touching the polygon the user drew.
      const isCircle = zoneMode === "circle";
      if (isCircle) {
        setCenterCoords(coord);
        setDraftRadiusKm(1);
        setIsZoneConfirmed(false);
      }

      const delta = isCircle ? 0.02 : 0.05;
      const region = {
        ...coord,
        latitudeDelta: delta,
        longitudeDelta: delta,
      };
      // Animate whichever map is currently mounted (fullscreen takes
      // precedence — its modal is on top when visible).
      mapRefFullscreen.current?.animateToRegion(region, 600);
      mapRef.current?.animateToRegion(region, 600);

      // Also update the city field with a clean short label.
      const shortLabel = result.title.split(",")[0]?.trim() || result.title;
      setDraftCity(shortLabel);
    },
    [zoneMode, GOOGLE_PLACES_KEY]
  );

  // Rightmost vertex (max longitude) of the confirmed polygon — used as
  // the coordinate of the green clear-zone Marker. The Marker is rendered
  // INSIDE the MapView so it follows pan/zoom natively.
  const polygonClearMarkerCoord = useMemo<LatLng | null>(() => {
    if (!isZoneConfirmed || zoneMode !== "draw" || drawnPolygon.length < 3) {
      return null;
    }
    return drawnPolygon.reduce((acc, p) =>
      p.longitude > acc.longitude ? p : acc
    );
  }, [isZoneConfirmed, zoneMode, drawnPolygon]);
  // ── Drag overlay (visual ghost circle following the finger) ──
  // While dragging, the native <Circle> is hidden and an Animated.View
  // (a regular round View driven by reanimated shared values) follows
  // the finger in real time. No async bridge call per move = zero lag.
  const dragOverlayActive = useSharedValue(0); // 0 hidden, 1 visible
  const dragOverlayCx = useSharedValue(0);
  const dragOverlayCy = useSharedValue(0);
  const dragOverlayR = useSharedValue(0);
  const dragOverlayScale = useSharedValue(1); // 1 idle, 1.06 dragging
  const dragLastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [dragOverlayMounted, setDragOverlayMounted] = useState(false);

  // Ref to the parent ScrollView so we can lock its native scroll
  // synchronously (via setNativeProps) the moment the user starts
  // touching the map / drawing area, bypassing React state delays.
  const scrollViewRef = useRef<ScrollView>(null);

  const dragOverlayAnimStyle = useAnimatedStyle(() => {
    const r = dragOverlayR.value;
    return {
      opacity: dragOverlayActive.value,
      width: r * 2,
      height: r * 2,
      borderRadius: r,
      transform: [
        { translateX: dragOverlayCx.value - r },
        { translateY: dragOverlayCy.value - r },
        { scale: dragOverlayScale.value },
      ],
    };
  });
  // Pure JS handlers used by the gesture-handler PanGesture (see below).
  // The drag is rendered via an Animated.View overlay that follows the
  // finger in real time (no per-move async bridge call). The native
  // <Circle> is hidden while dragging and re-shown at the end with the
  // final coordinate.
  const handleCircleDragStart = useCallback((x: number, y: number) => {
    setIsZoneConfirmed(false);
    const cx = circleCenterPxRef.current?.x ?? 0;
    const cy = circleCenterPxRef.current?.y ?? 0;
    const r = circleRadiusPxRef.current ?? 0;
    dragOffsetRef.current = { dx: cx - x, dy: cy - y };
    dragLastPosRef.current = { x: cx, y: cy };
    // Position the ghost overlay exactly on top of the current native circle
    dragOverlayCx.value = cx;
    dragOverlayCy.value = cy;
    dragOverlayR.value = r;
    // Smooth fade-in (60 ms) + spring scale up for tactile feedback
    dragOverlayActive.value = withTiming(1, { duration: 60, easing: Easing.out(Easing.quad) });
    dragOverlayScale.value = withSpring(1.06, { damping: 14, stiffness: 220 });
    setDragOverlayMounted(true);
    isDraggingCircleRef.current = true;
    setIsDraggingCircle(true);
    // Light haptic — short vibration on iOS / Android
    Vibration.vibrate(15);
  }, [dragOverlayCx, dragOverlayCy, dragOverlayR, dragOverlayActive, dragOverlayScale]);

  const handleCircleDragUpdate = useCallback(
    (x: number, y: number) => {
      const off = dragOffsetRef.current;
      if (!off) return;
      const newCx = x + off.dx;
      const newCy = y + off.dy;
      // Pure synchronous update — drives the Animated.View on the UI thread.
      dragOverlayCx.value = newCx;
      dragOverlayCy.value = newCy;
      dragLastPosRef.current = { x: newCx, y: newCy };
      circleCenterPxRef.current = { x: newCx, y: newCy };
    },
    [dragOverlayCx, dragOverlayCy]
  );

  const handleCircleDragEnd = useCallback(
    async (isFullscreen: boolean) => {
      isDraggingCircleRef.current = false;
      setIsDraggingCircle(false);
      dragOffsetRef.current = null;
      // Spring scale back to 1 immediately for instant tactile release feel
      dragOverlayScale.value = withSpring(1, { damping: 16, stiffness: 240 });
      const last = dragLastPosRef.current;
      dragLastPosRef.current = null;
      const hideOverlay = () => {
        dragOverlayActive.value = withTiming(
          0,
          { duration: 120, easing: Easing.in(Easing.quad) },
          (finished) => {
            "worklet";
            if (finished) runOnJS(setDragOverlayMounted)(false);
          }
        );
      };
      if (!last) {
        hideOverlay();
        return;
      }
      const ref = isFullscreen ? mapRefFullscreen.current : mapRef.current;
      if (!ref) {
        hideOverlay();
        return;
      }
      try {
        // ONE single async conversion at release time — the only bridge call.
        const coord = await ref.coordinateForPoint({ x: last.x, y: last.y });
        if (coord) {
          setCenterCoords(coord);
          Location.reverseGeocodeAsync(coord)
            .then((results) => {
              if (results.length > 0) {
                const r = results[0];
                setDraftCity(r.city || r.subregion || r.region || "");
              }
            })
            .catch(() => {});
        }
      } catch {
        // ignore — overlay still fades out below
      }
      // Wait one frame so the native <Circle> can re-render in the new
      // position before the ghost fades, eliminating any visual jump.
      requestAnimationFrame(hideOverlay);
    },
    [dragOverlayActive, dragOverlayScale]
  );

  // Hit test that checks whether a point in the active map's pixel space
  // falls inside the cached circle bounds.
  const hitTestCircle = useCallback((x: number, y: number): boolean => {
    const cx = circleCenterPxRef.current?.x;
    const cy = circleCenterPxRef.current?.y;
    const r = circleRadiusPxRef.current;
    if (cx == null || cy == null || r == null) return false;
    const dx = x - cx;
    const dy = y - cy;
    const hitR = r + 12; // touch padding
    return dx * dx + dy * dy <= hitR * hitR;
  }, []);
  // Tick counter forced by onRegionChangeComplete — used as an effect
  // dependency to recompute the cached pixel coords when the user
  // pans/zooms the map manually.
  const [mapRegionTick, setMapRegionTick] = useState(0);
  const handleRegionChangeComplete = useCallback(() => {
    setMapRegionTick((t) => t + 1);
  }, []);

  // NOTE: circle/polygon stay FIXED at their geographic coordinates when
  // the user pans the map. Previously the shapes were slid by the region
  // delta, which felt like "the zone chases the map" — the user reported
  // this as a bug. Pan is now pure viewport navigation. The shapes are
  // only moved by explicit gestures (drag the circle, redraw the polygon)
  // or by searching a city in circle mode.
  const handleRegionChange = useCallback(
    (_region: { latitude: number; longitude: number }) => {
      // Intentionally no-op: MapView renders Circle/Polygon at their own
      // lat/lng, so they naturally stay fixed as the user pans.
    },
    []
  );
  // Inline-only: true while the user's finger is touching the inline map.
  // Used to disable the parent ScrollView's vertical scroll so the map
  // gesture (pan / pinch / drag-circle) doesn't get hijacked by the page.
  const [isMapTouching, setIsMapTouching] = useState(false);

  const handleMapContainerTouchStart = useCallback(() => {
    setIsMapTouching(true);
  }, []);
  const handleMapContainerTouchEnd = useCallback(() => {
    setIsMapTouching(false);
  }, []);

  // ── Pan gestures for the circle drag (gesture-handler) ──
  // Two distinct gestures, one per MapView. They share the same wrapper
  // handlers via the `isFullscreen` flag. The gesture is manualActivation
  // so it stays inert until onTouchesDown verifies the touch is inside
  // the cached circle bounds; otherwise manager.fail() lets the touch
  // pass through to the native MapView (pan/pinch keep working).
  const circleDragGestureInline = useMemo(
    () =>
      Gesture.Pan()
        .enabled(zoneMode === "circle")
        .runOnJS(true)
        .manualActivation(true)
        .onTouchesDown((e, manager) => {
          if (zoneMode !== "circle") {
            manager.fail();
            return;
          }
          const t = e.changedTouches[0];
          if (!hitTestCircle(t.x, t.y)) {
            manager.fail();
            return;
          }
          handleCircleDragStart(t.x, t.y);
          manager.activate();
        })
        .onUpdate((e) => {
          handleCircleDragUpdate(e.x, e.y);
        })
        .onEnd(() => handleCircleDragEnd(false))
        .onFinalize(() => {
          if (isDraggingCircleRef.current) handleCircleDragEnd(false);
        }),
    [zoneMode, hitTestCircle, handleCircleDragStart, handleCircleDragUpdate, handleCircleDragEnd]
  );

  const circleDragGestureFullscreen = useMemo(
    () =>
      Gesture.Pan()
        .enabled(zoneMode === "circle")
        .runOnJS(true)
        .manualActivation(true)
        .onTouchesDown((e, manager) => {
          if (zoneMode !== "circle") {
            manager.fail();
            return;
          }
          const t = e.changedTouches[0];
          if (!hitTestCircle(t.x, t.y)) {
            manager.fail();
            return;
          }
          handleCircleDragStart(t.x, t.y);
          manager.activate();
        })
        .onUpdate((e) => {
          handleCircleDragUpdate(e.x, e.y);
        })
        .onEnd(() => handleCircleDragEnd(true))
        .onFinalize(() => {
          if (isDraggingCircleRef.current) handleCircleDragEnd(true);
        }),
    [zoneMode, hitTestCircle, handleCircleDragStart, handleCircleDragUpdate, handleCircleDragEnd]
  );

  const handleMapContainerLayout = useCallback((_e: LayoutChangeEvent) => {
    // reserved for future use; overlay uses absoluteFillObject
  }, []);

  // Fullscreen modal
  const [fullscreenVisible, setFullscreenVisible] = useState(false);

  const effectiveRadiusKm = zoneMode === "draw" && drawnPolygon.length >= 3
    ? Math.ceil(calcPolygonRadiusKm(drawnPolygon))
    : draftRadiusKm;
  const draftPlan = useMemo(() => getPlanForRadius(effectiveRadiusKm), [effectiveRadiusKm]);

  // Initial map region — used only at mount. After that, the map is
  // panned/zoomed by the user OR programmatically via animateToRegion.
  // This is intentionally NOT linked to centerCoords so that dragging
  // the circle does not re-center the map under it.
  // Computed once, using saved coverage center if available (set by hydrate).
  // Falls back to current device location or Rome only as last resort.
  const initialMapRegion = useMemo(() => {
    if (initialMapRegionRef.current) return initialMapRegionRef.current;
    return {
      latitude: ROME_COORDS.latitude,
      longitude: ROME_COORDS.longitude,
      latitudeDelta: Math.max((draftRadiusKm * 2) / 111, 0.5),
      longitudeDelta: Math.max((draftRadiusKm * 2) / 111, 0.5),
    };
    // intentional empty deps: only the very first value matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geocode city name to coordinates
  const geocodeCity = useCallback(async (city: string) => {
    if (!city.trim()) return;
    try {
      const results = await Location.geocodeAsync(city);
      if (results.length > 0) {
        setCenterCoords({ latitude: results[0].latitude, longitude: results[0].longitude });
      } else {
        Alert.alert("Città non trovata", "Prova con un altro nome");
      }
    } catch {
      Alert.alert("Errore", "Impossibile cercare la città");
    }
  }, []);

  // Handle map tap: only moves circle center in circle mode.
  // In draw mode the overlay handles all input.
  const handleMapPress = useCallback((e: MapPressEvent) => {
    if (zoneMode === "draw") return;
    setIsZoneConfirmed(false);
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setCenterCoords({ latitude, longitude });
    Location.reverseGeocodeAsync({ latitude, longitude }).then((results) => {
      if (results.length > 0) {
        const r = results[0];
        setDraftCity(r.city || r.subregion || r.region || "");
      }
    }).catch(() => {});
  }, [zoneMode]);

// ── Refresh cached pixel coords for the circle hit-test ──
  // Triggered whenever centerCoords / radius / fullscreen / region changes.
  useEffect(() => {
    if (zoneMode !== "circle") return;
    const ref = fullscreenVisible ? mapRefFullscreen.current : mapRef.current;
    if (!ref) return;
    let cancelled = false;
    (async () => {
      try {
        const center = await ref.pointForCoordinate(centerCoords);
        if (cancelled) return;
        circleCenterPxRef.current = center;
        // Compute the on-screen radius by mapping a point one "radius east"
        // and measuring the pixel distance from the center. This is exact
        // for the current map zoom level.
        const lonDeg =
          draftRadiusKm /
          (111 * Math.cos((centerCoords.latitude * Math.PI) / 180));
        const edge = await ref.pointForCoordinate({
          latitude: centerCoords.latitude,
          longitude: centerCoords.longitude + lonDeg,
        });
        if (cancelled) return;
        const dx = edge.x - center.x;
        const dy = edge.y - center.y;
        circleRadiusPxRef.current = Math.sqrt(dx * dx + dy * dy);
      } catch {
        // ignore — refs may be unmounted mid-async
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    centerCoords,
    draftRadiusKm,
    fullscreenVisible,
    zoneMode,
    mapRegionTick,
  ]);

  // ── Touch responder handlers for dragging the circle ──
  // Draw mode handlers
  const handleClearPolygon = useCallback(() => {
    setDrawnPolygon([]);
  }, []);

  // Reset the confirmed zone so the user can redraw / re-edit.
  // For draw mode: clears the polygon. For circle mode: just re-enables
  // the on-map confirm button so the user can drag/edit and confirm again.
  const handleResetConfirmedZone = useCallback(() => {
    setIsZoneConfirmed(false);
    if (zoneMode === "draw") {
      setDrawnPolygon([]);
      setHasDrawnOnce(false);
      screenPointsRef.current = [];
      setLiveSvgPath("");
    }
  }, [zoneMode]);

  // Locate the user: request foreground permission, get the current
  // position, and animate the active map to that region.
  const handleLocateUser = useCallback(async () => {
    try {
      // Check current status first — if previously denied, iOS won't re-prompt
      let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();

      // Only request if we can still ask (first time, or reset)
      if (status !== "granted" && canAskAgain) {
        const res = await Location.requestForegroundPermissionsAsync();
        status = res.status;
        canAskAgain = res.canAskAgain;
      }

      if (status !== "granted") {
        // Permanently denied — offer to open iOS/Android settings directly
        Alert.alert(
          "Posizione disattivata",
          "Per trovare la tua posizione devi attivare l'accesso nelle impostazioni dell'app.",
          [
            { text: "Annulla", style: "cancel" },
            {
              text: "Apri Impostazioni",
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const ref = fullscreenVisible
        ? mapRefFullscreen.current
        : mapRef.current;
      ref?.animateToRegion(
        {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        600
      );
    } catch {
      Alert.alert(
        "Posizione non disponibile",
        "Non riesco a leggere la tua posizione. Controlla che il GPS sia attivo e riprova."
      );
    }
  }, [fullscreenVisible]);

  // Unified zone confirmation. Handles both circle (uses centerCoords +
  // radius) and draw (uses polygon vertices) modes. Adds a CoverageZone
  // to the list, resets the draft state, and closes fullscreen if open.
  // City is optional — if empty we save the zone with a generic label.
  const handleConfirmZone = useCallback(() => {
    const city = draftCity.trim() || "Zona personalizzata";
    setIsZoneConfirmed(true);

    if (zoneMode === "draw") {
      if (drawnPolygon.length < 3) {
        Alert.alert(
          "Zona insufficiente",
          "Disegna una zona con almeno 3 punti."
        );
        return;
      }
      const polyRadiusKm = Math.max(1, Math.ceil(calcPolygonRadiusKm(drawnPolygon)));
      const polyPlan = getPlanForRadius(polyRadiusKm);
      // Centroid as the reference lat/lng for the saved zone
      const centroid = drawnPolygon.reduce(
        (acc, p) => ({
          lat: acc.lat + p.latitude / drawnPolygon.length,
          lng: acc.lng + p.longitude / drawnPolygon.length,
        }),
        { lat: 0, lng: 0 }
      );
      const newZone: CoverageZone = {
        id: `${Date.now()}`,
        city,
        radiusKm: polyRadiusKm,
        plan: polyPlan,
        lat: centroid.lat,
        lng: centroid.lng,
        polygon: drawnPolygon,
      };
      setCoverageZones((prev) => [...prev, newZone]);
      // Keep the drawn polygon visible on the map after confirmation —
      // the user can press "Cancella zona" or "Ridisegna" to start over.
    } else {
      // Circle mode
      const newZone: CoverageZone = {
        id: `${Date.now()}`,
        city,
        radiusKm: draftRadiusKm,
        plan: draftPlan,
        lat: centerCoords.latitude,
        lng: centerCoords.longitude,
      };
      setCoverageZones((prev) => [...prev, newZone]);
      // Keep the circle visible after confirmation.
    }

    if (fullscreenVisible) {
      setFullscreenVisible(false);
      setIsDrawingActive(false);
      screenPointsRef.current = [];
      setLiveSvgPath("");
    }
  }, [
    zoneMode,
    drawnPolygon,
    draftCity,
    draftRadiusKm,
    draftPlan,
    centerCoords,
    fullscreenVisible,
  ]);

  const handleSwitchToCircle = useCallback(() => {
    setZoneMode("circle");
    setDrawnPolygon([]);
    setIsZoneConfirmed(false);
  }, []);

  const handleSwitchToDraw = useCallback(() => {
    setZoneMode("draw");
    setDrawnPolygon([]);
    setIsDrawingActive(false);
    setHasDrawnOnce(false);
    screenPointsRef.current = [];
    setLiveSvgPath("");
    setIsZoneConfirmed(false);
  }, []);

  const handleOverlayTouchStart = useCallback(
    (e: { nativeEvent: { locationX: number; locationY: number } }) => {
      // Hard-lock the parent ScrollView synchronously via native props so
      // the page does NOT scroll while the user is drawing the polygon.
      scrollViewRef.current?.setNativeProps({ scrollEnabled: false });
      // Reset the double-fire guard for this new stroke (BUG 5 fix).
      touchEndCalledRef.current = false;
      const { locationX, locationY } = e.nativeEvent;
      screenPointsRef.current = [{ x: locationX, y: locationY }];
      setLiveSvgPath(buildSvgPathFromPoints(screenPointsRef.current));
    },
    []
  );

  const handleOverlayTouchMove = useCallback(
    (e: { nativeEvent: { locationX: number; locationY: number } }) => {
      const { locationX, locationY } = e.nativeEvent;
      const next = { x: locationX, y: locationY };
      const buf = screenPointsRef.current;
      // Skip points too close to the previous one (reduces noise + cost).
      const last = buf[buf.length - 1];
      if (last && distSq(last, next) < 4) return; // ~2px threshold
      buf.push(next);
      setLiveSvgPath(buildSvgPathFromPoints(buf));
    },
    []
  );

  const handleOverlayTouchEnd = useCallback(async () => {
    // Guard against double-fire from .onEnd + .onFinalize (BUG 5 fix).
    if (touchEndCalledRef.current) return;
    touchEndCalledRef.current = true;
    // Re-enable parent ScrollView native scroll on release.
    scrollViewRef.current?.setNativeProps({ scrollEnabled: true });
    // Snapshot the points immediately (BUG 4 fix): copy before any async
    // await so a concurrent handleOverlayTouchStart cannot mutate the ref
    // while Promise.all is running.
    const raw = [...screenPointsRef.current];
    if (raw.length < 3) {
      Alert.alert("Zona troppo piccola", "Disegna una zona più grande.");
      screenPointsRef.current = [];
      setLiveSvgPath("");
      return;
    }
    // Simplify in screen-space: keep at most DRAW_MAX_POINTS vertices.
    let sampled: Array<{ x: number; y: number }>;
    if (raw.length <= DRAW_MAX_POINTS) {
      sampled = raw;
    } else {
      const step = raw.length / DRAW_MAX_POINTS;
      sampled = Array.from({ length: DRAW_MAX_POINTS }, (_, i) =>
        raw[Math.round(i * step)]
      );
    }
    // Batch convert ALL screen points → LatLng in parallel.
    // Ordering is preserved because we await Promise.all on an indexed array.
    const ref = fullscreenVisible ? mapRefFullscreen.current : mapRef.current;
    if (!ref) {
      screenPointsRef.current = [];
      setLiveSvgPath("");
      return;
    }
    const coords = await Promise.all(
      sampled.map((p) =>
        ref.coordinateForPoint({ x: p.x, y: p.y }).catch(() => null)
      )
    );
    const valid = coords.filter((c): c is LatLng => c !== null);
    if (valid.length < 3) {
      Alert.alert("Errore", "Non sono riuscito a calcolare la zona. Riprova.");
      screenPointsRef.current = [];
      setLiveSvgPath("");
      return;
    }
    // Smooth the polygon with 2 Chaikin iterations → soft, fluid curve.
    const smoothed = chaikinSmoothLatLng(valid, 2);
    setDrawnPolygon(smoothed);
    setIsDrawingActive(false);
    setHasDrawnOnce(true);
    screenPointsRef.current = [];
    setLiveSvgPath("");

    // Auto-fill the city field by reverse-geocoding the polygon centroid.
    const centroid = smoothed.reduce(
      (acc, p) => ({
        latitude: acc.latitude + p.latitude / smoothed.length,
        longitude: acc.longitude + p.longitude / smoothed.length,
      }),
      { latitude: 0, longitude: 0 }
    );
    Location.reverseGeocodeAsync(centroid)
      .then((results) => {
        if (results.length > 0) {
          const r = results[0];
          const name = r.city || r.subregion || r.region || "";
          if (name) setDraftCity(name);
        }
      })
      .catch(() => {});
  }, [fullscreenVisible]);

  // ── Pan gesture for the freeform drawing overlay ──
  // Uses gesture-handler so the parent ScrollView (also from gesture-handler)
  // automatically yields the vertical pan to this child gesture, preventing
  // the page from scrolling while the user is tracing a polygon.
  const drawPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .maxPointers(1)
        .shouldCancelWhenOutside(false)
        .onBegin((e) => {
          handleOverlayTouchStart({
            nativeEvent: { locationX: e.x, locationY: e.y },
          });
        })
        .onUpdate((e) => {
          handleOverlayTouchMove({
            nativeEvent: { locationX: e.x, locationY: e.y },
          });
        })
        .onEnd(() => {
          handleOverlayTouchEnd();
        })
        .onFinalize(() => {
          handleOverlayTouchEnd();
        }),
    [handleOverlayTouchStart, handleOverlayTouchMove, handleOverlayTouchEnd]
  );

  const handleStartDrawing = useCallback(() => {
    setDrawnPolygon([]);
    screenPointsRef.current = [];
    setLiveSvgPath("");
    setIsDrawingActive(true);
    setHasDrawnOnce(false);
    setIsZoneConfirmed(false);
  }, []);

  const handleRedraw = useCallback(() => {
    setDrawnPolygon([]);
    screenPointsRef.current = [];
    setLiveSvgPath("");
    setIsDrawingActive(true);
    setHasDrawnOnce(false);
    setIsZoneConfirmed(false);
  }, []);

  // Fullscreen modal — always opens with the map FREE (no active drawing).
  // The user can pan/zoom or switch mode before deciding to draw.
  const handleOpenFullscreen = useCallback(() => {
    setIsDrawingActive(false);
    screenPointsRef.current = [];
    setLiveSvgPath("");
    setFullscreenVisible(true);
  }, []);
  const handleCloseFullscreen = useCallback(() => {
    setIsDrawingActive(false);
    screenPointsRef.current = [];
    setLiveSvgPath("");
    setFullscreenVisible(false);
  }, []);

  // Handlers
  const handleBack = useCallback(() => router.back(), [router]);

  const handleToggleService = useCallback((id: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  }, []);

  const handleToggleDay = useCallback((day: string) => {
    setDays((prev) =>
      prev.map((d) => (d.day === day ? { ...d, available: !d.available } : d))
    );
  }, []);

  const handleRadiusChange = useCallback((km: number) => {
    setDraftRadiusKm(km);
    setIsZoneConfirmed(false);
  }, []);

  // "Aggiungi zona" button is just an alias of the unified confirm flow.
  const handleAddZone = useCallback(() => {
    handleConfirmZone();
  }, [handleConfirmZone]);

  const handleDeleteZone = useCallback((id: string) => {
    setCoverageZones((prev) => prev.filter((z) => z.id !== id));
  }, []);

  // ── Cover photo upload ───────────────────────────────────────────────
  // Lets the cleaner replace the listing cover photo. Picks from the
  // device library, uploads to Supabase Storage, and persists the URL on
  // cleaner_profiles.avatar_url.
  const handleChangeCoverPhoto = useCallback(async () => {
    if (!user?.id) {
      Alert.alert(
        "Accesso richiesto",
        "Devi essere loggato per cambiare la foto."
      );
      return;
    }
    if (!ImagePicker) {
      Alert.alert(
        "Non disponibile",
        "La funzionalità foto richiede un rebuild dell'app (dev build)."
      );
      return;
    }

    // Ask which source — Camera or Library — and proceed.
    Alert.alert("Cambia foto di copertina", "Da dove vuoi prenderla?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Fotocamera",
        onPress: async () => {
          const { status } =
            await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert(
              "Permesso negato",
              "Abilita l'accesso alla fotocamera nelle impostazioni."
            );
            return;
          }
          try {
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
              cameraType: ImagePicker.CameraType.front,
            });
            await persistPickedCover(result);
          } catch (err) {
            console.warn("[camera] launchCameraAsync error", err);
            Alert.alert(
              "Fotocamera non disponibile",
              err instanceof Error ? err.message : "Prova dalla libreria."
            );
          }
        },
      },
      {
        text: "Libreria",
        onPress: async () => {
          const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") {
            Alert.alert(
              "Permesso negato",
              "Abilita l'accesso alla libreria foto nelle impostazioni."
            );
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
          });
          await persistPickedCover(result);
        },
      },
    ]);
  }, [user?.id]);

  const persistPickedCover = useCallback(
    async (result: any) => {
      if (!user?.id || !listingId) return;
      if (result?.canceled || !result?.assets?.length) return;
      const localUri = result.assets[0].uri as string;
      // Optimistic preview while the upload runs.
      setCoverUrl(localUri);
      setIsUploadingCover(true);
      try {
        const publicUrl = await uploadListingCover(
          user.id,
          listingId,
          localUri
        );
        setCoverUrl(publicUrl);
      } catch (err) {
        // Revert the optimistic preview on any failure.
        setCoverUrl((prev) => (prev === localUri ? null : prev));
        if (err instanceof ListingCoverRejectedError) {
          Alert.alert("Foto non ammessa", err.friendlyMessage);
        } else {
          const msg =
            err instanceof Error ? err.message : "Errore sconosciuto";
          Alert.alert("Errore upload foto", msg);
        }
      } finally {
        setIsUploadingCover(false);
      }
    },
    [user?.id, listingId]
  );

  // ── Active / inactive toggle ─────────────────────────────────────────
  const handleToggleActive = useCallback(
    async (next: boolean) => {
      if (!listingId) {
        Alert.alert(
          "Annuncio non caricato",
          "Riprova tra un momento."
        );
        return;
      }
      const previous = isActive;
      // Optimistic UI: flip immediately, rollback on error.
      setIsActive(next);
      try {
        await updateListing(listingId, { is_active: next });
      } catch (err) {
        setIsActive(previous);
        Alert.alert(
          "Errore",
          err instanceof Error ? err.message : "Riprova."
        );
      }
    },
    [listingId, isActive]
  );

  // ── New listing: go back to the listings hub where the user can
  // either create a new free listing (if they don't have one yet) or
  // start the paid subscription flow. Keeping the CTA for now so the
  // layout doesn't change.
  const handleAddNewListing = useCallback(() => {
    router.push("/listings");
  }, [router]);

  // Persist the coverage zone + rate to Supabase. The DB trigger
  // converts the raw inputs into a PostGIS GEOGRAPHY column used by
  // the client search.
  const handleSave = useCallback(async () => {
    if (!listingId) {
      Alert.alert(
        "Annuncio non caricato",
        "Torna alla lista annunci e riprova."
      );
      return;
    }
    if (!isZoneConfirmed) {
      Alert.alert(
        "Zona mancante",
        "Conferma prima la zona di copertura (cerchio o poligono) sulla mappa."
      );
      return;
    }

    const isCircle = zoneMode === "circle";
    const polygonPoints =
      zoneMode === "draw" && drawnPolygon.length >= 3
        ? drawnPolygon.map((p) => ({ lat: p.latitude, lng: p.longitude }))
        : null;

    const selectedServices = services.filter((s) => s.selected).map((s) => s.id);

    setIsSaving(true);
    try {
      await updateListing(listingId, {
        city: draftCity || null,
        hourly_rate: parseFloat(hourlyRate) || null,
        description: description.trim() || null,
        services: selectedServices.length > 0 ? selectedServices : null,
        coverage_mode: isCircle ? "circle" : "polygon",
        coverage_center_lat: centerCoords.latitude,
        coverage_center_lng: centerCoords.longitude,
        coverage_radius_km: isCircle ? draftRadiusKm : null,
        coverage_polygon: !isCircle ? polygonPoints : null,
      });
      Alert.alert(
        "Annuncio salvato",
        "La tua zona di copertura è stata salvata. Ora i clienti in quest'area ti vedranno nei risultati.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/listings"),
          },
        ]
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Errore sconosciuto";
      Alert.alert("Errore nel salvataggio", msg);
    } finally {
      setIsSaving(false);
    }
  }, [
    listingId,
    isZoneConfirmed,
    zoneMode,
    drawnPolygon,
    draftCity,
    centerCoords,
    draftRadiusKm,
    hourlyRate,
    description,
    services,
    router,
  ]);

  // Redirect to the listings hub if the route lacks an ?id=... query.
  // Without a listing id we have nothing to edit.
  useEffect(() => {
    if (!listingId) {
      router.replace("/listings");
    }
  }, [listingId, router]);

  // Load the listing row from Supabase on mount. Every field is
  // hydrated into the corresponding local state so the editor reflects
  // what's currently persisted.
  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    (async () => {
      try {
        const existing = await fetchListing(listingId);
        if (cancelled || !existing) return;

        if (existing.city) setDraftCity(existing.city);
        if (existing.cover_url) setCoverUrl(existing.cover_url);
        if (existing.hourly_rate != null) {
          setHourlyRate(String(existing.hourly_rate));
        }
        if (existing.description) setDescription(existing.description);
        if (existing.services && existing.services.length > 0) {
          const persisted = new Set(existing.services);
          setServices((prev) =>
            prev.map((s) => ({ ...s, selected: persisted.has(s.id) }))
          );
        }
        setIsActive(existing.is_active !== false);

        if (
          existing.coverage_mode === "circle" &&
          existing.coverage_center_lat != null &&
          existing.coverage_center_lng != null &&
          existing.coverage_radius_km != null
        ) {
          const lat = Number(existing.coverage_center_lat);
          const lng = Number(existing.coverage_center_lng);
          const radiusKm = Number(existing.coverage_radius_km);
          setZoneMode("circle");
          setCenterCoords({ latitude: lat, longitude: lng });
          setDraftRadiusKm(radiusKm);
          setIsZoneConfirmed(true);
          // Set initial map region to saved coverage center (BUG 3 fix)
          const delta = Math.max((radiusKm * 2) / 111, 0.5);
          initialMapRegionRef.current = {
            latitude: lat,
            longitude: lng,
            latitudeDelta: delta,
            longitudeDelta: delta,
          };
        } else if (
          existing.coverage_mode === "polygon" &&
          existing.coverage_polygon &&
          existing.coverage_polygon.length >= 3
        ) {
          const polygon = existing.coverage_polygon.map((p) => ({
            latitude: Number(p.lat),
            longitude: Number(p.lng),
          }));
          setZoneMode("draw");
          setDrawnPolygon(polygon);
          setHasDrawnOnce(true);
          setIsZoneConfirmed(true);
          // Center map on polygon centroid (BUG 3 fix)
          const centroid = polygon.reduce(
            (acc, p) => ({
              latitude: acc.latitude + p.latitude / polygon.length,
              longitude: acc.longitude + p.longitude / polygon.length,
            }),
            { latitude: 0, longitude: 0 }
          );
          initialMapRegionRef.current = {
            latitude: centroid.latitude,
            longitude: centroid.longitude,
            latitudeDelta: 0.3,
            longitudeDelta: 0.3,
          };
        }
      } catch {
        // Listing not found or transient error — keep defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={C.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Il mio annuncio</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isDrawingActive && !isMapTouching}
        >
          {/* ── Completion checklist ── */}
          <CompletionBanner
            items={[
              {
                key: "cover",
                done: !!coverUrl,
                label: "Foto profilo",
                hint: "Carica una foto chiara — i clienti si fidano di chi mostra la faccia",
                icon: "camera-outline",
              },
              {
                key: "rate",
                done: !!hourlyRate && parseFloat(hourlyRate) > 0,
                label: "Tariffa oraria",
                hint: "Imposta la tariffa oraria nella sezione qui sotto",
                icon: "pricetag-outline",
              },
              {
                key: "services",
                done: services.some((s) => s.selected),
                label: "Servizi offerti",
                hint: "Seleziona almeno un servizio (es. Pulizia ordinaria)",
                icon: "checkmark-circle-outline",
              },
              {
                key: "description",
                done: description.trim().length >= 30,
                label: "Descrizione (min 30 caratteri)",
                hint: "Racconta cosa ti rende speciale: esperienza, professionalità, dettagli",
                icon: "document-text-outline",
              },
              {
                key: "days",
                done: days.some((d) => d.available),
                label: "Disponibilità settimanale",
                hint: "Seleziona almeno un giorno in cui sei disponibile",
                icon: "calendar-outline",
              },
              {
                key: "zone",
                done:
                  coverageZones.length > 0 ||
                  (zoneMode === "draw" && drawnPolygon.length >= 3) ||
                  isZoneConfirmed,
                label: "Zona di copertura",
                hint: "Imposta la zona dove offri il servizio sulla mappa",
                icon: "location-outline",
              },
            ]}
          />

          {/* ── Cover image / empty state ── */}
          <View style={styles.coverContainer}>
            {coverUrl ? (
              <Image
                source={{ uri: coverUrl }}
                style={styles.coverImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.coverImage, styles.coverEmpty]}>
                <View style={styles.coverEmptyIconCircle}>
                  <Ionicons name="person-outline" size={36} color={C.primary} />
                </View>
                <Text style={styles.coverEmptyTitle}>Aggiungi un tuo selfie</Text>
                <Text style={styles.coverEmptySubtitle}>
                  I clienti si fidano di chi mostra il proprio volto.
                  Una foto chiara e sorridente raddoppia le richieste.
                </Text>
              </View>
            )}
            <View style={styles.coverOverlay}>
              <StatusBadge status={isActive ? "active" : "paused"} />
              <Pressable
                style={styles.coverEditBtn}
                onPress={handleChangeCoverPhoto}
                disabled={isUploadingCover}
              >
                <Ionicons
                  name={
                    isUploadingCover
                      ? "sync-outline"
                      : coverUrl
                        ? "camera-outline"
                        : "add-circle-outline"
                  }
                  size={16}
                  color={C.surface}
                />
                <Text style={styles.coverEditText}>
                  {isUploadingCover
                    ? "Verifica…"
                    : coverUrl
                      ? "Cambia foto"
                      : "Carica foto"}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ── Prezzo base ── */}
          <View style={styles.card}>
            <SectionLabel>Tariffa oraria</SectionLabel>
            <PriceSlider
              priceEur={Math.min(
                PRICE_MAX,
                Math.max(PRICE_MIN, parseInt(hourlyRate, 10) || 25)
              )}
              onPriceChange={(v) => setHourlyRate(String(v))}
            />
            <Text style={[styles.priceHint, { marginTop: 4, alignSelf: "center" }]}>
              Media zona: €22–€30
            </Text>

            {/* Active / inactive switch */}
            <View style={styles.activeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeLabel}>
                  {isActive ? "Annuncio attivo" : "Annuncio in pausa"}
                </Text>
                <Text style={styles.activeHint}>
                  {isActive
                    ? "I clienti nella tua zona possono vederti e contattarti"
                    : "Il tuo annuncio è nascosto ai clienti"}
                </Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={handleToggleActive}
                trackColor={{ false: "#cfd6d4", true: C.secondary }}
                thumbColor={C.surface}
                ios_backgroundColor="#cfd6d4"
              />
            </View>
          </View>


          {/* ── Servizi offerti ── */}
          <View style={styles.card}>
            <SectionLabel>Servizi offerti</SectionLabel>
            <Text style={styles.cardSubtext}>
              Seleziona i servizi che offri ai clienti
            </Text>
            <View style={styles.chipRow}>
              {services.map((s) => (
                <ServiceChip key={s.id} tag={s} onToggle={handleToggleService} />
              ))}
            </View>
          </View>

          {/* ── Descrizione ── */}
          <View style={styles.card}>
            <SectionLabel>Descrizione</SectionLabel>
            <Text style={styles.cardSubtext}>
              Racconta ai clienti cosa ti rende speciale
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              style={styles.textArea}
              placeholderTextColor={`${C.outline}80`}
              placeholder="Descrivi il tuo servizio..."
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/500</Text>
          </View>

          {/* ── Disponibilità ── */}
          <View style={styles.card}>
            <SectionLabel>Disponibilità settimanale</SectionLabel>
            <Text style={styles.cardSubtext}>
              Seleziona i giorni in cui sei disponibile
            </Text>
            <View style={styles.daysRow}>
              {days.map((d) => (
                <DayPill key={d.day} day={d} onToggle={handleToggleDay} />
              ))}
            </View>
          </View>

          {/* ── Zone di copertura ── */}
          <View style={styles.card}>
            <SectionLabel>Zone di copertura</SectionLabel>
            <Text style={styles.cardSubtext}>
              Configura le aree in cui operi e il piano associato
            </Text>

            {/* Città base */}
            <Text style={styles.zoneFieldLabel}>Città base</Text>
            <TextInput
              value={draftCity}
              onChangeText={setDraftCity}
              placeholder="Es. Roma, Milano, Napoli..."
              placeholderTextColor={`${C.outline}80`}
              style={styles.addZoneInput}
              returnKeyType="search"
              onSubmitEditing={() => geocodeCity(draftCity)}
            />

            {/* Toggle modalità zona */}
            <View style={styles.zoneModeToggleRow}>
              <Pressable
                onPress={handleSwitchToCircle}
                style={[
                  styles.zoneModeButton,
                  styles.zoneModeButtonLeft,
                  zoneMode === "circle" && styles.zoneModeButtonActive,
                ]}
              >
                <Ionicons
                  name="radio-button-on-outline"
                  size={16}
                  color={zoneMode === "circle" ? C.surface : C.onSurfaceVariant}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.zoneModeButtonText,
                    zoneMode === "circle" && styles.zoneModeButtonTextActive,
                  ]}
                >
                  Cerchio
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSwitchToDraw}
                style={[
                  styles.zoneModeButton,
                  styles.zoneModeButtonRight,
                  zoneMode === "draw" && styles.zoneModeButtonActive,
                ]}
              >
                <Ionicons
                  name="pencil-outline"
                  size={16}
                  color={zoneMode === "draw" ? C.surface : C.onSurfaceVariant}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.zoneModeButtonText,
                    zoneMode === "draw" && styles.zoneModeButtonTextActive,
                  ]}
                >
                  Disegna zona
                </Text>
              </Pressable>
            </View>

            {/* Mappa con cerchio o poligono.
                onTouch* bubble up from MapView/overlays and (a) disable the
                parent ScrollView so vertical pan/drag stays on the map and
                so that vertical pan/drag stays on the map. */}
            <View
              style={styles.mapContainer}
              onLayout={handleMapContainerLayout}
              onTouchStart={handleMapContainerTouchStart}
              onTouchEnd={handleMapContainerTouchEnd}
              onTouchCancel={handleMapContainerTouchEnd}
            >
              {/* GestureDetector wraps the MapView so the circle-drag
                  PanGesture can hit-test BEFORE the native MapView gestures.
                  If the touch lands inside the circle the gesture activates
                  and drags the circle; otherwise it fails and the touch
                  falls through to the native MapView (pan/pinch keep working). */}
              <GestureDetector gesture={circleDragGestureInline}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  initialRegion={initialMapRegion}
                  showsUserLocation
                  scrollEnabled={!isDrawingActive && !isDraggingCircle}
                  zoomEnabled={!isDrawingActive && !isDraggingCircle}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  onPress={isDrawingActive ? undefined : handleMapPress}
                  onRegionChange={handleRegionChange}
                  onRegionChangeComplete={handleRegionChangeComplete}
                >
                  {zoneMode === "circle" && !dragOverlayMounted && (
                    <Circle
                      center={{
                        latitude: centerCoords.latitude,
                        longitude: centerCoords.longitude,
                      }}
                      radius={kmToMeters(draftRadiusKm)}
                      fillColor={MAP_CIRCLE_FILL}
                      strokeColor={MAP_CIRCLE_STROKE}
                      strokeWidth={2}
                    />
                  )}
                  {zoneMode === "draw" && !isDrawingActive && drawnPolygon.length >= 3 && (
                    <Polygon
                      coordinates={drawnPolygon}
                      fillColor="#006b5530"
                      strokeColor="#006b55"
                      strokeWidth={2}
                    />
                  )}
                  {/* Green clear-zone marker anchored to the rightmost
                      vertex of the confirmed polygon. Being a Marker,
                      it follows the map natively on pan/zoom. */}
                  {polygonClearMarkerCoord && (
                    <Marker
                      coordinate={polygonClearMarkerCoord}
                      anchor={{ x: 0.5, y: 0.5 }}
                      onPress={handleResetConfirmedZone}
                      tracksViewChanges={false}
                    >
                      <View style={styles.markerClearCircle}>
                        <Ionicons name="close" size={18} color={C.surface} />
                      </View>
                    </Marker>
                  )}
                </MapView>
              </GestureDetector>

              {/* Ghost circle overlay shown during drag — pure JS Animated
                  view, no bridge calls per move = zero lag. */}
              {dragOverlayMounted && (
                <Animated.View
                  pointerEvents="none"
                  style={[styles.dragGhostCircle, dragOverlayAnimStyle]}
                />
              )}

              {/* Freeform drawing overlay — active only when isDrawingActive.
                  Wrapped in a gesture-handler PanGesture so the parent
                  ScrollView (also from gesture-handler) yields the vertical
                  pan to this child gesture, preventing page scroll while
                  the user is tracing. */}
              {zoneMode === "draw" && isDrawingActive && (
                <GestureDetector gesture={drawPanGesture}>
                <View
                  style={styles.drawOverlay}
                >
                  <Svg
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  >
                    {liveSvgPath ? (
                      <SvgPath
                        d={liveSvgPath}
                        stroke="#006b55"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="rgba(0, 107, 85, 0.18)"
                      />
                    ) : null}
                  </Svg>
                  {liveSvgPath === "" && (
                    <View style={styles.drawOverlayHint} pointerEvents="none">
                      <Ionicons name="pencil" size={14} color={C.surface} style={{ marginRight: 5 }} />
                      <Text style={styles.drawOverlayHintText}>Trascina per disegnare</Text>
                    </View>
                  )}
                </View>
                </GestureDetector>
              )}

              {/* Expand button (top-right) */}
              <Pressable
                onPress={handleOpenFullscreen}
                style={styles.mapExpandButton}
                hitSlop={8}
              >
                <Ionicons name="expand-outline" size={18} color={C.onSurface} />
              </Pressable>

              {/* Locate-user button (bottom-right of inline map) */}
              <Pressable
                onPress={handleLocateUser}
                style={styles.mapLocateButton}
                hitSlop={8}
              >
                <Ionicons name="navigate" size={18} color={C.secondary} />
              </Pressable>


              {/* Confirm button inside map — circle mode, hidden after confirm */}
              {zoneMode === "circle" && !isZoneConfirmed && (
                <View style={styles.mapDrawActionsRow} pointerEvents="box-none">
                  <Pressable
                    onPress={handleConfirmZone}
                    style={styles.mapDrawTriggerButton}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={C.surface}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.mapDrawTriggerText}>Conferma</Text>
                  </Pressable>
                </View>
              )}

              {/* Draw action buttons inside map — draw mode only, hidden after confirm */}
              {zoneMode === "draw" && !isDrawingActive && !isZoneConfirmed && (
                <View style={styles.mapDrawActionsRow} pointerEvents="box-none">
                  {drawnPolygon.length >= 3 ? (
                    <>
                      <Pressable
                        onPress={handleRedraw}
                        style={styles.mapDrawRedrawButton}
                      >
                        <Ionicons
                          name="refresh-outline"
                          size={15}
                          color={C.secondary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.mapDrawRedrawText}>Ridisegna</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleConfirmZone}
                        style={styles.mapDrawTriggerButton}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={C.surface}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.mapDrawTriggerText}>Conferma</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      onPress={handleStartDrawing}
                      style={styles.mapDrawTriggerButton}
                    >
                      <Ionicons
                        name="pencil-outline"
                        size={15}
                        color={C.surface}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.mapDrawTriggerText}>
                        Inizia a disegnare
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            {/* Slider raggio — visibile solo in modalità cerchio */}
            {zoneMode === "circle" && (
              <RadiusSlider
                radiusKm={draftRadiusKm}
                onRadiusChange={handleRadiusChange}
              />
            )}

            {/* Riepilogo km della zona disegnata */}
            {zoneMode === "draw" && drawnPolygon.length >= 3 && (
              <View style={styles.zoneKmSummary}>
                <Ionicons
                  name="resize-outline"
                  size={15}
                  color={C.secondary}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.zoneKmSummaryText}>
                  {calcPolygonAreaKm2(drawnPolygon).toFixed(1)} km² · raggio{" "}
                  {calcPolygonRadiusKm(drawnPolygon).toFixed(1)} km · max{" "}
                  {calcPolygonMaxReachKm(drawnPolygon).toFixed(1)} km
                </Text>
              </View>
            )}

            {/* Piano attivo */}
            <PlanBadge plan={draftPlan} />

            {/* Piani di riferimento */}
            <View style={styles.planTableContainer}>
              {COVERAGE_PLANS.map((p) => {
                const isActive = draftPlan.name === p.name;
                return (
                  <View
                    key={p.name}
                    style={[styles.planTableRow, isActive && styles.planTableRowActive]}
                  >
                    <View style={styles.planTableLeft}>
                      <Text
                        style={[
                          styles.planTableName,
                          isActive && styles.planTableNameActive,
                        ]}
                      >
                        {p.name}
                      </Text>
                      <Text style={styles.planTableRange}>
                        {p.minKm}–{p.maxKm} km
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.planTablePrice,
                        isActive && styles.planTablePriceActive,
                      ]}
                    >
                      {p.priceLabel}
                    </Text>
                  </View>
                );
              })}
            </View>

          </View>

          {/* ── Save button ── */}
          <View style={[styles.saveButton, isSaving && { opacity: 0.6 }]}>
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel={isSaving ? "Caricamento in corso" : "Conferma e carica annuncio"}
            />
            <Ionicons
              name={isSaving ? "sync-outline" : "checkmark-circle-outline"}
              size={20}
              color="#ffffff"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.saveButtonText}>
              {isSaving ? "Caricamento…" : "Conferma e carica"}
            </Text>
          </View>

          {/* ── Delete listing ── */}
          <Pressable
            onPress={() => {
              if (!listingId) return;
              Alert.alert(
                "Elimina annuncio",
                "Sei sicuro di voler eliminare questo annuncio? L'azione non può essere annullata.",
                [
                  { text: "Annulla", style: "cancel" },
                  {
                    text: "Elimina",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        const { deleteListing } = await import("../../lib/api");
                        await deleteListing(listingId);
                        Alert.alert(
                          "Annuncio eliminato",
                          "L'annuncio è stato rimosso.",
                          [{ text: "OK", onPress: () => router.replace("/listings") }]
                        );
                      } catch (err) {
                        Alert.alert(
                          "Errore",
                          err instanceof Error ? err.message : "Impossibile eliminare."
                        );
                      }
                    },
                  },
                ]
              );
            }}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                alignSelf: "center",
                gap: 10,
                marginTop: 24,
                marginBottom: 8,
                paddingVertical: 16,
                paddingHorizontal: 40,
                borderRadius: 16,
                backgroundColor: "#fde7e7",
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="trash-outline" size={20} color="#b3261e" />
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#b3261e" }}>
              Elimina annuncio
            </Text>
          </Pressable>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Fullscreen map modal ── */}
      <Modal
        visible={fullscreenVisible}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={handleCloseFullscreen}
      >
        <StatusBar barStyle="light-content" backgroundColor={C.primary} />
        <View style={styles.fullscreenContainer}>
          <GestureDetector gesture={circleDragGestureFullscreen}>
            <MapView
              ref={mapRefFullscreen}
              style={styles.fullscreenMap}
              initialRegion={initialMapRegion}
              showsUserLocation
              scrollEnabled={!isDrawingActive && !isDraggingCircle}
              zoomEnabled={!isDrawingActive && !isDraggingCircle}
              rotateEnabled={false}
              pitchEnabled={false}
              onPress={isDrawingActive ? undefined : handleMapPress}
              onRegionChangeComplete={handleRegionChangeComplete}
            >
              {zoneMode === "circle" && !dragOverlayMounted && (
                <Circle
                  center={{
                    latitude: centerCoords.latitude,
                    longitude: centerCoords.longitude,
                  }}
                  radius={kmToMeters(draftRadiusKm)}
                  fillColor={MAP_CIRCLE_FILL}
                  strokeColor={MAP_CIRCLE_STROKE}
                  strokeWidth={2}
                />
              )}
              {zoneMode === "draw" && !isDrawingActive && drawnPolygon.length >= 3 && (
                <Polygon
                  coordinates={drawnPolygon}
                  fillColor="#006b5530"
                  strokeColor="#006b55"
                  strokeWidth={2}
                />
              )}
              {polygonClearMarkerCoord && (
                <Marker
                  coordinate={polygonClearMarkerCoord}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={handleResetConfirmedZone}
                  tracksViewChanges={false}
                >
                  <View style={styles.markerClearCircle}>
                    <Ionicons name="close" size={18} color={C.surface} />
                  </View>
                </Marker>
              )}
            </MapView>
          </GestureDetector>

          {/* Ghost circle overlay in fullscreen during drag */}
          {dragOverlayMounted && (
            <Animated.View
              pointerEvents="none"
              style={[styles.dragGhostCircle, dragOverlayAnimStyle]}
            />
          )}

          {/* Freeform drawing overlay in fullscreen */}
          {zoneMode === "draw" && isDrawingActive && (
            <GestureDetector gesture={drawPanGesture}>
            <View
              style={styles.drawOverlay}
            >
              <Svg
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              >
                {liveSvgPath ? (
                  <SvgPath
                    d={liveSvgPath}
                    stroke="#006b55"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="rgba(0, 107, 85, 0.18)"
                  />
                ) : null}
              </Svg>
              {liveSvgPath === "" && (
                <View style={styles.drawOverlayHint} pointerEvents="none">
                  <Ionicons name="pencil" size={14} color={C.surface} style={{ marginRight: 5 }} />
                  <Text style={styles.drawOverlayHintText}>Trascina per disegnare</Text>
                </View>
              )}
            </View>
            </GestureDetector>
          )}

          {/* Close button — top-left */}
          <Pressable
            onPress={handleCloseFullscreen}
            style={styles.fullscreenCloseButton}
            hitSlop={8}
          >
            <Ionicons name="close" size={22} color={C.onSurface} />
          </Pressable>

          {/* Address search bar with autocomplete (Nominatim / OSM) */}
          <View style={styles.fullscreenSearchContainer} pointerEvents="box-none">
            <View style={styles.fullscreenSearchBar}>
              <Ionicons
                name="search"
                size={16}
                color={C.onSurfaceVariant}
                style={{ marginRight: 8 }}
              />
              <TextInput
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder="Cerca città, via, indirizzo…"
                placeholderTextColor={C.outline}
                style={styles.fullscreenSearchInput}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={18} color={C.outline} />
                </Pressable>
              )}
            </View>
            {(searchResults.length > 0 || isSearching) && (
              <View style={styles.fullscreenSearchDropdown}>
                {isSearching && searchResults.length === 0 && (
                  <Text style={styles.fullscreenSearchEmpty}>Ricerca…</Text>
                )}
                {searchResults.map((r, idx) => (
                  <Pressable
                    key={r.placeId}
                    onPress={() => handleSelectSearchResult(r)}
                    style={({ pressed }) => [
                      styles.fullscreenSearchRow,
                      idx > 0 && styles.fullscreenSearchRowBorder,
                      pressed && { backgroundColor: C.surfaceLow },
                    ]}
                  >
                    <View style={styles.fullscreenSearchIconCircle}>
                      <Ionicons
                        name={r.iconName}
                        size={18}
                        color={C.secondary}
                      />
                    </View>
                    <View style={styles.fullscreenSearchTextCol}>
                      <Text
                        style={styles.fullscreenSearchRowTitle}
                        numberOfLines={1}
                      >
                        {r.title}
                      </Text>
                      {r.subtitle ? (
                        <Text
                          style={styles.fullscreenSearchRowSubtitle}
                          numberOfLines={1}
                        >
                          {r.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name="arrow-up-outline"
                      size={16}
                      color={C.outline}
                      style={styles.fullscreenSearchRowArrow}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Locate-user button — bottom-right of fullscreen map */}
          <Pressable
            onPress={handleLocateUser}
            style={styles.fullscreenLocateButton}
            hitSlop={8}
          >
            <Ionicons name="navigate" size={20} color={C.secondary} />
          </Pressable>


          {/* Mode toggle Cerchio/Disegna — hidden while search dropdown is
              open so the city suggestions remain fully visible */}
          {!isDrawingActive && searchResults.length === 0 && !isSearching && (
            <View style={styles.fullscreenModeToggle} pointerEvents="box-none">
              <Pressable
                onPress={handleSwitchToCircle}
                style={[
                  styles.fullscreenModeButton,
                  zoneMode === "circle" && styles.fullscreenModeButtonActive,
                ]}
              >
                <Ionicons
                  name="ellipse-outline"
                  size={15}
                  color={zoneMode === "circle" ? C.surface : C.onSurfaceVariant}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.fullscreenModeButtonText,
                    zoneMode === "circle" && styles.fullscreenModeButtonTextActive,
                  ]}
                >
                  Cerchio
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSwitchToDraw}
                style={[
                  styles.fullscreenModeButton,
                  zoneMode === "draw" && styles.fullscreenModeButtonActive,
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={15}
                  color={zoneMode === "draw" ? C.surface : C.onSurfaceVariant}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.fullscreenModeButtonText,
                    zoneMode === "draw" && styles.fullscreenModeButtonTextActive,
                  ]}
                >
                  Disegna zona
                </Text>
              </Pressable>
            </View>
          )}

          {/* Radius slider in fullscreen — circle mode only */}
          {zoneMode === "circle" && (
            <View style={styles.fullscreenSliderContainer} pointerEvents="box-none">
              <RadiusSlider
                radiusKm={draftRadiusKm}
                onRadiusChange={handleRadiusChange}
              />
            </View>
          )}

          {/* Confirm button in fullscreen — circle mode */}
          {zoneMode === "circle" && !isDrawingActive && (
            <View style={styles.fullscreenDrawActionsRow} pointerEvents="box-none">
              <Pressable
                onPress={handleConfirmZone}
                style={styles.fullscreenDrawTrigger}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={C.surface}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.mapDrawTriggerText}>Conferma zona</Text>
              </Pressable>
            </View>
          )}

          {/* Draw action buttons in fullscreen — draw mode only */}
          {zoneMode === "draw" && !isDrawingActive && (
            <View style={styles.fullscreenDrawActionsRow} pointerEvents="box-none">
              {drawnPolygon.length >= 3 ? (
                <>
                  <Pressable
                    onPress={handleRedraw}
                    style={styles.mapDrawRedrawButton}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={15}
                      color={C.secondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.mapDrawRedrawText}>Ridisegna</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      handleConfirmZone();
                      handleCloseFullscreen();
                    }}
                    style={styles.fullscreenDrawTrigger}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={C.surface}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.mapDrawTriggerText}>Conferma</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={handleStartDrawing}
                  style={styles.fullscreenDrawTrigger}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={15}
                    color={C.surface}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.mapDrawTriggerText}>
                    Inizia a disegnare
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const THUMB_SIZE = 24;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.background,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.background,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontStyle: "italic",
    color: C.onSurface,
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 38,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },

  // Cover
  coverContainer: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 14,
    height: 200,
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverEmpty: {
    backgroundColor: C.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
  },
  coverEmptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(2,36,32,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverEmptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.onSurface,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  coverEmptySubtitle: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,36,32,0.35)",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    padding: 16,
  },
  coverEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  coverEditText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.surface,
  },

  // Status badge
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: C.outline,
    marginBottom: 10,
  },
  cardSubtext: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    marginTop: -4,
    marginBottom: 14,
  },

  // Price
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceLow,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    gap: 4,
    flex: 1,
    marginRight: 12,
  },
  priceCurrency: {
    fontSize: 22,
    fontWeight: "700",
    color: C.primary,
  },
  priceInput: {
    fontSize: 28,
    fontWeight: "700",
    color: C.onSurface,
    flex: 1,
    padding: 0,
  },
  priceUnit: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    fontWeight: "500",
  },
  priceHint: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    flex: 1,
    textAlign: "right",
  },

  // Active / inactive switch row
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5ece9",
    gap: 12,
  },
  activeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: C.onSurface,
  },
  activeHint: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 16,
  },

  // "Crea un nuovo annuncio" CTA card
  newListingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    gap: 14,
    borderWidth: 1.5,
    borderColor: "#006b5530",
    borderStyle: "dashed",
  },
  newListingIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#006b5515",
    alignItems: "center",
    justifyContent: "center",
  },
  newListingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.onSurface,
    lineHeight: 19,
  },
  newListingSubtitle: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    lineHeight: 16,
    marginTop: 2,
  },
  newListingPriceBadge: {
    backgroundColor: C.secondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  newListingPriceText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.surface,
  },

  // Chips
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.surfaceLow,
    borderWidth: 1,
    borderColor: C.outlineVariant,
  },
  chipSelected: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: C.onSurfaceVariant,
  },
  chipTextSelected: {
    color: C.surface,
    fontWeight: "600",
  },

  // Text area
  textArea: {
    backgroundColor: C.surfaceLow,
    borderRadius: 14,
    padding: 16,
    fontSize: 14,
    color: C.onSurface,
    minHeight: 120,
    lineHeight: 21,
  },
  charCount: {
    marginTop: 8,
    fontSize: 11,
    color: C.outline,
    textAlign: "right",
  },

  // Days
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  dayPill: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.outlineVariant,
  },
  dayPillActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  dayPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: C.onSurfaceVariant,
  },
  dayPillTextActive: {
    color: C.surface,
  },

  // Zone field
  zoneFieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: C.onSurfaceVariant,
    marginBottom: 8,
  },
  addZoneInput: {
    height: 48,
    backgroundColor: C.surfaceLow,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    color: C.onSurface,
    marginBottom: 14,
  },

  // Map
  mapContainer: {
    borderRadius: 14,
    overflow: "hidden",
    height: 250,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.outlineVariant,
  },
  map: {
    flex: 1,
  },

  // Slider
  sliderContainer: {
    marginBottom: 16,
  },
  sliderLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sliderLabelLeft: {
    fontSize: 11,
    color: C.outline,
    fontWeight: "500",
  },
  sliderLabelRight: {
    fontSize: 11,
    color: C.outline,
    fontWeight: "500",
  },
  sliderKmValue: {
    fontSize: 18,
    fontWeight: "800",
    color: C.secondary,
  },
  sliderTrackWrapper: {
    height: THUMB_SIZE,
    justifyContent: "center",
  },
  sliderTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.outlineVariant,
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.secondary,
  },
  sliderThumbWrapper: {
    position: "absolute",
    left: -(THUMB_SIZE / 2),
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: C.secondary,
    borderWidth: 3,
    borderColor: C.surface,
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },

  // Plan badge
  planBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    backgroundColor: C.surfaceLow,
    borderRadius: 14,
    padding: 14,
  },
  planBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  planBadgeName: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  planPriceBlock: {
    flex: 1,
  },
  planPriceLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: C.onSurface,
  },
  planPriceSub: {
    fontSize: 11,
    color: C.outline,
    marginTop: 2,
  },

  // Plan table
  planTableContainer: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.outlineVariant,
    marginBottom: 16,
  },
  planTableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.outlineVariant,
  },
  planTableRowActive: {
    backgroundColor: "#e6f4f1",
  },
  planTableLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  planTableName: {
    fontSize: 13,
    fontWeight: "600",
    color: C.onSurfaceVariant,
    minWidth: 60,
  },
  planTableNameActive: {
    color: C.secondary,
    fontWeight: "700",
  },
  planTableRange: {
    fontSize: 12,
    color: C.outline,
  },
  planTablePrice: {
    fontSize: 13,
    fontWeight: "600",
    color: C.onSurfaceVariant,
  },
  planTablePriceActive: {
    color: C.secondary,
    fontWeight: "700",
  },

  // Add zone button
  addZoneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.secondary,
    borderRadius: 14,
    height: 50,
    marginBottom: 4,
    ...Platform.select({
      ios: {
        shadowColor: C.secondary,
        shadowOpacity: 0.22,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },
  addZoneButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  addZoneButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.surface,
  },

  // Zone list
  coverageZoneList: {
    marginTop: 14,
    gap: 8,
  },
  coverageZoneListTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: C.outline,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  coverageZoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surfaceLow,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  coverageZoneLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  coverageZoneCity: {
    fontSize: 14,
    fontWeight: "600",
    color: C.onSurface,
  },
  coverageZoneMeta: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    marginTop: 2,
  },
  coverageZoneDelete: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },

  // Reviews
  reviewsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  ratingBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: C.accent,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 3,
  },
  reviewCount: {
    fontSize: 12,
    color: C.onSurfaceVariant,
  },

  // Save button — verde scuro: outer View porta layout + bg, Pressable copre
  // l'area come absoluteFill per il touch. Pattern bullet-proof su iOS.
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#022420",
    borderRadius: 16,
    height: 58,
    marginTop: 16,
    marginBottom: 12,
    marginHorizontal: 20,
    paddingHorizontal: 24,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#022420",
        shadowOpacity: 0.22,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
  },
  saveButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.2,
  },

  bottomSpacer: {
    height: 60,
  },

  // Zone mode toggle
  zoneModeToggleRow: {
    flexDirection: "row",
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.outlineVariant,
  },
  zoneModeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    backgroundColor: C.surfaceLow,
  },
  zoneModeButtonLeft: {
    borderRightWidth: 1,
    borderRightColor: C.outlineVariant,
  },
  zoneModeButtonRight: {},
  zoneModeButtonActive: {
    backgroundColor: C.secondary,
  },
  zoneModeButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.onSurfaceVariant,
  },
  zoneModeButtonTextActive: {
    color: C.surface,
  },

  // Draw mode controls
  drawControlsContainer: {
    marginBottom: 16,
    gap: 10,
  },
  drawPointCount: {
    fontSize: 13,
    fontWeight: "600",
    color: C.onSurfaceVariant,
    textAlign: "center",
    paddingVertical: 8,
    backgroundColor: C.surfaceLow,
    borderRadius: 10,
  },
  drawActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  drawActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.surfaceLow,
    borderWidth: 1,
    borderColor: C.outlineVariant,
  },
  drawActionButtonDisabled: {
    opacity: 0.45,
  },
  drawActionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.onSurfaceVariant,
  },
  drawActionButtonTextDisabled: {
    color: C.outline,
  },
  drawConfirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.secondary,
    borderRadius: 14,
    height: 50,
    ...Platform.select({
      ios: {
        shadowColor: C.secondary,
        shadowOpacity: 0.22,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },
  drawConfirmButtonDisabled: {
    backgroundColor: C.outlineVariant,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  drawConfirmButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.surface,
  },
  drawConfirmButtonTextDisabled: {
    color: C.outline,
  },

  // Drawing overlay
  drawOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 14,
  },
  drawOverlayHint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(2,36,32,0.72)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  drawOverlayHintText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.surface,
  },

  // Map action buttons (overlaid on the map card)
  mapExpandButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  fullscreenSearchContainer: {
    position: "absolute",
    top: Platform.select({ ios: 56, android: 40 }) ?? 48,
    left: 64,
    right: 16,
    // Keep dropdown above all other map overlays (mode toggle, buttons…)
    zIndex: 50,
    elevation: 50,
  },
  fullscreenSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: "#022420",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 4 },
    }),
  },
  fullscreenSearchInput: {
    flex: 1,
    fontSize: 14,
    color: C.onSurface,
    padding: 0,
  },
  fullscreenSearchDropdown: {
    marginTop: 8,
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingVertical: 2,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#022420",
        shadowOpacity: 0.1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
    }),
  },
  fullscreenSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  fullscreenSearchRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5ece9",
  },
  fullscreenSearchIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#006b5515",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenSearchTextCol: {
    flex: 1,
    justifyContent: "center",
  },
  fullscreenSearchRowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: C.onSurface,
    lineHeight: 19,
  },
  fullscreenSearchRowSubtitle: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    lineHeight: 16,
    marginTop: 1,
  },
  fullscreenSearchRowArrow: {
    marginLeft: 8,
    transform: [{ rotate: "45deg" }],
  },
  fullscreenSearchRowText: {
    flex: 1,
    fontSize: 13,
    color: C.onSurface,
    lineHeight: 18,
  },
  fullscreenSearchEmpty: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 13,
    color: C.onSurfaceVariant,
    fontStyle: "italic",
  },
  zoneKmSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#006b5512",
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  zoneKmSummaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.secondary,
    letterSpacing: 0.2,
  },
  markerClearCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.secondary,
    borderWidth: 2,
    borderColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#006b55",
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },
  mapLocateButton: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },
  fullscreenLocateButton: {
    position: "absolute",
    // Positioned ABOVE the km slider (which sits at bottom ~110 full width)
    bottom: Platform.select({ ios: 190, android: 170 }) ?? 180,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#022420",
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 5 },
    }),
  },
  mapDrawActionsRow: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  mapDrawTriggerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.secondary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: C.secondary,
        shadowOpacity: 0.28,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 4 },
    }),
  },
  mapDrawTriggerText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.surface,
  },
  mapDrawRedrawButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.secondary,
    ...Platform.select({
      ios: {
        shadowColor: "#006b55",
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  mapDrawRedrawText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.secondary,
  },

  // Fullscreen modal
  fullscreenContainer: {
    flex: 1,
    backgroundColor: C.primary,
  },
  fullscreenMap: {
    flex: 1,
  },
  fullscreenCloseButton: {
    position: "absolute",
    top: Platform.select({ ios: 56, android: 40 }) ?? 48,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },
  fullscreenDrawActionsRow: {
    position: "absolute",
    bottom: Platform.select({ ios: 48, android: 32 }) ?? 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  fullscreenDrawTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: C.secondary,
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  fullscreenModeToggle: {
    position: "absolute",
    top: Platform.select({ ios: 116, android: 100 }) ?? 108,
    left: 64,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surface,
    borderRadius: 22,
    padding: 4,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#022420",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  fullscreenModeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 18,
  },
  fullscreenModeButtonActive: {
    backgroundColor: C.secondary,
  },
  fullscreenModeButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.onSurfaceVariant,
  },
  fullscreenModeButtonTextActive: {
    color: C.surface,
  },
  // ── "Sposta cerchio" buttons ─────────────────────────────────────
  moveCircleButton: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.secondary,
    ...Platform.select({
      ios: {
        shadowColor: "#006b55",
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  moveCircleButtonActive: {
    backgroundColor: C.secondary,
    borderColor: C.secondary,
  },
  moveCircleButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.secondary,
  },
  moveCircleButtonTextActive: {
    color: C.surface,
  },
  fullscreenMoveCircleButton: {
    position: "absolute",
    top: Platform.select({ ios: 110, android: 90 }) ?? 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.secondary,
    ...Platform.select({
      ios: {
        shadowColor: "#006b55",
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 4 },
    }),
  },
  fullscreenMoveCircleButtonActive: {
    backgroundColor: C.secondary,
    borderColor: C.secondary,
  },
  fullscreenMoveCircleButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.secondary,
    letterSpacing: 0.2,
  },
  fullscreenMoveCircleButtonTextActive: {
    color: C.surface,
  },
  dragGhostCircle: {
    position: "absolute",
    left: 0,
    top: 0,
    backgroundColor: MAP_CIRCLE_FILL,
    borderColor: MAP_CIRCLE_STROKE,
    borderWidth: 2,
  },
  fullscreenLockBadge: {
    position: "absolute",
    top: Platform.select({ ios: 110, android: 90 }) ?? 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(2, 36, 32, 0.92)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#022420",
        shadowOpacity: 0.16,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },
  fullscreenLockBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.surface,
    letterSpacing: 0.2,
  },
  fullscreenSliderContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: Platform.select({ ios: 110, android: 90 }) ?? 100,
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#022420",
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },

});
```

---

### `app/cleaner/_layout.tsx`

```tsx
import { Stack } from "expo-router";

export default function CleanerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="jobs" />
      <Stack.Screen name="reviews" />
      <Stack.Screen name="profile-view" />
    </Stack>
  );
}
```

---

### `app/cleaner/[id].tsx`

```tsx
import { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchCleaner, fetchReviewsForCleaner } from "../../lib/api";
import { CleanerProfile, Review } from "../../lib/types";
import { Colors } from "../../lib/theme";

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 1) return "Oggi";
  if (diffDays < 2) return "Ieri";
  if (diffDays < 7) return `${diffDays} giorni fa`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} sett. fa`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} mesi fa`;
  return `${Math.floor(diffDays / 365)} anni fa`;
}

export default function CleanerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cleaner, setCleaner] = useState<CleanerProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [cleanerData, reviewsData] = await Promise.all([
          fetchCleaner(id),
          fetchReviewsForCleaner(id).catch(() => [] as Review[]),
        ]);
        if (!cleanerData) {
          Alert.alert("Errore", "Professionista non trovato");
          router.back();
          return;
        }
        setCleaner(cleanerData);
        setReviews(reviewsData);
      } catch {
        Alert.alert("Errore", "Impossibile caricare il profilo");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View
        style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" }}
      >
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  if (!cleaner) return null;

  const initials = cleaner.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" />

      {/* Nav bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: Colors.surface,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "700",
            color: Colors.text,
          }}
        >
          Profilo
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* Hero section */}
        <View
          style={{
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 28,
          }}
        >
          {/* Avatar — photo if available, initials fallback (BUG 7 fix) */}
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 30,
              backgroundColor: Colors.primary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 8,
              overflow: "hidden",
            }}
          >
            {cleaner.avatar_url ? (
              <Image
                source={{ uri: cleaner.avatar_url }}
                style={{ width: 96, height: 96, borderRadius: 30 }}
                resizeMode="cover"
                defaultSource={require("../../assets/icon.png")}
              />
            ) : (
              <Text
                style={{ color: Colors.accent, fontSize: 32, fontWeight: "800" }}
              >
                {initials}
              </Text>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "800",
                color: Colors.text,
                letterSpacing: -0.5,
              }}
            >
              {cleaner.full_name}
            </Text>
            {cleaner.stripe_identity_status === "verified" && (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#006b55"
                accessibilityLabel="Identità verificata da Stripe"
              />
            )}
          </View>

          {/* Rating */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Ionicons name="star" size={16} color={Colors.warning} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: Colors.text,
                marginLeft: 5,
              }}
            >
              {cleaner.avg_rating.toFixed(1)}
            </Text>
            <Text
              style={{ fontSize: 13, color: Colors.textSecondary, marginLeft: 5 }}
            >
              ({cleaner.review_count} recensioni)
            </Text>
          </View>

          {/* Location */}
          {cleaner.city && (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="location-outline" size={14} color={Colors.textTertiary} />
              <Text
                style={{
                  fontSize: 13,
                  color: Colors.textSecondary,
                  marginLeft: 4,
                }}
              >
                {cleaner.city}
              </Text>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 20,
            gap: 12,
            marginBottom: 28,
          }}
        >
          {/* Rate */}
          {cleaner.hourly_rate && (
            <View
              style={{
                flex: 1,
                backgroundColor: Colors.surface,
                borderRadius: 18,
                padding: 16,
                alignItems: "center",
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: Colors.secondary,
                  letterSpacing: -0.5,
                }}
              >
                €{cleaner.hourly_rate}
              </Text>
              <Text style={{ fontSize: 12, color: Colors.textTertiary, marginTop: 3 }}>
                all'ora
              </Text>
            </View>
          )}

          {/* Type */}
          <View
            style={{
              flex: 1,
              backgroundColor: Colors.surface,
              borderRadius: 18,
              padding: 16,
              alignItems: "center",
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Ionicons
              name={cleaner.cleaner_type === "azienda" ? "business-outline" : "person-outline"}
              size={22}
              color={Colors.textSecondary}
            />
            <Text
              style={{
                fontSize: 12,
                color: Colors.textTertiary,
                marginTop: 4,
                textTransform: "capitalize",
              }}
            >
              {cleaner.cleaner_type}
            </Text>
          </View>

          {/* Availability */}
          <View
            style={{
              flex: 1,
              backgroundColor: cleaner.is_available ? Colors.successLight : Colors.errorLight,
              borderRadius: 18,
              padding: 16,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: cleaner.is_available ? Colors.success : Colors.error,
                marginBottom: 6,
              }}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: cleaner.is_available ? Colors.success : Colors.error,
                textAlign: "center",
                lineHeight: 16,
              }}
            >
              {cleaner.is_available ? "Disponibile" : "Non disponibile"}
            </Text>
          </View>
        </View>

        {/* Bio */}
        {cleaner.bio && (
          <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: Colors.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 12,
              }}
            >
              Chi sono
            </Text>
            <View
              style={{
                backgroundColor: Colors.surface,
                borderRadius: 18,
                padding: 18,
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: Colors.textSecondary,
                  lineHeight: 22,
                }}
              >
                {cleaner.bio}
              </Text>
            </View>
          </View>
        )}

        {/* Services */}
        {cleaner.services && cleaner.services.length > 0 && (
          <View style={{ paddingHorizontal: 20 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: Colors.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 12,
              }}
            >
              Servizi offerti
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {cleaner.services.map((s) => (
                <View
                  key={s}
                  style={{
                    backgroundColor: Colors.accentLight,
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="checkmark-circle" size={14} color={Colors.secondary} />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: Colors.secondary,
                      marginLeft: 6,
                    }}
                  >
                    {s}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Reviews */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: Colors.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Recensioni
            </Text>
            {reviews.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="star" size={13} color={Colors.warning} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.text,
                    marginLeft: 4,
                  }}
                >
                  {cleaner.avg_rating.toFixed(1)}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textTertiary,
                    marginLeft: 4,
                  }}
                >
                  · {reviews.length}
                </Text>
              </View>
            )}
          </View>

          {reviews.length === 0 ? (
            <View
              style={{
                backgroundColor: Colors.surface,
                borderRadius: 18,
                padding: 22,
                alignItems: "center",
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Ionicons
                name="star-outline"
                size={28}
                color={Colors.textTertiary}
              />
              <Text
                style={{
                  fontSize: 13,
                  color: Colors.textSecondary,
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                Nessuna recensione ancora
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {reviews.map((review) => (
                <View
                  key={review.id}
                  style={{
                    backgroundColor: Colors.surface,
                    borderRadius: 18,
                    padding: 16,
                    shadowColor: Colors.primary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor: Colors.accentLight,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="person"
                        size={18}
                        color={Colors.secondary}
                      />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: Colors.text,
                        }}
                      >
                        Cliente verificato
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginTop: 2,
                        }}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Ionicons
                            key={n}
                            name={n <= review.rating ? "star" : "star-outline"}
                            size={12}
                            color={Colors.warning}
                            style={{ marginRight: 2 }}
                          />
                        ))}
                        <Text
                          style={{
                            fontSize: 11,
                            color: Colors.textTertiary,
                            marginLeft: 6,
                          }}
                        >
                          {formatReviewDate(review.created_at)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {review.comment && (
                    <Text
                      style={{
                        fontSize: 14,
                        color: Colors.textSecondary,
                        lineHeight: 20,
                      }}
                    >
                      {review.comment}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: Colors.surface,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 36,
          shadowColor: Colors.primary,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 10,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!cleaner.is_available}
          onPress={() => {
            if (!cleaner.is_available) return;
            router.push({
              pathname: "/booking/new",
              params: {
                cleanerId: cleaner.id,
                cleanerName: cleaner.full_name,
                hourlyRate: String(cleaner.hourly_rate ?? 15),
              },
            });
          }}
          style={{
            backgroundColor: cleaner.is_available ? Colors.secondary : Colors.textTertiary,
            borderRadius: 16,
            height: 56,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
          }}
        >
          <Ionicons name="calendar-outline" size={20} color="#fff" />
          <Text
            style={{
              color: "#fff",
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            {cleaner.is_available ? "Prenota ora" : "Non disponibile"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
```

---

### `app/cleaner/jobs.tsx`

```tsx
import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StatusBar,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { fetchBookings, markWorkDone } from "../../lib/api";
import {
  NotificationMessages,
  sendPushNotification,
} from "../../lib/notifications";
import { Booking } from "../../lib/types";
import { Colors } from "../../lib/theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = "#022420";
const PRIMARY_CONTAINER = "#1a3a35";
const SECONDARY = "#006b55";
const SECONDARY_CONTAINER = "#82f4d1";
const SURFACE = "#f6faf9";
const SURFACE_LOW = "#f0f4f3";
const ON_SURFACE = "#181c1c";
const ON_SURFACE_VARIANT = "#414846";
const OUTLINE = "#717976";
const OUTLINE_VARIANT = "#c1c8c5";

type FilterTab = "active" | "cancelled" | "history";

// Format an ISO date (YYYY-MM-DD) as a short Italian date.
// Returns the original string if it can't be parsed so the UI never
// shows "Invalid Date" — better to keep raw than to crash visually.
function formatItDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Job card ─────────────────────────────────────────────────────────────────

interface JobCardProps {
  booking: Booking;
  onViewDetails: (id: string) => void;
  onMarkWorkDone?: (id: string) => void;
}

function JobCard({ booking, onViewDetails, onMarkWorkDone }: JobCardProps) {
  const earnings = (booking.base_price - booking.cleaner_fee).toFixed(2);
  const hourlyRate = booking.estimated_hours > 0
    ? (booking.base_price / booking.estimated_hours).toFixed(0)
    : "—";

  const canMarkDone = booking.status === "accepted";
  const isWaitingConfirm = booking.status === "work_done";

  return (
    <View style={styles.jobCard}>
      {/* Card header */}
      <View style={styles.jobCardTop}>
        <View style={styles.jobIconWrap}>
          <Ionicons
            name={isWaitingConfirm ? "hourglass-outline" : "checkmark-circle"}
            size={22}
            color={Colors.secondary}
          />
        </View>
        <View style={styles.jobTitleBlock}>
          <Text style={styles.jobTitle} numberOfLines={1}>
            {booking.service_type}
          </Text>
          <Text style={styles.jobRate}>€{hourlyRate}/ora</Text>
        </View>
        <View style={styles.jobEarningsBadge}>
          <Text style={styles.jobEarningsText}>€{earnings}</Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.jobDetailsBlock}>
        {booking.address ? (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.detailText} numberOfLines={1}>
              {booking.address}
            </Text>
          </View>
        ) : null}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.detailText}>
            {formatItDate(booking.date)} — {booking.time_slot}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.detailText}>
            {booking.estimated_hours}h · {booking.num_rooms}{" "}
            {booking.num_rooms === 1 ? "stanza" : "stanze"}
          </Text>
        </View>
      </View>

      {isWaitingConfirm ? (
        <View
          style={[
            styles.viewDetailsBtn,
            { backgroundColor: Colors.warningLight, flexDirection: "row" },
          ]}
        >
          <Ionicons name="time-outline" size={14} color={Colors.warning} />
          <Text
            style={[
              styles.viewDetailsBtnText,
              { color: Colors.warning, marginLeft: 6 },
            ]}
          >
            In attesa di conferma cliente
          </Text>
        </View>
      ) : canMarkDone && onMarkWorkDone ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={[styles.viewDetailsBtn, { flex: 1 }]}>
            <Pressable
              onPress={() => onMarkWorkDone(booking.id)}
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 12,
                gap: 6,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={styles.viewDetailsBtnText}>Segna completato</Text>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </Pressable>
          </View>
          <Pressable
            style={({ pressed }) => [
              {
                width: 44,
                borderRadius: 12,
                backgroundColor: Colors.backgroundAlt,
                alignItems: "center",
                justifyContent: "center",
              },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => onViewDetails(booking.id)}
          >
            <Ionicons name="chatbubble-outline" size={16} color={Colors.secondary} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.viewDetailsBtn}>
          <Pressable
            onPress={() => onViewDetails(booking.id)}
            android_ripple={{ color: "rgba(255,255,255,0.18)" }}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 12,
              gap: 6,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={styles.viewDetailsBtnText}>Vedi Dettagli</Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Payment row ──────────────────────────────────────────────────────────────

interface PaymentRowProps {
  booking: Booking;
}

function PaymentRow({ booking }: PaymentRowProps) {
  const earnings = (booking.base_price - booking.cleaner_fee).toFixed(2);

  return (
    <View style={styles.paymentRow}>
      <View style={styles.paymentIconWrap}>
        <Ionicons name="cash-outline" size={18} color={Colors.secondary} />
      </View>
      <View style={styles.paymentInfo}>
        <Text style={styles.paymentService} numberOfLines={1}>
          {booking.service_type}
        </Text>
        <Text style={styles.paymentDate}>{formatItDate(booking.date)}</Text>
      </View>
      <Text style={styles.paymentAmount}>€{earnings}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CleanerJobsScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("active");

  const loadBookings = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);
      try {
        const data = await fetchBookings(user.id, "cleaner");
        setBookings(data);
      } catch {
        // Don't alert on silent reloads (focus refresh, pull-to-refresh) —
        // the user already sees the existing list and a flaky network
        // shouldn't bombard them. Only surface a hard failure on first load.
        if (!silent) {
          Alert.alert("Errore", "Impossibile caricare i lavori. Riprova trascinando verso il basso.");
          setBookings([]);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadBookings(true);
  }, [loadBookings]);

  const handleViewDetails = useCallback(
    (id: string) => {
      router.push(`/chat/${id}`);
    },
    [router]
  );

  const handleMarkWorkDone = useCallback(
    (id: string) => {
      Alert.alert(
        "Segnare come completato?",
        "Il cliente verrà notificato per confermare il lavoro e rilasciare il pagamento.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Conferma",
            style: "default",
            onPress: async () => {
              try {
                await markWorkDone(id);
                // Notify the client so they can review and release payment
                const booking = bookings.find((b) => b.id === id);
                if (booking) {
                  const { title, body } = NotificationMessages.workDone(
                    profile?.full_name ?? "Il professionista"
                  );
                  sendPushNotification(booking.client_id, title, body, {
                    screen: "bookings",
                    bookingId: id,
                  }).catch(() => {});
                }
                loadBookings();
              } catch {
                Alert.alert("Errore", "Impossibile aggiornare il lavoro");
              }
            },
          },
        ]
      );
    },
    [bookings, profile?.full_name, loadBookings]
  );

  const handleBrowseMarket = useCallback(() => {
    router.push("/(tabs)/cleaner-home");
  }, [router]);

  // Filter bookings by tab
  const activeJobs = bookings.filter((b) =>
    ["accepted", "work_done"].includes(b.status)
  );
  const cancelledJobs = bookings.filter((b) =>
    ["declined", "cancelled", "auto_cancelled"].includes(b.status)
  );
  const historyJobs = bookings.filter((b) => b.status === "completed");
  const recentPayments = bookings
    .filter((b) => b.status === "completed")
    .slice(0, 5);

  const displayedJobs =
    activeTab === "active"
      ? activeJobs
      : activeTab === "cancelled"
      ? cancelledJobs
      : historyJobs;

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: "active", label: "Attivi" },
    { id: "cancelled", label: "Annullati" },
    { id: "history", label: "Storico" },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={SECONDARY} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={SECONDARY}
            colors={[SECONDARY]}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>I miei lavori</Text>
          {/* Right slot kept as spacer to keep the title centered. The old
              calendar icon was a non-functional placeholder — re-add once
              a calendar/agenda view is actually wired. */}
          <View style={styles.calendarButton} />
        </View>

        {/* ── Motivational banner ── */}
        <View style={styles.motivationBanner}>
          <View style={styles.motivationContent}>
            <Text style={styles.motivationTitle}>Cura nei dettagli</Text>
            <Text style={styles.motivationSub}>
              {activeJobs.length === 0
                ? "Nessun incarico attivo. Sfoglia il mercato per accettarne uno nuovo."
                : activeJobs.length === 1
                ? "Hai 1 incarico in corso. Dai il massimo!"
                : `Hai ${activeJobs.length} incarichi in corso. Dai il massimo!`}
            </Text>
          </View>
          <View style={styles.motivationIllustration}>
            <Ionicons name="star" size={32} color={SECONDARY_CONTAINER} />
          </View>
        </View>

        {/* ── Filter pills ── */}
        <View style={styles.filterRow}>
          {filterTabs.map((tab) => (
            <Pressable
              key={tab.id}
              style={[
                styles.filterPill,
                activeTab === tab.id && styles.filterPillActive,
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeTab === tab.id && styles.filterPillTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Active assignments section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {activeTab === "active"
              ? "INCARICHI ATTIVI"
              : activeTab === "cancelled"
              ? "ANNULLATI"
              : "STORICO"}
          </Text>

          {displayedJobs.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons
                name={
                  activeTab === "active"
                    ? "briefcase-outline"
                    : activeTab === "cancelled"
                    ? "close-circle-outline"
                    : "archive-outline"
                }
                size={32}
                color={Colors.textTertiary}
              />
              <Text style={styles.emptySectionText}>
                {activeTab === "active"
                  ? "Nessun incarico attivo. Esplora il mercato per accettarne uno."
                  : activeTab === "cancelled"
                  ? "Nessun incarico annullato. Bene così!"
                  : "Nessun lavoro completato ancora."}
              </Text>
            </View>
          ) : (
            displayedJobs.map((booking) => (
              <JobCard
                key={booking.id}
                booking={booking}
                onViewDetails={handleViewDetails}
                onMarkWorkDone={handleMarkWorkDone}
              />
            ))
          )}
        </View>

        {/* ── Recent payments ── */}
        {recentPayments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PAGAMENTI RECENTI</Text>
            <View style={styles.paymentsCard}>
              {recentPayments.map((booking, index) => (
                <View key={booking.id}>
                  <PaymentRow booking={booking} />
                  {index < recentPayments.length - 1 && (
                    <View style={styles.paymentDivider} />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── CTA: Browse market ── */}
        <View style={styles.ctaCard}>
          <View style={styles.ctaIllustration}>
            <Ionicons name="search" size={40} color={SECONDARY_CONTAINER} />
          </View>
          <Text style={styles.ctaTitle}>Hai bisogno di più ore?</Text>
          <Text style={styles.ctaSub}>
            Esplora le richieste disponibili nella tua area
          </Text>
          <View style={styles.ctaButton}>
            <Pressable
              onPress={handleBrowseMarket}
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 14,
                paddingHorizontal: 28,
                gap: 8,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={styles.ctaButtonText}>Sfoglia il Mercato</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: PRIMARY,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  calendarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SURFACE_LOW,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Motivation banner ─────────────────────────────────────────────────────────
  motivationBanner: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: PRIMARY_CONTAINER,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  motivationContent: {
    flex: 1,
  },
  motivationTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  motivationSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 18,
  },
  motivationIllustration: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
  },

  // ── Filter pills ──────────────────────────────────────────────────────────────
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: "#fff",
  },

  // ── Section ───────────────────────────────────────────────────────────────────
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: Colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 14,
  },

  // ── Job card ──────────────────────────────────────────────────────────────────
  jobCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  jobCardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  jobIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  jobTitleBlock: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 3,
  },
  jobRate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  jobEarningsBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  jobEarningsText: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.secondary,
  },
  jobDetailsBlock: {
    gap: 6,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  detailText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  viewDetailsBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    overflow: "hidden",
  },
  viewDetailsBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },

  // ── Empty section ─────────────────────────────────────────────────────────────
  emptySection: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  emptySectionText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: "center",
  },

  // ── Payments card ─────────────────────────────────────────────────────────────
  paymentsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  paymentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentInfo: {
    flex: 1,
  },
  paymentService: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 2,
  },
  paymentDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.success,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 70,
  },

  // ── CTA card ──────────────────────────────────────────────────────────────────
  ctaCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  ctaIllustration: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SURFACE_LOW,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  ctaSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  ctaButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    overflow: "hidden",
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
```

---

### `app/cleaner/profile-view.tsx`

```tsx
import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StatusBar,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Colors } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { fetchCleaner, fetchReviewsForCleaner } from "../../lib/api";
import { CleanerProfile, Review } from "../../lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = "#022420";
const PRIMARY_CONTAINER = "#1a3a35";
const SECONDARY = "#006b55";
const SECONDARY_CONTAINER = "#82f4d1";
const SURFACE = "#f6faf9";
const SURFACE_LOW = "#f0f4f3";
const ON_SURFACE = "#181c1c";
const ON_SURFACE_VARIANT = "#414846";
const OUTLINE = "#717976";
const OUTLINE_VARIANT = "#c1c8c5";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PHOTO_HEIGHT = 340;
const GALLERY_THUMB = (SCREEN_WIDTH - 20 * 2 - 12 * 2) / 3;

// ─── Star row ─────────────────────────────────────────────────────────────────

interface StarRowProps {
  rating: number;
  reviewCount: number;
}

function StarRow({ rating, reviewCount }: StarRowProps) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={
            i <= Math.floor(rating)
              ? "star"
              : i - 0.5 <= rating
              ? "star-half"
              : "star-outline"
          }
          size={16}
          color="#006b55"
        />
      ))}
      <Text style={styles.starRatingText}>{rating}</Text>
      <Text style={styles.starCountText}>({reviewCount})</Text>
    </View>
  );
}

// ─── Service row ──────────────────────────────────────────────────────────────

interface ServiceRowProps {
  name: string;
  price: string;
  duration: string;
}

function ServiceRow({ name, price, duration }: ServiceRowProps) {
  return (
    <View style={styles.serviceRow}>
      <View style={styles.serviceIconWrap}>
        <Ionicons name="sparkles-outline" size={18} color="#022420" />
      </View>
      <View style={styles.serviceBody}>
        <Text style={styles.serviceName}>{name}</Text>
        <Text style={styles.serviceDuration}>{duration}</Text>
      </View>
      <Text style={styles.servicePrice}>{price}</Text>
    </View>
  );
}

// ─── Gallery thumbnail ────────────────────────────────────────────────────────

interface GalleryThumbProps {
  index: number;
}

function GalleryThumb({ index }: GalleryThumbProps) {
  const bgColors = ["#f0f4f3", "#ede0d4", "#f0e6da", "#fdf3ec", "#f5e6d8", "#ede0d4"];
  const bg = bgColors[index % bgColors.length];

  return (
    <View style={[styles.galleryThumb, { backgroundColor: bg }]}>
      <Ionicons name="image-outline" size={24} color="#006b55" />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const DEFAULT_SERVICE_DURATIONS: Record<string, string> = {
  "Pulizia ordinaria": "2–3 ore",
  "Pulizia profonda": "4–6 ore",
  "Stiratura": "1–2 ore",
  "Pulizia vetri": "2–4 ore",
  "Pulizia post-ristrutturazione": "6–8 ore",
  "Pulizia uffici": "3–5 ore",
  "Pulizia condominiale": "2–4 ore",
};

export default function CleanerProfileViewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();

  // If navigated with an explicit id, show that cleaner; otherwise
  // fall back to the current logged-in user's own profile.
  const targetId = id ?? user?.id;

  const [cleaner, setCleaner] = useState<CleanerProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [profile, revs] = await Promise.all([
          fetchCleaner(targetId).catch(() => null),
          fetchReviewsForCleaner(targetId).catch(() => [] as Review[]),
        ]);
        setCleaner(profile);
        setReviews(revs);
      } finally {
        setLoading(false);
      }
    })();
  }, [targetId]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleBook = useCallback(() => {
    if (id) {
      router.push(`/booking/new?cleanerId=${id}`);
    } else {
      router.push("/booking/new");
    }
  }, [router, id]);

  const handleReviews = useCallback(() => {
    router.push("/cleaner/reviews");
  }, [router]);

  const handleShare = useCallback(async () => {
    if (!cleaner) return;
    try {
      await Share.share({
        message: `Guarda il profilo di ${cleaner.full_name} su CleanHome: https://www.cleanhomeapp.com/cleaner/${cleaner.id}`,
      });
    } catch {
      // user cancelled or share unavailable — silent
    }
  }, [cleaner]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  const displayName = cleaner?.full_name ?? "Il tuo profilo";
  const displayRating = cleaner?.avg_rating ?? 0;
  const displayReviewCount = cleaner?.review_count ?? reviews.length;
  const displayBio =
    cleaner?.bio ??
    "Completa il tuo profilo aggiungendo una biografia per farti conoscere dai clienti.";
  const displayRate = cleaner?.hourly_rate ?? 25;
  const servicesList: ServiceRowProps[] =
    cleaner?.services && cleaner.services.length > 0
      ? cleaner.services.map((name) => ({
          name,
          price: `${displayRate}€/ora`,
          duration: DEFAULT_SERVICE_DURATIONS[name] ?? "Tempo variabile",
        }))
      : [
          {
            name: "Nessun servizio configurato",
            price: "—",
            duration: "Aggiungi dalle tue listings",
          },
        ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
      >
        {/* ── Hero photo area with gradient overlay ── */}
        <View style={styles.heroArea}>
          {/* Placeholder gradient photo */}
          <View style={styles.heroPhoto}>
            <View style={styles.heroPhotoGradient} />
            <Ionicons
              name="person"
              size={80}
              color="rgba(255,255,255,0.25)"
              style={styles.heroPhotoIcon}
            />
          </View>

          {/* Gradient overlay */}
          <View style={styles.heroOverlay} />

          {/* Back button */}
          <SafeAreaView style={styles.heroTopRow} edges={["top"]}>
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleBack}
              accessibilityLabel="Indietro"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.shareButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleShare}
              accessibilityLabel="Condividi profilo"
              accessibilityRole="button"
            >
              <Ionicons name="share-outline" size={20} color="#fff" />
            </Pressable>
          </SafeAreaView>

          {/* Identity block — overlaid on photo */}
          <View style={styles.heroIdentity}>
            {/* Online badge */}
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineBadgeText}>Disponibile</Text>
            </View>

            <Text style={styles.heroName}>{displayName}</Text>

            <Pressable onPress={handleReviews}>
              <StarRow rating={displayRating} reviewCount={displayReviewCount} />
            </Pressable>
          </View>
        </View>

        {/* ── Bio ── */}
        <View style={styles.bioSection}>
          <Text style={styles.bioText}>{displayBio}</Text>

          {/* Quick stats — driven by real data */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {displayRating > 0 ? displayRating.toFixed(1) : "—"}
              </Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{displayReviewCount}</Text>
              <Text style={styles.statLabel}>Recensioni</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{displayRate}€</Text>
              <Text style={styles.statLabel}>Ora</Text>
            </View>
          </View>
        </View>

        {/* ── Gallery section ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Portfolio of Perfection</Text>
            <Pressable style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <Text style={styles.sectionLink}>Vedi tutto</Text>
            </Pressable>
          </View>
          <View style={styles.galleryGrid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <GalleryThumb key={i} index={i} />
            ))}
          </View>
        </View>

        {/* ── Services ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Servizi offerti</Text>
          <View style={styles.servicesCard}>
            {servicesList.map((s, i) => (
              <View key={s.name}>
                <ServiceRow {...s} />
                {i < servicesList.length - 1 && <View style={styles.serviceDivider} />}
              </View>
            ))}
          </View>
        </View>

        {/* ── Trust badges ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verifiche</Text>
          <View style={styles.trustRow}>
            {[
              { icon: "shield-checkmark-outline" as const, label: "Identità verificata" },
              { icon: "document-text-outline" as const, label: "Documenti OK" },
              { icon: "star-outline" as const, label: "Top Cleaner" },
            ].map((badge) => (
              <View key={badge.label} style={styles.trustBadge}>
                <Ionicons name={badge.icon} size={20} color={Colors.secondary} />
                <Text style={styles.trustBadgeText}>{badge.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Reviews preview ── */}
        <Pressable
          style={({ pressed }) => [
            styles.reviewsPreviewCard,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleReviews}
        >
          <View style={styles.reviewsPreviewLeft}>
            <Text style={styles.reviewsPreviewRating}>
              {displayRating > 0 ? displayRating.toFixed(1) : "—"}
            </Text>
            <View style={styles.reviewsPreviewStars}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons
                  key={i}
                  name={i <= Math.round(displayRating) ? "star" : "star-outline"}
                  size={12}
                  color="#006b55"
                />
              ))}
            </View>
            <Text style={styles.reviewsPreviewCount}>
              {displayReviewCount === 0
                ? "Nessuna recensione"
                : `${displayReviewCount} recensioni`}
            </Text>
          </View>
          <Text style={styles.reviewsPreviewCta}>Leggi tutte le recensioni</Text>
          <Ionicons name="chevron-forward" size={18} color="#022420" />
        </Pressable>
      </ScrollView>

      {/* ── Floating Book Now button ── */}
      <View style={[styles.floatingBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.floatingBarInner}>
          <View>
            <Text style={styles.floatingRateLabel}>A partire da</Text>
            <Text style={styles.floatingRate}>{displayRate}€/ora</Text>
          </View>
          <View style={styles.bookNowBtn}>
            <Pressable
              onPress={handleBook}
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 16,
                paddingHorizontal: 28,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={styles.bookNowBtnText}>Prenota ora</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Hero area ─────────────────────────────────────────────────────────────────
  heroArea: {
    height: PHOTO_HEIGHT,
    position: "relative",
    overflow: "hidden",
  },
  heroPhoto: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1a3a35",
    alignItems: "center",
    justifyContent: "center",
  },
  heroPhotoGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#022420",
    opacity: 0.7,
  },
  heroPhotoIcon: {
    opacity: 0.4,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  heroTopRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroIdentity: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 8,
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  onlineBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  heroName: {
    fontSize: 30,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.8,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  starRatingText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginLeft: 6,
  },
  starCountText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
  },

  // ── Bio section ───────────────────────────────────────────────────────────────
  bioSection: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginTop: -16,
    borderRadius: 24,
    padding: 22,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 5,
  },
  bioTagline: {
    fontSize: 18,
    fontWeight: "700",
    fontStyle: "italic",
    color: "#022420",
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  bioText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#022420",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.borderLight,
  },

  // ── Generic section ───────────────────────────────────────────────────────────
  section: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.2,
    marginBottom: 14,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#022420",
  },

  // ── Gallery ───────────────────────────────────────────────────────────────────
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  galleryThumb: {
    width: GALLERY_THUMB,
    height: GALLERY_THUMB,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Services ──────────────────────────────────────────────────────────────────
  servicesCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  serviceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f0f4f3",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceBody: {
    flex: 1,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 2,
  },
  serviceDuration: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  servicePrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#022420",
  },
  serviceDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 70,
  },

  // ── Trust badges ──────────────────────────────────────────────────────────────
  trustRow: {
    flexDirection: "row",
    gap: 10,
  },
  trustBadge: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 7,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  trustBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 13,
  },

  // ── Reviews preview card ──────────────────────────────────────────────────────
  reviewsPreviewCard: {
    marginHorizontal: 20,
    marginTop: 28,
    backgroundColor: "#f0f4f3",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  reviewsPreviewLeft: {
    alignItems: "center",
    gap: 3,
  },
  reviewsPreviewRating: {
    fontSize: 22,
    fontWeight: "800",
    color: "#022420",
    letterSpacing: -0.5,
  },
  reviewsPreviewStars: {
    flexDirection: "row",
    gap: 2,
  },
  reviewsPreviewCount: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  reviewsPreviewCta: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#1a3a35",
  },

  // ── Floating bar ──────────────────────────────────────────────────────────────
  floatingBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    paddingTop: 16,
    paddingHorizontal: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  floatingBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  floatingRateLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  floatingRate: {
    fontSize: 22,
    fontWeight: "800",
    color: "#022420",
    letterSpacing: -0.5,
  },
  bookNowBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    overflow: "hidden",
  },
  bookNowBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.2,
  },
});
```

---

### `app/cleaner/reviews.tsx`

```tsx
import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { fetchCleaner, fetchReviewsForCleaner } from "../../lib/api";
import { CleanerProfile } from "../../lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const BROWN = "#022420";
const AMBER = "#006b55";
const WASH = "#e8fdf7";
const BROWN_DARK = "#022420";
const DARK_BG = "#022420";

type ReviewTab = "experience" | "trust";

// ─── Star rating display ──────────────────────────────────────────────────────

interface StarRatingProps {
  rating: number;
  size?: number;
  color?: string;
}

function StarRating({ rating, size = 16, color = "#00c896" }: StarRatingProps) {
  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.floor(rating) ? "star" : i - 0.5 <= rating ? "star-half" : "star-outline"}
          size={size}
          color={color}
        />
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 2 },
});

// ─── Review card ──────────────────────────────────────────────────────────────

interface ReviewCardData {
  id: string;
  clientName: string;
  clientInitials: string;
  rating: number;
  date: string;
  comment: string;
  serviceType: string;
}

interface ReviewCardProps {
  review: ReviewCardData;
}

function ReviewCard({ review }: ReviewCardProps) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewAvatar}>
          <Text style={styles.reviewAvatarText}>{review.clientInitials}</Text>
        </View>
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewClientName}>{review.clientName}</Text>
          <Text style={styles.reviewDate}>{review.date}</Text>
        </View>
        <StarRating rating={review.rating} size={14} />
      </View>
      <View style={styles.reviewServiceBadge}>
        <Text style={styles.reviewServiceText}>{review.serviceType}</Text>
      </View>
      <Text style={styles.reviewComment}>{review.comment}</Text>
    </View>
  );
}

// ─── Empty reviews placeholder ────────────────────────────────────────────────

function EmptyReviews() {
  return (
    <View style={styles.emptyReviews}>
      <View style={styles.emptyReviewsIcon}>
        <Ionicons name="chatbubble-outline" size={32} color={Colors.textTertiary} />
      </View>
      <Text style={styles.emptyReviewsTitle}>Nessuna recensione ancora</Text>
      <Text style={styles.emptyReviewsSub}>
        Le recensioni dei tuoi clienti appariranno qui dopo ogni servizio completato.
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CleanerReviewsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ReviewTab>("experience");

  const [cleaner, setCleaner] = useState<CleanerProfile | null>(null);
  const [displayedReviews, setDisplayedReviews] = useState<ReviewCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [profile, rawReviews] = await Promise.all([
          fetchCleaner(user.id).catch(() => null),
          fetchReviewsForCleaner(user.id).catch(() => []),
        ]);
        setCleaner(profile);
        setDisplayedReviews(
          rawReviews.map((r) => ({
            id: r.id,
            clientName: "Cliente verificato",
            clientInitials: "C",
            rating: r.rating,
            date: formatReviewDate(r.created_at),
            comment: r.comment ?? "",
            serviceType: "Servizio completato",
          }))
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const avgRating = cleaner?.avg_rating ?? 0;
  const reviewCount = cleaner?.review_count ?? displayedReviews.length;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: DARK_BG,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#00c896" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Dark header area ── */}
        <View style={styles.darkHeader}>
          {/* Back button */}
          <Pressable
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.6 },
            ]}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>

          {/* Avatar area */}
          <View style={styles.profileAvatarWrap}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {(cleaner?.full_name ?? "")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "?"}
              </Text>
            </View>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineBadgeText}>Online</Text>
            </View>
          </View>

          <Text style={styles.profileName}>
            {cleaner?.full_name ?? "Il tuo profilo"}
          </Text>
          <Text style={styles.profileTagline}>
            {cleaner?.city
              ? `Professionista · ${cleaner.city}`
              : "Professionista"}
          </Text>

          {/* Overall rating */}
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={20} color="#00c896" />
            <Text style={styles.ratingNumber}>
              {avgRating > 0 ? avgRating.toFixed(1) : "—"}
            </Text>
            <Text style={styles.ratingCount}>
              {reviewCount === 0
                ? "(nessuna recensione)"
                : `(${reviewCount} recensioni)`}
            </Text>
          </View>
        </View>

        {/* ── Tab pills ── */}
        <View style={styles.tabRow}>
          <Pressable
            style={[
              styles.tabPill,
              activeTab === "experience" && styles.tabPillActive,
            ]}
            onPress={() => setActiveTab("experience")}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === "experience" && styles.tabPillTextActive,
              ]}
            >
              Esperienza
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabPill,
              activeTab === "trust" && styles.tabPillActive,
            ]}
            onPress={() => setActiveTab("trust")}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === "trust" && styles.tabPillTextActive,
              ]}
            >
              Affidabilità
            </Text>
          </Pressable>
        </View>

        {/* ── Reviews section ── */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsSectionHeader}>
            <Text style={styles.reviewsSectionTitle}>Recensioni dei clienti</Text>
            <View style={styles.ratePrompt}>
              <Ionicons name="star-outline" size={14} color={BROWN} />
              <Text style={styles.ratePromptText}>Valuta la tua esperienza</Text>
            </View>
          </View>

          {/* Summary bar */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryRatingBig}>
                {avgRating > 0 ? avgRating.toFixed(1) : "—"}
              </Text>
              <StarRating rating={avgRating} size={18} />
              <Text style={styles.summaryCountText}>
                {reviewCount === 0 ? "nessuna" : `${reviewCount} recensioni`}
              </Text>
            </View>
            <View style={styles.summaryBars}>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = displayedReviews.filter(
                  (r) => Math.round(r.rating) === star
                ).length;
                const pct = reviewCount > 0 ? count / reviewCount : 0;
                return (
                  <View key={star} style={styles.barRow}>
                    <Text style={styles.barLabel}>{star}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${pct * 100}%` as `${number}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.barCount}>{count}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Review cards */}
          {displayedReviews.length === 0 ? (
            <EmptyReviews />
          ) : (
            displayedReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // ── Dark header ───────────────────────────────────────────────────────────────
  darkHeader: {
    backgroundColor: DARK_BG,
    paddingBottom: 32,
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    top: 16,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  profileAvatarWrap: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 16,
  },
  profileAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#1a3a35",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#00c896",
    marginBottom: 8,
  },
  profileAvatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  onlineBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  profileName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  profileTagline: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 16,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
  },
  ratingCount: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
  },

  // ── Tab pills ─────────────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  tabPill: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabPillActive: {
    backgroundColor: BROWN,
    borderColor: BROWN,
  },
  tabPillText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  tabPillTextActive: {
    color: "#fff",
  },

  // ── Reviews section ───────────────────────────────────────────────────────────
  reviewsSection: {
    paddingHorizontal: 20,
  },
  reviewsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  reviewsSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.2,
  },
  ratePrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: WASH,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ratePromptText: {
    fontSize: 12,
    fontWeight: "600",
    color: BROWN,
  },

  // ── Summary bar ───────────────────────────────────────────────────────────────
  summaryBar: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    gap: 20,
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  summaryLeft: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  summaryRatingBig: {
    fontSize: 36,
    fontWeight: "900",
    color: Colors.text,
    letterSpacing: -1,
  },
  summaryCountText: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  summaryBars: {
    flex: 1,
    justifyContent: "center",
    gap: 5,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  barLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    width: 10,
    textAlign: "center",
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.borderLight,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#00c896",
    borderRadius: 3,
  },
  barCount: {
    fontSize: 11,
    color: Colors.textTertiary,
    width: 16,
    textAlign: "right",
  },

  // ── Review card ───────────────────────────────────────────────────────────────
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 12,
  },
  reviewAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: WASH,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: BROWN,
  },
  reviewMeta: {
    flex: 1,
  },
  reviewClientName: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  reviewServiceBadge: {
    alignSelf: "flex-start",
    backgroundColor: WASH,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  reviewServiceText: {
    fontSize: 11,
    fontWeight: "600",
    color: BROWN,
  },
  reviewComment: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyReviews: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyReviewsIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyReviewsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  emptyReviewsSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
});
```
