"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface BookingRespondButtonsProps {
  bookingId: string;
}

export function BookingRespondButtons({ bookingId }: BookingRespondButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [done, setDone] = useState(false);

  async function respond(action: "accept" | "decline") {
    setLoading(action);
    const res = await fetch(`/api/bookings/${bookingId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(null);
    if (res.ok) {
      setDone(true);
      router.refresh();
    }
  }

  if (done) {
    return <p className="text-sm text-[#38a169] font-medium">Risposta inviata.</p>;
  }

  return (
    <div className="flex gap-3">
      <Button
        onClick={() => respond("accept")}
        disabled={!!loading}
        className="flex-1 h-12 bg-[#38a169] text-white rounded-2xl font-semibold"
      >
        {loading === "accept" ? "..." : "Accetta"}
      </Button>
      <Button
        onClick={() => respond("decline")}
        disabled={!!loading}
        variant="outline"
        className="flex-1 h-12 border-[#e53e3e] text-[#e53e3e] rounded-2xl font-semibold"
      >
        {loading === "decline" ? "..." : "Declina"}
      </Button>
    </div>
  );
}
