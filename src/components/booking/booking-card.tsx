import Link from "next/link";
import { BookingStatusBadge } from "./booking-status-badge";
import type { Booking } from "@/types/booking";

interface BookingCardProps {
  booking: Booking;
  viewAs: "client" | "cleaner";
}

export function BookingCard({ booking, viewAs }: BookingCardProps) {
  const href =
    viewAs === "cleaner"
      ? `/cleaner/bookings/${booking.id}`
      : `/client/bookings/${booking.id}`;

  const person = viewAs === "cleaner" ? booking.client : booking.cleaner;
  const personLabel = viewAs === "cleaner" ? "Cliente" : "Pulitore";

  return (
    <Link href={href}>
      <div className="rounded-2xl border border-[#e0eae8] bg-white p-4 space-y-2 hover:shadow-sm transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#1a3a35]">{booking.service_type}</span>
          <BookingStatusBadge status={booking.status} />
        </div>
        <p className="text-sm text-[#6b7280]">
          {booking.date} alle {booking.time_slot}
        </p>
        {person && (
          <p className="text-xs text-[#6b7280]">
            {personLabel}: {person.full_name}
          </p>
        )}
        <p className="text-sm font-semibold text-[#1a3a35]">
          Totale: €{booking.total_price?.toFixed(2)}
        </p>
      </div>
    </Link>
  );
}
