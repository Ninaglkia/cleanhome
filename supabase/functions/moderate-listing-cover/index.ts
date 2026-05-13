// ============================================================================
// Edge Function: moderate-listing-cover
// ----------------------------------------------------------------------------
// One-shot server-side upload + SafeSearch moderation for cleaner listing
// covers. Frontend sends the image as base64 + content_type; the function
// decodes, uploads to the `avatars` bucket as service role (bypassing
// fragile RN client-storage RLS interactions), runs Google Vision
// SafeSearch on the resulting public URL, and either updates
// cleaner_listings.cover_url or removes the storage object and clears
// cover_url on rejection.
//
// Request body: { listing_id: string, image_base64: string, content_type: string }
// Auth: caller must own the listing (cleaner_listings.cleaner_id == auth.uid()).
// GOOGLE_VISION_API_KEY in Supabase secrets is required for real moderation;
// without it the function auto-approves with a warning log.
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decode as decodeBase64 } from "https://deno.land/std@0.203.0/encoding/base64.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_VISION_API_KEY = Deno.env.get("GOOGLE_VISION_API_KEY") ?? "";
const BUCKET = "avatars";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

const LIKELIHOOD_RANK: Record<string, number> = {
  UNKNOWN: 0, VERY_UNLIKELY: 1, UNLIKELY: 2, POSSIBLE: 3, LIKELY: 4, VERY_LIKELY: 5,
};
const REJECT_AT_OR_ABOVE = 4;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ModerationResult { flagged: boolean; reason?: string; }

async function runSafeSearch(imageUrl: string): Promise<ModerationResult> {
  if (!GOOGLE_VISION_API_KEY) {
    console.warn("[moderate-listing-cover] GOOGLE_VISION_API_KEY not set — auto-approve");
    return { flagged: false };
  }
  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;
  const body = { requests: [{ image: { source: { imageUri: imageUrl } }, features: [{ type: "SAFE_SEARCH_DETECTION", maxResults: 1 }] }] };
  const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) { console.error("[moderate-listing-cover] Vision API failed", res.status); return { flagged: false }; }
  const data = await res.json();
  const ss = data?.responses?.[0]?.safeSearchAnnotation;
  if (!ss) return { flagged: false };
  const adult = LIKELIHOOD_RANK[ss.adult] ?? 0;
  const violence = LIKELIHOOD_RANK[ss.violence] ?? 0;
  const racy = LIKELIHOOD_RANK[ss.racy] ?? 0;
  if (adult >= REJECT_AT_OR_ABOVE) return { flagged: true, reason: "adult" };
  if (violence >= REJECT_AT_OR_ABOVE) return { flagged: true, reason: "violence" };
  if (racy >= REJECT_AT_OR_ABOVE) return { flagged: true, reason: "racy" };
  return { flagged: false };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ error: "unauthorized" }, 401);

  let body: { listing_id?: string; image_base64?: string; content_type?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_body" }, 400); }
  const { listing_id, image_base64, content_type } = body;
  if (!listing_id || !image_base64 || !content_type) return json({ error: "missing_fields" }, 400);
  if (!ALLOWED_MIME.has(content_type)) return json({ error: "unsupported_type" }, 415);

  const { data: listing, error: listErr } = await supabase
    .from("cleaner_listings").select("id, cleaner_id").eq("id", listing_id).maybeSingle();
  if (listErr || !listing) return json({ error: "listing_not_found" }, 404);
  if (listing.cleaner_id !== user.id) return json({ error: "forbidden" }, 403);

  let bytes: Uint8Array;
  try { bytes = decodeBase64(image_base64); } catch { return json({ error: "invalid_base64" }, 400); }
  if (bytes.byteLength > MAX_BYTES) return json({ error: "too_large" }, 413);

  const ext = EXT_BY_MIME[content_type];
  const fileName = `listing-covers/${user.id}/${listing_id}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(fileName, bytes, {
    contentType: content_type, upsert: true,
  });
  if (upErr) { console.error("[moderate-listing-cover] upload failed", upErr.message); return json({ error: "upload_failed", detail: upErr.message }, 500); }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  const publicUrl = urlData.publicUrl;

  const result = await runSafeSearch(publicUrl);

  if (result.flagged) {
    await supabase.storage.from(BUCKET).remove([fileName]).catch(() => {});
    await supabase.from("cleaner_listings").update({ cover_url: null }).eq("id", listing_id);
    const friendly: Record<string, string> = {
      adult: "Le foto con contenuti per adulti non sono ammesse. Carica un tuo selfie chiaro e adatto a tutti.",
      racy: "La foto è troppo provocante per la piattaforma. Carica un selfie più sobrio.",
      violence: "La foto contiene elementi violenti. Carica un selfie sereno.",
    };
    return json({ rejected: true, reason: result.reason, message: friendly[result.reason ?? ""] ?? "La foto non rispetta la nostra policy. Caricane un'altra." }, 422);
  }

  const { error: updErr } = await supabase.from("cleaner_listings").update({ cover_url: publicUrl }).eq("id", listing_id);
  if (updErr) { console.error("[moderate-listing-cover] update failed", updErr.message); return json({ error: "update_failed" }, 500); }

  return json({ approved: true, public_url: publicUrl });
});
