"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CleanerFilters } from "@/components/cleaners/cleaner-filters";
import { SplitView } from "@/components/cleaners/split-view";
import { useNearbyCleaners } from "@/hooks/use-nearby-cleaners";
import { DEFAULT_FILTERS } from "@/types/cleaner";
import type { CleanerFilters as Filters } from "@/types/cleaner";

export default function ClientHomePage() {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const { cleaners, loading, error } = useNearbyCleaners(filters);

  const handleCardClick = useCallback(
    (id: string) => {
      router.push(`/client/cleaners/${id}`);
    },
    [router]
  );

  // Cast: nearby_cleaners RPC returns lat/lng columns from profiles
  const cleanersWithCoords = cleaners as (typeof cleaners[0] & {
    lat: number;
    lng: number;
  })[];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 60px)" }}>
      <CleanerFilters filters={filters} onChange={setFilters} />
      {error && (
        <p className="px-4 py-2 text-sm text-error">{error}</p>
      )}
      <div className="flex-1 overflow-hidden">
        <SplitView
          cleaners={cleanersWithCoords}
          loading={loading}
          onCardClick={handleCardClick}
        />
      </div>
    </div>
  );
}
