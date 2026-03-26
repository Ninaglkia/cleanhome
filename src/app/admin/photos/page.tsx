import { createAdminClient } from "@/lib/supabase/admin";
import { PhotosGrid, type Photo } from "./photos-grid";

export const dynamic = "force-dynamic";

export default async function AdminPhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string; type?: string }>;
}) {
  const { booking_id, type } = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("booking_photos")
    .select(
      `id, photo_url, type, room_label, created_at, booking_id,
       uploader:profiles!booking_photos_uploaded_by_fkey(id, full_name),
       booking:bookings!booking_photos_booking_id_fkey(
         id, service_type, scheduled_date, status,
         client:profiles!bookings_client_id_fkey(id, full_name),
         cleaner:profiles!bookings_cleaner_id_fkey(id, full_name)
       )`
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (booking_id) {
    query = query.eq("booking_id", booking_id);
  }
  if (type && type !== "all") {
    query = query.eq("type", type);
  }

  const { data: photos } = await query;

  return (
    <div className="p-8">
      <h1 className="font-serif text-2xl text-primary mb-1">Foto archivio</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Tutte le foto di completamento e disputa
      </p>
      <PhotosGrid
        photos={(photos ?? []) as unknown as Photo[]}
        currentType={type ?? "all"}
        currentBookingId={booking_id ?? ""}
      />
    </div>
  );
}
