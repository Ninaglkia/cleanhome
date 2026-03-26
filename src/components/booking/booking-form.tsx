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
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-semibold text-[#1a3a35]">Prenota {cleanerName}</h2>

      {/* Service */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-[#1a3a35]">Servizio</label>
        <select
          className="w-full rounded-xl border border-[#e0eae8] px-3 py-2 text-sm bg-white"
          value={values.service_type}
          onChange={(e) => update("service_type", e.target.value)}
        >
          {ALL_SERVICES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-[#1a3a35]">Data</label>
        <input
          type="date"
          min={todayStr}
          value={values.date}
          onChange={(e) => update("date", e.target.value)}
          className="w-full rounded-xl border border-[#e0eae8] px-3 py-2 text-sm bg-white"
        />
      </div>

      {/* Time slot */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-[#1a3a35]">Orario</label>
        <div className="grid grid-cols-4 gap-2">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              onClick={() => update("time_slot", slot)}
              className={`rounded-xl border px-2 py-1.5 text-xs font-medium transition-colors ${
                values.time_slot === slot
                  ? "bg-[#4fc4a3] text-white border-[#4fc4a3]"
                  : "border-[#e0eae8] text-[#1a3a35] bg-white"
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      {/* Num rooms */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-[#1a3a35]">
          Numero stanze ({values.num_rooms})
        </label>
        <input
          type="range"
          min={1}
          max={10}
          value={values.num_rooms}
          onChange={(e) => update("num_rooms", Number(e.target.value))}
          className="w-full accent-[#4fc4a3]"
        />
        <div className="flex justify-between text-xs text-[#6b7280]">
          <span>1</span><span>10</span>
        </div>
      </div>

      {/* Price summary */}
      {priceBreakdown && (
        <BookingPriceSummary
          breakdown={priceBreakdown}
          estimatedHours={estimateHours(values.num_rooms)}
        />
      )}

      {error && <p className="text-sm text-[#e53e3e]">{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full h-12 bg-[#1a3a35] text-white rounded-2xl font-semibold"
      >
        {loading ? "Caricamento..." : "Continua al pagamento"}
      </Button>
    </div>
  );
}
