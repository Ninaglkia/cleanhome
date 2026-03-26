"use client";

import { useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { usePlacesAutocomplete } from "@/hooks/use-places-autocomplete";
import { ALL_SERVICES, DEFAULT_FILTERS } from "@/types/cleaner";
import type { CleanerFilters as Filters } from "@/types/cleaner";

interface CleanerFiltersProps {
  filters: Filters;
  onChange: (next: Filters) => void;
}

const TYPE_OPTIONS: { value: Filters["type"]; label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "privato", label: "Privato" },
  { value: "azienda", label: "Azienda" },
];

const SORT_OPTIONS: { value: Filters["sortBy"]; label: string }[] = [
  { value: "distanza", label: "Distanza" },
  { value: "prezzo", label: "Prezzo" },
  { value: "valutazione", label: "Valutazione" },
];

const RATING_OPTIONS = [0, 3, 4, 4.5];

export function CleanerFilters({ filters, onChange }: CleanerFiltersProps) {
  const zoneInputRef = useRef<HTMLInputElement>(null);

  usePlacesAutocomplete({
    inputRef: zoneInputRef,
    onSelect: ({ address, lat, lng }) => {
      onChange({ ...filters, zone: address, lat, lng });
      if (zoneInputRef.current) zoneInputRef.current.value = address;
    },
  });

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-4">
      {/* Zone search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={zoneInputRef}
          placeholder="Zona o città..."
          defaultValue={filters.zone}
          className="pl-9"
          autoComplete="off"
        />
      </div>

      {/* Type chips */}
      <div className="flex gap-2">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => set("type", opt.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filters.type === opt.value
                ? "border-accent bg-accent text-white"
                : "border-border bg-background text-muted-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}

        {/* Sort */}
        <select
          value={filters.sortBy}
          onChange={(e) => set("sortBy", e.target.value as Filters["sortBy"])}
          className="ml-auto rounded-full border border-border bg-background px-2 py-1 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Price range */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Tariffa max</span>
          <span>
            {filters.maxRate >= 200 ? "Qualsiasi" : `≤ €${filters.maxRate}/ora`}
          </span>
        </div>
        <Slider
          min={5}
          max={200}
          step={5}
          value={[filters.maxRate]}
          onValueChange={([v]) => set("maxRate", v)}
        />
      </div>

      {/* Min rating chips */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">Min ★</span>
        {RATING_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => set("minRating", r)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
              filters.minRating === r
                ? "border-accent bg-accent text-white"
                : "border-border text-muted-foreground"
            )}
          >
            {r === 0 ? "Tutti" : `${r}+`}
          </button>
        ))}
      </div>

      {/* Service filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => set("service", "")}
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
            !filters.service
              ? "border-accent bg-accent text-white"
              : "border-border text-muted-foreground"
          )}
        >
          Tutti
        </button>
        {ALL_SERVICES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => set("service", s)}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
              filters.service === s
                ? "border-accent bg-accent text-white"
                : "border-border text-muted-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
