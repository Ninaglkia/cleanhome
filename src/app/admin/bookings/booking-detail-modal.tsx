"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface BookingProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface Booking {
  id: string;
  service_type: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string | null;
  total_price: number | null;
  created_at: string;
  client: BookingProfile | null;
  cleaner: BookingProfile | null;
}

const STATUS_TIMELINE = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
];

const STATUS_LABELS: Record<string, string> = {
  pending: "In attesa",
  confirmed: "Confermata",
  in_progress: "In corso",
  completed: "Completata",
  cancelled: "Annullata",
  disputed: "Disputa",
};

function fmt(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export function BookingDetailModal({
  booking,
  onClose,
}: {
  booking: Booking;
  onClose: () => void;
}) {
  const currentIdx = STATUS_TIMELINE.indexOf(booking.status ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-serif text-xl text-primary">Dettaglio prenotazione</h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{booking.id}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Details grid */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-6">
          <div>
            <dt className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Cliente</dt>
            <dd className="font-medium text-primary">{booking.client?.full_name ?? "—"}</dd>
            <dd className="text-muted-foreground text-xs">{booking.client?.email ?? ""}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Pulitore</dt>
            <dd className="font-medium text-primary">{booking.cleaner?.full_name ?? "—"}</dd>
            <dd className="text-muted-foreground text-xs">{booking.cleaner?.email ?? ""}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Servizio</dt>
            <dd className="capitalize">{booking.service_type ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Data / Ora</dt>
            <dd>
              {booking.scheduled_date
                ? new Date(booking.scheduled_date).toLocaleDateString("it-IT")
                : "—"}{" "}
              {booking.scheduled_time ?? ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Totale</dt>
            <dd className="font-semibold">{fmt(booking.total_price)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Stato attuale</dt>
            <dd>
              <Badge className="bg-[#1a3a35] text-white border-0 text-xs">
                {STATUS_LABELS[booking.status ?? ""] ?? booking.status ?? "—"}
              </Badge>
            </dd>
          </div>
        </dl>

        {/* Timeline */}
        {booking.status !== "cancelled" && booking.status !== "disputed" && (
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Timeline
            </p>
            <div className="flex items-center gap-0">
              {STATUS_TIMELINE.map((s, i) => {
                const done = i <= currentIdx;
                const active = i === currentIdx;
                return (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div
                        className={`h-3 w-3 rounded-full border-2 transition-colors ${
                          done
                            ? active
                              ? "bg-[#4fc4a3] border-[#4fc4a3]"
                              : "bg-[#1a3a35] border-[#1a3a35]"
                            : "bg-white border-border"
                        }`}
                      />
                      <span className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">
                        {STATUS_LABELS[s]}
                      </span>
                    </div>
                    {i < STATUS_TIMELINE.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mb-3.5 ${
                          i < currentIdx ? "bg-[#1a3a35]" : "bg-border"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Chiudi
          </Button>
        </div>
      </div>
    </div>
  );
}
