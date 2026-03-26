import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBookingById } from "@/lib/supabase/bookings";
import { ReviewForm } from "@/components/reviews/review-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientReviewPage({ params }: PageProps) {
  const { id: bookingId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const booking = await getBookingById(supabase, bookingId);
  if (!booking || booking.client_id !== user.id) redirect("/client/bookings");
  if (booking.status !== "completed") redirect(`/client/bookings/${bookingId}`);

  // Check if already reviewed
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("reviewer_id", user.id)
    .maybeSingle();

  if (existing) redirect(`/client/bookings/${bookingId}`);

  const cleanerName = booking.cleaner?.full_name ?? "il pulitore";

  return (
    <div className="min-h-screen bg-[#f0f4f3]">
      <div className="max-w-lg mx-auto bg-white min-h-screen">
        <ReviewForm
          bookingId={bookingId}
          reviewedName={cleanerName}
          redirectTo={`/client/bookings/${bookingId}`}
        />
      </div>
    </div>
  );
}
