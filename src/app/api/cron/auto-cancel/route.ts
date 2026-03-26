import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { dispatchNotification } from "@/lib/notifications/dispatcher";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Find all pending bookings whose cleaner_deadline has passed
  const { data: overdueBookings } = await supabase
    .from("bookings")
    .select("id, client_id, cleaner_id, stripe_payment_intent_id, date")
    .eq("status", "pending")
    .lt("cleaner_deadline", now);

  if (!overdueBookings || overdueBookings.length === 0) {
    return NextResponse.json({ cancelled: 0 });
  }

  let cancelled = 0;
  for (const booking of overdueBookings) {
    try {
      // Cancel PaymentIntent = full refund
      if (booking.stripe_payment_intent_id) {
        await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id);
      }

      await supabase
        .from("bookings")
        .update({ status: "auto_cancelled" })
        .eq("id", booking.id);

      // Notify both parties
      await dispatchNotification({
        supabase,
        userId: booking.client_id,
        type: "booking_auto_cancelled",
        title: "Prenotazione annullata",
        body: `La prenotazione del ${booking.date} è stata annullata automaticamente. Rimborso in arrivo.`,
        data: { booking_id: booking.id },
        emailData: {
          recipientEmail: "",
          recipientName: "Cliente",
          bookingDate: booking.date,
          bookingId: booking.id,
        },
      });

      await dispatchNotification({
        supabase,
        userId: booking.cleaner_id,
        type: "booking_auto_cancelled",
        title: "Prenotazione annullata",
        body: `Non hai risposto in tempo. La prenotazione del ${booking.date} è stata annullata.`,
        data: { booking_id: booking.id },
        emailData: {
          recipientEmail: "",
          recipientName: "Pulitore",
          bookingDate: booking.date,
          bookingId: booking.id,
        },
      });

      cancelled++;
    } catch (err) {
      console.error(`Failed to auto-cancel booking ${booking.id}:`, err);
    }
  }

  return NextResponse.json({ cancelled });
}
