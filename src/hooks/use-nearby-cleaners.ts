"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchNearbyCleaners } from "@/lib/supabase/nearby-cleaners";
import type { CleanerProfile, CleanerFilters } from "@/types/cleaner";

interface UseNearbyCleanhersResult {
  cleaners: CleanerProfile[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function applyFilters(
  cleaners: CleanerProfile[],
  filters: CleanerFilters
): CleanerProfile[] {
  let result = cleaners.filter((c) => c.is_available);

  if (filters.type !== "tutti") {
    result = result.filter((c) => c.cleaner_type === filters.type);
  }
  if (filters.minRating > 0) {
    result = result.filter((c) => c.avg_rating >= filters.minRating);
  }
  if (filters.maxRate < 200) {
    result = result.filter(
      (c) => c.hourly_rate !== null && c.hourly_rate <= filters.maxRate
    );
  }
  if (filters.service) {
    result = result.filter((c) =>
      c.services?.some((s) =>
        s.toLowerCase().includes(filters.service.toLowerCase())
      )
    );
  }

  if (filters.sortBy === "prezzo") {
    result = result.sort(
      (a, b) => (a.hourly_rate ?? 0) - (b.hourly_rate ?? 0)
    );
  } else if (filters.sortBy === "valutazione") {
    result = result.sort((a, b) => b.avg_rating - a.avg_rating);
  } else {
    result = result.sort((a, b) => a.distance_km - b.distance_km);
  }

  return result;
}

export function useNearbyCleaners(
  filters: CleanerFilters
): UseNearbyCleanhersResult {
  const [raw, setRaw] = useState<CleanerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const lat = filters.lat ?? 41.9028;
    const lng = filters.lng ?? 12.4964;

    fetchNearbyCleaners(lat, lng, 50)
      .then((data) => {
        if (!cancelled) setRaw(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [filters.lat, filters.lng, tick]);

  const cleaners = applyFilters(raw, filters);

  return { cleaners, loading, error, refetch };
}
