// ============================================================================
// Edge Function: stripe-booking-action
// ----------------------------------------------------------------------------
// Called by the cleaner when they accept or decline a booking. With
// capture_method=manual the PaymentIntent is authorized-only until we
// explicitly capture or cancel it:
//
//   action=capture → capture the funds, transfer to cleaner's account
//   action=cancel  → void the authorization, release the hold
//
// The function also updates the booking row's status accordingly. Only
// the cleaner associated with the booking can trigger this (enforced by
// checking auth.uid() against the cleaner_id in the row).
//
// Request body: { booking_id: UUID, action: "capture" | "cancel" }
// Response:    { ok: true, status: BookingStatus }
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_API_VERSION = "2023-10-16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function stripeFetch(path: string, body?: Record<string, string>) {
  const params = new URLSearchParams();
  if (body) {
    for (const [k, v] of Object.entries(body)) {
      params.append(k, String(v));
    }
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION,
    },
    body: body ? params.toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? "Stripe API error");
  }
  return data;
}

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

  // Authenticate the caller (the cleaner)
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "Missing auth token" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  let body: { booking_id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { booking_id, action } = body;
  if (!booking_id) return json({ error: "booking_id is required" }, 400);
  if (action !== "capture" && action !== "cancel") {
    return json({ error: "action must be 'capture' or 'cancel'" }, 400);
  }

  try {
    // Load the booking and assert ownership
    const { data: booking, error: loadErr } = await supabase
      .from("bookings")
      .select("id, cleaner_id, status, stripe_payment_intent_id")
      .eq("id", booking_id)
      .single();

    if (loadErr || !booking) return json({ error: "Booking not found" }, 404);
    if (booking.cleaner_id !== user.id) {
      return json({ error: "Not allowed" }, 403);
    }
    if (booking.status !== "pending") {
      return json(
        { error: `Booking already ${booking.status}, cannot ${action}` },
        409
      );
    }
    if (!booking.stripe_payment_intent_id) {
      return json({ error: "Booking has no payment intent" }, 400);
    }

    // Fire the Stripe action
    if (action === "capture") {
      await stripeFetch(
        `payment_intents/${booking.stripe_payment_intent_id}/capture`,
        {}
      );
      const { error: updErr } = await supabase
        .from("bookings")
        .update({ status: "accepted" })
        .eq("id", booking_id);
      if (updErr) throw updErr;
      return json({ ok: true, status: "accepted" });
    } else {
      // action === "cancel"
      await stripeFetch(
        `payment_intents/${booking.stripe_payment_intent_id}/cancel`,
        { cancellation_reason: "requested_by_customer" }
      );
      const { error: updErr } = await supabase
        .from("bookings")
        .update({ status: "declined" })
        .eq("id", booking_id);
      if (updErr) throw updErr;
      return json({ ok: true, status: "declined" });
    }
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[stripe-booking-action]", msg);
    return json({ error: msg }, 500);
  }
});
