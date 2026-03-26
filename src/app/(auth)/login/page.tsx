"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SocialAuthButtons } from "@/components/social-auth-buttons";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Email o password non corretti");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase.from("profiles").select("active_role, cleaner_onboarded").eq("id", user.id).single();

      if (profile) {
        if (profile.active_role === "cleaner" && !profile.cleaner_onboarded) {
          router.push("/cleaner/onboarding");
        } else {
          router.push(`/${profile.active_role}`);
        }
      }
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="font-serif text-4xl text-white">CleanHome</h1>
        <p className="mt-2 text-accent">Accedi al tuo account</p>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-xl border border-border bg-card px-4 py-3 text-primary placeholder:text-muted-foreground focus:border-accent focus:outline-none" />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-xl border border-border bg-card px-4 py-3 text-primary placeholder:text-muted-foreground focus:border-accent focus:outline-none" />
        {error && <p className="text-center text-sm text-error">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-accent py-4 text-lg font-semibold text-primary transition-opacity disabled:opacity-40">
          {loading ? "Accesso..." : "Accedi"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/20" /></div>
        <div className="relative flex justify-center"><span className="bg-primary px-4 text-sm text-white/60">oppure</span></div>
      </div>

      <SocialAuthButtons />

      <p className="text-center text-sm text-white/60">
        Non hai un account?{" "}
        <Link href="/choose-role" className="text-accent hover:underline">Registrati</Link>
      </p>
    </div>
  );
}
