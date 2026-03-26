import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CleanerProfileHeader } from "@/components/profile/cleaner-profile-header";
import { CleanerServicesList } from "@/components/profile/cleaner-services-list";
import { CleanerReviewsList } from "@/components/profile/cleaner-reviews-list";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
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

  // Fetch reviews with reviewer names
  const { data: rawReviews } = await supabase
    .from("reviews")
    .select(
      "id, reviewer_id, rating, comment, created_at, profiles!reviewer_id(full_name, avatar_url)"
    )
    .eq("reviewed_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const reviews: Review[] = (rawReviews ?? []).map((r: {
    id: string;
    reviewer_id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    profiles: { full_name: string | null; avatar_url: string | null } | null;
  }) => ({
    id: r.id,
    reviewer_id: r.reviewer_id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    reviewer_name: r.profiles?.full_name ?? null,
    reviewer_avatar: r.profiles?.avatar_url ?? null,
  }));

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

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
    avg_rating: Math.round(avgRating * 10) / 10,
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
