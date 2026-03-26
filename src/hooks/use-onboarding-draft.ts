"use client";

import { useState, useEffect, useCallback } from "react";

export interface OnboardingDraft {
  step: 1 | 2 | 3;
  // Step 1
  avatarFile: null; // never persisted in localStorage — only in memory
  avatarPreview: string;
  fullName: string;
  city: string;
  cityLat: number | null;
  cityLng: number | null;
  bio: string;
  // Step 2
  cleanerType: "privato" | "azienda";
  hourlyRate: string;
  services: string[];
  isAvailable: boolean;
}

const DRAFT_KEY = "cleanhome_onboarding_draft";

const DEFAULT_DRAFT: OnboardingDraft = {
  step: 1,
  avatarFile: null,
  avatarPreview: "",
  fullName: "",
  city: "",
  cityLat: null,
  cityLng: null,
  bio: "",
  cleanerType: "privato",
  hourlyRate: "",
  services: [],
  isAvailable: true,
};

export function useOnboardingDraft() {
  const [draft, setDraftState] = useState<OnboardingDraft>(DEFAULT_DRAFT);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<OnboardingDraft>;
        setDraftState((prev) => ({
          ...prev,
          ...saved,
          avatarFile: null, // never restore File object
          avatarPreview: "", // never restore blob URL
        }));
      }
    } catch {
      // ignore parse errors
    }
    setHydrated(true);
  }, []);

  const setDraft = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraftState((prev) => {
      const next = { ...prev, ...patch };
      // Persist everything except the File/Blob fields
      const { avatarFile: _f, avatarPreview: _p, ...persistable } = next;
      void _f; void _p;
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(persistable));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftState(DEFAULT_DRAFT);
  }, []);

  return { draft, setDraft, clearDraft, hydrated };
}
