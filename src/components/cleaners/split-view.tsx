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
        className={cn(
          "md:w-[420px] md:flex-shrink-0 md:overflow-y-auto md:block",
          mobileView === "list" ? "block flex-1 overflow-y-auto" : "hidden"
        )}
      >
        <div className="flex flex-col gap-3 p-3">
          <CleanerList
            cleaners={cleaners}
            loading={loading}
            highlightedId={highlightedId}
            onCardClick={handleCardClick}
          />
        </div>
      </div>

      {/* Map panel */}
      <div
        className={cn(
          "md:flex-1 md:block md:sticky md:top-0 md:h-[calc(100vh-60px)]",
          mobileView === "map" ? "block h-[calc(100vh-180px)]" : "hidden"
        )}
      >
        <CleanerMap
          cleaners={cleaners}
          highlightedId={highlightedId}
          onPinClick={handlePinClick}
          onCardClick={handleCardClick}
        />
      </div>

      {/* Mobile floating toggle button (FAB) */}
      <button
        type="button"
        onClick={() => setMobileView(mobileView === "list" ? "map" : "list")}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl active:scale-95 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
        aria-label={mobileView === "list" ? "Mostra mappa" : "Mostra lista"}
      >
        {mobileView === "list" ? (
          <Map className="h-5 w-5" />
        ) : (
          <List className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
