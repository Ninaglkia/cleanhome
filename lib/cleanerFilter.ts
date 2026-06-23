/**
 * cleanerFilter — pure, side-effect-free helper for the home screen
 * client-side filter logic. Extracted so it can be unit-tested independently.
 */

export interface CleanerFilters {
  priceFilter: { min: number; max: number } | null;
  serviceFilters: string[];
  /** Minimum average rating (inclusive). null/undefined = no rating filter. */
  minRating?: number | null;
  /** Maximum distance in km (inclusive). null/undefined = no distance filter. */
  maxDistance?: number | null;
}

/**
 * Filter a list of cleaners by the given price range and service requirements.
 *
 * Semantics (must match the useMemo in home.tsx exactly):
 *  - If priceFilter is set: rows with null/undefined hourly_rate are dropped;
 *    rate must be within [min, max] inclusive.
 *  - If serviceFilters is non-empty: cleaner.services must contain EVERY
 *    selected service (logical AND, not OR).
 *  - When both filters are inactive the original array is returned as-is
 *    (no new allocation).
 */
export function filterCleaners<
  T extends {
    hourly_rate?: number | null;
    services?: string[] | null;
    avg_rating?: number | null;
    distance_km?: number | null;
  }
>(cleaners: T[], filters: CleanerFilters): T[] {
  const { priceFilter, serviceFilters, minRating, maxDistance } = filters;
  const hasPrice = priceFilter != null;
  const hasServices = serviceFilters.length > 0;
  const hasRating = minRating != null;
  const hasDistance = maxDistance != null;

  if (!hasPrice && !hasServices && !hasRating && !hasDistance) return cleaners;

  return cleaners.filter((c) => {
    if (hasPrice) {
      const rate = c.hourly_rate;
      if (rate == null) return false;
      if (rate < priceFilter.min || rate > priceFilter.max) return false;
    }
    if (hasServices) {
      const svc = c.services ?? [];
      if (!serviceFilters.every((s) => svc.includes(s))) return false;
    }
    if (hasRating) {
      if ((c.avg_rating ?? 0) < minRating) return false;
    }
    if (hasDistance) {
      const d = c.distance_km;
      if (d != null && d > maxDistance) return false;
    }
    return true;
  });
}
