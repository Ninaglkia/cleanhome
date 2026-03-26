import type { SupabaseClient } from "@supabase/supabase-js";
import type { Message } from "@/types/message";

export async function getMessages(
  supabase: SupabaseClient,
  bookingId: string
): Promise<Message[]> {
  const { data } = await supabase
    .from("messages")
    .select(`*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url)`)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  return (data ?? []) as Message[];
}
