"use client";
import { useState } from "react";
import { calculateBookingPrice, isAdvanceBookingValid } from "@/lib/stripe/price";
import type { BookingFormValues, PriceBreakdown } from "@/types/booking";
import { ALL_SERVICES } from "@/types/cleaner";

interface UseBookingFormOptions {
  hourlyRate: number;
}

export function useBookingForm({ hourlyRate }: UseBookingFormOptions) {
  const [values, setValues] = useState<BookingFormValues>({
    service_type: ALL_SERVICES[0],
    date: "",
    time_slot: "09:00",
    num_rooms: 2,
  });
  const [error, setError] = useState<string | null>(null);

  const priceBreakdown: PriceBreakdown | null =
    hourlyRate > 0
      ? calculateBookingPrice(hourlyRate, values.num_rooms)
      : null;

  function update<K extends keyof BookingFormValues>(
    key: K,
    value: BookingFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function validate(): boolean {
    if (!values.date) {
      setError("Seleziona una data.");
      return false;
    }
    if (!isAdvanceBookingValid(values.date, values.time_slot)) {
      setError("La prenotazione deve essere effettuata con almeno 8 ore di anticipo.");
      return false;
    }
    return true;
  }

  return { values, update, priceBreakdown, error, validate };
}
