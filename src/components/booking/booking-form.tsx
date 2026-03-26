"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BookingPriceSummary } from "./booking-price-summary";
import { useBookingForm } from "@/hooks/use-booking-form";
import { estimateHours } from "@/lib/stripe/price";
import { ALL_SERVICES } from "@/types/cleaner";

interface BookingFormProps {
  cleanerId: string;
  hourlyRate: number;
  cleanerName: string;
}

export function BookingForm({ cleanerId, hourlyRate, cleanerName }: BookingFormProps) {
  const router = useRouter();
  const { values, update, priceBreakdown, error, validate } = useBookingForm({ hourlyRate });
  const [loading, setLoading] = useState(false);

  const TIME_SLOTS = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
  const todayStr = new Date().toISOString().split("T")[0];

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, cleanerId }),
      });
      if (!res.ok) {
        const { error: apiError } = await res.json();
        throw new Error(apiError ?? "Errore nel creare la prenotazione.");
      }
      const { bookingId, clientSecret } = await res.json();
      // Navigate to payment page with client secret
      router.push(`/client/bookings/${bookingId}/pay?cs=${clientSecret}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-5">
      <div>
        <h2 className="font-serif text-2xl font-bold text-primary">Prenota</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{cleanerName}</p>
      </div>

      {/* Service */}
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Servizio</label>
          <select
            className="w-full h-12 rounded-xl bg-background px-4 text-sm text-primary ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer"
            value={values.service_type}
            onChange={(e) => update("service_type", e.target.value)}
          >
            {ALL_SERVICES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</label>
          <input
            type="date"
            min={todayStr}
            value={values.date}
            onChange={(e) => update("date", e.target.value)}
            className="w-full h-12 rounded-xl bg-background px-4 text-sm text-primary ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-accent transition-all"
          />
        </div>

        {/* Time slot */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Orario</label>
          <div className="grid grid-cols-4 gap-2">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot}
                onClick={() => update("time_slot", slot)}
                className={`rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${
                  values.time_slot === slot
                    ? "bg-accent text-white shadow-sm shadow-accent/20"
                    : "bg-background text-primary ring-1 ring-border hover:ring-accent/40"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>

        {/* Num rooms */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Numero stanze</label>
            <span className="text-sm font-bold text-accent">{values.num_rooms}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={values.num_rooms}
            onChange={(e) => update("num_rooms", Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>1</span><span>10</span>
          </div>
        </div>
      </div>

      {/* Price summary */}
      {priceBreakdown && (
        <BookingPriceSummary
          breakdown={priceBreakdown}
          estimatedHours={estimateHours(values.num_rooms)}
        />
      )}

      {error && (
        <div className="rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error ring-1 ring-error/20">{error}</div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full h-14 bg-primary text-white rounded-2xl text-base font-bold shadow-md hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-40"
      >
        {loading ? "Caricamento..." : "Continua al pagamento"}
      </Button>
    </div>
  );
}
