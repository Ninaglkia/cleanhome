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
      {/* Type toggle */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Tipo</p>
        <div className="flex gap-2">
          {(["privato", "azienda"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setDraft({ cleanerType: t })}
              className={cn(
                "flex-1 rounded-xl border px-4 py-2 text-sm font-medium capitalize transition-colors",
                draft.cleanerType === t
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Hourly rate */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="hourlyRate" className="text-sm font-medium text-primary">
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
        />
      </div>

      {/* Services */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Servizi offerti</p>
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
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  selected
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-card text-muted-foreground"
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
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-medium text-primary">Disponibile</p>
          <p className="text-xs text-muted-foreground">
            I clienti possono prenotarti
          </p>
        </div>
        <Switch
          checked={draft.isAvailable}
          onCheckedChange={(v) => setDraft({ isAvailable: v })}
        />
      </div>

      <div className="flex gap-3 mt-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Indietro
        </Button>
        <Button onClick={onNext} disabled={!canProceed} className="flex-1">
          Avanti
        </Button>
      </div>
    </div>
  );
}
