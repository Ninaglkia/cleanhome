// ============================================================================
// _shared/push-notification.ts
// ----------------------------------------------------------------------------
// Server-side Expo push delivery helper.
// Extracted from send-push-notification/index.ts so Edge Functions that
// insert a notification can immediately fire the push without an HTTP
// round-trip to another function.
//
// Usage:
//   import { sendPushToUser } from "../_shared/push-notification.ts";
//
//   // supabase must be a service-role SupabaseClient so it can read
//   // profiles.expo_push_token without hitting RLS restrictions.
//   await sendPushToUser(supabase, {
//     recipientId: "uuid-of-user",
//     title: "Prenotazione confermata!",
//     body: "Un professionista ha accettato.",
//     data: { booking_id: "..." },
//   });
//
// The call is always best-effort:
//   - Missing token → silent skip, returns { skipped: "no_token" }
//   - Expo error → logs and returns { error: "delivery_failed" }
//   - Never throws
// ============================================================================

// deno-lint-ignore-file no-explicit-any

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface PushPayload {
  /** UUID of the user to notify (looks up their expo_push_token) */
  recipientId: string;
  title: string;
  body: string;
  /** Extra data forwarded to the app's notification handler */
  data?: Record<string, string>;
}

export interface PushResult {
  ok?: boolean;
  skipped?: string;
  error?: string;
}

/**
 * Look up the user's Expo push token and deliver the notification.
 *
 * @param supabase  Service-role client (bypasses RLS on profiles)
 * @param payload   Push content and target user
 */
export async function sendPushToUser(
  supabase: SupabaseClient,
  payload: PushPayload
): Promise<PushResult> {
  try {
    // Fetch the push token for the recipient (service role bypasses RLS)
    const { data: profile } = await supabase
      .from("profiles")
      .select("expo_push_token")
      .eq("id", payload.recipientId)
      .maybeSingle();

    const pushToken: string | null | undefined = profile?.expo_push_token;
    if (!pushToken) {
      // Not an error — user has not granted push permissions or has no device
      return { skipped: "no_token" };
    }

    const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: pushToken,
        title: payload.title,
        body: payload.body,
        sound: "default",
        data: payload.data ?? {},
        priority: "high",
      }),
    });

    if (!pushRes.ok) {
      const text = await pushRes.text();
      console.error(
        "[push-notification] Expo returned",
        pushRes.status,
        text,
        "for user",
        payload.recipientId
      );
      return { error: "delivery_failed" };
    }

    return { ok: true };
  } catch (err: any) {
    console.error(
      "[push-notification] fetch threw:",
      err?.message,
      "for user",
      payload.recipientId
    );
    return { error: "exception" };
  }
}

/**
 * Fire push notifications to multiple recipients concurrently.
 * All results are returned; individual failures do not cancel others.
 */
export async function sendPushToMany(
  supabase: SupabaseClient,
  recipients: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<PushResult[]> {
  return Promise.all(
    recipients.map((id) => sendPushToUser(supabase, { recipientId: id, title, body, data }))
  );
}
