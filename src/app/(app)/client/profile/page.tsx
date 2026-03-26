import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientProfileForm } from "./client-profile-form";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, active_role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-lg">
      <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-4">
        <h2 className="font-serif text-2xl text-primary">Profilo</h2>
      </div>
      <div className="px-4 py-6">
        <ClientProfileForm
          userId={user.id}
          initialName={profile.full_name ?? ""}
          initialAvatarUrl={profile.avatar_url ?? null}
          email={user.email ?? ""}
        />
      </div>
    </div>
  );
}
