import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getBookingById } from "@/lib/supabase/bookings";
import { getMessages } from "@/lib/supabase/messages";
import { getBookingPhotos } from "@/lib/supabase/booking-photos";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { ChatView } from "@/components/chat/chat-view";
import { CompletionUpload } from "@/components/completion/completion-upload";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CleanerBookingDetailPage({ params }: PageProps) {
  const { id: bookingId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const booking = await getBookingById(supabase, bookingId);
  if (!booking || booking.cleaner_id !== user.id) redirect("/cleaner/bookings");

  const initialMessages = await getMessages(supabase, bookingId);

  const isAccepted = booking.status === "accepted";
  const isWorkDone = booking.status === "work_done";
  const isCompleted = ["completed", "disputed"].includes(booking.status);
  const isReviewable = booking.status === "completed";

  // Check if cleaner has already left a review
  let hasReviewed = false;
  if (isReviewable) {
    const { data: existingReview } = await supabase
      .from("reviews")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("reviewer_id", user.id)
      .maybeSingle();
    hasReviewed = !!existingReview;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="p-4 border-b border-[#e0eae8] bg-white">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-base font-semibold text-[#1a3a35]">
            {booking.service_type}
          </h1>
          <BookingStatusBadge status={booking.status} />
        </div>
        <p className="text-xs text-[#6b7280]">
          {booking.date} alle {booking.time_slot} · {booking.num_rooms} stanze
        </p>
        <p className="text-xs text-[#6b7280]">
          Cliente: {booking.client?.full_name}
        </p>
      </div>

      {/* Chat (only when accepted or work_done) */}
      {(isAccepted || isWorkDone) && (
        <div className="flex-1 overflow-hidden">
          <ChatView
            bookingId={bookingId}
            currentUserId={user.id}
            initialMessages={initialMessages}
            address={booking.address}
            notes={booking.notes}
          />
        </div>
      )}

      {/* Completion upload panel (only when accepted — cleaner hasn't marked done yet) */}
      {isAccepted && (
        <div className="border-t border-[#e0eae8] bg-white overflow-y-auto max-h-[50vh]">
          <CompletionUpload
            bookingId={bookingId}
            onComplete={() => {
              // Client-side redirect after POST succeeds
              window.location.reload();
            }}
          />
        </div>
      )}

      {isWorkDone && (
        <div className="p-4 bg-[#f0f4f3] border-t border-[#e0eae8] text-sm text-center text-[#1a3a35]">
          Lavoro segnato come terminato. In attesa della conferma del cliente.
        </div>
      )}

      {isCompleted && (
        <div className="p-4 text-center space-y-3">
          <p className="text-sm text-[#6b7280]">Prenotazione chiusa.</p>
          {isReviewable && !hasReviewed && (
            <Button asChild size="sm" className="w-full">
              <Link href={`/cleaner/bookings/${bookingId}/review`}>
                Valuta il cliente
              </Link>
            </Button>
          )}
          {isReviewable && hasReviewed && (
            <p className="text-xs text-[#6b7280]">Recensione già inviata.</p>
          )}
        </div>
      )}
    </div>
  );
}
