import { createClient } from "@/lib/supabase/client";
import type { CleanerProfile } from "@/types/cleaner";

export async function fetchNearbyCleaners(
  lat: number,
  lng: number,
  radiusKm = 50
): Promise<CleanerProfile[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("nearby_cleaners", {
    lat,
    lng,
    radius_km: radiusKm,
  });
  if (error) throw error;
  return (data ?? []) as CleanerProfile[];
}
