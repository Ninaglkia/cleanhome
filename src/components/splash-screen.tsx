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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary">
      {/* Decorative orb */}
      <div className="pointer-events-none absolute h-[400px] w-[400px] rounded-full bg-accent/8 blur-3xl motion-safe:animate-pulse" />
      <div className="relative flex flex-col items-center">
        <h1 className="animate-splash-logo font-serif text-5xl font-bold text-white md:text-7xl tracking-tight">
          Clean<span className="text-accent">Home</span>
        </h1>
        <p className="animate-splash-tagline mt-4 text-lg text-accent/70">
          Trova il pulitore perfetto
        </p>
      </div>
    </div>
  );
}
