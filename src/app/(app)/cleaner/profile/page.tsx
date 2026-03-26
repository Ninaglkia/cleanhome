import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CleanerProfileEditForm } from "./cleaner-profile-edit-form";

export const dynamic = "force-dynamic";

export default async function CleanerProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, avatar_url, bio, city, lat, lng, cleaner_type, hourly_rate, services, is_available, cleaner_onboarded, stripe_account_id"
    )
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // If cleaner hasn't onboarded yet, redirect to onboarding
  if (!profile.cleaner_onboarded) redirect("/cleaner/onboarding");

  return (
    <div className="mx-auto max-w-lg">
      <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-4">
        <h2 className="font-serif text-2xl text-primary">Il mio profilo</h2>
      </div>
      <div className="px-4 py-6">
        <CleanerProfileEditForm
          userId={user.id}
          email={user.email ?? ""}
          initialName={profile.full_name ?? ""}
          initialAvatarUrl={profile.avatar_url ?? null}
          initialBio={profile.bio ?? ""}
          initialCity={profile.city ?? ""}
          initialCityLat={(profile.lat as number | null) ?? null}
          initialCityLng={(profile.lng as number | null) ?? null}
          initialCleanerType={(profile.cleaner_type as "privato" | "azienda") ?? "privato"}
          initialHourlyRate={profile.hourly_rate ?? 0}
          initialServices={(profile.services as string[]) ?? []}
          initialIsAvailable={profile.is_available ?? false}
          hasStripeAccount={!!profile.stripe_account_id}
        />
      </div>
    </div>
  );
}
