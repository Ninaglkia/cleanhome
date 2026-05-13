// ============================================================================
// Edge Function: moderate-listing-cover
// ----------------------------------------------------------------------------
// Validates a listing cover photo (cleaner self-portrait) uploaded to the
// `avatars` bucket against Google Cloud Vision SafeSearch. Rejects adult,
// violence and racy content. If the upload is clean it updates the
// cleaner_listings.cover_url with the public URL.
//
// Flow:
//   1. Client uploads photo to `avatars/listing-covers/<userId>/<listingId>/...`
//   2. Client calls this function with { listing_id, storage_path }
//   3. Function generates a signed URL, sends to Vision SafeSearch
//   4. If flagged → DELETE file + clear cover_url + 422 to client
//   5. If clean → set cleaner_listings.cover_url + return 200 with public URL
//
// GOOGLE_VISION_API_KEY must be set in Supabase secrets.
// If missing the function logs a warning and approves all photos
// (graceful degradation — useful during the first launch).
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_VISION_API_KEY = Deno.env.get("GOOGLE_VISION_API_KEY") ?? "";
const BUCKET = "avatars";

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

async function runSafeSearch(imageUrl: string): Promise<ModerationResult> {
  if (!GOOGLE_VISION_API_KEY) {
    console.warn("[moderate-listing-cover] GOOGLE_VISION_API_KEY not set — auto-approve");
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
    console.error("[moderate-listing-cover] Vision API failed", res.status);
    // Fail open: don't block users if Vision is down. Photos that survive
    // are still subject to user reports.
    return { flagged: false };
  }

  const data = await res.json();
  const ss = data?.responses?.[0]?.safeSearchAnnotation;
  if (!ss) return { flagged: false };

  const adult = LIKELIHOOD_RANK[ss.adult] ?? 0;
  const violence = LIKELIHOOD_RANK[ss.violence] ?? 0;
  const racy = LIKELIHOOD_RANK[ss.racy] ?? 0;

  if (adult >= REJECT_AT_OR_ABOVE)
    return { flagged: true, reason: "adult", categories: ss };
  if (violence >= REJECT_AT_OR_ABOVE)
    return { flagged: true, reason: "violence", categories: ss };
  if (racy >= REJECT_AT_OR_ABOVE)
    return { flagged: true, reason: "racy", categories: ss };

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

  let body: { listing_id?: string; storage_path?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const { listing_id, storage_path } = body;
  if (!listing_id || !storage_path) {
    return json({ error: "missing_fields" }, 400);
  }
  // Defense in depth: storage_path must start with listing-covers/<userId>/
  if (!storage_path.startsWith(`listing-covers/${user.id}/`)) {
    return json({ error: "forbidden" }, 403);
  }

  // Confirm the listing belongs to this user.
  const { data: listing, error: listErr } = await supabase
    .from("cleaner_listings")
    .select("id, cleaner_id")
    .eq("id", listing_id)
    .maybeSingle();
  if (listErr || !listing) return json({ error: "listing_not_found" }, 404);
  if (listing.cleaner_id !== user.id) return json({ error: "forbidden" }, 403);

  // Public bucket → public URL works for Vision.
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storage_path);
  const publicUrl = urlData.publicUrl;

  const result = await runSafeSearch(publicUrl);

  if (result.flagged) {
    await supabase.storage.from(BUCKET).remove([storage_path]).catch(() => {});
    await supabase
      .from("cleaner_listings")
      .update({ cover_url: null })
      .eq("id", listing_id)
      .catch(() => {});

    const friendly: Record<string, string> = {
      adult: "Le foto con contenuti per adulti non sono ammesse. Carica un tuo selfie chiaro e adatto a tutti.",
      racy: "La foto è troppo provocante per la piattaforma. Carica un selfie più sobrio.",
      violence: "La foto contiene elementi violenti. Carica un selfie sereno.",
    };
    return json(
      {
        rejected: true,
        reason: result.reason,
        message: friendly[result.reason ?? ""] ??
          "La foto non rispetta la nostra policy. Caricane un'altra.",
      },
      422
    );
  }

  // Persist the cover_url.
  const { error: updErr } = await supabase
    .from("cleaner_listings")
    .update({ cover_url: publicUrl })
    .eq("id", listing_id);

  if (updErr) {
    console.error("[moderate-listing-cover] update failed", updErr.message);
    return json({ error: "update_failed" }, 500);
  }

  return json({ approved: true, public_url: publicUrl });
});
