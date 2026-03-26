import { createAdminClient } from "@/lib/supabase/admin";
import { BookingsTable, type Booking } from "./bookings-table";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("bookings")
    .select(
      `id, service_type, scheduled_date, scheduled_time, status, total_price, created_at,
       client:profiles!bookings_client_id_fkey(id, full_name, email),
       cleaner:profiles!bookings_cleaner_id_fkey(id, full_name, email)`
    )
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: bookings } = await query;

  return (
    <div className="p-8">
      <h1 className="font-serif text-2xl text-primary mb-1">Prenotazioni</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Tutte le prenotazioni della piattaforma
      </p>
      <BookingsTable bookings={(bookings ?? []) as unknown as Booking[]} currentStatus={status ?? "all"} />
    </div>
  );
}
