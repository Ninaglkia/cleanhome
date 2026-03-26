import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number; // 0-5, supports decimals
  count?: number;
  size?: "sm" | "md";
}

export function StarRating({ value, count, size = "sm" }: StarRatingProps) {
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            iconClass,
            i <= Math.round(value)
              ? "fill-warning text-warning"
              : "fill-muted text-muted"
          )}
        />
      ))}
      <span className="text-xs text-muted-foreground">
        {value.toFixed(1)}
        {count !== undefined && ` (${count})`}
      </span>
    </div>
  );
}
