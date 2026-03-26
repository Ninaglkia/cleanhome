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
    <div className="flex flex-col gap-5">
      {/* Type + Rate in one card */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col gap-4">
        {/* Type toggle */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-primary">Tipo di profilo</p>
          <div className="flex gap-2 rounded-xl bg-background p-1 border border-border">
            {(["privato", "azienda"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDraft({ cleanerType: t })}
                className={cn(
                  "flex-1 rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-all duration-150",
                  draft.cleanerType === t
                    ? "bg-accent text-white shadow-sm"
                    : "text-muted-foreground hover:text-primary"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Hourly rate */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="hourlyRate" className="text-sm font-semibold text-primary">
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
            className="rounded-xl focus-visible:ring-accent focus-visible:ring-2"
          />
        </div>
      </div>

      {/* Services in card */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col gap-3">
        <p className="text-sm font-semibold text-primary">Servizi offerti</p>
        <div className="flex flex-wrap gap-2">
          {ALL_SERVICES.map((service) => {
            const selected = draft.services.includes(service);
            return (
              <button
                key={service}
                type="button"
                aria-label={service}
                onClick={() => toggleService(service)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150",
                  selected
                    ? "bg-accent text-white shadow-sm shadow-accent/30"
                    : "border border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-primary"
                )}
              >
                {service}
              </button>
            );
          })}
        </div>
        {draft.services.length === 0 && (
          <p className="text-xs text-error">Seleziona almeno un servizio</p>
        )}
      </div>

      {/* Availability toggle */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-primary">Disponibile ora</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            I clienti possono prenotarti
          </p>
        </div>
        <Switch
          checked={draft.isAvailable}
          onCheckedChange={(v) => setDraft({ isAvailable: v })}
        />
      </div>

      <div className="flex gap-3 mt-1">
        <Button variant="outline" onClick={onBack} className="flex-1 h-12 rounded-2xl text-base font-semibold">
          Indietro
        </Button>
        <Button onClick={onNext} disabled={!canProceed} className="flex-1 h-12 rounded-2xl text-base font-bold shadow-md">
          Avanti
        </Button>
      </div>
    </div>
  );
}
