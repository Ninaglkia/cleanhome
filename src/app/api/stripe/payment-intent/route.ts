import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import {
  calculateBookingPrice,
  calculateCleanerDeadline,
  estimateHours,
  isAdvanceBookingValid,
} from "@/lib/stripe/price";
import { insertNotification } from "@/lib/supabase/notifications";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { cleanerId, service_type, date, time_slot, num_rooms } = body;

  if (!cleanerId || !service_type || !date || !time_slot || !num_rooms) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!isAdvanceBookingValid(date, time_slot)) {
    return NextResponse.json(
      { error: "Prenotazione deve essere almeno 8 ore in anticipo." },
      { status: 422 }
    );
  }

  // Fetch cleaner
  const { data: cleaner } = await supabase
    .from("profiles")
    .select("id, full_name, hourly_rate, stripe_account_id, is_available, is_banned, cleaner_onboarded")
    .eq("id", cleanerId)
    .single();

  if (!cleaner || !cleaner.hourly_rate || cleaner.is_banned || !cleaner.cleaner_onboarded || !cleaner.is_available) {
    return NextResponse.json({ error: "Pulitore non disponibile" }, { status: 422 });
  }

  if (!cleaner.stripe_account_id) {
    return NextResponse.json(
      { error: "Il pulitore non ha ancora configurato i pagamenti." },
      { status: 422 }
    );
  }

  const estimated_hours = estimateHours(num_rooms);
  const { basePrice, clientFee, cleanerNet, platformMargin, totalPrice } =
    calculateBookingPrice(cleaner.hourly_rate, num_rooms);
  const cleanerFee = basePrice * 0.09;
  const cleanerDeadline = calculateCleanerDeadline(date, time_slot);

  // Create booking row
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      client_id: user.id,
      cleaner_id: cleanerId,
      service_type,
      date,
      time_slot,
      num_rooms,
      estimated_hours,
      base_price: basePrice,
      client_fee: clientFee,
      cleaner_fee: cleanerFee,
      total_price: totalPrice,
      status: "pending",
      cleaner_deadline: cleanerDeadline.toISOString(),
    })
    .select()
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Errore creazione prenotazione" }, { status: 500 });
  }

  // Create Stripe PaymentIntent (manual capture = hold funds)
  const amountInCents = Math.round(totalPrice * 100);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: "eur",
    capture_method: "manual",
    metadata: {
      booking_id: booking.id,
      cleaner_id: cleanerId,
      client_id: user.id,
    },
    transfer_data: {
      destination: cleaner.stripe_account_id,
    },
    // Transfer amount = cleaner net payout
    on_behalf_of: cleaner.stripe_account_id,
  });

  // Store PaymentIntent ID on booking
  await supabase
    .from("bookings")
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq("id", booking.id);

  // Notify cleaner
  await insertNotification({
    supabase,
    userId: cleanerId,
    type: "new_booking",
    title: "Nuova prenotazione",
    body: `Hai ricevuto una richiesta per ${service_type} il ${date} alle ${time_slot}`,
    data: { booking_id: booking.id },
  });

  return NextResponse.json({
    bookingId: booking.id,
    clientSecret: paymentIntent.client_secret,
  });
}
