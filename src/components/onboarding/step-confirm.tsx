"use client";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
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
      {/* Profile hero */}
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04]">
        <Avatar className="h-24 w-24 ring-2 ring-accent ring-offset-4">
          <AvatarImage src={draft.avatarPreview || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-accent/20 to-accent/5 text-2xl font-bold text-accent">
            {draft.fullName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h3 className="font-serif text-2xl font-bold text-primary">{draft.fullName}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{draft.city}</p>
        </div>
        <Badge
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            draft.cleanerType === "azienda"
              ? "bg-primary/8 text-primary"
              : "bg-accent/10 text-accent"
          )}
        >
          {draft.cleanerType === "azienda" ? "Azienda" : "Privato"}
        </Badge>
      </div>

      {/* Details card */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] flex flex-col gap-4">
        <div className="flex justify-between items-center py-1">
          <span className="text-sm text-muted-foreground">Tariffa oraria</span>
          <span className="text-base font-bold text-accent">&euro;{draft.hourlyRate}/ora</span>
        </div>
        <Separator className="bg-border/50" />
        <div className="flex justify-between items-center py-1">
          <span className="text-sm text-muted-foreground">Disponibile</span>
          <span className={cn("text-sm font-semibold", draft.isAvailable ? "text-green-500" : "text-muted-foreground")}>
            {draft.isAvailable ? "Si" : "No"}
          </span>
        </div>

        {draft.services.length > 0 && (
          <>
            <Separator className="bg-border/50" />
            <div className="flex flex-col gap-2.5">
              <p className="text-sm font-medium text-muted-foreground">Servizi</p>
              <div className="flex flex-wrap gap-2">
                {draft.services.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
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
            <Separator className="bg-border/50" />
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-muted-foreground">Bio</p>
              <p className="text-sm text-primary/80 leading-relaxed">{draft.bio}</p>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3 mt-2">
        <Button variant="outline" onClick={onBack} disabled={submitting} className="flex-1 h-12 cursor-pointer rounded-xl text-base font-semibold ring-1 ring-border transition-colors duration-200 hover:bg-background">
          Indietro
        </Button>
        <Button onClick={onComplete} disabled={submitting} className="flex-1 h-12 cursor-pointer gap-2 rounded-xl bg-primary text-base font-semibold text-white shadow-md transition-all duration-200 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed">
          <CheckCircle className="h-4 w-4" strokeWidth={2} />
          {submitting ? "Salvataggio..." : "Completa profilo"}
        </Button>
      </div>
    </div>
  );
}
