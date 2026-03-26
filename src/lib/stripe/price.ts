import type { PriceBreakdown } from "@/types/booking";

const CLIENT_FEE_RATE = 0.09;
const CLEANER_FEE_RATE = 0.09;

/** Estimated hours from room count (1 room = 1.5h, min 2h) */
export function estimateHours(numRooms: number): number {
  return Math.max(2, numRooms * 1.5);
}

export function calculateBookingPrice(
  hourlyRate: number,
  numRooms: number
): PriceBreakdown {
  const estimatedHours = estimateHours(numRooms);
  const basePrice = Math.round(hourlyRate * estimatedHours * 100) / 100;
  const clientFee = Math.round(basePrice * CLIENT_FEE_RATE * 100) / 100;
  const cleanerFee = Math.round(basePrice * CLEANER_FEE_RATE * 100) / 100;
  const totalPrice = Math.round((basePrice + clientFee) * 100) / 100;
  const cleanerNet = Math.round((basePrice - cleanerFee) * 100) / 100;
  const platformMargin = Math.round((clientFee + cleanerFee) * 100) / 100;

  return { basePrice, clientFee, totalPrice, cleanerNet, platformMargin };
}

/** Returns cleaner_deadline = serviceDateTime - 8 hours */
export function calculateCleanerDeadline(date: string, timeSlot: string): Date {
  const [hours, minutes] = timeSlot.split(":").map(Number);
  const serviceTime = new Date(date);
  serviceTime.setHours(hours, minutes, 0, 0);
  return new Date(serviceTime.getTime() - 8 * 60 * 60 * 1000);
}

/** Returns true if booking is at least 8h in the future */
export function isAdvanceBookingValid(date: string, timeSlot: string): boolean {
  const [hours, minutes] = timeSlot.split(":").map(Number);
  const serviceTime = new Date(date);
  serviceTime.setHours(hours, minutes, 0, 0);
  const minAllowed = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return serviceTime >= minAllowed;
}
