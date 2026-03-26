import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBookingById } from "@/lib/supabase/bookings";
import { ReviewForm } from "@/components/reviews/review-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CleanerReviewPage({ params }: PageProps) {
  const { id: bookingId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const booking = await getBookingById(supabase, bookingId);
  if (!booking || booking.cleaner_id !== user.id) redirect("/cleaner/bookings");
  if (booking.status !== "completed") redirect(`/cleaner/bookings/${bookingId}`);

  // Check if already reviewed
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("reviewer_id", user.id)
    .maybeSingle();

  if (existing) redirect(`/cleaner/bookings/${bookingId}`);

  const clientName = booking.client?.full_name ?? "il cliente";

  return (
    <div className="min-h-screen bg-[#f0f4f3]">
      <div className="max-w-lg mx-auto bg-white min-h-screen">
        <ReviewForm
          bookingId={bookingId}
          reviewedName={clientName}
          redirectTo={`/cleaner/bookings/${bookingId}`}
        />
      </div>
    </div>
  );
}
