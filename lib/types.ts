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

export const ALL_SERVICES = [
  "Pulizia ordinaria",
  "Pulizia profonda",
  "Stiratura",
  "Pulizia vetri",
  "Pulizia post-ristrutturazione",
  "Pulizia uffici",
  "Pulizia condominiale",
] as const;
