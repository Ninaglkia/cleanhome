import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StatusBar,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../lib/theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const BROWN = "#8B5E3C";
const AMBER = "#D4A574";
const WASH = "#F5EBE0";
const BROWN_DARK = "#5C3D24";
const DARK_BG = "#1a1a2e";

type ReviewTab = "experience" | "trust";

// ─── Star rating display ──────────────────────────────────────────────────────

interface StarRatingProps {
  rating: number;
  size?: number;
  color?: string;
}

function StarRating({ rating, size = 16, color = AMBER }: StarRatingProps) {
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

// Placeholder data — in production this would come from a hook
const SAMPLE_REVIEWS: ReviewCardData[] = [
  {
    id: "1",
    clientName: "Marco B.",
    clientInitials: "MB",
    rating: 5,
    date: "28 Mar 2026",
    comment: "Lavoro eccellente, puntuale e molto professionale. Casa impeccabile!",
    serviceType: "Pulizia Profonda",
  },
  {
    id: "2",
    clientName: "Sofia R.",
    clientInitials: "SR",
    rating: 4.5,
    date: "20 Mar 2026",
    comment: "Ottimo servizio, molto attenta ai dettagli. Consiglio vivamente.",
    serviceType: "Pulizia Ordinaria",
  },
  {
    id: "3",
    clientName: "Luca M.",
    clientInitials: "LM",
    rating: 5,
    date: "15 Mar 2026",
    comment: "Fantastica, la migliore che abbia mai avuto. Tornerò sicuramente.",
    serviceType: "Pulizia Profonda",
  },
];

export default function CleanerReviewsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReviewTab>("experience");

  const avgRating = 4.9;
  const reviewCount = SAMPLE_REVIEWS.length;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const displayedReviews = SAMPLE_REVIEWS;

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
              <Text style={styles.profileAvatarText}>EV</Text>
            </View>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineBadgeText}>Online</Text>
            </View>
          </View>

          <Text style={styles.profileName}>Eleanor Vance</Text>
          <Text style={styles.profileTagline}>
            Professionista certificata · Milano
          </Text>

          {/* Overall rating */}
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={20} color={AMBER} />
            <Text style={styles.ratingNumber}>{avgRating}</Text>
            <Text style={styles.ratingCount}>({reviewCount} recensioni)</Text>
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
              Experience
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
              Trust
            </Text>
          </Pressable>
        </View>

        {/* ── Reviews section ── */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsSectionHeader}>
            <Text style={styles.reviewsSectionTitle}>Client Reviews</Text>
            <View style={styles.ratePrompt}>
              <Ionicons name="star-outline" size={14} color={BROWN} />
              <Text style={styles.ratePromptText}>Rate your experience</Text>
            </View>
          </View>

          {/* Summary bar */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryRatingBig}>{avgRating}</Text>
              <StarRating rating={avgRating} size={18} />
              <Text style={styles.summaryCountText}>
                {reviewCount} recensioni
              </Text>
            </View>
            <View style={styles.summaryBars}>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = SAMPLE_REVIEWS.filter(
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
    backgroundColor: BROWN,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: AMBER,
    marginBottom: 8,
  },
  profileAvatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: WASH,
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
    backgroundColor: AMBER,
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
