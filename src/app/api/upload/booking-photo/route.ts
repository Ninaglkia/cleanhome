import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const bookingId = formData.get("booking_id") as string | null;
  const photoType = (formData.get("photo_type") as string) ?? "completion";
  const roomLabel = (formData.get("room_label") as string) ?? null;

  if (!file || !bookingId) {
    return NextResponse.json({ error: "Missing file or booking_id" }, { status: 400 });
  }

  // Verify user is participant of this booking
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, client_id, cleaner_id, status")
    .eq("id", bookingId)
    .single();

  if (!booking || (booking.client_id !== user.id && booking.cleaner_id !== user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Upload to Supabase Storage
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${bookingId}/${user.id}/${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("booking-photos")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Get public URL (bucket is private — use signed URL in real use; store path for now)
  const { data: { publicUrl } } = supabase.storage
    .from("booking-photos")
    .getPublicUrl(path);

  // Insert record
  const { data: photo, error: dbError } = await supabase
    .from("booking_photos")
    .insert({
      booking_id: bookingId,
      uploaded_by: user.id,
      photo_url: publicUrl,
      type: photoType,
      room_label: roomLabel,
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ photo });
}
