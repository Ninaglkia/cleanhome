import type { PriceBreakdown } from "@/types/booking";

interface BookingPriceSummaryProps {
  breakdown: PriceBreakdown;
  estimatedHours: number;
}

export function BookingPriceSummary({
  breakdown,
  estimatedHours,
}: BookingPriceSummaryProps) {
  return (
    <div className="rounded-2xl border border-[#e0eae8] bg-white p-4 space-y-3">
      <h3 className="font-semibold text-[#1a3a35]">Riepilogo prezzo</h3>
      <div className="space-y-2 text-sm">
        <Row label={`Tariffa (${estimatedHours}h stimata)`} value={`€${breakdown.basePrice.toFixed(2)}`} />
        <Row label="Fee servizio (9%)" value={`€${breakdown.clientFee.toFixed(2)}`} muted />
        <div className="border-t border-[#e0eae8] pt-2 flex justify-between font-semibold text-[#1a3a35]">
          <span>Totale</span>
          <span>€{breakdown.totalPrice.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={`flex justify-between ${muted ? "text-[#6b7280]" : "text-[#1a3a35]"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
