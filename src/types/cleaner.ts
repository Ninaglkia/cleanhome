export interface CleanerProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  cleaner_type: "privato" | "azienda" | null;
  hourly_rate: number | null;
  services: string[] | null;
  is_available: boolean;
  avg_rating: number;
  review_count: number;
  distance_km: number;
}

export const ALL_SERVICES = [
  "Pulizia ordinaria",
  "Pulizia profonda",
  "Stiratura",
  "Pulizia vetri",
  "Pulizia post-ristrutturazione",
  "Pulizia uffici",
  "Pulizia condominiale",
] as const;

export type ServiceName = (typeof ALL_SERVICES)[number];

export interface CleanerFilters {
  zone: string;
  lat: number | null;
  lng: number | null;
  type: "tutti" | "privato" | "azienda";
  minRating: number;
  maxRate: number;
  service: string;
  sortBy: "distanza" | "prezzo" | "valutazione";
}

export const DEFAULT_FILTERS: CleanerFilters = {
  zone: "",
  lat: null,
  lng: null,
  type: "tutti",
  minRating: 0,
  maxRate: 200,
  service: "",
  sortBy: "distanza",
};
