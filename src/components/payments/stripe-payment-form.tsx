"use client";
import { useState } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface StripePaymentFormProps {
  bookingId: string;
}

export function StripePaymentForm({ bookingId }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/client/bookings/${bookingId}/confirmed`,
      },
    });

    if (stripeError) {
      setError(stripeError.message ?? "Errore nel pagamento.");
      setLoading(false);
    }
    // On success, Stripe redirects to return_url
  }

  return (
    <div className="space-y-6">
      <PaymentElement />
      {error && <p className="text-sm text-[#e53e3e]">{error}</p>}
      <Button
        onClick={handlePay}
        disabled={loading || !stripe}
        className="w-full h-12 bg-[#1a3a35] text-white rounded-2xl font-semibold"
      >
        {loading ? "Pagamento in corso..." : "Paga ora"}
      </Button>
    </div>
  );
}
