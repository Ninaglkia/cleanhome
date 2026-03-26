"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";

export interface CleanerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface Payout {
  id: string;
  week_start: string | null;
  week_end: string | null;
  total_gross: number | null;
  commission_deducted: number | null;
  net_amount: number | null;
  stripe_transfer_id: string | null;
  status: string | null;
  created_at: string;
  cleaner: CleanerProfile | null;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "pending", label: "In attesa" },
  { value: "processed", label: "Processato" },
  { value: "failed", label: "Fallito" },
];

function statusBadge(status: string | null) {
  const map: Record<string, string> = {
    pending: "bg-warning text-[#1a3a35]",
    processed: "bg-success text-white",
    failed: "bg-error text-white",
  };
  const label: Record<string, string> = {
    pending: "In attesa",
    processed: "Processato",
    failed: "Fallito",
  };
  return (
    <Badge className={`${map[status ?? ""] ?? "bg-muted text-muted-foreground"} border-0 text-xs`}>
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

function fmtWeek(start: string | null, end: string | null) {
  if (!start) return "—";
  const s = new Date(start).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
  const e = end ? new Date(end).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }) : "";
  return e ? `${s} – ${e}` : s;
}

export function PayoutsTable({
  payouts,
  currentStatus,
}: {
  payouts: Payout[];
  currentStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  function applyStatus(s: string) {
    const params = new URLSearchParams();
    if (s && s !== "all") params.set("status", s);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
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
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Pulitore</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Settimana</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Lordo</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Commissione</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Netto</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Stato</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Stripe ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payouts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Nessun payout trovato.
                </td>
              </tr>
            ) : (
              payouts.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-primary">{p.cleaner?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{p.cleaner?.email ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {fmtWeek(p.week_start, p.week_end)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(p.total_gross)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-error">
                    -{fmt(p.commission_deducted)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary">
                    {fmt(p.net_amount)}
                  </td>
                  <td className="px-4 py-3">{statusBadge(p.status)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {p.stripe_transfer_id ? (
                      <span title={p.stripe_transfer_id}>
                        {p.stripe_transfer_id.slice(0, 16)}…
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
