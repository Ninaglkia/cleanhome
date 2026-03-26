"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function useRole(initialRole: "cleaner" | "client") {
  const [activeRole, setActiveRole] = useState(initialRole);
  const [switching, setSwitching] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const switchRole = async () => {
    setSwitching(true);
    const newRole = activeRole === "cleaner" ? "client" : "cleaner";
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) { setSwitching(false); return; }

    if (newRole === "cleaner") {
      const { data: profile } = await supabase.from("profiles").select("cleaner_onboarded").eq("id", user.id).single();
      if (profile && !profile.cleaner_onboarded) {
        await supabase.from("profiles").update({ active_role: "cleaner" }).eq("id", user.id);
        router.push("/cleaner/onboarding");
        setSwitching(false);
        return;
      }
    }

    await supabase.from("profiles").update({ active_role: newRole }).eq("id", user.id);
    setActiveRole(newRole);
    router.push(`/${newRole}`);
    setSwitching(false);
  };

  return { activeRole, switchRole, switching };
}
