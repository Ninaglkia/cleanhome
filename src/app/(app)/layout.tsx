import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "./app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) { redirect("/login"); }

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_role, full_name, avatar_url, cleaner_onboarded")
    .eq("id", user.id)
    .single();

  if (!profile) { redirect("/choose-role"); }

  return (
    <AppShell activeRole={profile.active_role as "cleaner" | "client"} userName={profile.full_name}>
      {children}
    </AppShell>
  );
}
