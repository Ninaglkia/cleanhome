import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { StripeIdentityStatus } from "../types";

// ─── Return shape ─────────────────────────────────────────────────────────────

export interface UseIdentityVerificationResult {
  status: StripeIdentityStatus | null;
  verifiedAt: string | null;
  lastError: string | null;
  isVerified: boolean;
  isProcessing: boolean;
  isLoading: boolean;
  error: Error | null;
  /** Calls the Edge Function, returns the client_secret for the Stripe Identity SDK */
  startVerification: () => Promise<string>;
  refetch: () => Promise<void>;
}

// ─── Row shape fetched from cleaner_profiles ──────────────────────────────────

interface IdentityRow {
  stripe_identity_status: StripeIdentityStatus | null;
  stripe_identity_verified_at: string | null;
  stripe_identity_last_error: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIdentityVerification(
  cleanerId: string | null | undefined
): UseIdentityVerificationResult {
  const [status, setStatus] = useState<StripeIdentityStatus | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Fetch from DB ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!cleanerId) {
      if (isMountedRef.current) {
        setStatus(null);
        setVerifiedAt(null);
        setLastError(null);
        setIsLoading(false);
      }
      return;
    }

    if (isMountedRef.current) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const { data, error: fetchError } = await supabase
        .from("cleaner_profiles")
        .select(
          "stripe_identity_status, stripe_identity_verified_at, stripe_identity_last_error"
        )
        .eq("id", cleanerId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (isMountedRef.current && data) {
        const row = data as IdentityRow;
        setStatus(row.stripe_identity_status);
        setVerifiedAt(row.stripe_identity_verified_at);
        setLastError(row.stripe_identity_last_error);
      }
    } catch (e) {
      if (isMountedRef.current) {
        setError(
          e instanceof Error
            ? e
            : new Error("Impossibile caricare lo stato verifica identità")
        );
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [cleanerId]);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Realtime subscription — updates live when the webhook fires ─────────────
  useEffect(() => {
    if (!cleanerId) return;

    channelRef.current = supabase
      .channel(`identity-verification-${cleanerId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cleaner_profiles",
          filter: `id=eq.${cleanerId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<IdentityRow>;
          if (isMountedRef.current) {
            if (updated.stripe_identity_status !== undefined) {
              setStatus(updated.stripe_identity_status ?? null);
            }
            if (updated.stripe_identity_verified_at !== undefined) {
              setVerifiedAt(updated.stripe_identity_verified_at ?? null);
            }
            if (updated.stripe_identity_last_error !== undefined) {
              setLastError(updated.stripe_identity_last_error ?? null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [cleanerId]);

  // ── startVerification — calls Edge Function, returns client_secret ──────────
  const startVerification = useCallback(async (): Promise<string> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      throw new Error("Sessione non valida. Effettua di nuovo il login.");
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("EXPO_PUBLIC_SUPABASE_URL non configurato");
    }

    const res = await fetch(
      `${supabaseUrl}/functions/v1/stripe-identity-create-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      }
    );

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        (errBody as { error?: string }).error ??
          "Impossibile avviare la verifica"
      );
    }

    const body = (await res.json()) as { client_secret?: string };
    if (!body.client_secret) {
      throw new Error("Risposta della funzione non valida: client_secret mancante");
    }

    // Optimistically set local state to processing
    if (isMountedRef.current) {
      setStatus("processing");
    }

    return body.client_secret;
  }, []);

  return {
    status,
    verifiedAt,
    lastError,
    isVerified: status === "verified",
    isProcessing: status === "processing",
    isLoading,
    error,
    startVerification,
    refetch: loadData,
  };
}
