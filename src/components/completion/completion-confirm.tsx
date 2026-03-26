"use client";

import { useState } from "react";
import Image from "next/image";
import { usePhotoUpload } from "@/hooks/use-photo-upload";
import type { BookingPhoto } from "@/types/booking-photo";

interface CompletionConfirmProps {
  bookingId: string;
  completionPhotos: BookingPhoto[];
  onConfirmed: () => void;
}

export function CompletionConfirm({
  bookingId,
  completionPhotos,
  onConfirmed,
}: CompletionConfirmProps) {
  const [mode, setMode] = useState<"idle" | "dispute">("idle");
  const [description, setDescription] = useState("");
  const [disputePhotos, setDisputePhotos] = useState<BookingPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { upload, uploading } = usePhotoUpload({ bookingId, photoType: "dispute" });

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      if (res.ok) onConfirmed();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDispute() {
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dispute",
          description,
          dispute_photo_ids: disputePhotos.map((p) => p.id),
        }),
      });
      if (res.ok) onConfirmed();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisputePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const photo = await upload(file);
    if (photo) setDisputePhotos((prev) => [...prev, photo]);
  }

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-base font-semibold text-[#1a3a35]">Conferma lavoro completato</h2>

      {/* Completion photo gallery */}
      <div className="grid grid-cols-2 gap-3">
        {completionPhotos.map((photo) => (
          <div key={photo.id} className="rounded-2xl overflow-hidden border border-[#e0eae8]">
            <Image
              src={photo.photo_url}
              alt={photo.room_label ?? "Foto"}
              width={200}
              height={150}
              className="object-cover w-full h-28"
            />
            {photo.room_label && (
              <p className="text-[10px] text-[#6b7280] px-2 py-1">{photo.room_label}</p>
            )}
          </div>
        ))}
      </div>

      {mode === "idle" && (
        <div className="flex flex-col gap-3">
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full rounded-2xl bg-[#38a169] text-white py-3 text-sm font-semibold disabled:opacity-40"
          >
            Tutto OK
          </button>
          <button
            onClick={() => setMode("dispute")}
            className="w-full rounded-2xl border-2 border-[#e53e3e] text-[#e53e3e] py-3 text-sm font-semibold"
          >
            Non OK — Segnala problema
          </button>
        </div>
      )}

      {mode === "dispute" && (
        <div className="space-y-3">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrivi il problema in dettaglio…"
            rows={4}
            className="w-full rounded-2xl border border-[#e0eae8] px-4 py-3 text-sm outline-none focus:border-[#e53e3e] resize-none"
          />

          {/* Dispute photo upload */}
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#4fc4a3] font-medium">
            + Aggiungi foto del problema
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleDisputePhoto}
              disabled={uploading}
            />
          </label>

          {disputePhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {disputePhotos.map((p) => (
                <Image
                  key={p.id}
                  src={p.photo_url}
                  alt="Foto problema"
                  width={100}
                  height={80}
                  className="rounded-xl object-cover w-full h-20"
                />
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setMode("idle")}
              className="flex-1 rounded-2xl border border-[#e0eae8] py-3 text-sm text-[#6b7280]"
            >
              Annulla
            </button>
            <button
              onClick={handleDispute}
              disabled={!description.trim() || submitting}
              className="flex-1 rounded-2xl bg-[#e53e3e] text-white py-3 text-sm font-semibold disabled:opacity-40"
            >
              {submitting ? "Invio…" : "Invia segnalazione"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
