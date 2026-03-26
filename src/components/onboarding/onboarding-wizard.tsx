"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { OnboardingProgress } from "./onboarding-progress";
import { StepProfile } from "./step-profile";
import { StepServices } from "./step-services";
import { StepConfirm } from "./step-confirm";

const TOTAL_STEPS = 3;

export function OnboardingWizard() {
  const router = useRouter();
  const { draft, setDraft, clearDraft, hydrated } = useOnboardingDraft();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const goToStep = useCallback(
    (step: 1 | 2 | 3) => setDraft({ step }),
    [setDraft]
  );

  const handleComplete = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      let avatarUrl: string | null = null;

      // Upload avatar if provided
      // avatarFile is not persisted in localStorage; we get it from the File input via the preview URL.
      // In a real Capacitor context this would use the camera blob.
      // Here we skip upload if no in-memory file is available (avatarPreview is a blob URL).
      if (draft.avatarPreview && draft.avatarPreview.startsWith("blob:")) {
        const res = await fetch(draft.avatarPreview);
        const blob = await res.blob();
        const ext = blob.type.split("/")[1] ?? "jpg";
        const path = `${user.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, blob, { upsert: true, contentType: blob.type });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: draft.fullName,
          avatar_url: avatarUrl ?? undefined,
          bio: draft.bio || null,
          city: draft.city,
          lat: draft.cityLat,
          lng: draft.cityLng,
          cleaner_type: draft.cleanerType,
          hourly_rate: Number(draft.hourlyRate),
          services: draft.services,
          is_available: draft.isAvailable,
          cleaner_onboarded: true,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      clearDraft();
      router.push("/cleaner");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Errore sconosciuto");
      setSubmitting(false);
    }
  }, [draft, clearDraft, router]);

  if (!hydrated) return null; // avoid SSR flash

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card px-4 py-3">
        <h1 className="text-center font-serif text-lg text-primary">
          Crea il tuo profilo
        </h1>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col gap-6 px-4 py-6 max-w-md mx-auto w-full">
        <OnboardingProgress currentStep={draft.step} totalSteps={TOTAL_STEPS} />

        <div className="text-center">
          <h2 className="font-serif text-2xl text-primary">
            {draft.step === 1 && "Il tuo profilo"}
            {draft.step === 2 && "Servizi e tariffa"}
            {draft.step === 3 && "Conferma"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Passo {draft.step} di {TOTAL_STEPS}
          </p>
        </div>

        {submitError && (
          <p className="rounded-xl bg-error/10 px-4 py-2 text-sm text-error">
            {submitError}
          </p>
        )}

        {draft.step === 1 && (
          <StepProfile
            draft={draft}
            setDraft={setDraft}
            onNext={() => goToStep(2)}
          />
        )}
        {draft.step === 2 && (
          <StepServices
            draft={draft}
            setDraft={setDraft}
            onNext={() => goToStep(3)}
            onBack={() => goToStep(1)}
          />
        )}
        {draft.step === 3 && (
          <StepConfirm
            draft={draft}
            onBack={() => goToStep(2)}
            onComplete={handleComplete}
            submitting={submitting}
          />
        )}
      </main>
    </div>
  );
}
