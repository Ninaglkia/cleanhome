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
    <div className="flex flex-col gap-7">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 shadow-lg shadow-accent/20">
          <span className="font-serif text-3xl font-bold text-accent">C</span>
        </div>
        <h1 className="font-serif text-4xl font-bold text-white tracking-tight">CleanHome</h1>
        <p className="mt-2 text-accent/90">
          {role === "cleaner" ? "Crea il tuo profilo pulitore" : "Crea il tuo account"}
        </p>
      </div>

      <form onSubmit={handleSignup} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Nome completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all backdrop-blur-sm"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all backdrop-blur-sm"
        />
        <input
          type="password"
          placeholder="Password (min. 6 caratteri)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all backdrop-blur-sm"
        />
        {error && (
          <p className="rounded-lg bg-red-500/20 px-3 py-2 text-center text-sm text-red-300">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-2xl bg-accent py-4 text-lg font-bold text-primary shadow-lg shadow-accent/30 transition-all duration-150 hover:bg-accent/90 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {loading ? "Registrazione..." : "Registrati"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/15" /></div>
        <div className="relative flex justify-center"><span className="bg-primary/80 px-4 text-sm text-white/50 backdrop-blur-sm rounded-full">oppure</span></div>
      </div>

      <SocialAuthButtons />

      <p className="text-center text-sm text-white/60">
        Hai già un account?{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">Accedi</Link>
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
