export type BookingStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "completed"
  | "work_done"
  | "disputed"
  | "cancelled"
  | "auto_cancelled";

export interface Booking {
  id: string;
  client_id: string;
  cleaner_id: string;
  service_type: string;
  date: string;
  time_slot: string;
  num_rooms: number;
  estimated_hours: number;
  base_price: number;
  client_fee: number;
  cleaner_fee: number;
  total_price: number;
  status: BookingStatus;
  cleaner_deadline: string;
  address?: string;
  notes?: string;
  stripe_payment_intent_id?: string;
  work_done_at?: string;
  created_at: string;
}

export type CleanerType = "privato" | "azienda";

export type CoverageMode = "circle" | "polygon";

export interface PolygonPoint {
  lat: number;
  lng: number;
}

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete";

// A single listing published by a cleaner. Each cleaner can have many
// listings — the first is free, the rest require an active Stripe
// subscription (see subscription_status).
export interface CleanerListing {
  id: string;
  cleaner_id: string;
  title: string;
  cover_url?: string | null;
  hourly_rate?: number | null;
  services?: string[] | null;
  description?: string | null;
  is_active: boolean;

  // Coverage zone
  city?: string | null;
  coverage_mode?: CoverageMode | null;
  coverage_center_lat?: number | null;
  coverage_center_lng?: number | null;
  coverage_radius_km?: number | null;
  coverage_polygon?: PolygonPoint[] | null;

  // Subscription
  is_first_listing: boolean;
  stripe_subscription_id?: string | null;
  subscription_status: SubscriptionStatus;

  created_at?: string;
  updated_at?: string;
}

// Row shape returned by the `search_listings_by_point` RPC — a listing
// JOINed with the cleaner's public profile fields.
export interface ListingSearchResult {
  listing_id: string;
  cleaner_id: string;
  title: string;
  cover_url: string | null;
  hourly_rate: number | null;
  services: string[] | null;
  description: string | null;
  city: string | null;
  coverage_center_lat: number | null;
  coverage_center_lng: number | null;
  cleaner_name: string;
  cleaner_bio: string | null;
  cleaner_type: CleanerType | null;
  avg_rating: number;
  review_count: number;
}

export interface CleanerProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  cleaner_type?: CleanerType;
  hourly_rate?: number;
  services?: string[];
  is_available: boolean;
  avg_rating: number;
  review_count: number;
  distance_km: number;
  // Coverage zone the cleaner declared they serve. Clients match against
  // this via the `search_cleaners_by_point` RPC (PostGIS ST_Contains).
  coverage_mode?: CoverageMode | null;
  coverage_center_lat?: number | null;
  coverage_center_lng?: number | null;
  coverage_radius_km?: number | null;
  coverage_polygon?: PolygonPoint[] | null;
}

export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  content: string;
  photo_url?: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  active_role: string;
  cleaner_onboarded: boolean;
}

export interface Review {
  id: string;
  booking_id: string;
  client_id: string;
  cleaner_id: string;
  rating: number;
  comment?: string | null;
  created_at: string;
}

// A saved property/house that a client can reuse when booking a cleaning.
// Clients with multiple homes (Airbnb hosts, property managers, people with
// a second house) can add each one once and pick it from a dropdown in the
// booking flow instead of retyping the address every time.
export interface ClientProperty {
  id: string;
  client_id: string;
  name: string;
  address: string;
  num_rooms: number;
  sqm?: number | null;
  notes?: string | null;
  // Legacy single cover photo — kept for backward compatibility with
  // existing rows that were created before cover_photo_url/room_photo_urls.
  photo_url?: string | null;
  // Primary hero photo of the house — what the cleaner sees first.
  cover_photo_url?: string | null;
  // Per-room/per-area photos (kitchen, bathroom, bedroom...) for context.
  room_photo_urls: string[];
  is_default: boolean;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
  updated_at: string;
}

export type NewClientProperty = Omit<
  ClientProperty,
  "id" | "client_id" | "created_at" | "updated_at"
>;

export const ALL_SERVICES = [
  "Pulizia ordinaria",
  "Pulizia profonda",
  "Stiratura",
  "Pulizia vetri",
  "Pulizia post-ristrutturazione",
  "Pulizia uffici",
  "Pulizia condominiale",
] as const;
