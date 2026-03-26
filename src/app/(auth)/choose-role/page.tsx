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
    <div className="flex flex-col gap-10">
      {/* Logo + heading */}
      <div className="text-center">
        <h1 className="font-serif text-5xl font-bold text-white tracking-tight md:text-6xl">
          Clean<span className="text-accent">Home</span>
        </h1>
        <p className="mt-3 text-base text-accent/80">Come vuoi usare CleanHome?</p>
      </div>

      {/* Role cards — side by side on desktop, stacked on mobile */}
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
        <RoleCard title="Sono un pulitore" description="Offri i tuoi servizi di pulizia" icon="sparkles" selected={selectedRole === "cleaner"} onClick={() => setSelectedRole("cleaner")} />
        <RoleCard title="Cerco un pulitore" description="Trova chi pulisce la tua casa" icon="search" selected={selectedRole === "client"} onClick={() => setSelectedRole("client")} />
      </div>

      {/* CTA */}
      <button
        onClick={handleContinue}
        disabled={!selectedRole}
        className="w-full cursor-pointer rounded-xl bg-accent py-4 text-lg font-semibold text-primary shadow-md shadow-accent/25 transition-all duration-200 hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/30 active:scale-[0.97] disabled:opacity-30 disabled:shadow-none disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
      >
        Continua
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
        <div className="relative flex justify-center"><span className="bg-transparent px-5 text-sm text-white/40 backdrop-blur-sm">oppure</span></div>
      </div>

      <SocialAuthButtons />
    </div>
  );
}
