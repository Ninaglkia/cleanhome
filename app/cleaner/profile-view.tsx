import { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StatusBar,
  StyleSheet,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Colors } from "../../lib/theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const BROWN = "#8B5E3C";
const AMBER = "#D4A574";
const WASH = "#F5EBE0";
const BROWN_DARK = "#5C3D24";
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
          color={AMBER}
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
        <Ionicons name="sparkles-outline" size={18} color={BROWN} />
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
  const bgColors = [WASH, "#ede0d4", "#f0e6da", "#fdf3ec", "#f5e6d8", "#ede0d4"];
  const bg = bgColors[index % bgColors.length];

  return (
    <View style={[styles.galleryThumb, { backgroundColor: bg }]}>
      <Ionicons name="image-outline" size={24} color={AMBER} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const SERVICES: ServiceRowProps[] = [
  { name: "Pulizia Standard", price: "25€/ora", duration: "2–3 ore" },
  { name: "Pulizia Profonda", price: "35€/ora", duration: "4–6 ore" },
  { name: "Stiratura", price: "20€/ora", duration: "1–2 ore" },
  { name: "Pulizia Vetri", price: "30€/ora", duration: "2–4 ore" },
];

export default function CleanerProfileViewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

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
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.shareButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {}}
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

            <Text style={styles.heroName}>Elena Rossi</Text>

            <Pressable onPress={handleReviews}>
              <StarRow rating={4.9} reviewCount={47} />
            </Pressable>
          </View>
        </View>

        {/* ── Bio tagline ── */}
        <View style={styles.bioSection}>
          <Text style={styles.bioTagline}>"The Art of Cleanliness"</Text>
          <Text style={styles.bioText}>
            Professionista con 5 anni di esperienza nel settore delle pulizie
            residenziali e commerciali. Specializzzata in pulizie profonde e
            cura dei dettagli. Ogni casa merita il massimo.
          </Text>

          {/* Quick stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>5+</Text>
              <Text style={styles.statLabel}>Anni exp.</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>120+</Text>
              <Text style={styles.statLabel}>Lavori</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>4.9</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>98%</Text>
              <Text style={styles.statLabel}>Risposta</Text>
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
            {SERVICES.map((s, i) => (
              <View key={s.name}>
                <ServiceRow {...s} />
                {i < SERVICES.length - 1 && <View style={styles.serviceDivider} />}
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
            <Text style={styles.reviewsPreviewRating}>4.9</Text>
            <View style={styles.reviewsPreviewStars}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons key={i} name="star" size={12} color={AMBER} />
              ))}
            </View>
            <Text style={styles.reviewsPreviewCount}>47 recensioni</Text>
          </View>
          <Text style={styles.reviewsPreviewCta}>Leggi tutte le recensioni</Text>
          <Ionicons name="chevron-forward" size={18} color={BROWN} />
        </Pressable>
      </ScrollView>

      {/* ── Floating Book Now button ── */}
      <View style={[styles.floatingBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.floatingBarInner}>
          <View>
            <Text style={styles.floatingRateLabel}>A partire da</Text>
            <Text style={styles.floatingRate}>25€/ora</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.bookNowBtn,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleBook}
          >
            <Text style={styles.bookNowBtnText}>Prenota ora</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
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
    backgroundColor: BROWN_DARK,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPhotoGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BROWN,
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
    color: BROWN,
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
    color: BROWN,
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
    color: BROWN,
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
    backgroundColor: WASH,
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
    color: BROWN,
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
    backgroundColor: WASH,
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
    color: BROWN,
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
    color: BROWN_DARK,
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
    color: BROWN,
    letterSpacing: -0.5,
  },
  bookNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 28,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  bookNowBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.2,
  },
});
