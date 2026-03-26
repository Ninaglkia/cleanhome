import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationType =
  | "new_booking"
  | "booking_accepted"
  | "booking_declined"
  | "booking_auto_cancelled"
  | "payout_sent"
  // Phase 4 additions:
  | "new_message"
  | "job_completed"
  | "booking_confirmed"
  | "dispute_opened"
  // Phase 5 additions:
  | "review_received";

interface InsertNotificationParams {
  supabase: SupabaseClient;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function insertNotification({
  supabase,
  userId,
  type,
  title,
  body,
  data = {},
}: InsertNotificationParams): Promise<void> {
  await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body,
    data,
    is_read: false,
  });
}
