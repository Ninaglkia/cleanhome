export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  content: string;
  photo_url: string | null;
  created_at: string;
  // joined
  sender?: { full_name: string; avatar_url: string | null };
}
