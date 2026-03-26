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
    <div className="flex flex-col gap-7">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 shadow-lg shadow-accent/20">
          <span className="font-serif text-3xl font-bold text-accent">C</span>
        </div>
        <h1 className="font-serif text-4xl font-bold text-white tracking-tight">CleanHome</h1>
        <p className="mt-2 text-accent/90">Accedi al tuo account</p>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all backdrop-blur-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all backdrop-blur-sm"
          />
        </div>
        {error && (
          <p className="rounded-lg bg-red-500/20 px-3 py-2 text-center text-sm text-red-300">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-2xl bg-accent py-4 text-lg font-bold text-primary shadow-lg shadow-accent/30 transition-all duration-150 hover:bg-accent/90 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {loading ? "Accesso..." : "Accedi"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/15" /></div>
        <div className="relative flex justify-center"><span className="bg-primary/80 px-4 text-sm text-white/50 backdrop-blur-sm rounded-full">oppure</span></div>
      </div>

      <SocialAuthButtons />

      <p className="text-center text-sm text-white/60">
        Non hai un account?{" "}
        <Link href="/choose-role" className="font-semibold text-accent hover:underline">Registrati</Link>
      </p>
    </div>
  );
}
