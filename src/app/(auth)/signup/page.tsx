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
      <div className="text-center">
        <h1 className="font-serif text-4xl text-white">CleanHome</h1>
        <p className="mt-2 text-accent">
          {role === "cleaner" ? "Crea il tuo profilo pulitore" : "Crea il tuo account"}
        </p>
      </div>

      <form onSubmit={handleSignup} className="flex flex-col gap-4">
        <input type="text" placeholder="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full rounded-xl border border-border bg-card px-4 py-3 text-primary placeholder:text-muted-foreground focus:border-accent focus:outline-none" />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-xl border border-border bg-card px-4 py-3 text-primary placeholder:text-muted-foreground focus:border-accent focus:outline-none" />
        <input type="password" placeholder="Password (min. 6 caratteri)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full rounded-xl border border-border bg-card px-4 py-3 text-primary placeholder:text-muted-foreground focus:border-accent focus:outline-none" />
        {error && <p className="text-center text-sm text-error">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-accent py-4 text-lg font-semibold text-primary transition-opacity disabled:opacity-40">
          {loading ? "Registrazione..." : "Registrati"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/20" /></div>
        <div className="relative flex justify-center"><span className="bg-primary px-4 text-sm text-white/60">oppure</span></div>
      </div>

      <SocialAuthButtons />

      <p className="text-center text-sm text-white/60">
        Hai gia un account?{" "}
        <Link href="/login" className="text-accent hover:underline">Accedi</Link>
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
