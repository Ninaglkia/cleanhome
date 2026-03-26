"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SocialAuthButtons } from "@/components/social-auth-buttons";

function SignupForm() {
  const searchParams = useSearchParams();
  const role = searchParams.get("role") || "client";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("profiles").update({ active_role: role, full_name: fullName }).eq("id", user.id);
      if (role === "cleaner") {
        router.push("/cleaner/onboarding");
      } else {
        router.push("/client");
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
        <p className="mt-3 text-base text-white/70">
          {role === "cleaner" ? "Crea il tuo profilo pulitore" : "Crea il tuo account"}
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-2xl bg-white p-8 shadow-xl">
        <form onSubmit={handleSignup} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-name" className="text-sm font-medium text-muted-foreground">Nome completo</label>
            <input
              id="signup-name"
              type="text"
              placeholder="Mario Rossi"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="h-12 w-full rounded-xl border border-border bg-white px-4 text-primary placeholder:text-muted-foreground/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-email" className="text-sm font-medium text-muted-foreground">Email</label>
            <input
              id="signup-email"
              type="email"
              placeholder="mario@esempio.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 w-full rounded-xl border border-border bg-white px-4 text-primary placeholder:text-muted-foreground/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-pw" className="text-sm font-medium text-muted-foreground">Password</label>
            <input
              id="signup-pw"
              type="password"
              placeholder="Min. 6 caratteri"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
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
            {loading ? "Registrazione..." : "Registrati"}
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
        Hai già un account?{" "}
        <Link href="/login" className="cursor-pointer font-semibold text-accent hover:text-accent/80 transition-colors">Accedi</Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex flex-col gap-8 animate-pulse" />}>
      <SignupForm />
    </Suspense>
  );
}
