// ============================================================================
// Edge Function: moderate-photo
// ----------------------------------------------------------------------------
// Validates a photo uploaded to the booking-photos bucket against:
//   1. Google Cloud Vision SafeSearch (NSFW: adult, violence, racy, medical)
//   2. Booking participation (caller must be cleaner or client of booking)
//
// Flow:
//   - Client uploads photo to Storage (booking-photos/<booking_id>/<filename>)
//   - Client calls this function with { booking_id, storage_path, type, room_label? }
//   - Function generates a short-lived signed URL, sends it to Vision API
//   - If flagged → DELETE file from Storage + insert rejected row + 422
//   - If clean → insert approved row + return public URL
//
// GOOGLE_VISION_API_KEY must be set in Supabase secrets.
// Free tier: 1000 SafeSearch units/month. Then $1.50/1000.
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
const GOOGLE_VISION_API_KEY = Deno.env.get("GOOGLE_VISION_API_KEY") ?? "";
const BUCKET = "booking-photos";

const ALLOWED_TYPES = new Set([
  "before",
  "after_cleaner",
  "dispute_client",
  "dispute_cleaner",
]);

// SafeSearch likelihood scale (Google):
// VERY_UNLIKELY=1, UNLIKELY=2, POSSIBLE=3, LIKELY=4, VERY_LIKELY=5
// We reject at LIKELY (4) or higher for adult/violence/racy.
// Medical and spoof are not auto-rejected (could be legitimate dirt photos).
const LIKELIHOOD_RANK: Record<string, number> = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};
const REJECT_AT_OR_ABOVE = 4; // LIKELY

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
  categories?: Record<string, string>;
}

async function runGoogleVisionModeration(imageUrl: string): Promise<ModerationResult> {
  if (!GOOGLE_VISION_API_KEY) {
    console.warn("[moderate-photo] GOOGLE_VISION_API_KEY not set — auto-approve");
    return { flagged: false };
  }

  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { source: { imageUri: imageUrl } },
          features: [{ type: "SAFE_SEARCH_DETECTION" }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[moderate-photo] Google Vision error:", res.status, errText);
    // Fail-open: content will be reviewed manually if disputed.
    return { flagged: false, reason: "moderation_unavailable" };
  }

  const data = await res.json();
  const safeSearch = data?.responses?.[0]?.safeSearch ?? null;
  if (!safeSearch) {
    return { flagged: false, reason: "no_safesearch_response" };
  }

  // Capture all category likelihoods for audit
  const categories: Record<string, string> = {
    adult: safeSearch.adult ?? "UNKNOWN",
    spoof: safeSearch.spoof ?? "UNKNOWN",
    medical: safeSearch.medical ?? "UNKNOWN",
    violence: safeSearch.violence ?? "UNKNOWN",
    racy: safeSearch.racy ?? "UNKNOWN",
  };

  // Reject criteria: adult, violence, or racy at LIKELY+ → block
  // Medical and spoof are not blockers (could be legitimate dirt/stain photos)
  const rejectCats = ["adult", "violence", "racy"] as const;
  const flagged = rejectCats.find(
    (cat) => (LIKELIHOOD_RANK[categories[cat]] ?? 0) >= REJECT_AT_OR_ABOVE
  );

  if (flagged) {
    return {
      flagged: true,
      reason: flagged,
      categories,
    };
  }

  return { flagged: false, categories };
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

  // Path traversal guard: storage_path MUST be scoped under <booking_id>/
  const expectedPrefix = `${booking_id}/`;
  if (
    !storage_path.startsWith(expectedPrefix) ||
    storage_path.includes("..") ||
    storage_path.includes("//")
  ) {
    return json({ error: "Invalid storage_path scope" }, 400);
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

    // Generate a short-lived signed URL for OpenAI (2-min TTL).
    // Using a signed URL (not public) keeps the bucket safe even if browsing is enabled.
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storage_path, 120);
    if (signErr || !signed?.signedUrl) {
      return json({ error: "Cannot sign photo URL" }, 500);
    }
    const moderationUrl = signed.signedUrl;
    // Public URL is what the app renders later (bucket remains public for read).
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storage_path);
    const photoUrl = pub.publicUrl;
    if (!photoUrl) return json({ error: "Cannot resolve photo URL" }, 500);

    // Run Google Vision SafeSearch against the signed URL (fetched within 120s TTL)
    const moderation = await runGoogleVisionModeration(moderationUrl);

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
    case "adult":
      return "La foto contiene contenuto per adulti. Carica solo foto del lavoro di pulizia.";
    case "violence":
      return "La foto contiene contenuto violento. Carica solo foto del lavoro di pulizia.";
    case "racy":
      return "La foto non è appropriata per il contesto. Carica solo foto del lavoro di pulizia.";
    case "moderation_unavailable":
    case "no_safesearch_response":
      return "Verifica temporaneamente non disponibile, riprova tra qualche secondo.";
    default:
      return "La foto non è adatta. Carica solo foto chiare del lavoro di pulizia o del problema riscontrato.";
  }
}
