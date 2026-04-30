// ============================================================================
// Edge Function: moderate-photo
// ----------------------------------------------------------------------------
// Validates a photo uploaded to the booking-photos bucket against:
//   1. OpenAI omni-moderation-latest (NSFW: sexual, violence, self-harm, etc.)
//   2. Booking participation (caller must be cleaner or client of booking)
//
// Flow:
//   - Client uploads photo to Storage (booking-photos/<booking_id>/<filename>)
//   - Client calls this function with { booking_id, storage_path, type, room_label? }
//   - Function gets public URL, runs OpenAI moderation
//   - If flagged → DELETE file from Storage + insert rejected row + 422
//   - If clean → insert approved row + return public URL
//
// OPENAI_API_KEY must be set in Supabase secrets (free moderation API).
// If missing, the function logs a warning and approves all photos
// (graceful degradation — useful for first launch before key is configured).
//
// Auth: user JWT (verify_jwt=true). Caller must be cleaner or client of booking.
// Request body: { booking_id, storage_path, type, room_label? }
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const BUCKET = "booking-photos";

const ALLOWED_TYPES = new Set([
  "before",
  "after_cleaner",
  "dispute_client",
  "dispute_cleaner",
]);

const REJECT_THRESHOLD = 0.5; // category score >= 0.5 → reject

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

interface ModerationResult {
  flagged: boolean;
  reason?: string;
  categories?: Record<string, number>;
}

async function runOpenAIModeration(imageUrl: string): Promise<ModerationResult> {
  if (!OPENAI_API_KEY) {
    console.warn("[moderate-photo] OPENAI_API_KEY not set — auto-approve");
    return { flagged: false };
  }

  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: [
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[moderate-photo] OpenAI error:", res.status, errText);
    // Fail-closed on API error during early launch is too risky for UX.
    // Fail-open with warning — content will be reviewed manually if disputed.
    return { flagged: false, reason: "moderation_unavailable" };
  }

  const data = await res.json();
  const result = data?.results?.[0];
  if (!result) return { flagged: false };

  const scores: Record<string, number> = result.category_scores ?? {};
  // Pick highest-scoring flagged category for human-readable reason
  const flaggedCats = Object.entries(scores)
    .filter(([_, score]) => (score as number) >= REJECT_THRESHOLD)
    .sort(([, a], [, b]) => (b as number) - (a as number));

  if (result.flagged || flaggedCats.length > 0) {
    const topCategory = flaggedCats[0]?.[0] ?? "policy_violation";
    return {
      flagged: true,
      reason: topCategory,
      categories: scores,
    };
  }

  return { flagged: false, categories: scores };
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

  let body: { booking_id?: string; storage_path?: string; type?: string; room_label?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { booking_id, storage_path, type, room_label } = body;
  if (!booking_id || !storage_path || !type) {
    return json({ error: "booking_id, storage_path, type required" }, 400);
  }
  if (!ALLOWED_TYPES.has(type)) {
    return json({ error: "invalid type" }, 400);
  }

  try {
    // Verify booking participation
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, client_id, cleaner_id")
      .eq("id", booking_id)
      .maybeSingle();

    if (!booking) return json({ error: "Booking not found" }, 404);
    if (booking.client_id !== user.id && booking.cleaner_id !== user.id) {
      return json({ error: "Forbidden" }, 403);
    }

    // Build public URL for moderation
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storage_path);
    const photoUrl = pub.publicUrl;
    if (!photoUrl) return json({ error: "Cannot resolve photo URL" }, 500);

    // Run moderation
    const moderation = await runOpenAIModeration(photoUrl);

    if (moderation.flagged) {
      // Delete the offending file from Storage to avoid leaving NSFW content public
      await supabase.storage.from(BUCKET).remove([storage_path]);

      // Log the rejection (audit trail)
      await supabase.from("booking_photos").insert({
        booking_id,
        uploaded_by: user.id,
        photo_url: photoUrl,
        storage_path,
        type,
        room_label: room_label ?? null,
        moderation_status: "rejected",
        moderation_reason: moderation.reason ?? "unknown",
        moderation_categories: moderation.categories ?? null,
      });

      return json(
        {
          ok: false,
          rejected: true,
          reason: moderation.reason,
          message: humanReason(moderation.reason),
        },
        422
      );
    }

    // Approved — insert the canonical row
    const { data: inserted, error: insertErr } = await supabase
      .from("booking_photos")
      .insert({
        booking_id,
        uploaded_by: user.id,
        photo_url: photoUrl,
        storage_path,
        type,
        room_label: room_label ?? null,
        moderation_status: "approved",
        moderation_categories: moderation.categories ?? null,
      })
      .select("id, photo_url")
      .single();

    if (insertErr || !inserted) {
      console.error("[moderate-photo] insert error:", insertErr?.message);
      return json({ error: "DB insert failed" }, 500);
    }

    return json({ ok: true, photo_id: inserted.id, photo_url: inserted.photo_url });
  } catch (err: any) {
    console.error("[moderate-photo]", err?.message ?? err);
    return json({ error: "Errore interno del server" }, 500);
  }
});

function humanReason(category?: string): string {
  switch (category) {
    case "sexual":
    case "sexual/minors":
      return "La foto sembra contenere contenuto sessuale. Carica solo foto del lavoro di pulizia.";
    case "violence":
    case "violence/graphic":
      return "La foto contiene contenuto violento. Carica solo foto del lavoro di pulizia.";
    case "hate":
    case "hate/threatening":
    case "harassment":
    case "harassment/threatening":
      return "La foto contiene contenuti d'odio o offensivi. Non è ammessa.";
    case "self-harm":
    case "self-harm/intent":
    case "self-harm/instructions":
      return "Contenuto non idoneo. Carica solo foto del lavoro di pulizia.";
    case "illicit":
    case "illicit/violent":
      return "Contenuto non ammesso.";
    case "moderation_unavailable":
      return "Verifica temporaneamente non disponibile, riprova.";
    default:
      return "La foto non è adatta. Carica solo foto chiare del lavoro di pulizia o del problema riscontrato.";
  }
}
