"use client";

import { useRef, useCallback } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePlacesAutocomplete } from "@/hooks/use-places-autocomplete";
import type { OnboardingDraft } from "@/hooks/use-onboarding-draft";

interface StepProfileProps {
  draft: OnboardingDraft;
  setDraft: (patch: Partial<OnboardingDraft>) => void;
  onNext: () => void;
}

const MAX_BIO = 500;

export function StepProfile({ draft, setDraft, onNext }: StepProfileProps) {
  const cityInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  usePlacesAutocomplete({
    inputRef: cityInputRef,
    onSelect: ({ address, lat, lng }) => {
      setDraft({ city: address, cityLat: lat, cityLng: lng });
      if (cityInputRef.current) cityInputRef.current.value = address;
    },
  });

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const preview = URL.createObjectURL(file);
      setDraft({ avatarPreview: preview });
    },
    [setDraft]
  );

  const canProceed =
    draft.fullName.trim().length > 0 &&
    draft.city.trim().length > 0 &&
    draft.cityLat !== null;

  return (
    <div className="flex flex-col gap-6">
      {/* Avatar upload */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative focus-visible:outline-none"
          aria-label="Carica foto profilo"
        >
          <Avatar className="h-24 w-24 border-2 border-dashed border-accent">
            <AvatarImage src={draft.avatarPreview || undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground">
              <Camera className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-accent shadow">
            <Camera className="h-3.5 w-3.5 text-white" />
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="text-xs text-muted-foreground">Tocca per aggiungere una foto</p>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="text-sm font-medium text-primary">
          Nome completo
        </label>
        <Input
          id="fullName"
          value={draft.fullName}
          onChange={(e) => setDraft({ fullName: e.target.value })}
          placeholder="Mario Rossi"
        />
      </div>

      {/* City */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="city" className="text-sm font-medium text-primary">
          Città / zona
        </label>
        <Input
          id="city"
          ref={cityInputRef}
          defaultValue={draft.city}
          placeholder="Roma, Milano..."
          autoComplete="off"
        />
      </div>

      {/* Bio */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className="text-sm font-medium text-primary">
          Bio
        </label>
        <textarea
          id="bio"
          value={draft.bio}
          onChange={(e) => {
            if (e.target.value.length <= MAX_BIO) {
              setDraft({ bio: e.target.value });
            }
          }}
          rows={4}
          placeholder="Descrivi la tua esperienza e i tuoi punti di forza..."
          className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <p className="text-right text-xs text-muted-foreground">
          {draft.bio.length} / {MAX_BIO}
        </p>
      </div>

      <Button onClick={onNext} disabled={!canProceed} className="mt-2">
        Avanti
      </Button>
    </div>
  );
}
