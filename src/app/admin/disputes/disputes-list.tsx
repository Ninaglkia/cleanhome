"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";

export interface DisputeProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface Photo {
  id: string;
  photo_url: string;
  type: string;
  uploaded_by: string;
}

export interface DisputeBooking {
  id: string;
  service_type: string | null;
  scheduled_date: string | null;
  total_price: number | null;
  photos: Photo[];
}

export interface Dispute {
  id: string;
  status: string;
  client_description: string | null;
  ai_suggestion: string | null;
  admin_decision_percentage: number | null;
  created_at: string;
  resolved_at: string | null;
  client: DisputeProfile | null;
  cleaner: DisputeProfile | null;
  booking: DisputeBooking | null;
}

function fmt(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

function DisputeCard({ dispute }: { dispute: Dispute }) {
  const router = useRouter();
  const [refundPct, setRefundPct] = useState<string>(
    dispute.admin_decision_percentage?.toString() ?? ""
  );
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = dispute.status === "open";
  const photos = dispute.booking?.photos ?? [];
  const cleanerPhotos = photos.filter((p) => p.uploaded_by === dispute.cleaner?.id);
  const clientPhotos = photos.filter((p) => p.uploaded_by === dispute.client?.id);

  async function handleResolve() {
    const pct = parseFloat(refundPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setError("Inserisci una percentuale valida (0-100).");
      return;
    }
    setResolving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/disputes/${dispute.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refund_percentage: pct }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Errore durante la risoluzione.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Errore di rete.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Badge
            className={`border-0 text-xs ${
              isOpen ? "bg-warning text-[#1a3a35]" : "bg-muted text-muted-foreground"
            }`}
          >
            {isOpen ? "Aperta" : "Risolta"}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">
            {dispute.id.slice(0, 8)}…
          </span>
          <span className="text-sm text-muted-foreground">
            {new Date(dispute.created_at).toLocaleDateString("it-IT")}
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          Prenotazione{" "}
          <span className="font-medium text-primary">
            {dispute.booking?.service_type ?? "—"}
          </span>{" "}
          — {fmt(dispute.booking?.total_price ?? null)}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Parties */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Cliente</p>
            <p className="font-medium text-primary">{dispute.client?.full_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{dispute.client?.email ?? ""}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Pulitore</p>
            <p className="font-medium text-primary">{dispute.cleaner?.full_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{dispute.cleaner?.email ?? ""}</p>
          </div>
        </div>

        {/* Description */}
        {dispute.client_description && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Descrizione cliente
            </p>
            <p className="text-sm text-primary bg-muted/20 rounded-lg p-3">
              {dispute.client_description}
            </p>
          </div>
        )}

        {/* Photos side-by-side */}
        {(cleanerPhotos.length > 0 || clientPhotos.length > 0) && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Foto pulitore ({cleanerPhotos.length})
              </p>
              {cleanerPhotos.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nessuna foto</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {cleanerPhotos.map((p) => (
                    <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                      <Image
                        src={p.photo_url}
                        alt="Foto pulitore"
                        fill
                        className="object-cover"
                        sizes="120px"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Foto cliente ({clientPhotos.length})
              </p>
              {clientPhotos.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nessuna foto</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {clientPhotos.map((p) => (
                    <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                      <Image
                        src={p.photo_url}
                        alt="Foto cliente"
                        fill
                        className="object-cover"
                        sizes="120px"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI suggestion (placeholder) */}
        <div className="rounded-lg border border-[#4fc4a3]/40 bg-[#4fc4a3]/5 p-3">
          <p className="text-xs font-semibold text-[#1a3a35] mb-1">
            Suggerimento AI (Phase 7)
          </p>
          <p className="text-sm text-muted-foreground italic">
            {dispute.ai_suggestion ??
              "L'analisi AI sarà disponibile nella Fase 7. Revisione manuale richiesta."}
          </p>
        </div>

        {/* Admin action */}
        {isOpen ? (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-1">
                Rimborso al cliente (%)
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                placeholder="es. 50"
                value={refundPct}
                onChange={(e) => setRefundPct(e.target.value)}
                className="w-32"
              />
            </div>
            <Button
              onClick={handleResolve}
              disabled={resolving}
              className="bg-[#1a3a35] text-white hover:bg-[#1a3a35]/90"
            >
              {resolving ? "Risoluzione…" : "Risolvi disputa"}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <Badge className="bg-muted text-muted-foreground border-0">Risolta</Badge>
            <span className="text-muted-foreground">
              Rimborso applicato:{" "}
              <span className="font-semibold text-primary">
                {dispute.admin_decision_percentage ?? 0}%
              </span>
            </span>
            {dispute.resolved_at && (
              <span className="text-muted-foreground text-xs">
                il {new Date(dispute.resolved_at).toLocaleDateString("it-IT")}
              </span>
            )}
          </div>
        )}

        {error && <p className="text-sm text-error">{error}</p>}
      </div>
    </div>
  );
}

export function DisputesList({
  open,
  resolved,
}: {
  open: Dispute[];
  resolved: Dispute[];
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-semibold text-primary mb-4">
          Dispute aperte ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna disputa aperta.</p>
        ) : (
          <div className="space-y-4">
            {open.map((d) => (
              <DisputeCard key={d.id} dispute={d} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-muted-foreground mb-4">
          Dispute risolte ({resolved.length})
        </h2>
        {resolved.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna disputa risolta.</p>
        ) : (
          <div className="space-y-4">
            {resolved.map((d) => (
              <DisputeCard key={d.id} dispute={d} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
