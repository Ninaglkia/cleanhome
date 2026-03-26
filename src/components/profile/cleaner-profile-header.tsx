import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { StarRating } from "./star-rating";
import type { CleanerProfile } from "@/types/cleaner";

interface CleanerProfileHeaderProps {
  cleaner: CleanerProfile;
}

export function CleanerProfileHeader({ cleaner }: CleanerProfileHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-4 bg-card px-6 py-8">
      <div className="relative">
        <Avatar className="h-28 w-28 border-4 border-accent/30">
          <AvatarImage src={cleaner.avatar_url ?? undefined} />
          <AvatarFallback className="bg-muted text-4xl font-bold text-primary">
            {cleaner.full_name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {cleaner.is_available && (
          <span
            aria-label="Disponibile"
            className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-card bg-success"
          />
        )}
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-serif text-2xl text-primary">{cleaner.full_name}</h1>
        <Badge
          className={
            cleaner.cleaner_type === "azienda"
              ? "bg-primary text-white"
              : "bg-accent/15 text-accent"
          }
        >
          {cleaner.cleaner_type === "azienda" ? "Azienda" : "Privato"}
        </Badge>
        <StarRating value={cleaner.avg_rating} count={cleaner.review_count} size="md" />
        {cleaner.city && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {cleaner.city}
            {cleaner.distance_km > 0 && ` · ${cleaner.distance_km} km`}
          </p>
        )}
        <p className="mt-1 text-xl font-bold text-primary">
          €{cleaner.hourly_rate}
          <span className="text-sm font-normal text-muted-foreground">/ora</span>
        </p>
      </div>
    </div>
  );
}
