"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingInputProps {
  value: number; // 1-5
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function StarRatingInput({ value, onChange, disabled = false }: StarRatingInputProps) {
  const [hovered, setHovered] = useState(0);

  const active = hovered > 0 ? hovered : value;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`${star} stelle`}
          className={cn(
            "transition-transform",
            !disabled && "hover:scale-110 cursor-pointer",
            disabled && "cursor-default"
          )}
        >
          <Star
            className={cn(
              "h-8 w-8",
              star <= active
                ? "fill-warning text-warning"
                : "fill-muted text-muted"
            )}
          />
        </button>
      ))}
    </div>
  );
}
