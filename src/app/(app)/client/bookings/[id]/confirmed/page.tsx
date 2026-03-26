import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getBookingById } from "@/lib/supabase/bookings";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, Clock, Home, MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingConfirmedPage({ params }: PageProps) {
  const { id: bookingId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const booking = await getBookingById(supabase, bookingId);
  if (!booking || booking.client_id !== user.id) redirect("/client/bookings");

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 py-10 text-center">
      {/* Success icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
        <CheckCircle className="h-10 w-10 text-success" />
      </div>

      {/* Heading */}
      <h1 className="font-serif text-3xl text-primary">Prenotazione confermata!</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Il tuo pagamento è andato a buon fine. Il pulitore riceverà una notifica e
        potrà accettare la prenotazione.
      </p>

      {/* Booking summary card */}
      <div className="mt-8 w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-left space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Riepilogo
        </p>

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
            <Home className="h-4 w-4 text-accent" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Servizio</p>
            <p className="text-sm font-medium text-primary">{booking.service_type}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
            <Calendar className="h-4 w-4 text-accent" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Data</p>
            <p className="text-sm font-medium text-primary">{booking.date}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
            <Clock className="h-4 w-4 text-accent" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Orario</p>
            <p className="text-sm font-medium text-primary">{booking.time_slot}</p>
          </div>
        </div>

        {booking.cleaner?.full_name && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
              <MessageCircle className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pulitore</p>
              <p className="text-sm font-medium text-primary">{booking.cleaner.full_name}</p>
            </div>
          </div>
        )}

        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Totale pagato</p>
            <p className="text-base font-bold text-primary">
              €{booking.total_price?.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
        <Button asChild className="w-full">
          <Link href={`/client/bookings/${bookingId}`}>
            Vai alla prenotazione
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/client">Torna alla home</Link>
        </Button>
      </div>
    </div>
  );
}
