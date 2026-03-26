import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { insertNotification } from "@/lib/supabase/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const rating: unknown = body.rating;
  const comment: unknown = body.comment ?? null;

  // Validate rating
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Valutazione non valida (1-5)." }, { status: 400 });
  }
  if (comment !== null && typeof comment !== "string") {
    return NextResponse.json({ error: "Commento non valido." }, { status: 400 });
  }

  // Fetch booking — caller must be a participant
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, client_id, cleaner_id, status, date")
    .eq("id", bookingId)
    .single();

  if (!booking) return NextResponse.json({ error: "Prenotazione non trovata." }, { status: 404 });

  const isClient = booking.client_id === user.id;
  const isCleaner = booking.cleaner_id === user.id;
  if (!isClient && !isCleaner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only allow reviews after completion
  if (booking.status !== "completed") {
    return NextResponse.json(
      { error: "Le recensioni sono disponibili solo dopo il completamento." },
      { status: 400 }
    );
  }

  // Determine who is being reviewed
  const reviewedId = isClient ? booking.cleaner_id : booking.client_id;

  // Prevent duplicate reviews
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("reviewer_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Hai già lasciato una recensione per questa prenotazione." },
      { status: 409 }
    );
  }

  // Insert review
  const { error: insertError } = await supabase.from("reviews").insert({
    booking_id: bookingId,
    reviewer_id: user.id,
    reviewed_id: reviewedId,
    rating,
    comment: comment ?? null,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Notify the reviewed person
  const isClientReviewing = isClient;
  await insertNotification({
    supabase,
    userId: reviewedId,
    type: "review_received",
    title: "Nuova recensione ricevuta",
    body: isClientReviewing
      ? `Hai ricevuto una recensione di ${rating} stelle da un cliente.`
      : `Hai ricevuto una recensione di ${rating} stelle da un pulitore.`,
    data: { booking_id: bookingId },
  });

  return NextResponse.json({ ok: true });
}
