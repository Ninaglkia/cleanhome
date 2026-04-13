import { supabase } from "./supabase";
import {
  Booking,
  CleanerListing,
  CleanerProfile,
  CoverageMode,
  ListingSearchResult,
  Message,
  PolygonPoint,
  Review,
  UserProfile,
} from "./types";

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

export async function sendMessage(bookingId: string, senderId: string, content: string) {
  const { error } = await supabase.from("messages").insert({
    booking_id: bookingId,
    sender_id: senderId,
    content,
  });

  if (error) throw error;
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
