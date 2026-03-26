import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBookingById } from "@/lib/supabase/bookings";
import { getMessages } from "@/lib/supabase/messages";
import { getBookingPhotos } from "@/lib/supabase/booking-photos";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { ChatView } from "@/components/chat/chat-view";
import { CompletionConfirm } from "@/components/completion/completion-confirm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientBookingDetailPage({ params }: PageProps) {
  const { id: bookingId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const booking = await getBookingById(supabase, bookingId);
  if (!booking || booking.client_id !== user.id) redirect("/client/bookings");

  const initialMessages = await getMessages(supabase, bookingId);
  const completionPhotos = await getBookingPhotos(supabase, bookingId, "completion");

  const isAccepted = booking.status === "accepted";
  const isWorkDone = booking.status === "work_done";
  const isCompleted = booking.status === "completed";
  const isDisputed = booking.status === "disputed";

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
          Pulitore: {booking.cleaner?.full_name}
        </p>
      </div>

      {/* Chat */}
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

      {/* Confirmation panel — shown when cleaner has marked work done */}
      {isWorkDone && (
        <div className="border-t border-[#e0eae8] overflow-y-auto max-h-[60vh] bg-white">
          <CompletionConfirm
            bookingId={bookingId}
            completionPhotos={completionPhotos}
            onConfirmed={() => window.location.reload()}
          />
        </div>
      )}

      {isCompleted && (
        <div className="p-4 text-center space-y-2">
          <p className="text-sm font-semibold text-[#38a169]">Lavoro confermato. Grazie!</p>
          <p className="text-xs text-[#6b7280]">Lascia una recensione al tuo pulitore.</p>
        </div>
      )}

      {isDisputed && (
        <div className="p-4 text-center">
          <p className="text-sm font-semibold text-[#e53e3e]">Disputa aperta. Il nostro team la esaminerà.</p>
        </div>
      )}
    </div>
  );
}
