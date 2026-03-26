import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { filterMessage, detectViolation } from "@/lib/anti-contact";
import { insertNotification } from "@/lib/supabase/notifications";

const VIOLATION_THRESHOLD = 3; // auto-report after 3 violations

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const rawContent: string = body.content ?? "";
  const photoUrl: string | null = body.photo_url ?? null;

  // Verify booking + participation + status=accepted
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, client_id, cleaner_id, status")
    .eq("id", bookingId)
    .single();

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.client_id !== user.id && booking.cleaner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (booking.status !== "accepted") {
    return NextResponse.json({ error: "Chat only available for accepted bookings" }, { status: 400 });
  }

  // Anti-contact filter
  const isViolation = detectViolation(rawContent);
  const filteredContent = filterMessage(rawContent);

  if (isViolation) {
    // Record violation with admin client (bypasses RLS)
    const admin = createAdminClient();
    await admin.from("contact_violations").insert({
      user_id: user.id,
      booking_id: bookingId,
      content: rawContent,
    });

    // Count total violations for this user
    const { count } = await admin
      .from("contact_violations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= VIOLATION_THRESHOLD) {
      // Auto-report: notify admin via notification (admin user_id must be stored or use a known admin query)
      // Find admin users
      const { data: admins } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "admin");

      for (const adminUser of admins ?? []) {
        await insertNotification({
          supabase: admin,
          userId: adminUser.id,
          type: "dispute_opened", // reusing closest type; Phase 5 adds admin-specific types
          title: "Utente segnalato — Tentativo contatto esterno",
          body: `L'utente ha tentato ${count} volte di condividere contatti diretti nella prenotazione ${bookingId}.`,
          data: { user_id: user.id, booking_id: bookingId, violation_count: count },
        });
      }
    }
  }

  // Insert the (filtered) message
  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      booking_id: bookingId,
      sender_id: user.id,
      content: filteredContent,
      photo_url: photoUrl,
    })
    .select(`*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url)`)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the other participant
  const recipientId =
    user.id === booking.client_id ? booking.cleaner_id : booking.client_id;

  await insertNotification({
    supabase,
    userId: recipientId,
    type: "new_message",
    title: "Nuovo messaggio",
    body: filteredContent.slice(0, 80),
    data: { booking_id: bookingId },
  });

  return NextResponse.json({
    message,
    warning: isViolation
      ? "Il tuo messaggio conteneva informazioni di contatto non consentite ed è stato filtrato."
      : null,
  });
}
