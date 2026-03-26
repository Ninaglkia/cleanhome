"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SplashScreen } from "@/components/splash-screen";
import { createClient } from "@/lib/supabase/client";

export default function HomePage() {
  const [showSplash, setShowSplash] = useState(true);
  const router = useRouter();

  const handleSplashComplete = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_role, cleaner_onboarded")
        .eq("id", user.id)
        .single();

      if (profile) {
        if (profile.active_role === "cleaner" && !profile.cleaner_onboarded) {
          router.push("/cleaner/onboarding");
        } else {
          router.push(`/${profile.active_role}`);
        }
        return;
      }
    }

    router.push("/choose-role");
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return null;
}
