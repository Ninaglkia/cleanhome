import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertNotification } from "@/lib/supabase/notifications";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  // Find all bookings in 'work_done' state where work_done_at is older than 48h
  const { data: overdueBookings } = await supabase
    .from("bookings")
    .select("id, client_id, cleaner_id, date, work_done_at")
    .eq("status", "work_done")
    .lt("work_done_at", cutoff);

  if (!overdueBookings || overdueBookings.length === 0) {
    return NextResponse.json({ auto_confirmed: 0 });
  }

  let confirmed = 0;

  for (const booking of overdueBookings) {
    try {
      // Auto-confirm as completed
      await supabase
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", booking.id);

      // Notify cleaner
      await insertNotification({
        supabase,
        userId: booking.cleaner_id,
        type: "booking_confirmed",
        title: "Lavoro auto-confermato",
        body: `Il lavoro del ${booking.date} è stato confermato automaticamente dopo 48h. Riceverai il pagamento nel prossimo payout.`,
        data: { booking_id: booking.id, auto_confirmed: true },
      });

      // Notify client
      await insertNotification({
        supabase,
        userId: booking.client_id,
        type: "booking_confirmed",
        title: "Lavoro confermato automaticamente",
        body: `Non hai risposto entro 48h. Il lavoro del ${booking.date} è stato confermato automaticamente.`,
        data: { booking_id: booking.id, auto_confirmed: true },
      });

      confirmed++;
    } catch (err) {
      console.error(`Failed to auto-confirm booking ${booking.id}:`, err);
    }
  }

  return NextResponse.json({ auto_confirmed: confirmed });
}
