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

  const body = await req.json();
  const action: "confirm" | "dispute" = body.action;

  // Fetch booking — only the client may call this
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, client_id, cleaner_id, status, date")
    .eq("id", bookingId)
    .single();

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.client_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (booking.status !== "work_done") {
    return NextResponse.json({ error: "Booking is not awaiting confirmation" }, { status: 400 });
  }

  if (action === "confirm") {
    // Mark completed — payment will be released in weekly payout cron
    await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", bookingId);

    // Notify cleaner
    await insertNotification({
      supabase,
      userId: booking.cleaner_id,
      type: "booking_confirmed",
      title: "Lavoro confermato!",
      body: `Il cliente ha confermato il lavoro del ${booking.date}. Riceverai il pagamento nel prossimo payout.`,
      data: { booking_id: bookingId },
    });

    // Trigger review requests for both parties
    await insertNotification({
      supabase,
      userId: booking.client_id,
      type: "booking_confirmed",
      title: "Lascia una recensione",
      body: "Come è andato il servizio? Lascia una valutazione al tuo pulitore.",
      data: { booking_id: bookingId, prompt: "review" },
    });

    await insertNotification({
      supabase,
      userId: booking.cleaner_id,
      type: "booking_confirmed",
      title: "Lascia una recensione",
      body: "Valuta la tua esperienza con questo cliente.",
      data: { booking_id: bookingId, prompt: "review" },
    });

    return NextResponse.json({ ok: true, status: "completed" });
  }

  if (action === "dispute") {
    const description: string = body.description ?? "";
    if (!description.trim()) {
      return NextResponse.json({ error: "La descrizione del problema è obbligatoria." }, { status: 400 });
    }

    // Mark booking as disputed
    await supabase
      .from("bookings")
      .update({ status: "disputed" })
      .eq("id", bookingId);

    // Create dispute record
    const { data: dispute, error: disputeError } = await supabase
      .from("disputes")
      .insert({
        booking_id: bookingId,
        client_id: booking.client_id,
        cleaner_id: booking.cleaner_id,
        client_description: description,
        status: "open",
      })
      .select()
      .single();

    if (disputeError) {
      return NextResponse.json({ error: disputeError.message }, { status: 500 });
    }

    // Notify cleaner
    await insertNotification({
      supabase,
      userId: booking.cleaner_id,
      type: "dispute_opened",
      title: "Disputa aperta",
      body: `Il cliente ha segnalato un problema per il lavoro del ${booking.date}.`,
      data: { booking_id: bookingId, dispute_id: dispute.id },
    });

    // Notify admin (Phase 5 will wire the admin panel UI; here we create the record + notify)
    // Admin notification is sent from the auto-confirm cron and this route via service role
    // For now, rely on admin notifications table — Phase 5 will add admin panel query

    return NextResponse.json({ ok: true, status: "disputed", dispute_id: dispute.id });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
