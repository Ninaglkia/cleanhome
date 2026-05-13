import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CleanerStats {
  role: "cleaner";
  earnings: number;
  jobs: number;
  rating: string;
  reviewCount: number;
  isLoading: boolean;
}

export interface ClientStats {
  role: "client";
  spent: number;
  bookingsCount: number;
  propertiesCount: number;
  isLoading: boolean;
}

export type ProfileStats = CleanerStats | ClientStats;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProfileStats(
  userId: string | null | undefined,
  role: "cleaner" | "client"
): ProfileStats {
  const [isLoading, setIsLoading] = useState(true);

  // Cleaner state
  const [earnings, setEarnings] = useState(0);
  const [jobs, setJobs] = useState(0);
  const [rating, setRating] = useState<string>("—");
  const [reviewCount, setReviewCount] = useState(0);

  // Client state
  const [spent, setSpent] = useState(0);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [propertiesCount, setPropertiesCount] = useState(0);

  const fetchCleanerStats = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      // Earnings this month: SUM(total_price) * 0.91 WHERE cleaner_id=uid AND status='completed' AND completed_at >= start_of_month
      const { data: earningsData } = await supabase
        .from("bookings")
        .select("total_price")
        .eq("cleaner_id", uid)
        .eq("status", "completed")
        .gte("completed_at", startOfMonth());

      const rawEarnings =
        earningsData?.reduce((acc, row) => acc + (row.total_price ?? 0), 0) ?? 0;
      setEarnings(rawEarnings * 0.91);

      // Total completed jobs: COUNT(bookings) WHERE cleaner_id=uid AND status='completed'
      const { count: jobCount } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("cleaner_id", uid)
        .eq("status", "completed");

      setJobs(jobCount ?? 0);

      // Rating from profiles table
      const { data: profileData } = await supabase
        .from("profiles")
        .select("avg_rating, review_count")
        .eq("id", uid)
        .single();

      setRating(
        profileData?.avg_rating != null
          ? Number(profileData.avg_rating).toFixed(1)
          : "—"
      );
      setReviewCount(profileData?.review_count ?? 0);
    } catch {
      // Leave defaults — UI shows "—"
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchClientStats = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      // Spent total: SUM(total_price) * 1.09 WHERE client_id=uid AND status='completed'
      const { data: spentData } = await supabase
        .from("bookings")
        .select("total_price")
        .eq("client_id", uid)
        .eq("status", "completed");

      const rawSpent =
        spentData?.reduce((acc, row) => acc + (row.total_price ?? 0), 0) ?? 0;
      setSpent(rawSpent * 1.09);

      // Completed bookings count
      const { count: bCount } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("client_id", uid)
        .eq("status", "completed");

      setBookingsCount(bCount ?? 0);

      // Saved properties: COUNT(client_properties) WHERE user_id=uid
      const { count: pCount } = await supabase
        .from("client_properties")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid);

      setPropertiesCount(pCount ?? 0);
    } catch {
      // Leave defaults
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    if (role === "cleaner") {
      fetchCleanerStats(userId);
    } else {
      fetchClientStats(userId);
    }
  }, [userId, role, fetchCleanerStats, fetchClientStats]);

  if (role === "cleaner") {
    return { role: "cleaner", earnings, jobs, rating, reviewCount, isLoading };
  }
  return { role: "client", spent, bookingsCount, propertiesCount, isLoading };
}
