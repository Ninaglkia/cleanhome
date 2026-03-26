"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, Trash2 } from "lucide-react";
import { usePhotoUpload } from "@/hooks/use-photo-upload";
import type { BookingPhoto } from "@/types/booking-photo";

interface CompletionUploadProps {
  bookingId: string;
  onComplete: () => void;
}

interface RoomPhoto {
  label: string;
  photo: BookingPhoto;
}

export function CompletionUpload({ bookingId, onComplete }: CompletionUploadProps) {
  const [roomPhotos, setRoomPhotos] = useState<RoomPhoto[]>([]);
  const [roomLabel, setRoomLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { upload, uploading } = usePhotoUpload({
    bookingId,
    photoType: "completion",
    roomLabel,
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const label = roomLabel.trim() || `Stanza ${roomPhotos.length + 1}`;
    const photo = await upload(file);
    if (photo) {
      setRoomPhotos((prev) => [...prev, { label, photo }]);
      setRoomLabel("");
    }
  }

  function removePhoto(photoId: string) {
    setRoomPhotos((prev) => prev.filter((rp) => rp.photo.id !== photoId));
  }

  async function handleComplete() {
    if (roomPhotos.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/complete`, { method: "POST" });
      if (res.ok) onComplete();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-base font-semibold text-[#1a3a35]">Foto del lavoro completato</h2>
      <p className="text-xs text-[#6b7280]">
        Carica almeno una foto per stanza prima di segnare il lavoro come terminato.
      </p>

      {/* Room label input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Etichetta stanza (es. Cucina)"
          value={roomLabel}
          onChange={(e) => setRoomLabel(e.target.value)}
          className="flex-1 rounded-xl border border-[#e0eae8] px-3 py-2 text-sm outline-none focus:border-[#4fc4a3]"
        />
        <label className="cursor-pointer flex items-center gap-1 rounded-xl bg-[#4fc4a3] text-white px-3 py-2 text-sm font-medium">
          <Plus size={16} />
          <span>Foto</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-2 gap-3">
        {roomPhotos.map(({ label, photo }) => (
          <div key={photo.id} className="relative rounded-2xl overflow-hidden border border-[#e0eae8]">
            <Image
              src={photo.photo_url}
              alt={label}
              width={200}
              height={150}
              className="object-cover w-full h-28"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-2 py-1 flex items-center justify-between">
              <span className="text-white text-[10px] truncate">{label}</span>
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="text-white/80 hover:text-white"
                aria-label="Rimuovi foto"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleComplete}
        disabled={roomPhotos.length === 0 || submitting}
        className="w-full rounded-2xl bg-[#1a3a35] text-white py-3 text-sm font-semibold disabled:opacity-40 transition-opacity"
      >
        {submitting ? "Invio in corso…" : "Lavoro terminato"}
      </button>
    </div>
  );
}
