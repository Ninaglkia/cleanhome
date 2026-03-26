import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle } from "lucide-react";
import type { Booking } from "@/types/booking";

export const dynamic = "force-dynamic";

export default async function CleanerMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch bookings that have or had an active chat
  const { data } = await supabase
    .from("bookings")
    .select(
      `*, client:profiles!bookings_client_id_fkey(full_name, avatar_url)`
    )
    .eq("cleaner_id", user.id)
    .in("status", ["accepted", "work_done", "completed", "disputed"])
    .order("created_at", { ascending: false });

  const bookings = (data ?? []) as Booking[];

  return (
    <div className="mx-auto max-w-lg">
      <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-4">
        <h2 className="font-serif text-2xl text-primary">Messaggi</h2>
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <MessageCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Nessun messaggio al momento.
            <br />
            Le chat appaiono quando accetti una prenotazione.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {bookings.map((booking) => {
            const client = booking.client;
            const initials = client?.full_name?.charAt(0).toUpperCase() ?? "?";
            return (
              <li key={booking.id}>
                <Link
                  href={`/cleaner/bookings/${booking.id}`}
                  className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/50"
                >
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={client?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-accent/15 font-semibold text-accent">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-primary">
                        {client?.full_name ?? "Cliente"}
                      </p>
                      <BookingStatusBadge status={booking.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {booking.service_type} · {booking.date} alle{" "}
                      {booking.time_slot}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
