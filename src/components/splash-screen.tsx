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
      <h1 className="animate-splash-logo font-serif text-5xl text-white md:text-7xl">
        CleanHome
      </h1>
      <p className="animate-splash-tagline mt-4 text-lg text-accent">
        Trova il pulitore perfetto
      </p>
    </div>
  );
}
