import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CleanerProfileHeader } from "@/components/profile/cleaner-profile-header";
import { CleanerServicesList } from "@/components/profile/cleaner-services-list";
import { CleanerReviewsList } from "@/components/profile/cleaner-reviews-list";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { getReviewsForProfile, calcAverageRating } from "@/lib/supabase/reviews";
import type { CleanerProfile } from "@/types/cleaner";
import type { Review } from "@/components/profile/cleaner-reviews-list";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CleanerProfilePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch cleaner profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, avatar_url, bio, city, lat, lng, cleaner_type, hourly_rate, services, is_available, cleaner_onboarded, is_banned"
    )
    .eq("id", id)
    .eq("cleaner_onboarded", true)
    .eq("is_banned", false)
    .single();

  if (error || !profile) notFound();

  // Fetch reviews with reviewer names (works for both client and cleaner reviewers)
  const rawReviews = await getReviewsForProfile(supabase, id);

  const reviews: Review[] = rawReviews.map((r) => ({
    id: r.id,
    reviewer_id: r.reviewer_id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    reviewer_name: r.reviewer_name,
    reviewer_avatar: r.reviewer_avatar,
  }));

  const avgRating = calcAverageRating(reviews);

  const cleaner: CleanerProfile = {
    id: profile.id,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    bio: profile.bio,
    city: profile.city,
    cleaner_type: profile.cleaner_type as "privato" | "azienda",
    hourly_rate: profile.hourly_rate,
    services: profile.services,
    is_available: profile.is_available,
    avg_rating: avgRating,
    review_count: reviews.length,
    distance_km: 0, // not shown on profile page
  };

  return (
    <div className="flex flex-col gap-px bg-background pb-8">
      <CleanerProfileHeader cleaner={cleaner} />

      {profile.bio && (
        <>
          <Separator />
          <div className="bg-card px-6 py-5">
            <h2 className="mb-2 font-semibold text-primary">Chi sono</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
          </div>
        </>
      )}

      <Separator />
      <CleanerServicesList services={profile.services ?? []} />

      <Separator />
      <CleanerReviewsList reviews={reviews} />

      {/* CTA sticky footer */}
      <div className="fixed bottom-[64px] left-0 right-0 z-20 border-t border-border bg-card px-4 py-3">
        <Button asChild className="w-full" size="lg">
          <Link href={`/client/cleaners/${id}/booking`}>
            Prenota
          </Link>
        </Button>
      </div>
    </div>
  );
}
