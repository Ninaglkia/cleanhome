/**
 * cleanerFilter — pure, side-effect-free helper for the home screen
 * client-side filter logic. Extracted so it can be unit-tested independently.
 */

export interface CleanerFilters {
  priceFilter: { min: number; max: number } | null;
  serviceFilters: string[];
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
  T extends { hourly_rate?: number | null; services?: string[] | null }
>(cleaners: T[], filters: CleanerFilters): T[] {
  const { priceFilter, serviceFilters } = filters;
  const hasPrice = priceFilter != null;
  const hasServices = serviceFilters.length > 0;

  if (!hasPrice && !hasServices) return cleaners;

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
    return true;
  });
}
