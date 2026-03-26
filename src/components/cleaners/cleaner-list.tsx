"use client";

import { CleanerCard } from "./cleaner-card";
import type { CleanerProfile } from "@/types/cleaner";

interface CleanerListProps {
  cleaners: CleanerProfile[];
  loading: boolean;
  highlightedId: string | null;
  onCardClick: (id: string) => void;
}

export function CleanerList({
  cleaners,
  loading,
  highlightedId,
  onCardClick,
}: CleanerListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
    );
  }

  if (cleaners.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-lg font-medium text-primary">Nessun pulitore trovato</p>
        <p className="text-sm text-muted-foreground">
          Prova ad allargare la zona o modificare i filtri.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-sm text-muted-foreground">
        {cleaners.length} pulitor{cleaners.length === 1 ? "e" : "i"} trovat{cleaners.length === 1 ? "o" : "i"}
      </p>
      {cleaners.map((c) => (
        <CleanerCard
          key={c.id}
          cleaner={c}
          onClick={onCardClick}
          highlighted={c.id === highlightedId}
        />
      ))}
    </div>
  );
}
