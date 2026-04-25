// ============================================================================
// Screen: Le mie case — list of saved client properties
// ----------------------------------------------------------------------------
// Entry point for the multi-property feature. Shows a list of all houses the
// client has saved, with a FAB that opens the add/edit form and a card-tap
// that opens the same form in edit mode. The default property floats to the
// top with a green chip. Empty state invites first-time users to add a house.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { fetchClientProperties } from "../../lib/api";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";
import type { ClientProperty } from "../../lib/types";

export default function PropertiesListScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ClientProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchClientProperties(user.id);
      setItems(data);
    } catch (err) {
      console.error("[properties] load error", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Refresh each time the screen gains focus so edits/adds from the form
  // bubble back up without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAdd = useCallback(() => {
    // New properties go through the multi-step wizard; only edits
    // (with an id param) still hit /properties/edit.
    router.push("/properties/new");
  }, [router]);

  const handleEdit = useCallback(
    (id: string) => {
      router.push({ pathname: "/properties/edit", params: { id } });
    },
    [router]
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={10}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Le mie case</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.secondary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── Intro block ── */}
          <View style={styles.introBlock}>
            <Text style={styles.introTitle}>Le tue case salvate</Text>
            <Text style={styles.introSub}>
              Salva gli indirizzi che usi spesso. Potrai prenotare una pulizia
              in un tocco — niente più indirizzo da riscrivere ogni volta.
            </Text>
          </View>

          {items.length === 0 ? (
            <EmptyState onAdd={handleAdd} />
          ) : (
            <View style={{ gap: Spacing.md }}>
              {items.map((item) => (
                <PropertyCard
                  key={item.id}
                  item={item}
                  onPress={() => handleEdit(item.id)}
                />
              ))}
              <Pressable
                onPress={handleAdd}
                style={({ pressed }) => [
                  styles.addAnotherBtn,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={Colors.secondary}
                />
                <Text style={styles.addAnotherText}>Aggiungi un'altra casa</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Floating Action Button — only when list has items ── */}
      {items.length > 0 && !loading && (
        <Pressable
          onPress={handleAdd}
          style={({ pressed }) => [
            styles.fab,
            pressed && { transform: [{ scale: 0.96 }] },
          ]}
          accessibilityLabel="Aggiungi una nuova casa"
        >
          <Ionicons name="add" size={26} color="#fff" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

// ─── PropertyCard ──────────────────────────────────────────────────────────

function PropertyCard({
  item,
  onPress,
}: {
  item: ClientProperty;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && { transform: [{ scale: 0.985 }] },
      ]}
    >
      <View style={styles.cardIconWrap}>
        <Ionicons name="home" size={22} color={Colors.secondary} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </Text>
          {item.is_default && (
            <View style={styles.defaultChip}>
              <Ionicons name="star" size={11} color={Colors.secondary} />
              <Text style={styles.defaultChipText}>Predefinita</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardAddress} numberOfLines={2}>
          {item.address}
        </Text>
        <View style={styles.cardMetaRow}>
          <View style={styles.metaPill}>
            <Ionicons
              name="bed-outline"
              size={12}
              color={Colors.textSecondary}
            />
            <Text style={styles.metaPillText}>
              {item.num_rooms} {item.num_rooms === 1 ? "stanza" : "stanze"}
            </Text>
          </View>
          {item.sqm ? (
            <View style={styles.metaPill}>
              <Ionicons
                name="resize-outline"
                size={12}
                color={Colors.textSecondary}
              />
              <Text style={styles.metaPillText}>{item.sqm} m²</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={Colors.textTertiary}
      />
    </Pressable>
  );
}

// ─── EmptyState ────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIllustration}>
        <Ionicons name="home-outline" size={44} color={Colors.secondary} />
      </View>
      <Text style={styles.emptyTitle}>Nessuna casa salvata</Text>
      <Text style={styles.emptyText}>
        Aggiungi la tua prima casa per prenotare pulizie in un attimo. È perfetto
        se hai più di una proprietà da gestire.
      </Text>
      <Pressable
        onPress={onAdd}
        style={({ pressed }) => [
          styles.ctaBtn,
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.ctaBtnText}>Aggiungi la prima casa</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.text,
  },

  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  scroll: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 120,
  },

  introBlock: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  introTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  introSub: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },

  // --- Card ---
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    maxWidth: "70%",
  },
  defaultChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.accentLight,
  },
  defaultChipText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cardAddress: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  cardMetaRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.backgroundAlt,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },

  // --- Add another ---
  addAnotherBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: Spacing.base,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: "dashed",
    backgroundColor: "transparent",
    marginTop: Spacing.sm,
  },
  addAnotherText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.secondary,
  },

  // --- Empty state ---
  emptyWrap: {
    alignItems: "center",
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.base,
  },
  emptyIllustration: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
    marginBottom: Spacing.xl,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
    ...Shadows.md,
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },

  // --- FAB ---
  fab: {
    position: "absolute",
    bottom: 28,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.lg,
  },
});
