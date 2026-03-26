import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingPhoto, PhotoType } from "@/types/booking-photo";

export async function getBookingPhotos(
  supabase: SupabaseClient,
  bookingId: string,
  type?: PhotoType
): Promise<BookingPhoto[]> {
  let query = supabase
    .from("booking_photos")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (type) query = query.eq("type", type);

  const { data } = await query;
  return (data ?? []) as BookingPhoto[];
}
