// ============================================================================
// Edge Function: booking-open-dispute
// ----------------------------------------------------------------------------
// Client opens an in-app dispute. Funds remain frozen on the platform balance
// until CleanHome admin reviews and decides:
//   - confirm service → call booking-confirm-completion
//   - partial refund  → call refunds + reduced transfer manually (TBD admin tool)
//   - full refund     → refunds.create (no transfer to cleaner)
//
// Auth: caller must be booking.client_id
// Request body: { booking_id: UUID, reason: string }
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "Missing auth token" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  let body: { booking_id?: string; reason?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { booking_id, reason } = body;
  if (!booking_id) return json({ error: "booking_id is required" }, 400);
  if (!reason || typeof reason !== "string" || reason.trim().length < 20) {
    return json({ error: "reason is required (min 20 chars)" }, 400);
  }
  if (reason.length > 2000) {
    return json({ error: "reason too long (max 2000 chars)" }, 400);
  }

  try {
    const { data: booking, error: loadErr } = await supabase
      .from("bookings")
      .select("id, client_id, cleaner_id, status, work_done_at, client_confirmed_at, client_dispute_opened_at")
      .eq("id", booking_id)
      .maybeSingle();

    if (loadErr || !booking) return json({ error: "Booking not found" }, 404);
    if (booking.client_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (booking.status !== "accepted") {
      return json({ error: `Booking is ${booking.status}` }, 409);
    }
    if (!booking.work_done_at) {
      return json({ error: "Cleaner has not marked work done yet" }, 409);
    }
    if (booking.client_confirmed_at) {
      return json({ error: "Booking already confirmed" }, 409);
    }
    if (booking.client_dispute_opened_at) {
      return json({ error: "Dispute already open" }, 409);
    }

    const now = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("bookings")
      .update({
        client_dispute_opened_at: now,
        client_dispute_reason: reason.trim(),
        status: "disputed",
        payout_blocked: true,
      })
      .eq("id", booking_id)
      .is("client_dispute_opened_at", null);

    if (updErr) throw updErr;

    // Notify cleaner that dispute is open
    if (booking.cleaner_id) {
      await supabase.from("notifications").insert({
        user_id: booking.cleaner_id,
        type: "booking_disputed",
        title: "Il cliente ha aperto una contestazione",
        body: "CleanHome esaminerà il caso entro 5 giorni lavorativi. Il pagamento è temporaneamente sospeso.",
        link_path: `/booking/${booking_id}`,
        metadata: { booking_id },
      });
    }

    return json({ ok: true, dispute_opened_at: now });
  } catch (err: any) {
    console.error("[booking-open-dispute]", err?.message ?? err);
    return json({ error: "Errore interno del server" }, 500);
  }
});
