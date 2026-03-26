import type { BookingStatus } from "@/types/booking";

const STATUS_MAP: Record<BookingStatus, { label: string; className: string }> = {
  pending: { label: "In attesa", className: "bg-[#f6ad55]/20 text-[#b7791f]" },
  accepted: { label: "Accettata", className: "bg-[#4fc4a3]/20 text-[#1a7a5e]" },
  declined: { label: "Declinata", className: "bg-[#e53e3e]/20 text-[#e53e3e]" },
  completed: { label: "Completata", className: "bg-[#38a169]/20 text-[#38a169]" },
  disputed: { label: "Disputa", className: "bg-[#e53e3e]/20 text-[#e53e3e]" },
  cancelled: { label: "Annullata", className: "bg-gray-100 text-gray-500" },
  auto_cancelled: { label: "Annullata auto", className: "bg-gray-100 text-gray-500" },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { label, className } = STATUS_MAP[status] ?? STATUS_MAP.cancelled;
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
