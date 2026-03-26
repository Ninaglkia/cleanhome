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
        <h1 className="font-serif text-5xl font-bold text-white tracking-tight">
          Clean<span className="text-accent">Home</span>
        </h1>
        <p className="mt-3 text-base text-white/70">Accedi al tuo account</p>
      </div>

      {/* Form card */}
      <div className="rounded-2xl bg-white p-8 shadow-xl">
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-sm font-medium text-muted-foreground">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="mario@esempio.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 w-full rounded-xl border border-border bg-white px-4 text-primary placeholder:text-muted-foreground/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-pw" className="text-sm font-medium text-muted-foreground">Password</label>
            <input
              id="login-pw"
              type="password"
              placeholder="La tua password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12 w-full rounded-xl border border-border bg-white px-4 text-primary placeholder:text-muted-foreground/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-error/10 px-4 py-2.5 text-center text-sm text-error ring-1 ring-error/20">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 h-12 w-full cursor-pointer rounded-xl bg-accent text-base font-semibold text-primary shadow-md shadow-accent/20 transition-all duration-200 hover:bg-accent/90 hover:shadow-lg active:scale-[0.97] disabled:opacity-30 disabled:shadow-none disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
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
        <Link href="/choose-role" className="cursor-pointer font-semibold text-accent hover:text-accent/80 transition-colors">Registrati</Link>
      </p>
    </div>
  );
}
