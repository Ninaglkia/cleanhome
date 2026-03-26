"use client";

import { useState, useCallback } from "react";
import { APIProvider, Map } from "@vis.gl/react-google-maps";
import { GOOGLE_MAPS_API_KEY, MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from "@/lib/google-maps";
import { CleanerMapPin } from "./cleaner-map-pin";
import { CleanerMapPopup } from "./cleaner-map-popup";
import type { CleanerProfile } from "@/types/cleaner";

// Attach lat/lng from profile (nearby_cleaners returns them via PostGIS)
// The RPC result includes lat/lng from the profiles table; we cast here.
type CleanerWithCoords = CleanerProfile & { lat: number; lng: number };

interface CleanerMapProps {
  cleaners: CleanerWithCoords[];
  highlightedId: string | null;
  onPinClick: (id: string) => void;
  onCardClick: (id: string) => void;
}

function MapContent({ cleaners, highlightedId, onPinClick, onCardClick }: CleanerMapProps) {
  const [popupId, setPopupId] = useState<string | null>(null);

  const handlePinClick = useCallback(
    (id: string) => {
      setPopupId((prev) => (prev === id ? null : id));
      onPinClick(id);
    },
    [onPinClick]
  );

  const popupCleaner = cleaners.find((c) => c.id === popupId);

  return (
    <>
      {cleaners.map((c) => (
        <CleanerMapPin
          key={c.id}
          cleaner={c}
          highlighted={c.id === highlightedId}
          onClick={handlePinClick}
        />
      ))}
      {popupCleaner && (
        <CleanerMapPopup
          cleaner={popupCleaner}
          onClose={() => setPopupId(null)}
          onCardClick={(id) => {
            setPopupId(null);
            onCardClick(id);
          }}
        />
      )}
    </>
  );
}

export function CleanerMap(props: CleanerMapProps) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={["places"]}>
      <Map
        defaultCenter={MAP_DEFAULT_CENTER}
        defaultZoom={MAP_DEFAULT_ZOOM}
        mapId="cleanhome-map"
        gestureHandling="greedy"
        disableDefaultUI={false}
        className="h-full w-full"
      >
        <MapContent {...props} />
      </Map>
    </APIProvider>
  );
}
