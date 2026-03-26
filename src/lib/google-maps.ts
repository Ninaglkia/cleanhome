export const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export const MAP_DEFAULT_CENTER = { lat: 41.9028, lng: 12.4964 }; // Rome
export const MAP_DEFAULT_ZOOM = 11;

export const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
];
