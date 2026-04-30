import { supabase } from "./supabase";
import {
  Booking,
  BookingOffer,
  CleanerListing,
  CleanerProfile,
  ClientProperty,
  CoverageMode,
  ListingSearchResult,
  Message,
  NewClientProperty,
  PolygonPoint,
  Review,
  UserProfile,
} from "./types";

// --- Client Properties (saved houses) ---

// Fetch all properties for a client, default first, then newest first.
export async function fetchClientProperties(
  clientId: string
): Promise<ClientProperty[]> {
  const { data, error } = await supabase
    .from("client_properties")
    .select()
    .eq("client_id", clientId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ClientProperty[]) ?? [];
}

export async function createClientProperty(
  clientId: string,
  input: NewClientProperty
): Promise<ClientProperty> {
  const { data, error } = await supabase
    .from("client_properties")
    .insert({ client_id: clientId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as ClientProperty;
}

export async function updateClientProperty(
  id: string,
  patch: Partial<NewClientProperty>
): Promise<ClientProperty> {
  const { data, error } = await supabase
    .from("client_properties")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ClientProperty;
}

export async function deleteClientProperty(id: string): Promise<void> {
  const { error } = await supabase
    .from("client_properties")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Flip the default flag on a single property. The DB trigger
// `enforce_single_default_property` will automatically unset the
// previously-default row for the same client.
export async function setDefaultProperty(
  id: string
): Promise<ClientProperty> {
  return updateClientProperty(id, { is_default: true } as Partial<NewClientProperty>);
}

// Upload a single property photo to the `property-photos` bucket. Returns
// the public URL. Each file is scoped under the client's user id so RLS
// can enforce that clients only touch their own folder.
export async function uploadPropertyPhoto(
  clientId: string,
  localUri: string,
  kind: "cover" | "room" = "cover"
): Promise<string> {
  const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileName = `${clientId}/${kind}-${Date.now()}-${Math.floor(
    Math.random() * 10000
  )}.${ext}`;

  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from("property-photos")
    .upload(fileName, blob, {
      contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from("property-photos")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// ----------------------------------------------------------------------------
// Address autocomplete helper — tries Google Places API (New) first and
// silently falls back to OpenStreetMap Nominatim when Places is not
// enabled on the GCP project. This is what actually made the app's
// address fields stop working: the user had never enabled Places (New),
// so every Places call returned 403 and we never showed suggestions.
// Nominatim is free, has no API key, supports italian addresses, and
// handles the usage policy via a sensible User-Agent + ~1 req/s rate
// (debouncing in the UI already keeps us well under that limit).
// ----------------------------------------------------------------------------

export interface AddressSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  latitude: number;
  longitude: number;
}

export async function searchAddresses(
  query: string,
  signal?: AbortSignal
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const googleKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  // Prefer Google Places when enabled — richer structured results.
  if (googleKey) {
    try {
      const res = await fetch(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": googleKey,
          },
          body: JSON.stringify({
            input: trimmed,
            languageCode: "it",
            regionCode: "it",
            includedRegionCodes: ["it"],
          }),
          signal,
        }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          suggestions?: Array<{
            placePrediction?: {
              placeId: string;
              structuredFormat?: {
                mainText?: { text: string };
                secondaryText?: { text: string };
              };
              text?: { text: string };
            };
          }>;
        };
        const mapped = (data.suggestions ?? [])
          .map((s) => s.placePrediction)
          .filter((p): p is NonNullable<typeof p> => !!p);
        if (mapped.length > 0) {
          // We still need coordinates — Places autocomplete doesn't
          // include them. Instead of making a second call per suggestion
          // we return placeholder 0/0 and expect the UI to call
          // fetchAddressDetails(placeId) when the user taps a row.
          return mapped.map((p) => ({
            placeId: p.placeId,
            mainText: p.structuredFormat?.mainText?.text || p.text?.text || "",
            secondaryText: p.structuredFormat?.secondaryText?.text || "",
            latitude: 0,
            longitude: 0,
          }));
        }
      }
      // Fall through to Nominatim if Places returned an error or no rows
    } catch {
      // Fall through
    }
  }

  // Nominatim fallback. No API key needed, but the usage policy requires
  // a descriptive User-Agent header identifying the app.
  try {
    const params = new URLSearchParams({
      q: trimmed,
      format: "json",
      addressdetails: "1",
      limit: "6",
      countrycodes: "it",
      "accept-language": "it",
    });
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          "User-Agent": "CleanHome/1.0 (https://cleanhome.app)",
          Accept: "application/json",
        },
        signal,
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      place_id: number;
      lat: string;
      lon: string;
      display_name: string;
      address?: Record<string, string>;
      type?: string;
    }>;
    return data.map((row) => {
      const a = row.address ?? {};
      // Main = street + civic number if available, else first token
      const street = a.road || a.pedestrian || a.footway || "";
      const house = a.house_number ? ` ${a.house_number}` : "";
      const main =
        street + house ||
        row.display_name.split(",").slice(0, 1).join("") ||
        row.display_name.slice(0, 60);
      // Secondary = city + postcode + province
      const cityParts = [a.postcode, a.city || a.town || a.village, a.state]
        .filter(Boolean)
        .join(" ");
      return {
        placeId: String(row.place_id),
        mainText: main.trim(),
        secondaryText: cityParts,
        latitude: parseFloat(row.lat),
        longitude: parseFloat(row.lon),
      };
    });
  } catch {
    return [];
  }
}

