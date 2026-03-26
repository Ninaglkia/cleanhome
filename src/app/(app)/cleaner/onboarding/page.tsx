import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function CleanerOnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("cleaner_onboarded, active_role")
    .eq("id", user.id)
    .single();

  // Already onboarded: redirect to cleaner home
  if (profile?.cleaner_onboarded) redirect("/cleaner");

  return <OnboardingWizard />;
}
