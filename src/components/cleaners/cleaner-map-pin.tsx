"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { cn } from "@/lib/utils";
import type { CleanerProfile } from "@/types/cleaner";

interface CleanerMapPinProps {
  cleaner: CleanerProfile & { lat: number; lng: number };
  highlighted: boolean;
  onClick: (id: string) => void;
}

export function CleanerMapPin({ cleaner, highlighted, onClick }: CleanerMapPinProps) {
  return (
    <AdvancedMarker
      position={{ lat: cleaner.lat, lng: cleaner.lng }}
      onClick={() => onClick(cleaner.id)}
      zIndex={highlighted ? 10 : 1}
    >
      <div
        className={cn(
          "flex h-8 min-w-[56px] items-center justify-center rounded-full px-2 text-xs font-bold shadow-md transition-transform",
          highlighted
            ? "scale-110 bg-accent text-white"
            : "bg-card text-primary border border-border"
        )}
      >
        €{cleaner.hourly_rate}
      </div>
    </AdvancedMarker>
  );
}
