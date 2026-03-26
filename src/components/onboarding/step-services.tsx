"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ALL_SERVICES } from "@/types/cleaner";
import type { OnboardingDraft } from "@/hooks/use-onboarding-draft";

interface StepServicesProps {
  draft: OnboardingDraft;
  setDraft: (patch: Partial<OnboardingDraft>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepServices({ draft, setDraft, onNext, onBack }: StepServicesProps) {
  const canProceed =
    Number(draft.hourlyRate) > 0 && draft.services.length > 0;

  const toggleService = (service: string) => {
    const has = draft.services.includes(service);
    setDraft({
      services: has
        ? draft.services.filter((s) => s !== service)
        : [...draft.services, service],
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Type + Rate */}
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] flex flex-col gap-5">
        {/* Type toggle */}
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo di profilo</p>
          <div className="flex gap-1.5 rounded-2xl bg-background p-1.5 ring-1 ring-border">
            {(["privato", "azienda"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDraft({ cleanerType: t })}
                className={cn(
                  "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold capitalize transition-all duration-200",
                  draft.cleanerType === t
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-primary"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Hourly rate */}
        <div className="flex flex-col gap-2">
          <label htmlFor="hourlyRate" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tariffa oraria (€/ora)
          </label>
          <Input
            id="hourlyRate"
            type="number"
            min="1"
            max="500"
            value={draft.hourlyRate}
            onChange={(e) => setDraft({ hourlyRate: e.target.value })}
            placeholder="es. 18"
            className="h-12 rounded-xl border-0 bg-background ring-1 ring-border focus-visible:ring-2 focus-visible:ring-accent transition-all"
          />
        </div>
      </div>

      {/* Services */}
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Servizi offerti</p>
        <div className="flex flex-wrap gap-2.5">
          {ALL_SERVICES.map((service) => {
            const selected = draft.services.includes(service);
            return (
              <button
                key={service}
                type="button"
                aria-label={service}
                onClick={() => toggleService(service)}
                className={cn(
                  "rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200",
                  selected
                    ? "bg-accent text-white shadow-sm shadow-accent/20"
                    : "bg-background text-muted-foreground ring-1 ring-border hover:ring-accent/40 hover:text-primary"
                )}
              >
                {service}
              </button>
            );
          })}
        </div>
        {draft.services.length === 0 && (
          <p className="text-xs text-error mt-1">Seleziona almeno un servizio</p>
        )}
      </div>

      {/* Availability toggle */}
      <div className="flex items-center justify-between rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-black/[0.04]">
        <div>
          <p className="text-sm font-semibold text-primary">Disponibile ora</p>
          <p className="text-xs text-muted-foreground mt-1">
            I clienti possono prenotarti
          </p>
        </div>
        <Switch
          checked={draft.isAvailable}
          onCheckedChange={(v) => setDraft({ isAvailable: v })}
        />
      </div>

      <div className="flex gap-3 mt-2">
        <Button variant="outline" onClick={onBack} className="flex-1 h-13 rounded-2xl text-base font-semibold ring-1 ring-border hover:bg-background transition-colors">
          Indietro
        </Button>
        <Button onClick={onNext} disabled={!canProceed} className="flex-1 h-13 rounded-2xl bg-accent text-base font-bold text-primary shadow-md shadow-accent/20 hover:bg-accent/90 transition-all active:scale-[0.98] disabled:opacity-30">
          Avanti
        </Button>
      </div>
    </div>
  );
}
