"use client";

import { useState } from "react";
import type { BookingPhoto, PhotoType } from "@/types/booking-photo";

interface UsePhotoUploadOptions {
  bookingId: string;
  photoType: PhotoType;
  roomLabel?: string;
}

export function usePhotoUpload({ bookingId, photoType, roomLabel }: UsePhotoUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<BookingPhoto | null> {
    setUploading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("booking_id", bookingId);
    form.append("photo_type", photoType);
    if (roomLabel) form.append("room_label", roomLabel);

    try {
      const res = await fetch("/api/upload/booking-photo", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) { setError(json.error); return null; }
      return json.photo as BookingPhoto;
    } catch (e) {
      setError("Errore di rete");
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, error };
}
