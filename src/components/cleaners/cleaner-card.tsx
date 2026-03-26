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
        "flex w-full cursor-pointer items-start gap-4 rounded-2xl bg-white text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
        highlighted
          ? "shadow-md shadow-accent/10 ring-2 ring-accent scale-[1.01]"
          : "shadow-sm ring-1 ring-black/[0.04] hover:shadow-md hover:-translate-y-0.5",
        compact ? "p-3" : "p-4"
      )}
    >
      {/* Avatar + availability dot */}
      <div className="relative shrink-0">
        <Avatar
          className={cn(
            "ring-2 ring-white shadow-sm",
            compact ? "h-12 w-12" : "h-16 w-16"
          )}
        >
          <AvatarImage src={cleaner.avatar_url ?? undefined} />
          <AvatarFallback className="bg-gradient-to-br from-accent/20 to-accent/5 text-lg font-bold text-accent">
            {cleaner.full_name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {cleaner.is_available && (
          <span
            aria-label="Disponibile"
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white bg-green-500 shadow-sm"
          />
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "font-semibold text-primary truncate leading-tight",
              compact ? "text-sm" : "text-lg"
            )}
          >
            {cleaner.full_name}
          </span>
          <Badge
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold border-0",
              cleaner.cleaner_type === "azienda"
                ? "bg-primary/8 text-primary"
                : "bg-accent/10 text-accent"
            )}
          >
            {cleaner.cleaner_type === "azienda" ? "Azienda" : "Privato"}
          </Badge>
        </div>

        <StarRating value={cleaner.avg_rating} count={cleaner.review_count} />

        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {cleaner.city?.split(",")[0]}
          </span>
          <span className="text-border/60">·</span>
          <span>{cleaner.distance_km} km</span>
        </div>

        {!compact && (
          <p className="mt-1.5 text-xl font-bold text-accent tracking-tight">
            &euro;{cleaner.hourly_rate}
            <span className="text-xs font-normal text-muted-foreground">/ora</span>
          </p>
        )}
        {compact && (
          <p className="text-sm font-bold text-accent">
            &euro;{cleaner.hourly_rate}<span className="text-xs font-normal text-muted-foreground">/ora</span>
          </p>
        )}
      </div>
    </button>
  );
}
