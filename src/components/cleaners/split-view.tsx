"use client";

import { useState, useCallback } from "react";
import { Map, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { CleanerList } from "./cleaner-list";
import { CleanerMap } from "./cleaner-map";
import type { CleanerProfile } from "@/types/cleaner";

type CleanerWithCoords = CleanerProfile & { lat: number; lng: number };

interface SplitViewProps {
  cleaners: CleanerWithCoords[];
  loading: boolean;
  onCardClick: (id: string) => void;
}

export function SplitView({ cleaners, loading, onCardClick }: SplitViewProps) {
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const handlePinClick = useCallback((id: string) => {
    setHighlightedId(id);
  }, []);

  const handleCardClick = useCallback(
    (id: string) => {
      setHighlightedId(id);
      onCardClick(id);
    },
    [onCardClick]
  );

  return (
    <div className="relative flex h-full w-full flex-col md:flex-row">
      {/* List panel */}
      <div
        className={[
          "md:w-[420px] md:flex-shrink-0 md:overflow-y-auto md:block",
          mobileView === "list" ? "block flex-1 overflow-y-auto" : "hidden",
        ].join(" ")}
      >
        <CleanerList
          cleaners={cleaners}
          loading={loading}
          highlightedId={highlightedId}
          onCardClick={handleCardClick}
        />
      </div>

      {/* Map panel */}
      <div
        className={[
          "md:flex-1 md:block md:sticky md:top-0 md:h-[calc(100vh-60px)]",
          mobileView === "map" ? "block h-[calc(100vh-180px)]" : "hidden",
        ].join(" ")}
      >
        <CleanerMap
          cleaners={cleaners}
          highlightedId={highlightedId}
          onPinClick={handlePinClick}
          onCardClick={handleCardClick}
        />
      </div>

      {/* Mobile floating toggle button */}
      <button
        type="button"
        onClick={() => setMobileView(mobileView === "list" ? "map" : "list")}
        className="fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl active:scale-95 md:hidden"
      >
        {mobileView === "list" ? (
          <>
            <Map className="h-4 w-4" />
            Mappa
          </>
        ) : (
          <>
            <List className="h-4 w-4" />
            Lista
          </>
        )}
      </button>
    </div>
  );
}
