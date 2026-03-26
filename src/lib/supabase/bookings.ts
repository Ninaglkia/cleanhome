import type { SupabaseClient } from "@supabase/supabase-js";
import type { Booking } from "@/types/booking";

export async function getBookingById(
  supabase: SupabaseClient,
  bookingId: string
): Promise<Booking | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `*,
       client:profiles!bookings_client_id_fkey(full_name, avatar_url),
       cleaner:profiles!bookings_cleaner_id_fkey(full_name, avatar_url, hourly_rate)`
    )
    .eq("id", bookingId)
    .single();

  if (error || !data) return null;
  return data as Booking;
}

export async function getClientBookings(
  supabase: SupabaseClient,
  clientId: string
): Promise<Booking[]> {
  const { data } = await supabase
    .from("bookings")
    .select(
      `*, cleaner:profiles!bookings_cleaner_id_fkey(full_name, avatar_url)`
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return (data ?? []) as Booking[];
}

export async function getCleanerPendingBookings(
  supabase: SupabaseClient,
  cleanerId: string
): Promise<Booking[]> {
  const { data } = await supabase
    .from("bookings")
    .select(
      `*, client:profiles!bookings_client_id_fkey(full_name, avatar_url)`
    )
    .eq("cleaner_id", cleanerId)
    .in("status", ["pending", "accepted"])
    .order("date", { ascending: true });

  return (data ?? []) as Booking[];
}