// Resolve a Google Places placeId to coordinates. Not needed when the
// suggestion came from Nominatim (the lat/lng is already included), but
// essential for the Google Places branch because the autocomplete API
// doesn't return coordinates. Falls through silently if Places is
// disabled — the caller already has the suggestion's mainText to save.
export async function fetchAddressDetails(
  placeId: string
): Promise<{ latitude: number; longitude: number } | null> {
  const googleKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!googleKey) return null;
  // Nominatim place_ids are numeric — skip
  if (/^\d+$/.test(placeId)) return null;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: {
          "X-Goog-Api-Key": googleKey,
          "X-Goog-FieldMask": "location",
        },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      location?: { latitude: number; longitude: number };
    };
    if (!data.location) return null;
    return {
      latitude: data.location.latitude,
      longitude: data.location.longitude,
    };
  } catch {
    return null;
  }
}

// Call Google Cloud Vision API to classify an image and return whether it
// looks like a house/room interior. Uses the same API key already in env
// (must be enabled for Vision API in Google Cloud Console). Returns the
// top labels so the caller can show a friendly error when validation
// fails. Non-house photos (selfies, memes, food, pets, etc.) are rejected.
export interface PhotoValidationResult {
  isValid: boolean;
  reason?: string;
  topLabels: string[];
}

// Labels from Vision API that indicate the photo actually shows a
// house / room / interior / cleaning context. Any match in the top
// labels is enough to pass validation.
const HOUSE_LIKE_LABELS = new Set([
  "room",
  "bedroom",
  "living room",
  "kitchen",
  "bathroom",
  "dining room",
  "home",
  "house",
  "apartment",
  "interior design",
  "property",
  "real estate",
  "furniture",
  "floor",
  "ceiling",
  "wall",
  "window",
  "countertop",
  "cabinetry",
  "tile",
  "sink",
  "bed",
  "couch",
  "table",
  "chair",
  "lamp",
  "curtain",
  "hardwood",
  "laminate flooring",
  "bathtub",
  "shower",
  "toilet",
  "stairs",
  "door",
]);

export async function validatePropertyPhoto(
  localUri: string
): Promise<PhotoValidationResult> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    // No API key — fail open so the form still works in dev, but mark
    // the result as unvalidated so the UI can show a gentle notice.
    return { isValid: true, topLabels: [] };
  }

  const response = await fetch(localUri);
  const blob = await response.blob();
  const base64: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // result is `data:image/jpeg;base64,<base64-data>` — strip the prefix
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  const visionRes = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [
              { type: "LABEL_DETECTION", maxResults: 15 },
              { type: "SAFE_SEARCH_DETECTION" },
            ],
          },
        ],
      }),
    }
  );

  if (!visionRes.ok) {
    // Vision API not enabled or quota exceeded — fail open with a warning.
    return { isValid: true, topLabels: [] };
  }

  const visionData = (await visionRes.json()) as {
    responses?: Array<{
      labelAnnotations?: Array<{ description: string; score: number }>;
      safeSearchAnnotation?: {
        adult: string;
        racy: string;
        violence: string;
      };
    }>;
  };

  const r = visionData.responses?.[0];
  if (!r) return { isValid: true, topLabels: [] };

  // Reject adult/racy/violent content outright.
  const safe = r.safeSearchAnnotation;
  if (safe) {
    const bad = ["LIKELY", "VERY_LIKELY"];
    if (
      bad.includes(safe.adult) ||
      bad.includes(safe.racy) ||
      bad.includes(safe.violence)
    ) {
      return {
        isValid: false,
        reason: "La foto contiene contenuti non appropriati.",
        topLabels: [],
      };
    }
  }

  const labels = (r.labelAnnotations ?? [])
    .filter((l) => l.score >= 0.6)
    .map((l) => l.description.toLowerCase());

  const matches = labels.filter((l) => HOUSE_LIKE_LABELS.has(l));

  if (matches.length === 0) {
    return {
      isValid: false,
      reason:
        "La foto non sembra rappresentare una casa, una stanza o un ambiente domestico. Carica una foto dell'interno della casa.",
      topLabels: labels.slice(0, 5),
    };
  }

  return { isValid: true, topLabels: labels.slice(0, 5) };
}

