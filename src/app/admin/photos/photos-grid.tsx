"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

export interface BookingProfile {
  id: string;
  full_name: string | null;
}

export interface PhotoBooking {
  id: string;
  service_type: string | null;
  scheduled_date: string | null;
  status: string | null;
  client: BookingProfile | null;
  cleaner: BookingProfile | null;
}

export interface Photo {
  id: string;
  photo_url: string;
  type: string;
  room_label: string | null;
  created_at: string;
  booking_id: string;
  uploader: BookingProfile | null;
  booking: PhotoBooking | null;
}

const TYPE_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "completion", label: "Completamento" },
  { value: "dispute", label: "Disputa" },
];

function typeBadge(type: string) {
  return type === "dispute" ? (
    <Badge className="bg-error text-white border-0 text-xs">Disputa</Badge>
  ) : (
    <Badge className="bg-[#4fc4a3] text-[#1a3a35] border-0 text-xs">Completamento</Badge>
  );
}

function PhotoLightbox({
  photo,
  onClose,
}: {
  photo: Photo;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div className="relative aspect-video bg-black">
          <Image
            src={photo.photo_url}
            alt={photo.room_label ?? "Foto"}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 672px"
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Context */}
        <div className="p-5 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            {typeBadge(photo.type)}
            {photo.room_label && (
              <span className="text-muted-foreground">{photo.room_label}</span>
            )}
            <span className="ml-auto text-muted-foreground text-xs">
              {new Date(photo.created_at).toLocaleDateString("it-IT")}
            </span>
          </div>

          {photo.booking && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 bg-muted/30 rounded-lg p-3 text-xs">
              <div>
                <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">Prenotazione</dt>
                <dd className="font-mono">{photo.booking.id.slice(0, 8)}…</dd>
              </div>
              <div>
                <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">Servizio</dt>
                <dd className="capitalize">{photo.booking.service_type ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">Cliente</dt>
                <dd>{photo.booking.client?.full_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">Pulitore</dt>
                <dd>{photo.booking.cleaner?.full_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">Data</dt>
                <dd>
                  {photo.booking.scheduled_date
                    ? new Date(photo.booking.scheduled_date).toLocaleDateString("it-IT")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">Caricata da</dt>
                <dd>{photo.uploader?.full_name ?? "—"}</dd>
              </div>
            </dl>
          )}

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>
              Chiudi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhotosGrid({
  photos,
  currentType,
  currentBookingId,
}: {
  photos: Photo[];
  currentType: string;
  currentBookingId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [bookingSearch, setBookingSearch] = useState(currentBookingId);
  const [, startTransition] = useTransition();
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  function applyFilters(type: string, bId: string) {
    const params = new URLSearchParams();
    if (type && type !== "all") params.set("type", type);
    if (bId) params.set("booking_id", bId);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => applyFilters(opt.value, bookingSearch)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  currentType === opt.value
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Input
            placeholder="Filtra per booking ID…"
            value={bookingSearch}
            onChange={(e) => setBookingSearch(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && applyFilters(currentType, bookingSearch)
            }
            className="w-64"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyFilters(currentType, bookingSearch)}
          >
            Cerca
          </Button>
          {(currentType !== "all" || currentBookingId) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBookingSearch("");
                applyFilters("all", "");
              }}
            >
              Reset filtri
            </Button>
          )}
        </div>

        {/* Stats */}
        <p className="text-xs text-muted-foreground">
          {photos.length} foto mostrate
        </p>

        {/* Grid */}
        {photos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            Nessuna foto trovata.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setLightbox(photo)}
                className="group relative aspect-square rounded-xl overflow-hidden border border-border hover:border-[#4fc4a3] transition-colors focus:outline-none focus:ring-2 focus:ring-[#4fc4a3]"
              >
                <Image
                  src={photo.photo_url}
                  alt={photo.room_label ?? "Foto"}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-200"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
                />
                {/* Type overlay */}
                <div className="absolute top-1.5 left-1.5">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      photo.type === "dispute"
                        ? "bg-error/90 text-white"
                        : "bg-[#4fc4a3]/90 text-[#1a3a35]"
                    }`}
                  >
                    {photo.type === "dispute" ? "D" : "C"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <PhotoLightbox photo={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
