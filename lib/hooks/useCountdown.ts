import { useEffect, useRef, useState } from "react";

export interface CountdownResult {
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  formatted: string; // "23h 45m" compact form
}

/**
 * Live countdown toward a target ISO date string.
 * Updates every second. Returns isExpired=true once the deadline passes.
 */
export function useCountdown(targetIso: string | null | undefined): CountdownResult {
  const computeRemaining = (): CountdownResult => {
    if (!targetIso) {
      return { hours: 0, minutes: 0, seconds: 0, isExpired: true, formatted: "—" };
    }
    const diff = new Date(targetIso).getTime() - Date.now();
    if (diff <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, isExpired: true, formatted: "Scaduto" };
    }
    const totalSeconds = Math.floor(diff / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const formatted =
      h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;
    return { hours: h, minutes: m, seconds: s, isExpired: false, formatted };
  };

  const [result, setResult] = useState<CountdownResult>(computeRemaining);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setResult(computeRemaining());
    intervalRef.current = setInterval(() => {
      const next = computeRemaining();
      setResult(next);
      if (next.isExpired && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso]);

  return result;
}
