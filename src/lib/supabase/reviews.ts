import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReviewRow {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewed_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
  reviewer_avatar: string | null;
}

/**
 * Fetch all reviews for a profile (where they were the one being reviewed),
 * regardless of whether the reviewer was a client or a cleaner.
 */
export async function getReviewsForProfile(
  supabase: SupabaseClient,
  profileId: string,
  limit = 20
): Promise<ReviewRow[]> {
  type RawRow = {
    id: string;
    booking_id: string;
    reviewer_id: string;
    reviewed_id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    profiles:
      | { full_name: string | null; avatar_url: string | null }
      | { full_name: string | null; avatar_url: string | null }[]
      | null;
  };

  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, booking_id, reviewer_id, reviewed_id, rating, comment, created_at, profiles!reviewer_id(full_name, avatar_url)"
    )
    .eq("reviewed_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as RawRow[]).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles;
    return {
      id: r.id,
      booking_id: r.booking_id,
      reviewer_id: r.reviewer_id,
      reviewed_id: r.reviewed_id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      reviewer_name: p?.full_name ?? null,
      reviewer_avatar: p?.avatar_url ?? null,
    };
  });
}

/**
 * Calculate average rating for a profile from an array of reviews.
 * Returns 0 when there are no reviews.
 */
export function calcAverageRating(reviews: { rating: number }[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}
