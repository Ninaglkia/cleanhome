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
    <div className="flex flex-col gap-4 border-b border-border bg-card px-4 py-5 shadow-sm">
      {/* Zone search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />
        <Input
          ref={zoneInputRef}
          placeholder="Zona o città..."
          defaultValue={filters.zone}
          className="pl-10 rounded-xl border-border bg-background shadow-none focus-visible:ring-accent focus-visible:ring-2 focus-visible:border-accent transition-colors"
          autoComplete="off"
        />
      </div>

      {/* Type chips + Sort */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set("type", opt.value)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150",
                filters.type === opt.value
                  ? "bg-accent text-white shadow-sm shadow-accent/30"
                  : "bg-background border border-border text-muted-foreground hover:border-accent/50 hover:text-primary"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={filters.sortBy}
          onChange={(e) => set("sortBy", e.target.value as Filters["sortBy"])}
          className="ml-auto rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors cursor-pointer"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Price range */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-primary">Tariffa max</span>
          <span className="text-xs font-semibold text-accent bg-accent/10 px-2.5 py-0.5 rounded-full">
            {filters.maxRate >= 200 ? "Qualsiasi" : `≤ €${filters.maxRate}/ora`}
          </span>
        </div>
        <Slider
          min={5}
          max={200}
          step={5}
          value={[filters.maxRate]}
          onValueChange={([v]) => set("maxRate", v)}
          className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:border-2 [&_[role=slider]]:border-accent [&_[role=slider]]:bg-white [&_[role=slider]]:shadow-md"
        />
      </div>

      {/* Min rating chips */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-primary shrink-0">Min ★</span>
        <div className="flex gap-1.5">
          {RATING_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set("minRating", r)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-all duration-150",
                filters.minRating === r
                  ? "bg-accent text-white shadow-sm shadow-accent/30"
                  : "bg-background border border-border text-muted-foreground hover:border-accent/50 hover:text-primary"
              )}
            >
              {r === 0 ? "Tutti" : `${r}+`}
            </button>
          ))}
        </div>
      </div>

      {/* Service filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        <button
          type="button"
          onClick={() => set("service", "")}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-150",
            !filters.service
              ? "bg-accent text-white shadow-sm shadow-accent/30"
              : "bg-background border border-border text-muted-foreground hover:border-accent/50 hover:text-primary"
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
              "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-150",
              filters.service === s
                ? "bg-accent text-white shadow-sm shadow-accent/30"
                : "bg-background border border-border text-muted-foreground hover:border-accent/50 hover:text-primary"
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
