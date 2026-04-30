// ============================================================================
// Edge Function: booking-mark-done
// ----------------------------------------------------------------------------
// Cleaner marks the work as completed. Sets work_done_at = now() which starts
// the 48h client review window (escrow hold).
//
// Auth: caller must be booking.cleaner_id.
// Request body: { booking_id: UUID }
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

  let body: { booking_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { booking_id } = body;
  if (!booking_id) return json({ error: "booking_id is required" }, 400);

  try {
    const { data: booking, error: loadErr } = await supabase
      .from("bookings")
      .select("id, client_id, cleaner_id, status, work_done_at")
      .eq("id", booking_id)
      .maybeSingle();

    if (loadErr || !booking) return json({ error: "Booking not found" }, 404);
    if (booking.cleaner_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (booking.status !== "accepted") {
      return json({ error: `Booking is ${booking.status}, cannot mark done` }, 409);
    }
    if (booking.work_done_at) {
      return json({ error: "Already marked as done" }, 409);
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("bookings")
      .update({ work_done_at: now })
      .eq("id", booking_id)
      .is("work_done_at", null);

    if (updateErr) throw updateErr;

    // Notify client: 48h review window starts
    await supabase.from("notifications").insert({
      user_id: booking.client_id,
      type: "booking_work_done",
      title: "Il tuo cleaner ha terminato il servizio",
      body: "Conferma o segnala un problema entro 48 ore. Dopo questo termine il pagamento verrà rilasciato automaticamente.",
      link_path: `/booking/${booking_id}`,
      metadata: { booking_id },
    });

    return json({ ok: true, work_done_at: now });
  } catch (err: any) {
    console.error("[booking-mark-done]", err?.message ?? err);
    return json({ error: "Errore interno del server" }, 500);
  }
});
