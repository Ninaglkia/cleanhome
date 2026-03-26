"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle } from "lucide-react";
import type { OnboardingDraft } from "@/hooks/use-onboarding-draft";

interface StepConfirmProps {
  draft: OnboardingDraft;
  onBack: () => void;
  onComplete: () => void;
  submitting: boolean;
}

export function StepConfirm({ draft, onBack, onComplete, submitting }: StepConfirmProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3">
        <Avatar className="h-20 w-20 border-2 border-accent">
          <AvatarImage src={draft.avatarPreview || undefined} />
          <AvatarFallback className="bg-muted text-2xl font-semibold text-primary">
            {draft.fullName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h3 className="font-serif text-xl text-primary">{draft.fullName}</h3>
          <p className="text-sm text-muted-foreground">{draft.city}</p>
        </div>
        <Badge
          className={
            draft.cleanerType === "azienda"
              ? "bg-primary text-white"
              : "bg-accent/20 text-accent"
          }
        >
          {draft.cleanerType === "azienda" ? "Azienda" : "Privato"}
        </Badge>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tariffa oraria</span>
          <span className="font-medium text-primary">€{draft.hourlyRate}/ora</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Disponibile</span>
          <span className={draft.isAvailable ? "text-success font-medium" : "text-muted-foreground"}>
            {draft.isAvailable ? "Sì" : "No"}
          </span>
        </div>
      </div>

      {draft.services.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-primary">Servizi</p>
            <div className="flex flex-wrap gap-1.5">
              {draft.services.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-accent"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {draft.bio && (
        <>
          <Separator />
          <p className="text-sm text-muted-foreground leading-relaxed">{draft.bio}</p>
        </>
      )}

      <div className="flex gap-3 mt-2">
        <Button variant="outline" onClick={onBack} disabled={submitting} className="flex-1">
          Indietro
        </Button>
        <Button onClick={onComplete} disabled={submitting} className="flex-1 gap-2">
          <CheckCircle className="h-4 w-4" />
          {submitting ? "Salvataggio..." : "Completa profilo"}
        </Button>
      </div>
    </div>
  );
}
