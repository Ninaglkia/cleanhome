import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookingForm } from "@/components/booking/booking-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BookCleanerPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, hourly_rate, cleaner_onboarded, is_available, is_banned")
    .eq("id", id)
    .eq("cleaner_onboarded", true)
    .eq("is_available", true)
    .eq("is_banned", false)
    .single();

  if (!profile || !profile.hourly_rate) notFound();

  return (
    <div className="max-w-lg mx-auto pb-24">
      <BookingForm
        cleanerId={id}
        hourlyRate={profile.hourly_rate}
        cleanerName={profile.full_name}
      />
    </div>
  );
}
