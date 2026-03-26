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
      {/* Logo + heading */}
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 shadow-lg shadow-black/10 backdrop-blur-sm ring-1 ring-white/20">
          <span className="font-serif text-4xl font-bold text-accent">C</span>
        </div>
        <h1 className="font-serif text-5xl font-bold text-white tracking-tight">CleanHome</h1>
        <p className="mt-3 text-base text-white/70">Accedi al tuo account</p>
      </div>

      {/* Form card */}
      <div className="rounded-3xl bg-white/[0.07] p-6 backdrop-blur-md ring-1 ring-white/10">
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-wider text-white/50">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="mario@esempio.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-white placeholder:text-white/30 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-pw" className="text-xs font-semibold uppercase tracking-wider text-white/50">Password</label>
            <input
              id="login-pw"
              type="password"
              placeholder="La tua password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-white placeholder:text-white/30 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-red-500/15 px-4 py-2.5 text-center text-sm text-red-300 ring-1 ring-red-500/20">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-2xl bg-accent py-4 text-lg font-bold text-primary shadow-lg shadow-accent/25 transition-all duration-200 hover:bg-accent/90 hover:shadow-xl active:scale-[0.97] disabled:opacity-30 disabled:shadow-none"
          >
            {loading ? "Accesso..." : "Accedi"}
          </button>
        </form>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
        <div className="relative flex justify-center"><span className="bg-transparent px-5 text-sm text-white/40">oppure</span></div>
      </div>

      <SocialAuthButtons />

      <p className="text-center text-sm text-white/50">
        Non hai un account?{" "}
        <Link href="/choose-role" className="font-semibold text-accent hover:text-accent/80 transition-colors">Registrati</Link>
      </p>
    </div>
  );
}
