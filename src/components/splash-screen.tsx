"use client";

import { useEffect } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a3a35] via-[#1f4a43] to-[#1a5c4a]">
      {/* Decorative orb */}
      <div className="pointer-events-none absolute h-[400px] w-[400px] rounded-full bg-accent/8 blur-3xl" />
      <div className="relative flex flex-col items-center">
        <div className="animate-splash-logo mb-3 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
          <span className="font-serif text-4xl font-bold text-accent">C</span>
        </div>
        <h1 className="animate-splash-logo font-serif text-5xl font-bold text-white md:text-7xl tracking-tight">
          CleanHome
        </h1>
        <p className="animate-splash-tagline mt-4 text-lg text-white/60">
          Trova il pulitore perfetto
        </p>
      </div>
    </div>
  );
}
