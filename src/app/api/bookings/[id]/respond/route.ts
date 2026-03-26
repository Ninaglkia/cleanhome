import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { dispatchNotification } from "@/lib/notifications/dispatcher";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json(); // "accept" | "decline"
  if (!["accept", "decline"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Fetch booking — must be cleaner_id === user.id and status === "pending"
  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("cleaner_id", user.id)
    .eq("status", "pending")
    .single();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found or already responded" }, { status: 404 });
  }

  // Check deadline
  const now = new Date();
  const deadline = new Date(booking.cleaner_deadline);
  if (now > deadline) {
    return NextResponse.json({ error: "Deadline scaduta" }, { status: 422 });
  }

  if (action === "accept") {
    // Capture the PaymentIntent (charge the card)
    await stripe.paymentIntents.capture(booking.stripe_payment_intent_id);

    await supabase
      .from("bookings")
      .update({ status: "accepted" })
      .eq("id", bookingId);

    await dispatchNotification({
      supabase,
      userId: booking.client_id,
      type: "booking_accepted",
      title: "Prenotazione accettata!",
      body: `Il tuo pulitore ha accettato la prenotazione per il ${booking.date}.`,
      data: { booking_id: bookingId },
    });
  } else {
    // Decline: cancel the PaymentIntent (full refund)
    await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id);

    await supabase
      .from("bookings")
      .update({ status: "declined" })
      .eq("id", bookingId);

    await dispatchNotification({
      supabase,
      userId: booking.client_id,
      type: "booking_declined",
      title: "Prenotazione declinata",
      body: `Il pulitore non è disponibile per il ${booking.date}. Il rimborso è automatico.`,
      data: { booking_id: bookingId },
    });
  }

  return NextResponse.json({ success: true });
}
