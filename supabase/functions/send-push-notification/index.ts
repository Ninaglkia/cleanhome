// ============================================================================
// Edge Function: send-push-notification
// ----------------------------------------------------------------------------
// Server-side push sender. Moved out of the client because:
//
// 1. The previous client-side implementation required authenticated users
//    to SELECT from profiles to look up the recipient's push token. That
//    policy widened `profiles` to any authenticated user and enabled a
//    push-token enumeration attack (an attacker could list every user's
//    token and spam notifications).
// 2. Centralising delivery here lets us add future concerns like rate
//    limiting, logging, and message templates in one place.
//
// The function authenticates the caller (must be a signed-in user), then
// validates that the caller is "related" to the recipient in a way that
// justifies a notification:
//   - Both parties on an active booking (cleaner ↔ client) are allowed
//     to notify each other about that booking.
//   - Other sender/recipient combinations are rejected.
//
// Request body:
//   {
//     recipient_id: UUID,
//     title: string,
//     body: string,
//     booking_id?: UUID,   // required for booking-scoped notifications
//     screen?: string,     // deep-link target
//     data?: Record<string, string>
//   }
//
// Response: { ok: true }  on success
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Authenticate the caller ────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "Missing auth token" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  // ── Parse + validate the body ──────────────────────────────────────────
  let body: {
    recipient_id?: string;
    title?: string;
    body?: string;
    booking_id?: string;
    screen?: string;
    data?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { recipient_id, title, body: messageBody, booking_id, screen, data } = body;

  if (!recipient_id || !UUID_RE.test(recipient_id)) {
    return json({ error: "recipient_id must be a valid UUID" }, 400);
  }
  if (!title || typeof title !== "string" || title.length > 200) {
    return json({ error: "title required (max 200 chars)" }, 400);
  }
  if (!messageBody || typeof messageBody !== "string" || messageBody.length > 500) {
    return json({ error: "body required (max 500 chars)" }, 400);
  }
  if (recipient_id === user.id) {
    // Don't waste a notification on the sender themselves
    return json({ ok: true, skipped: "self" });
  }

  // ── Authorisation: caller must be related to recipient via a booking ──
  // Either:
  //   - The caller is on a booking with the recipient, or
  //   - This is a review notification (booking_id references a booking
  //     where the caller was the client and recipient was the cleaner)
  if (!booking_id || !UUID_RE.test(booking_id)) {
    return json(
      { error: "booking_id required — only booking-scoped notifications allowed" },
      400
    );
  }

  const { data: booking, error: bkErr } = await supabase
    .from("bookings")
    .select("id, client_id, cleaner_id")
    .eq("id", booking_id)
    .maybeSingle();

  if (bkErr || !booking) {
    return json({ error: "Booking not found" }, 404);
  }

  const callerIsParty =
    booking.client_id === user.id || booking.cleaner_id === user.id;
  const recipientIsParty =
    booking.client_id === recipient_id || booking.cleaner_id === recipient_id;
  if (!callerIsParty || !recipientIsParty) {
    return json({ error: "Not allowed — unrelated to this booking" }, 403);
  }

  // ── Fetch the recipient's push token (service-role bypasses RLS) ──────
  const { data: recipientProfile } = await supabase
    .from("profiles")
    .select("expo_push_token")
    .eq("id", recipient_id)
    .maybeSingle();

  const pushToken = recipientProfile?.expo_push_token;
  if (!pushToken) {
    // Recipient has no token registered — silent success, not an error
    return json({ ok: true, skipped: "no_token" });
  }

  // ── Deliver via Expo push ──────────────────────────────────────────────
  try {
    const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: pushToken,
        title,
        body: messageBody,
        sound: "default",
        data: { ...(data ?? {}), ...(screen ? { screen } : {}), booking_id },
        priority: "high",
      }),
    });
    if (!pushRes.ok) {
      const text = await pushRes.text();
      console.error("[send-push-notification] Expo returned", pushRes.status, text);
      return json({ error: "Push delivery failed" }, 502);
    }
  } catch (err: any) {
    console.error("[send-push-notification] fetch failed", err?.message);
    return json({ error: "Push delivery failed" }, 502);
  }

  return json({ ok: true });
});