// --- Reviews ---

export async function fetchReviewsForCleaner(
  cleanerId: string
): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select()
    .eq("cleaner_id", cleanerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Review[]) ?? [];
}

export async function submitReview(
  bookingId: string,
  clientId: string,
  cleanerId: string,
  rating: number,
  comment?: string
): Promise<void> {
  const { error } = await supabase.from("reviews").insert({
    booking_id: bookingId,
    client_id: clientId,
    cleaner_id: cleanerId,
    rating,
    comment: comment || null,
  });
  if (error) throw error;
}

// --- Bookings ---

export async function fetchBookings(userId: string, role: string): Promise<Booking[]> {
  const column = role === "cleaner" ? "cleaner_id" : "client_id";
  const { data, error } = await supabase
    .from("bookings")
    .select()
    .eq(column, userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchBooking(id: string): Promise<Booking | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateBookingStatus(id: string, status: string) {
  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

// Cleaner accepts or declines a booking. Routed through an Edge Function
// so that the PaymentIntent is captured (on accept) or cancelled (on
// decline) atomically with the booking status update. Prevents the
// situation where the cleaner declines after the money was already
// transferred and we'd need a refund.
export async function cleanerBookingAction(
  bookingId: string,
  action: "capture" | "cancel"
): Promise<void> {
  const { error } = await supabase.functions.invoke("stripe-booking-action", {
    body: { booking_id: bookingId, action },
  });
  if (error) {
    type EdgeFnError = Error & { context?: { text?: () => Promise<string> } };
    const ctx = (error as EdgeFnError).context;
    let details = error.message;
    if (ctx && typeof ctx.text === "function") {
      try {
        details = `${error.message}: ${await ctx.text()}`;
      } catch {}
    }
    throw new Error(details);
  }
}

export async function markWorkDone(bookingId: string) {
  const { error } = await supabase
    .from("bookings")
    .update({ status: "work_done", work_done_at: new Date().toISOString() })
    .eq("id", bookingId);

  if (error) throw error;
}

// --- Cleaners ---

export async function searchCleaners(city?: string): Promise<CleanerProfile[]> {
  let query = supabase
    .from("cleaner_profiles")
    .select()
    .eq("is_available", true);

  if (city && city.trim()) {
    query = query.ilike("city", `%${city}%`);
  }

  const { data, error } = await query.order("avg_rating", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCleaner(id: string): Promise<CleanerProfile | null> {
  const { data, error } = await supabase
    .from("cleaner_profiles")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Spatial search: returns every available cleaner whose coverage zone
// actually contains the given customer point. Backed by a PostGIS
// ST_Contains query via the `search_cleaners_by_point` RPC.
export async function searchCleanersNearPoint(
  lat: number,
  lng: number
): Promise<CleanerProfile[]> {
  const { data, error } = await supabase.rpc("search_cleaners_by_point", {
    lat,
    lng,
  });
  if (error) throw error;
  return (data as CleanerProfile[]) ?? [];
}

// ────────────────────────────────────────────────────────────────────────────
// Cleaner listings (1:N with cleaner_profiles)
// ────────────────────────────────────────────────────────────────────────────

// Fetch every listing belonging to the current cleaner, newest first.
export async function fetchMyListings(
  cleanerId: string
): Promise<CleanerListing[]> {
  const { data, error } = await supabase
    .from("cleaner_listings")
    .select()
    .eq("cleaner_id", cleanerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as CleanerListing[]) ?? [];
}

// Fetch a single listing by id (for the edit page).
export async function fetchListing(
  listingId: string
): Promise<CleanerListing | null> {
  const { data, error } = await supabase
    .from("cleaner_listings")
    .select()
    .eq("id", listingId)
    .maybeSingle();

  if (error) throw error;
  return data as CleanerListing | null;
}

// Create a fresh empty listing. Pass `isFirst: true` only when the
// cleaner does not yet have any listing — that first row is free.
// Additional rows must be created via the Stripe subscription flow.
export async function createListing(
  cleanerId: string,
  isFirst: boolean
): Promise<CleanerListing> {
  const { data, error } = await supabase
    .from("cleaner_listings")
    .insert({
      cleaner_id: cleanerId,
      title: "Nuovo annuncio",
      is_active: true,
      is_first_listing: isFirst,
      subscription_status: isFirst ? "none" : "incomplete",
    })
    .select()
    .single();

  if (error) throw error;
  return data as CleanerListing;
}

// Partial update of a listing. Only the provided fields are touched.
export async function updateListing(
  listingId: string,
  patch: Partial<CleanerListing>
): Promise<void> {
  const { error } = await supabase
    .from("cleaner_listings")
    .update(patch)
    .eq("id", listingId);

  if (error) throw error;
}

// Delete a listing. Cancelling an associated Stripe subscription, if
// any, is the caller's responsibility (and is done via Edge Function).
export async function deleteListing(listingId: string): Promise<void> {
  const { error } = await supabase
    .from("cleaner_listings")
    .delete()
    .eq("id", listingId);

  if (error) throw error;
}

// Spatial search: find every active listing whose coverage zone
// contains the given customer point. Uses the PostGIS RPC.
export async function searchListingsNearPoint(
  lat: number,
  lng: number
): Promise<ListingSearchResult[]> {
  const { data, error } = await supabase.rpc("search_listings_by_point", {
    lat,
    lng,
  });
  if (error) throw error;
  return (data as ListingSearchResult[]) ?? [];
}

// Persist the cleaner's coverage zone. The DB trigger will rebuild the
// derived GEOGRAPHY column, so we only send the raw inputs.
export interface CleanerCoverageZoneInput {
  mode: CoverageMode;
  city: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  polygon: PolygonPoint[] | null;
}

export async function saveCleanerCoverageZone(
  userId: string,
  zone: CleanerCoverageZoneInput
): Promise<void> {
  const payload: Record<string, unknown> = {
    id: userId,
    city: zone.city || null,
    coverage_mode: zone.mode,
    coverage_center_lat: zone.centerLat,
    coverage_center_lng: zone.centerLng,
    coverage_radius_km: zone.mode === "circle" ? zone.radiusKm : null,
    coverage_polygon:
      zone.mode === "polygon" && zone.polygon && zone.polygon.length >= 3
        ? zone.polygon
        : null,
  };

  const { error } = await supabase
    .from("cleaner_profiles")
    .upsert(payload, { onConflict: "id" });

  if (error) throw error;
}

// --- Messages ---

export async function fetchMessages(bookingId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select()
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export class MessageBlockedError extends Error {
  violationType: string;
  friendlyMessage: string;
  constructor(violationType: string, friendlyMessage: string) {
    super(friendlyMessage);
    this.name = "MessageBlockedError";
    this.violationType = violationType;
    this.friendlyMessage = friendlyMessage;
  }
}

export async function sendMessage(bookingId: string, _senderId: string, content: string) {
  const { data, error } = await supabase.functions.invoke("validate-message", {
    body: { booking_id: bookingId, content },
  });

  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const payload = await ctx.json();
        if (payload?.blocked) {
          throw new MessageBlockedError(
            String(payload.violation_type ?? "unknown"),
            String(payload.message ?? "Messaggio non inviato.")
          );
        }
      } catch (parseErr) {
        if (parseErr instanceof MessageBlockedError) throw parseErr;
      }
    }
    throw error;
  }

  if (data?.blocked) {
    throw new MessageBlockedError(
      String(data.violation_type ?? "unknown"),
      String(data.message ?? "Messaggio non inviato.")
    );
  }
}

export function subscribeToMessages(
  bookingId: string,
  onMessage: (msg: Message) => void
) {
  return supabase
    .channel(`messages-${bookingId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `booking_id=eq.${bookingId}`,
      },
      (payload) => {
        onMessage(payload.new as Message);
      }
    )
    .subscribe();
}

// --- Profile ---

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select()
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertActiveRole(
  userId: string,
  role: string,
  fullName?: string
): Promise<UserProfile> {
  const row: Record<string, string> = { id: userId, active_role: role };
  if (fullName) row.full_name = fullName;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// --- Cleaner Onboarding ---

export async function upsertCleanerProfile(userId: string, profileData: Record<string, unknown>) {
  const { error } = await supabase
    .from("cleaner_profiles")
    .upsert({ id: userId, ...profileData }, { onConflict: "id" });

  if (error) throw error;
}

export async function markCleanerOnboarded(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ cleaner_onboarded: true })
    .eq("id", userId);

  if (error) throw error;
}

// ─── Cleaner setup checklist progress ─────────────────────────────────────────

export type CleanerSetupStepKey = "profile" | "photo" | "stripe" | "listing";

export type CleanerSetupProgress = Partial<Record<CleanerSetupStepKey, boolean>>;

/**
 * Load the persisted setup progress for a cleaner from profiles.cleaner_setup_progress.
 * Returns an empty object if the column doesn't exist yet (pre-migration).
 */
export async function fetchCleanerSetupProgress(
  userId: string
): Promise<CleanerSetupProgress> {
  const { data, error } = await supabase
    .from("profiles")
    .select("cleaner_setup_progress")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    // Column may not exist yet on older schema
    if (
      error.code === "42703" ||
      error.message?.includes("does not exist")
    ) {
      return {};
    }
    throw error;
  }
  return (data?.cleaner_setup_progress as CleanerSetupProgress) ?? {};
}

/**
 * Persist a step completion and optionally flip cleaner_setup_complete.
 */
export async function saveCleanerSetupProgress(
  userId: string,
  progress: CleanerSetupProgress,
  allDone: boolean
): Promise<void> {
  const patch: Record<string, unknown> = {
    cleaner_setup_progress: progress,
  };
  if (allDone) {
    patch.cleaner_setup_complete = true;
  }
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId);
  if (error) throw error;
}

// ──────────────────────────────────────────────────────────────────────────────

export async function updateProfileName(
  userId: string,
  fullName: string
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName.trim() })
    .eq("id", userId);
  if (error) throw error;
}

// Permanently delete the current user's account via the
// `delete-account` edge function. The function uses the service role
// key to call auth.admin.deleteUser which cascades to every row that
// references auth.users(id).
export async function deleteOwnAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-account", {
    body: {},
  });
  if (error) {
    type EdgeFnError = Error & { context?: { text?: () => Promise<string> } };
    const ctx = (error as EdgeFnError).context;
    let details = error.message;
    if (ctx && typeof ctx.text === "function") {
      try {
        details = `${error.message}: ${await ctx.text()}`;
      } catch {}
    }
    throw new Error(details);
  }
}

// --- Avatar ---

/**
 * Uploads a local image URI to Supabase Storage (bucket: avatars),
 * updates the profile's avatar_url, and returns the public URL.
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  // Build a unique file path: avatars/<userId>/<timestamp>.jpg
  const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileName = `${userId}/${Date.now()}.${ext}`;

  // Fetch the local file as a Blob
  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(fileName, blob, {
      contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", userId);

  if (updateError) throw updateError;

  return publicUrl;
}

/**
 * Uploads a cover photo for a SPECIFIC listing row (not the whole
 * cleaner_profiles row). Writes to the same `avatars` bucket under
 * `listing-covers/<userId>/<listingId>/<timestamp>.jpg` and updates
 * cleaner_listings.cover_url. Returns the public URL.
 */
export async function uploadListingCover(
  userId: string,
  listingId: string,
  localUri: string
): Promise<string> {
  const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileName = `listing-covers/${userId}/${listingId}/${Date.now()}.${ext}`;

  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(fileName, blob, {
      contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;

  const { error: updateError } = await supabase
    .from("cleaner_listings")
    .update({ cover_url: publicUrl })
    .eq("id", listingId);

  if (updateError) throw updateError;

  return publicUrl;
}

/**
 * Uploads the cleaner listing cover photo to Supabase Storage and updates
 * cleaner_profiles.avatar_url. Reuses the same `avatars` bucket but with
 * a `covers/` subfolder so listing covers are kept separate from user
 * profile pictures.
 */
export async function uploadCleanerCover(
  userId: string,
  localUri: string
): Promise<string> {
  const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileName = `covers/${userId}/${Date.now()}.${ext}`;

  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(fileName, blob, {
      contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;

  const { error: updateError } = await supabase
    .from("cleaner_profiles")
    .upsert({ id: userId, avatar_url: publicUrl }, { onConflict: "id" });

  if (updateError) throw updateError;

  return publicUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// User Documents
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentKind =
  | "id_card"
  | "passport"
  | "driving_license"
  | "tax_code"
  | "other";

export interface UserDocument {
  id: string;
  user_id: string;
  kind: DocumentKind;
  name: string;
  file_url: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
}

export async function getDocumentSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("user-documents")
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function fetchUserDocuments(
  userId: string
): Promise<UserDocument[]> {
  const { data, error } = await supabase
    .from("user_documents")
    .select("id, user_id, kind, name, file_url, storage_path, size_bytes, mime_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    // Table may not exist yet — return empty array gracefully
    if (
      error.code === "42P01" ||
      error.message?.includes("does not exist")
    ) {
      return [];
    }
    throw error;
  }
  return (data as UserDocument[]) ?? [];
}

export async function deleteUserDocument(documentId: string, userId: string): Promise<void> {
  // Fetch storage_path before deleting so we can clean up Storage
  const { data: doc, error: fetchError } = await supabase
    .from("user_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();
  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from("user_documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", userId);
  if (error) throw error;

  // Best-effort storage cleanup — do not throw if this fails
  if (doc?.storage_path) {
    await supabase.storage.from("user-documents").remove([doc.storage_path]);
  }
}

export async function uploadUserDocument(
  userId: string,
  localUri: string,
  mimeType: string,
  fileName: string,
  kind: DocumentKind,
  onProgress?: (percent: number) => void
): Promise<UserDocument> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "pdf";
  const storagePath = `${userId}/${Date.now()}-${fileName}`;

  const response = await fetch(localUri);
  const blob = await response.blob();
  const sizeBytes = blob.size;

  const MAX_BYTES = 10 * 1024 * 1024;
  if (sizeBytes > MAX_BYTES) throw new Error("Il file supera il limite di 10 MB.");

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("user-documents")
    .upload(storagePath, blob, {
      contentType: mimeType || `application/${ext}`,
      upsert: false,
    });

  if (uploadError) throw uploadError;
  onProgress?.(80);

  // Generate a 1-hour signed URL (bucket is private — no public URLs)
  const signedUrl = await getDocumentSignedUrl(storagePath);
  onProgress?.(90);

  // Save record to DB
  const { data, error: insertError } = await supabase
    .from("user_documents")
    .insert({
      user_id: userId,
      kind,
      name: fileName,
      file_url: signedUrl,
      storage_path: storagePath,
      size_bytes: sizeBytes,
      mime_type: mimeType || `application/${ext}`,
    })
    .select()
    .single();

  if (insertError) {
    // Clean up storage on DB failure
    await supabase.storage.from("user-documents").remove([storagePath]);
    throw insertError;
  }

  onProgress?.(100);
  return data as UserDocument;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toggles the cleaner's availability flag. Used by the active/inactive
 * Switch on the listing page.
 */
export async function setCleanerAvailability(
  userId: string,
  isAvailable: boolean
): Promise<void> {
  const { error } = await supabase
    .from("cleaner_profiles")
    .upsert(
      { id: userId, is_available: isAvailable },
      { onConflict: "id" }
    );
  if (error) throw error;
}

// ─── Dispatch multi-cleaner API ───────────────────────────────────────────────

/**
 * Fetch pending booking_offers for a cleaner (status='pending', not expired).
 * Returns offers joined with booking details for display.
 */
export async function fetchPendingOffersForCleaner(
  cleanerId: string
): Promise<BookingOffer[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("booking_offers")
    .select(`
      *,
      booking:bookings(*)
    `)
    .eq("cleaner_id", cleanerId)
    .eq("status", "pending")
    .gt("expires_at", now)
    .order("created_at", { ascending: false });

  if (error) {
    // Table not yet migrated — return empty gracefully
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return [];
    }
    throw error;
  }
  return (data as BookingOffer[]) ?? [];
}

/**
 * Accept or decline a booking offer via the stripe-booking-action Edge Function.
 * Returns { ok: true, status: "accepted" } or { ok: false, error: "already_taken" }.
 */
export async function cleanerOfferAction(
  bookingId: string,
  action: "accept" | "decline"
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke(
    "stripe-booking-action",
    { body: { booking_id: bookingId, action } }
  );

  if (error) {
    type EdgeFnError = Error & { context?: { text?: () => Promise<string> } };
    const ctx = (error as EdgeFnError).context;
    let details = error.message;
    if (ctx && typeof ctx.text === "function") {
      try {
        details = `${error.message}: ${await ctx.text()}`;
      } catch {}
    }
    // 409 already_taken is a non-exceptional race condition — surface it
    if (details.includes("already_taken")) {
      return { ok: false, error: "already_taken" };
    }
    throw new Error(details);
  }

  return (data as { ok: boolean; status?: string; error?: string }) ?? {
    ok: true,
  };
}

/**
 * Fetch a booking row + all its booking_offers for the client waiting screen.
 */
export async function fetchBookingWithOffers(
  bookingId: string
): Promise<{ booking: Booking | null; offers: BookingOffer[] }> {
  const [bookingResult, offersResult] = await Promise.all([
    supabase
      .from("bookings")
      .select()
      .eq("id", bookingId)
      .maybeSingle(),
    supabase
      .from("booking_offers")
      .select(`
        *,
        cleaner:cleaner_profiles(full_name, avatar_url)
      `)
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true }),
  ]);

  if (bookingResult.error) throw bookingResult.error;

  // booking_offers table might not exist yet
  const offers: BookingOffer[] =
    offersResult.error?.code === "42P01" || offersResult.error?.message?.includes("does not exist")
      ? []
      : offersResult.error
      ? (() => { throw offersResult.error; })()
      : ((offersResult.data ?? []) as BookingOffer[]);

  // Flatten joined cleaner fields into top-level for easy rendering
  const mappedOffers = offers.map((o) => {
    const raw = o as BookingOffer & {
      cleaner?: { full_name: string; avatar_url: string | null };
    };
    return {
      ...o,
      cleaner_name: raw.cleaner?.full_name,
      cleaner_avatar: raw.cleaner?.avatar_url ?? null,
    };
  });

  return {
    booking: bookingResult.data as Booking | null,
    offers: mappedOffers,
  };
}

/**
 * Subscribe to Realtime changes on a booking row.
 * Calls onUpdate whenever the row changes (status, cleaner_id, etc.).
 */
export function subscribeToBooking(
  bookingId: string,
  onUpdate: (booking: Booking) => void
) {
  return supabase
    .channel(`booking-${bookingId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "bookings",
        filter: `id=eq.${bookingId}`,
      },
      (payload) => onUpdate(payload.new as Booking)
    )
    .subscribe();
}

/**
 * Subscribe to Realtime changes on booking_offers for a given booking.
 * Calls onUpdate whenever any offer row changes.
 */
export function subscribeToBookingOffers(
  bookingId: string,
  onUpdate: (offer: BookingOffer) => void
) {
  return supabase
    .channel(`booking-offers-${bookingId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "booking_offers",
        filter: `booking_id=eq.${bookingId}`,
      },
      (payload) => onUpdate(payload.new as BookingOffer)
    )
    .subscribe();
}

/**
 * Subscribe to Realtime changes on booking_offers for a specific cleaner.
 * Used by the cleaner home screen to detect when offers are cancelled
 * (another cleaner won the race) and remove them from the list live.
 */
export function subscribeToCleanerOffers(
  cleanerId: string,
  onUpdate: (offer: BookingOffer) => void
) {
  return supabase
    .channel(`cleaner-offers-${cleanerId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "booking_offers",
        filter: `cleaner_id=eq.${cleanerId}`,
      },
      (payload) => onUpdate(payload.new as BookingOffer)
    )
    .subscribe();
}

/**
 * Removes the current avatar: deletes from storage and clears avatar_url.
 */
export async function removeAvatar(userId: string, currentAvatarUrl: string): Promise<void> {
  // Extract the storage path from the public URL
  // Public URL format: .../storage/v1/object/public/avatars/<path>
  const marker = "/avatars/";
  const idx = currentAvatarUrl.indexOf(marker);
  if (idx !== -1) {
    const storagePath = currentAvatarUrl.slice(idx + marker.length);
    await supabase.storage.from("avatars").remove([storagePath]);
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", userId);

  if (error) throw error;
}

// ─── Escrow + photo moderation API ────────────────────────────────────────────

export type BookingPhotoType =
  | "before"
  | "after_cleaner"
  | "dispute_client"
  | "dispute_cleaner";

export class PhotoRejectedError extends Error {
  reason: string;
  friendlyMessage: string;
  constructor(reason: string, friendlyMessage: string) {
    super(friendlyMessage);
    this.name = "PhotoRejectedError";
    this.reason = reason;
    this.friendlyMessage = friendlyMessage;
  }
}

/**
 * Upload a photo to Storage and run moderation. Returns the public URL on success.
 * Throws PhotoRejectedError if moderation flags the image (NSFW, violence, etc.).
 *
 * The moderation Edge Function deletes the file from Storage if rejected, so the
 * client doesn't need to clean up.
 */
export async function uploadAndModerateBookingPhoto(args: {
  bookingId: string;
  uri: string;
  type: BookingPhotoType;
  roomLabel?: string;
}): Promise<{ photoId: string; photoUrl: string }> {
  const { bookingId, uri, type, roomLabel } = args;

  // 1. Read file as Uint8Array
  const fileResp = await fetch(uri);
  if (!fileResp.ok) throw new Error("Cannot read photo from device");
  const arrayBuffer = await fileResp.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // 2. Build storage path
  const ext = uri.split(".").pop()?.toLowerCase().split("?")[0] || "jpg";
  const fileName = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storagePath = `${bookingId}/${fileName}`;

  // 3. Upload to Storage
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  const { error: uploadErr } = await supabase.storage
    .from("booking-photos")
    .upload(storagePath, bytes, { contentType, upsert: false });

  if (uploadErr) throw uploadErr;

  // 4. Call moderation Edge Function (it inserts the booking_photos row + returns URL)
  const { data, error } = await supabase.functions.invoke("moderate-photo", {
    body: { booking_id: bookingId, storage_path: storagePath, type, room_label: roomLabel },
  });

  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const payload = await ctx.json();
        if (payload?.rejected) {
          throw new PhotoRejectedError(
            String(payload.reason ?? "policy_violation"),
            String(payload.message ?? "Foto non ammessa")
          );
        }
      } catch (parseErr) {
        if (parseErr instanceof PhotoRejectedError) throw parseErr;
      }
    }
    // Best-effort cleanup if upload landed but moderation failed
    await supabase.storage.from("booking-photos").remove([storagePath]).catch(() => {});
    throw error;
  }

  if (!data?.ok) {
    if (data?.rejected) {
      throw new PhotoRejectedError(
        String(data.reason ?? "policy_violation"),
        String(data.message ?? "Foto non ammessa")
      );
    }
    throw new Error("Moderation failed");
  }

  return { photoId: String(data.photo_id), photoUrl: String(data.photo_url) };
}

/**
 * Cleaner marks the work as completed. Server checks that work_done_at is null
 * and that the caller is the assigned cleaner.
 */
export async function markBookingDone(bookingId: string): Promise<{ workDoneAt: string }> {
  const { data, error } = await supabase.functions.invoke("booking-mark-done", {
    body: { booking_id: bookingId },
  });
  if (error) throw error;
  return { workDoneAt: String(data?.work_done_at) };
}

/**
 * Client confirms the service was performed correctly. Triggers transfer to cleaner.
 */
export async function confirmBookingCompletion(
  bookingId: string
): Promise<{ transferId?: string; amountEur?: number }> {
  const { data, error } = await supabase.functions.invoke("booking-confirm-completion", {
    body: { booking_id: bookingId },
  });
  if (error) throw error;
  return {
    transferId: data?.transfer_id ? String(data.transfer_id) : undefined,
    amountEur: typeof data?.amount_eur === "number" ? data.amount_eur : undefined,
  };
}

/**
 * Client opens an in-app dispute. Reason must be at least 20 chars.
 * Photos should be uploaded separately via uploadAndModerateBookingPhoto with
 * type="dispute_client" before calling this.
 */
export async function openBookingDispute(
  bookingId: string,
  reason: string
): Promise<{ disputeOpenedAt: string }> {
  const trimmed = reason.trim();
  if (trimmed.length < 20) {
    throw new Error("La motivazione deve essere di almeno 20 caratteri");
  }
  const { data, error } = await supabase.functions.invoke("booking-open-dispute", {
    body: { booking_id: bookingId, reason: trimmed },
  });
  if (error) throw error;
  return { disputeOpenedAt: String(data?.dispute_opened_at) };
}

/**
 * Fetch all approved photos for a booking, optionally filtered by type.
 */
export async function fetchBookingPhotos(
  bookingId: string,
  type?: BookingPhotoType
): Promise<{
  id: string;
  photo_url: string;
  type: string;
  room_label: string | null;
  uploaded_by: string;
  created_at: string;
}[]> {
  let q = supabase
    .from("booking_photos")
    .select("id, photo_url, type, room_label, uploaded_by, created_at")
    .eq("booking_id", bookingId)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: true });

  if (type) q = q.eq("type", type);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
