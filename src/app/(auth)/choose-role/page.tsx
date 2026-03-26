"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RoleCard } from "@/components/role-card";
import { SocialAuthButtons } from "@/components/social-auth-buttons";
import { createClient } from "@/lib/supabase/client";

export default function ChooseRolePage() {
  const [selectedRole, setSelectedRole] = useState<"cleaner" | "client" | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleContinue = async () => {
    if (!selectedRole) return;

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("profiles").update({ active_role: selectedRole }).eq("id", user.id);
      if (selectedRole === "cleaner") {
        router.push("/cleaner/onboarding");
      } else {
        router.push("/client");
      }
    } else {
      router.push(`/signup?role=${selectedRole}`);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="font-serif text-4xl text-white">CleanHome</h1>
        <p className="mt-2 text-accent">Come vuoi usare CleanHome?</p>
      </div>

      <div className="flex flex-col gap-4">
        <RoleCard title="Sono un pulitore" description="Offri i tuoi servizi di pulizia" icon="sparkles" selected={selectedRole === "cleaner"} onClick={() => setSelectedRole("cleaner")} />
        <RoleCard title="Cerco un pulitore" description="Trova chi pulisce la tua casa" icon="search" selected={selectedRole === "client"} onClick={() => setSelectedRole("client")} />
      </div>

      <button onClick={handleContinue} disabled={!selectedRole} className="w-full rounded-xl bg-accent py-4 text-lg font-semibold text-primary transition-opacity disabled:opacity-40">
        Continua
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/20" /></div>
        <div className="relative flex justify-center"><span className="bg-primary px-4 text-sm text-white/60">oppure</span></div>
      </div>

      <SocialAuthButtons />
    </div>
  );
}
