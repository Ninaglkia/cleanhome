import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCleanerPendingBookings } from "@/lib/supabase/bookings";
import { BookingCard } from "@/components/booking/booking-card";

export const dynamic = "force-dynamic";

export default async function CleanerBookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const bookings = await getCleanerPendingBookings(supabase, user.id);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold text-[#1a3a35]">Le tue prenotazioni</h1>
      {bookings.length === 0 ? (
        <p className="text-sm text-[#6b7280]">Nessuna prenotazione al momento.</p>
      ) : (
        bookings.map((b) => <BookingCard key={b.id} booking={b} viewAs="cleaner" />)
      )}
    </div>
  );
}
