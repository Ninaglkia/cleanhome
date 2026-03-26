import { redirect } from "next/navigation";
import { StripeProvider } from "@/components/payments/stripe-provider";
import { StripePaymentForm } from "@/components/payments/stripe-payment-form";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cs?: string }>;
}

export default async function PayPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { cs: clientSecret } = await searchParams;

  if (!clientSecret) redirect(`/client/bookings/${id}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <h2 className="text-xl font-semibold text-[#1a3a35] mb-6">Pagamento</h2>
      <StripeProvider clientSecret={clientSecret}>
        <StripePaymentForm bookingId={id} />
      </StripeProvider>
    </div>
  );
}
