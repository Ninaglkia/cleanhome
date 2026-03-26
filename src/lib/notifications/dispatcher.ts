/**
 * Unified notification dispatcher.
 *
 * Every call to dispatchNotification will:
 * 1. Insert an in-app notification row (notifications table).
 * 2. Send a push notification if the user has FCM tokens and push is enabled.
 * 3. Send an email for important events if email is enabled.
 *
 * This module replaces bare insertNotification() calls for richer delivery.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  insertNotification,
  type NotificationType,
} from "@/lib/supabase/notifications";
import { sendPushToMany } from "@/lib/notifications/push";
import { sendEmail, type EmailTemplate } from "@/lib/notifications/email";

// Events that also trigger an email
const EMAIL_EVENTS = new Set<NotificationType>([
  "new_booking",
  "booking_accepted",
  "booking_auto_cancelled",
  "dispute_opened",
  "payout_sent",
  // dispute_resolved is handled separately below via a special type mapping
]);

// Map from NotificationType to EmailTemplate (only for events that send email)
const EMAIL_TEMPLATE_MAP: Partial<Record<NotificationType, EmailTemplate>> = {
  new_booking: "booking_new",
  booking_accepted: "booking_accepted",
  booking_declined: "booking_declined",
  booking_auto_cancelled: "auto_cancelled",
  job_completed: "job_completed",
  payout_sent: "payout_sent",
  dispute_opened: "dispute_resolved", // admin is notified; reuse generic template
};

export interface DispatchParams {
  /** Supabase client (server or admin) */
  supabase: SupabaseClient;
  /** Target user id */
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Extra context for email templates */
  emailData?: {
    recipientEmail: string;
    recipientName: string;
    bookingDate?: string;
    bookingId?: string;
    cleanerName?: string;
    clientName?: string;
    amount?: string;
    weekStart?: string;
    weekEnd?: string;
    resolution?: string;
  };
}

/**
 * Dispatch a notification through all enabled channels.
 * Non-throwing — channel failures are logged but not propagated.
 */
export async function dispatchNotification(
  params: DispatchParams
): Promise<void> {
  const { supabase, userId, type, title, body, data = {}, emailData } = params;

  // 1. Always insert in-app notification
  await insertNotification({ supabase, userId, type, title, body, data });

  // Fetch user preferences + FCM tokens in parallel
  const [prefResult, tokensResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", userId)
      .single(),
    supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", userId),
  ]);

  const prefs: { push?: boolean; email?: boolean } =
    (prefResult.data?.notification_preferences as { push?: boolean; email?: boolean }) ??
    { push: true, email: true };

  // 2. Push notification
  if (prefs.push !== false) {
    const tokens: string[] =
      (tokensResult.data ?? []).map((r: { token: string }) => r.token);

    if (tokens.length > 0) {
      const staleTokens = await sendPushToMany(tokens, {
        title,
        body,
        data: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
      }).catch((err) => {
        console.error("[dispatcher] push error:", err);
        return [] as string[];
      });

      // Prune invalid tokens
      if (staleTokens.length > 0) {
        await supabase
          .from("device_tokens")
          .delete()
          .in("token", staleTokens)
          .eq("user_id", userId)
          .catch((err) =>
            console.error("[dispatcher] token cleanup error:", err)
          );
      }
    }
  }

  // 3. Email notification (only for important events + if data provided + email present)
  const emailTemplate = EMAIL_TEMPLATE_MAP[type];
  if (
    prefs.email !== false &&
    emailTemplate &&
    EMAIL_EVENTS.has(type) &&
    emailData &&
    emailData.recipientEmail
  ) {
    await sendEmail({
      to: emailData.recipientEmail,
      template: emailTemplate,
      data: {
        recipientName: emailData.recipientName,
        bookingDate: emailData.bookingDate,
        bookingId: emailData.bookingId,
        cleanerName: emailData.cleanerName,
        clientName: emailData.clientName,
        amount: emailData.amount,
        weekStart: emailData.weekStart,
        weekEnd: emailData.weekEnd,
        resolution: emailData.resolution,
      },
    }).catch((err) => console.error("[dispatcher] email error:", err));
  }
}
