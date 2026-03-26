import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("active_role, cleaner_onboarded")
          .eq("id", user.id)
          .single();

        if (profile) {
          if (profile.active_role === "cleaner" && !profile.cleaner_onboarded) {
            return NextResponse.redirect(`${origin}/cleaner/onboarding`);
          }
          return NextResponse.redirect(`${origin}/${profile.active_role}`);
        }
      }

      return NextResponse.redirect(`${origin}/choose-role`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
