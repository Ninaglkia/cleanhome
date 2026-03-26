"use client";

import { InfoWindow } from "@vis.gl/react-google-maps";
import { CleanerCard } from "./cleaner-card";
import type { CleanerProfile } from "@/types/cleaner";

interface CleanerMapPopupProps {
  cleaner: CleanerProfile & { lat: number; lng: number };
  onClose: () => void;
  onCardClick: (id: string) => void;
}

export function CleanerMapPopup({ cleaner, onClose, onCardClick }: CleanerMapPopupProps) {
  return (
    <InfoWindow
      position={{ lat: cleaner.lat, lng: cleaner.lng }}
      onCloseClick={onClose}
      pixelOffset={[0, -40]}
    >
      <div className="w-64">
        <CleanerCard cleaner={cleaner} onClick={onCardClick} compact />
      </div>
    </InfoWindow>
  );
}
