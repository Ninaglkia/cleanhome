import { supabase } from "./supabase";
import { Booking, CleanerProfile, Message, UserProfile } from "./types";

// --- Bookings ---

export async function fetchBookings(userId: string, role: string): Promise<Booking[]> {
  const column = role === "cleaner" ? "cleaner_id" : "client_id";
  const { data, error } = await supabase
    .from("bookings")
    .select()
    .eq(column, userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchBooking(id: string): Promise<Booking> {
  const { data, error } = await supabase
    .from("bookings")
    .select()
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function updateBookingStatus(id: string, status: string) {
  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

export async function markWorkDone(bookingId: string) {
  const { error } = await supabase
    .from("bookings")
    .update({ status: "work_done", work_done_at: new Date().toISOString() })
    .eq("id", bookingId);

  if (error) throw error;
}

// --- Cleaners ---

export async function searchCleaners(city?: string): Promise<CleanerProfile[]> {
  let query = supabase
    .from("cleaner_profiles")
    .select()
    .eq("is_available", true);

  if (city && city.trim()) {
    query = query.ilike("city", `%${city}%`);
  }

  const { data, error } = await query.order("avg_rating", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCleaner(id: string): Promise<CleanerProfile> {
  const { data, error } = await supabase
    .from("cleaner_profiles")
    .select()
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// --- Messages ---

export async function fetchMessages(bookingId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select()
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(bookingId: string, senderId: string, content: string) {
  const { error } = await supabase.from("messages").insert({
    booking_id: bookingId,
    sender_id: senderId,
    content,
  });

  if (error) throw error;
}

export function subscribeToMessages(
  bookingId: string,
  onMessage: (msg: Message) => void
) {
  return supabase
    .channel(`messages-${bookingId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `booking_id=eq.${bookingId}`,
      },
      (payload) => {
        onMessage(payload.new as Message);
      }
    )
    .subscribe();
}

// --- Profile ---

export async function fetchProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select()
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function upsertActiveRole(
  userId: string,
  role: string,
  fullName?: string
): Promise<UserProfile> {
  const row: Record<string, string> = { id: userId, active_role: role };
  if (fullName) row.full_name = fullName;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// --- Cleaner Onboarding ---

export async function upsertCleanerProfile(userId: string, profileData: Record<string, unknown>) {
  const { error } = await supabase
    .from("cleaner_profiles")
    .upsert({ id: userId, ...profileData }, { onConflict: "id" });

  if (error) throw error;
}

export async function markCleanerOnboarded(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ cleaner_onboarded: true })
    .eq("id", userId);

  if (error) throw error;
}
