import * as Location from "expo-location";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface TrackingCoords {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface TrackingSession {
  stop: () => Promise<void>;
}

const CHANNEL_PREFIX = "booking-tracking";
const BROADCAST_EVENT = "location";

function channelName(bookingId: string): string {
  return `${CHANNEL_PREFIX}:${bookingId}`;
}

export async function startLocationBroadcast(
  bookingId: string,
  options: { echoSelf?: boolean } = {}
): Promise<TrackingSession> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Permesso posizione negato");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (__DEV__) {
    console.log(
      "[tracking] auth session:",
      !!sessionData.session?.access_token,
      sessionData.session?.user?.id
    );
  }
  if (sessionData.session?.access_token) {
    supabase.realtime.setAuth(sessionData.session.access_token);
  }

  const channel = supabase.channel(channelName(bookingId), {
    config: {
      broadcast: { ack: false, self: options.echoSelf ?? false },
    },
  });

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Supabase Realtime timeout (10s)"));
    }, 10000);

    channel.subscribe((state, err) => {
      if (__DEV__) console.log("[tracking] channel state:", state, err?.message);
      if (state === "SUBSCRIBED") {
        clearTimeout(timeoutId);
        resolve();
      }
      if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
        clearTimeout(timeoutId);
        reject(err ?? new Error(`Channel ${state}`));
      }
    });
  });

  const watcher = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 8000,
      distanceInterval: 15,
    },
    (loc) => {
      const payload: TrackingCoords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        heading: loc.coords.heading,
        speed: loc.coords.speed,
        timestamp: loc.timestamp,
      };
      channel.send({ type: "broadcast", event: BROADCAST_EVENT, payload });
    }
  );

  return {
    stop: async () => {
      watcher.remove();
      await channel.unsubscribe();
    },
  };
}

export function subscribeToLocation(
  bookingId: string,
  onLocation: (coords: TrackingCoords) => void
): RealtimeChannel {
  const channel = supabase
    .channel(channelName(bookingId), {
      config: { broadcast: { self: false } },
    })
    .on("broadcast", { event: BROADCAST_EVENT }, ({ payload }) => {
      onLocation(payload as TrackingCoords);
    })
    .subscribe();
  return channel;
}

export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function estimateEtaMinutes(
  distanceKm: number,
  avgKmh: number = 25
): number {
  if (distanceKm < 0.05) return 0;
  return Math.max(1, Math.ceil((distanceKm / avgKmh) * 60));
}
