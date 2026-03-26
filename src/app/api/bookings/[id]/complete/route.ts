import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { insertNotification } from "@/lib/supabase/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch booking — only the cleaner may call this
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, client_id, cleaner_id, status, date")
    .eq("id", bookingId)
    .single();

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.cleaner_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (booking.status !== "accepted") {
    return NextResponse.json({ error: "Booking is not in accepted state" }, { status: 400 });
  }

  // Verify at least 1 completion photo was uploaded
  const { count } = await supabase
    .from("booking_photos")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("type", "completion");

  if ((count ?? 0) === 0) {
    return NextResponse.json(
      { error: "Carica almeno una foto prima di completare il lavoro." },
      { status: 400 }
    );
  }

  // Mark booking as awaiting client confirmation
  // We use a new transient status "work_done" to distinguish from "completed"
  // Add "work_done" to BookingStatus type in src/types/booking.ts
  await supabase
    .from("bookings")
    .update({ status: "work_done", work_done_at: new Date().toISOString() })
    .eq("id", bookingId);

  // Notify client
  await insertNotification({
    supabase,
    userId: booking.client_id,
    type: "job_completed",
    title: "Lavoro terminato!",
    body: `Il tuo pulitore ha completato il lavoro del ${booking.date}. Controlla le foto e conferma.`,
    data: { booking_id: bookingId },
  });

  return NextResponse.json({ ok: true });
}
