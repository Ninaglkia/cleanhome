"use client";

import { useRef, useState } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    <div className="flex flex-col gap-3 bg-white px-4 pb-3 pt-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Zone search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={zoneInputRef}
          placeholder="Cerca zona o città..."
          defaultValue={filters.zone}
          className="h-12 rounded-2xl border-0 bg-background pl-11 pr-4 text-sm shadow-none ring-1 ring-border focus-visible:ring-2 focus-visible:ring-accent transition-all"
          autoComplete="off"
        />
      </div>

      {/* Horizontal scrollable chips: type + services */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar -mx-4 px-4">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => set("type", opt.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200",
              filters.type === opt.value
                ? "bg-primary text-white shadow-sm"
                : "bg-background text-muted-foreground ring-1 ring-border hover:ring-primary/30 hover:text-primary"
            )}
          >
            {opt.label}
          </button>
        ))}
        <div className="h-5 w-px shrink-0 bg-border" />
        <button
          type="button"
          onClick={() => set("service", "")}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200",
            !filters.service
              ? "bg-accent text-white shadow-sm"
              : "bg-background text-muted-foreground ring-1 ring-border hover:ring-accent/40 hover:text-primary"
          )}
        >
          Tutti i servizi
        </button>
        {ALL_SERVICES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => set("service", s)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200",
              filters.service === s
                ? "bg-accent text-white shadow-sm"
                : "bg-background text-muted-foreground ring-1 ring-border hover:ring-accent/40 hover:text-primary"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filtri avanzati
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", showAdvanced && "rotate-180")} />
      </button>

      {/* Collapsible advanced filters */}
      <div className={cn(
        "grid transition-all duration-300 ease-in-out",
        showAdvanced ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}>
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 pt-1 pb-1">
            {/* Sort */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">Ordina per</span>
              <select
                value={filters.sortBy}
                onChange={(e) => set("sortBy", e.target.value as Filters["sortBy"])}
                className="rounded-xl bg-background px-3 py-1.5 text-xs font-medium text-primary ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-accent transition-colors cursor-pointer"
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
                <span className="text-xs font-bold text-accent">
                  {filters.maxRate >= 200 ? "Qualsiasi" : `${filters.maxRate}/ora`}
                </span>
              </div>
              <Slider
                min={5}
                max={200}
                step={5}
                value={[filters.maxRate]}
                onValueChange={([v]) => set("maxRate", v)}
                className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-2 [&_[role=slider]]:border-accent [&_[role=slider]]:bg-white [&_[role=slider]]:shadow-sm"
              />
            </div>

            {/* Min rating chips */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary shrink-0">Valutazione min.</span>
              <div className="flex gap-1.5">
                {RATING_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => set("minRating", r)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                      filters.minRating === r
                        ? "bg-primary text-white shadow-sm"
                        : "bg-background text-muted-foreground ring-1 ring-border hover:ring-primary/30 hover:text-primary"
                    )}
                  >
                    {r === 0 ? "Tutti" : `${r}+`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
