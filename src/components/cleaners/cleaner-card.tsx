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
        "flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-all",
        highlighted
          ? "border-accent shadow-md"
          : "border-border hover:border-accent/50 hover:shadow-sm",
        compact && "p-3"
      )}
    >
      {/* Avatar + availability dot */}
      <div className="relative shrink-0">
        <Avatar
          className={cn(
            "border border-border",
            compact ? "h-10 w-10" : "h-14 w-14"
          )}
        >
          <AvatarImage src={cleaner.avatar_url ?? undefined} />
          <AvatarFallback className="bg-muted text-sm font-semibold text-primary">
            {cleaner.full_name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {cleaner.is_available && (
          <span
            aria-label="Disponibile"
            className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-success"
          />
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "font-semibold text-primary truncate",
              compact ? "text-sm" : "text-base"
            )}
          >
            {cleaner.full_name}
          </span>
          <Badge
            className={cn(
              "shrink-0 text-xs",
              cleaner.cleaner_type === "azienda"
                ? "bg-primary/10 text-primary"
                : "bg-accent/10 text-accent"
            )}
          >
            {cleaner.cleaner_type === "azienda" ? "Azienda" : "Privato"}
          </Badge>
        </div>

        <StarRating value={cleaner.avg_rating} count={cleaner.review_count} />

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3" />
            {cleaner.city?.split(",")[0]}
          </span>
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3 opacity-0" />
            {cleaner.distance_km} km
          </span>
        </div>

        {!compact && (
          <p className="mt-0.5 text-sm font-medium text-primary">
            €{cleaner.hourly_rate}/ora
          </p>
        )}
        {compact && (
          <p className="text-xs font-medium text-primary">
            €{cleaner.hourly_rate}/ora
          </p>
        )}
      </div>
    </button>
  );
}
