export type BookingStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "completed"
  | "work_done"
  | "disputed"
  | "cancelled"
  | "auto_cancelled";

export interface PriceBreakdown {
  basePrice: number;        // hourly_rate × estimated_hours
  clientFee: number;        // basePrice × 0.09
  totalPrice: number;       // basePrice + clientFee
  cleanerNet: number;       // basePrice - (basePrice × 0.09)
  platformMargin: number;   // basePrice × 0.18
}

export interface Booking {
  id: string;
  client_id: string;
  cleaner_id: string;
  service_type: string;
  date: string;             // ISO date
  time_slot: string;        // e.g. "09:00"
  num_rooms: number;
  estimated_hours: number;
  base_price: number;
  client_fee: number;
  cleaner_fee: number;
  total_price: number;
  status: BookingStatus;
  cleaner_deadline: string; // ISO timestamptz
  address: string | null;
  notes: string | null;
  stripe_payment_intent_id: string | null;
  work_done_at: string | null;
  created_at: string;
  // joined
  client?: { full_name: string; avatar_url: string | null };
  cleaner?: { full_name: string; avatar_url: string | null; hourly_rate: number };
}

export interface BookingFormValues {
  service_type: string;
  date: string;
  time_slot: string;
  num_rooms: number;
}
