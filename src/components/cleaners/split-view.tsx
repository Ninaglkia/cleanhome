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
      {/* Mobile toggle bar */}
      <div className="flex items-center justify-center border-b border-border bg-card px-4 py-3 shadow-sm md:hidden">
        <div className="flex rounded-xl bg-background p-1 gap-1 border border-border">
          <button
            type="button"
            onClick={() => setMobileView("list")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-150",
              mobileView === "list"
                ? "bg-accent text-white shadow-sm"
                : "text-muted-foreground hover:text-primary"
            )}
          >
            <List className="h-4 w-4" />
            Lista
          </button>
          <button
            type="button"
            onClick={() => setMobileView("map")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-150",
              mobileView === "map"
                ? "bg-accent text-white shadow-sm"
                : "text-muted-foreground hover:text-primary"
            )}
          >
            <Map className="h-4 w-4" />
            Mappa
          </button>
        </div>
      </div>

      {/* List panel */}
      <div
        className={[
          // Desktop: always visible, fixed width, scrollable
          "md:w-[420px] md:flex-shrink-0 md:overflow-y-auto md:block",
          // Mobile: toggle visibility
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
          // Desktop: fills remaining space, sticky
          "md:flex-1 md:block md:sticky md:top-0 md:h-[calc(100vh-60px)]",
          // Mobile: toggle visibility
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
    </div>
  );
}
