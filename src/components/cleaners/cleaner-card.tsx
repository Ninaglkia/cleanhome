"use client";

import { MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/profile/star-rating";
import { cn } from "@/lib/utils";
import type { CleanerProfile } from "@/types/cleaner";

interface CleanerCardProps {
  cleaner: CleanerProfile;
  onClick: (id: string) => void;
  highlighted?: boolean;
  compact?: boolean; // used in map popup
}

export function CleanerCard({
  cleaner,
  onClick,
  highlighted,
  compact,
}: CleanerCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(cleaner.id)}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border bg-card text-left transition-all duration-200",
        highlighted
          ? "border-accent shadow-lg shadow-accent/10 scale-[1.01]"
          : "border-border shadow-sm hover:border-accent/60 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5",
        compact ? "p-3" : "p-4"
      )}
    >
      {/* Avatar + availability dot */}
      <div className="relative shrink-0">
        <Avatar
          className={cn(
            "border-2",
            highlighted ? "border-accent" : "border-border",
            compact ? "h-11 w-11" : "h-16 w-16"
          )}
        >
          <AvatarImage src={cleaner.avatar_url ?? undefined} />
          <AvatarFallback className="bg-accent/10 text-base font-bold text-accent">
            {cleaner.full_name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {cleaner.is_available && (
          <span
            aria-label="Disponibile"
            className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card bg-success shadow-sm"
          />
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "font-bold text-primary truncate leading-tight",
              compact ? "text-sm" : "text-base"
            )}
          >
            {cleaner.full_name}
          </span>
          <Badge
            className={cn(
              "shrink-0 text-xs font-semibold border-0",
              cleaner.cleaner_type === "azienda"
                ? "bg-primary/10 text-primary"
                : "bg-accent/15 text-accent"
            )}
          >
            {cleaner.cleaner_type === "azienda" ? "Azienda" : "Privato"}
          </Badge>
        </div>

        <StarRating value={cleaner.avg_rating} count={cleaner.review_count} />

        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-accent/70" />
            {cleaner.city?.split(",")[0]}
          </span>
          <span className="text-border">·</span>
          <span>{cleaner.distance_km} km</span>
        </div>

        {!compact && (
          <p className="mt-1 text-base font-bold text-accent">
            €{cleaner.hourly_rate}
            <span className="text-xs font-normal text-muted-foreground">/ora</span>
          </p>
        )}
        {compact && (
          <p className="text-xs font-bold text-accent">
            €{cleaner.hourly_rate}/ora
          </p>
        )}
      </div>
    </button>
  );
}
