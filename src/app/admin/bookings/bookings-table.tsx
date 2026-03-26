"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { BookingDetailModal } from "./booking-detail-modal";

export interface BookingProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface Booking {
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

const STATUS_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "pending", label: "In attesa" },
  { value: "confirmed", label: "Confermata" },
  { value: "in_progress", label: "In corso" },
  { value: "completed", label: "Completata" },
  { value: "cancelled", label: "Annullata" },
  { value: "disputed", label: "Disputa" },
];

function statusBadge(status: string | null) {
  const map: Record<string, string> = {
    pending: "bg-warning text-[#1a3a35]",
    confirmed: "bg-[#4fc4a3] text-[#1a3a35]",
    in_progress: "bg-[#4fc4a3] text-[#1a3a35]",
    completed: "bg-success text-white",
    cancelled: "bg-muted text-muted-foreground",
    disputed: "bg-error text-white",
  };
  const label: Record<string, string> = {
    pending: "In attesa",
    confirmed: "Confermata",
    in_progress: "In corso",
    completed: "Completata",
    cancelled: "Annullata",
    disputed: "Disputa",
  };
  const cls = map[status ?? ""] ?? "bg-muted text-muted-foreground";
  return (
    <Badge className={`${cls} border-0 text-xs`}>
      {label[status ?? ""] ?? status ?? "—"}
    </Badge>
  );
}

function fmt(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT");
}

export function BookingsTable({
  bookings,
  currentStatus,
}: {
  bookings: Booking[];
  currentStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<Booking | null>(null);

  function applyStatus(s: string) {
    const params = new URLSearchParams();
    if (s && s !== "all") params.set("status", s);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <>
      <div className="space-y-4">
        {/* Status filter */}
        <div className="flex flex-wrap gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => applyStatus(opt.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                currentStatus === opt.value
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Pulitore</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Servizio</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Stato</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Totale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nessuna prenotazione trovata.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setSelected(b)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {b.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">
                      {b.client?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.cleaner?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {b.service_type ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(b.scheduled_date)}
                    </td>
                    <td className="px-4 py-3">{statusBadge(b.status)}</td>
                    <td className="px-4 py-3 font-medium">{fmt(b.total_price)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <BookingDetailModal booking={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
