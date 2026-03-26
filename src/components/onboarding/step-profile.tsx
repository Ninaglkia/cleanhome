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
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04]">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 rounded-full group"
          aria-label="Carica foto profilo"
        >
          <Avatar className="h-24 w-24 ring-2 ring-dashed ring-accent/30 ring-offset-4 group-hover:ring-accent/60 transition-all duration-200">
            <AvatarImage src={draft.avatarPreview || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-accent/15 to-accent/5 text-accent">
              <Camera className="h-9 w-9" strokeWidth={1.5} />
            </AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent shadow-md shadow-accent/25 group-hover:scale-110 transition-transform duration-200">
            <Camera className="h-4 w-4 text-white" strokeWidth={2} />
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

      {/* Name + City */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="fullName" className="text-sm font-medium text-muted-foreground">
            Nome completo
          </label>
          <Input
            id="fullName"
            value={draft.fullName}
            onChange={(e) => setDraft({ fullName: e.target.value })}
            placeholder="Mario Rossi"
            className="h-12 rounded-xl border border-border bg-white focus-visible:ring-2 focus-visible:ring-accent/30 transition-all"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="city" className="text-sm font-medium text-muted-foreground">
            Città / zona
          </label>
          <Input
            id="city"
            ref={cityInputRef}
            defaultValue={draft.city}
            placeholder="Roma, Milano..."
            autoComplete="off"
            className="h-12 rounded-xl border border-border bg-white focus-visible:ring-2 focus-visible:ring-accent/30 transition-all"
          />
        </div>
      </div>

      {/* Bio */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] flex flex-col gap-2">
        <label htmlFor="bio" className="text-sm font-medium text-muted-foreground">
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
          className="w-full resize-none rounded-xl border border-border bg-white px-4 py-3 text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
        />
        <p className="text-right text-[11px] text-muted-foreground">
          {draft.bio.length}/{MAX_BIO}
        </p>
      </div>

      <Button onClick={onNext} disabled={!canProceed} className="mt-2 h-12 cursor-pointer rounded-xl bg-accent text-base font-semibold text-primary shadow-md shadow-accent/20 transition-all duration-200 hover:bg-accent/90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed">
        Avanti
      </Button>
    </div>
  );
}
