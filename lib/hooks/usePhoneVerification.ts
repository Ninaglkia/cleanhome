import { useState, useCallback } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../auth";

// ─── Return shape ──────────────────────────────────────────────────────────────

export interface UsePhoneVerificationResult {
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  isSending: boolean;
  isVerifying: boolean;
}

// ─── Helper to extract a typed error message ──────────────────────────────────

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePhoneVerification(): UsePhoneVerificationResult {
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { refreshProfile } = useAuth();

  const sendOtp = useCallback(async (phone: string): Promise<void> => {
    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-phone-otp", {
        body: { phone },
      });

      if (error) {
        // supabase-js wraps HTTP errors; check for 429 in the message or status
        const message = error.message ?? "";
        const isRateLimited =
          message.includes("429") ||
          (error as unknown as Record<string, unknown>)["status"] === 429;
        if (isRateLimited) {
          throw new Error("Troppi tentativi, riprova tra un'ora");
        }
        throw toError(error);
      }
    } finally {
      setIsSending(false);
    }
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, code: string): Promise<void> => {
      setIsVerifying(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "verify-phone-otp",
          { body: { phone, code } }
        );

        if (error) {
          const message = error.message ?? "";
          const isExpired =
            message.includes("429") ||
            message.includes("expired") ||
            message.includes("too many");
          if (isExpired) {
            throw new Error("Codice scaduto o troppi tentativi. Richiedi un nuovo codice.");
          }
          throw toError(error);
        }

        const result = data as Record<string, unknown>;

        if (result["ok"] === false) {
          const serverMsg =
            typeof result["error"] === "string"
              ? result["error"]
              : "Codice errato";
          throw new Error(serverMsg);
        }

        // Success — refresh profile so phone_verified is visible in memory
        await refreshProfile();
      } finally {
        setIsVerifying(false);
      }
    },
    [refreshProfile]
  );

  return { sendOtp, verifyOtp, isSending, isVerifying };
}
