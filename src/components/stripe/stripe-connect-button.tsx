"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface StripeConnectButtonProps {
  hasAccount?: boolean;
}

export function StripeConnectButton({
  hasAccount = false,
}: StripeConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);

    try {
      // If already has account, fetch a new link; otherwise create account + link
      const endpoint = hasAccount
        ? "/api/stripe/connect-account/link"
        : "/api/stripe/connect-account";

      const method = hasAccount ? "GET" : "POST";
      const res = await fetch(endpoint, { method });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Errore durante la connessione a Stripe.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleConnect}
        disabled={loading}
        className="w-full h-12 bg-[#1a3a35] text-white rounded-2xl font-semibold"
      >
        {loading
          ? "Caricamento..."
          : hasAccount
            ? "Continua configurazione pagamenti"
            : "Collega account Stripe"}
      </Button>
      {error && <p className="text-sm text-[#e53e3e]">{error}</p>}
    </div>
  );
}
