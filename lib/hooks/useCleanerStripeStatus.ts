import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CleanerStripeStatus = "not-configured" | "pending" | "active";

interface StripeStatusRow {
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
}

interface UseCleanerStripeStatusResult {
  status: CleanerStripeStatus;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveStatus(row: StripeStatusRow | null): CleanerStripeStatus {
  if (!row || !row.stripe_account_id) return "not-configured";
  if (
    row.stripe_onboarding_complete === true &&
    row.stripe_charges_enabled === true &&
    row.stripe_payouts_enabled === true
  ) {
    return "active";
  }
  return "pending";
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useCleanerStripeStatus(
  cleanerId: string | null | undefined
): UseCleanerStripeStatusResult {
  const [status, setStatus] = useState<CleanerStripeStatus>("not-configured");
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

  const fetch = useCallback(async () => {
    if (!cleanerId) {
      if (isMountedRef.current) {
        setStatus("not-configured");
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
          "stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled"
        )
        .eq("id", cleanerId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (isMountedRef.current) {
        setStatus(deriveStatus(data as StripeStatusRow | null));
      }
    } catch (e) {
      if (isMountedRef.current) {
        setError(
          e instanceof Error
            ? e
            : new Error("Impossibile caricare lo stato pagamenti")
        );
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [cleanerId]);

  // Initial load
  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime subscription: UPDATE on cleaner_profiles for this cleaner
  // so the card updates automatically when Stripe webhooks fire.
  useEffect(() => {
    if (!cleanerId) return;

    channelRef.current = supabase
      .channel(`cleaner-stripe-status-${cleanerId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cleaner_profiles",
          filter: `id=eq.${cleanerId}`,
        },
        (payload) => {
          const updated = payload.new as StripeStatusRow;
          if (isMountedRef.current) {
            setStatus(deriveStatus(updated));
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

  return { status, isLoading, error, refetch: fetch };
}
