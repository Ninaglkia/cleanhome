"use client";

import { useRef, useEffect, useCallback } from "react";

interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
}

interface UsePlacesAutocompleteOptions {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (result: PlaceResult) => void;
  types?: string[];
}

export function usePlacesAutocomplete({
  inputRef,
  onSelect,
  types = ["(cities)"],
}: UsePlacesAutocompleteOptions) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!inputRef.current) return;
    if (typeof google === "undefined" || !google.maps?.places) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(
      inputRef.current,
      { types, fields: ["geometry", "formatted_address"] }
    );

    const listener = autocompleteRef.current.addListener(
      "place_changed",
      () => {
        const place = autocompleteRef.current?.getPlace();
        if (!place?.geometry?.location) return;
        onSelect({
          address: place.formatted_address ?? inputRef.current?.value ?? "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    );

    return () => {
      google.maps.event.removeListener(listener);
      autocompleteRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputRef.current]);

  return autocompleteRef;
}
