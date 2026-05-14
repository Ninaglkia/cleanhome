// ============================================================================
// Edge Function: moderate-image
// ----------------------------------------------------------------------------
// Generic server-side image upload + Google Vision SafeSearch moderation,
// dispatched by a `kind` discriminator. Supersedes per-target functions
// (moderate-listing-cover, moderate-photo) for new call sites so the same
// upload + moderation pipeline is reused for avatars, listing covers and
// any future image surface — Apple Guideline 1.1.4 (user-generated photos
// must be moderated) requires every public image to pass this gate.
//
// kind: "avatar"
//   - Auth: any authenticated user (subject = self).
//   - Storage: bucket `avatars`, path `<user_id>/avatar-<ts>.<ext>`.
//   - On approve: updates profiles.avatar_url = publicUrl.
//   - On reject: removes object and clears profiles.avatar_url.
//
// kind: "listing_cover"
//   - Requires listing_id; caller must own the cleaner_listings row.
//   - Storage: bucket `avatars`, path `listing-covers/<user_id>/<listing_id>/<ts>.<ext>`.
//   - On approve: updates cleaner_listings.cover_url.
//   - On reject: removes object and clears cleaner_listings.cover_url.
//
// Common rules:
//   - 5 MB hard byte cap.
//   - Allowed mime: image/jpeg, image/png, image/webp.
//   - When GOOGLE_VISION_API_KEY is unset, function logs a warning and
//     auto-approves (graceful degradation for first launch). In production
//     the secret MUST be configured.
//
// Request body:
//   { kind: "avatar" | "listing_cover",
//     image_base64: string, content_type: string,
//     listing_id?: string  // required when kind === "listing_cover"
//   }
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decode as decodeBase64 } from "https://deno.land/std@0.203.0/encoding/base64.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_VISION_API_KEY = Deno.env.get("GOOGLE_VISION_API_KEY") ?? "";
const BUCKET = "avatars";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const LIKELIHOOD_RANK: Record<string, number> = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};
const REJECT_AT_OR_ABOVE = 4;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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
}

async function runSafeSearch(imageUrl: string): Promise<ModerationResult> {
  if (!GOOGLE_VISION_API_KEY) {
    console.warn("[moderate-image] GOOGLE_VISION_API_KEY not set — auto-approve");
    return { flagged: false };
  }
  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;
  const body = {
    requests: [
      {
        image: { source: { imageUri: imageUrl } },
        features: [{ type: "SAFE_SEARCH_DETECTION", maxResults: 1 }],
      },
    ],
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[moderate-image] Vision API failed", res.status);
    return { flagged: false };
  }
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

const FRIENDLY: Record<string, string> = {
  adult:
    "Le foto con contenuti per adulti non sono ammesse. Carica un'immagine adatta a tutti.",
  racy: "L'immagine è troppo provocante per la piattaforma. Caricane una più sobria.",
  violence: "L'immagine contiene elementi violenti. Caricane una serena.",
};

type Kind = "avatar" | "listing_cover";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ error: "unauthorized" }, 401);

  let body: {
    kind?: Kind;
    listing_id?: string;
    image_base64?: string;
    content_type?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }

  const { kind, image_base64, content_type, listing_id } = body;
  if (!kind || !image_base64 || !content_type) {
    return json({ error: "missing_fields" }, 400);
  }
  if (kind !== "avatar" && kind !== "listing_cover") {
    return json({ error: "invalid_kind" }, 400);
  }
  if (!ALLOWED_MIME.has(content_type)) return json({ error: "unsupported_type" }, 415);

  // Decode + size cap
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(image_base64);
  } catch {
    return json({ error: "invalid_base64" }, 400);
  }
  if (bytes.byteLength > MAX_BYTES) return json({ error: "too_large" }, 413);

  // Authorize + build storage path
  let fileName: string;
  if (kind === "avatar") {
    fileName = `${user.id}/avatar-${Date.now()}.${EXT_BY_MIME[content_type]}`;
  } else {
    if (!listing_id) return json({ error: "missing_listing_id" }, 400);
    const { data: listing, error: listErr } = await supabase
      .from("cleaner_listings")
      .select("id, cleaner_id")
      .eq("id", listing_id)
      .maybeSingle();
    if (listErr || !listing) return json({ error: "listing_not_found" }, 404);
    if (listing.cleaner_id !== user.id) return json({ error: "forbidden" }, 403);
    fileName = `listing-covers/${user.id}/${listing_id}/${Date.now()}.${EXT_BY_MIME[content_type]}`;
  }

  // Upload as service-role (bypasses fragile RN storage RLS interactions)
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, bytes, { contentType: content_type, upsert: true });
  if (upErr) {
    console.error("[moderate-image] upload failed", upErr.message);
    return json({ error: "upload_failed", detail: upErr.message }, 500);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  const publicUrl = urlData.publicUrl;

  // SafeSearch
  const result = await runSafeSearch(publicUrl);

  if (result.flagged) {
    await supabase.storage.from(BUCKET).remove([fileName]).catch(() => {});
    if (kind === "avatar") {
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    } else if (listing_id) {
      await supabase.from("cleaner_listings").update({ cover_url: null }).eq("id", listing_id);
    }
    return json(
      {
        rejected: true,
        reason: result.reason,
        message:
          FRIENDLY[result.reason ?? ""] ??
          "L'immagine non rispetta la nostra policy. Caricane un'altra.",
      },
      422
    );
  }

  // Persist URL into the right row
  if (kind === "avatar") {
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);
    if (updErr) {
      console.error("[moderate-image] profile update failed", updErr.message);
      return json({ error: "update_failed" }, 500);
    }
  } else if (listing_id) {
    const { error: updErr } = await supabase
      .from("cleaner_listings")
      .update({ cover_url: publicUrl })
      .eq("id", listing_id);
    if (updErr) {
      console.error("[moderate-image] listing update failed", updErr.message);
      return json({ error: "update_failed" }, 500);
    }
  }

  return json({ approved: true, public_url: publicUrl });
});
