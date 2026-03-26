import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { buildWeeklyPayouts } from "@/lib/stripe/payout";
import { insertNotification } from "@/lib/supabase/notifications";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Week window: last Monday 00:00 to this Monday 00:00
  const now = new Date();
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - now.getDay() + 1);
  thisMonday.setHours(0, 0, 0, 0);
  const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weekStart = lastMonday.toISOString().split("T")[0];
  const weekEnd = thisMonday.toISOString().split("T")[0];

  // Fetch completed bookings in window
  const { data: rawBookings } = await supabase
    .from("bookings")
    .select(`
      id, cleaner_id, base_price, cleaner_fee,
      cleaner:profiles!bookings_cleaner_id_fkey(stripe_account_id)
    `)
    .eq("status", "completed")
    .gte("date", weekStart)
    .lt("date", weekEnd);

  if (!rawBookings || rawBookings.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const bookingsFlat = rawBookings.map((b: any) => ({
    id: b.id,
    cleaner_id: b.cleaner_id,
    base_price: b.base_price,
    cleaner_fee: b.cleaner_fee,
    stripe_account_id: b.cleaner?.stripe_account_id ?? null,
  }));

  const groups = buildWeeklyPayouts(bookingsFlat);
  let processed = 0;

  for (const group of groups) {
    const amountInCents = Math.round(group.netAmount * 100);
    try {
      const transfer = await stripe.transfers.create({
        amount: amountInCents,
        currency: "eur",
        destination: group.stripeAccountId,
        metadata: {
          cleaner_id: group.cleanerId,
          week_start: weekStart,
          week_end: weekEnd,
          booking_ids: group.bookingIds.join(","),
        },
      });

      const { data: payout } = await supabase
        .from("payouts")
        .insert({
          cleaner_id: group.cleanerId,
          week_start: weekStart,
          week_end: weekEnd,
          total_gross: group.totalGross,
          commission_deducted: group.commissionDeducted,
          net_amount: group.netAmount,
          stripe_transfer_id: transfer.id,
          status: "processed",
        })
        .select()
        .single();

      await insertNotification({
        supabase,
        userId: group.cleanerId,
        type: "payout_sent",
        title: "Pagamento inviato!",
        body: `Hai ricevuto €${group.netAmount.toFixed(2)} per la settimana ${weekStart} – ${weekEnd}.`,
        data: { payout_id: payout?.id, transfer_id: transfer.id },
      });

      processed++;
    } catch (err) {
      console.error(`Payout failed for cleaner ${group.cleanerId}:`, err);
      await supabase.from("payouts").insert({
        cleaner_id: group.cleanerId,
        week_start: weekStart,
        week_end: weekEnd,
        total_gross: group.totalGross,
        commission_deducted: group.commissionDeducted,
        net_amount: group.netAmount,
        stripe_transfer_id: null,
        status: "failed",
      });
    }
  }

  return NextResponse.json({ processed, total: groups.length });
}
