import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase environment variables.\n" +
      "Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env.local"
  );
}

// Storage adapter for Supabase Auth.
//
// On native (iOS/Android) we prefer expo-secure-store (iOS Keychain /
// Android Keystore — encrypted at rest). If the native module isn't
// linked into the current dev build (e.g. the app was built before
// expo-secure-store was added to the project), we fall back to
// AsyncStorage so the app keeps booting. A native rebuild of the dev
// client will re-enable SecureStore automatically.
//
// On web we use AsyncStorage (localStorage under the hood); browsers
// already provide origin isolation, and SecureStore is a no-op there.
let SecureStore: typeof import("expo-secure-store") | null = null;
if (Platform.OS !== "web") {
  try {
    // Lazy require so a missing native module doesn't crash the bundle at import time.
    SecureStore = require("expo-secure-store");
    // Probe the native bridge — throws if the module isn't linked.
    SecureStore?.getItemAsync("__cleanhome_secure_probe__").catch(() => {
      SecureStore = null;
    });
  } catch {
    SecureStore = null;
  }
}

const SECURE_CHUNK_SIZE = 1900;

async function setItemSecure(key: string, value: string) {
  if (!SecureStore) return AsyncStorage.setItem(key, value);
  try {
    if (value.length <= SECURE_CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      await SecureStore.deleteItemAsync(`${key}__chunked`).catch(() => {});
      return;
    }
    const chunks = Math.ceil(value.length / SECURE_CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}__chunked`, String(chunks));
    for (let i = 0; i < chunks; i++) {
      const part = value.slice(i * SECURE_CHUNK_SIZE, (i + 1) * SECURE_CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}__${i}`, part);
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
  } catch {
    SecureStore = null;
    await AsyncStorage.setItem(key, value);
  }
}

async function getItemSecure(key: string): Promise<string | null> {
  if (!SecureStore) return AsyncStorage.getItem(key);
  try {
    const direct = await SecureStore.getItemAsync(key);
    if (direct !== null) return direct;
    const chunkedRaw = await SecureStore.getItemAsync(`${key}__chunked`);
    if (!chunkedRaw) return null;
    const chunks = parseInt(chunkedRaw, 10);
    if (!chunks || isNaN(chunks)) return null;
    const parts: string[] = [];
    for (let i = 0; i < chunks; i++) {
      const part = await SecureStore.getItemAsync(`${key}__${i}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join("");
  } catch {
    SecureStore = null;
    return AsyncStorage.getItem(key);
  }
}

async function removeItemSecure(key: string) {
  if (!SecureStore) return AsyncStorage.removeItem(key);
  try {
    await SecureStore.deleteItemAsync(key).catch(() => {});
    const chunkedRaw = await SecureStore.getItemAsync(`${key}__chunked`).catch(() => null);
    if (chunkedRaw) {
      const chunks = parseInt(chunkedRaw, 10);
      if (chunks && !isNaN(chunks)) {
        for (let i = 0; i < chunks; i++) {
          await SecureStore.deleteItemAsync(`${key}__${i}`).catch(() => {});
        }
      }
      await SecureStore.deleteItemAsync(`${key}__chunked`).catch(() => {});
    }
  } catch {
    SecureStore = null;
    await AsyncStorage.removeItem(key);
  }
}

const SecureStorageAdapter = {
  getItem: (key: string) => getItemSecure(key),
  setItem: (key: string, value: string) => setItemSecure(key, value),
  removeItem: (key: string) => removeItemSecure(key),
};

const storage = Platform.OS === "web" ? AsyncStorage : SecureStorageAdapter;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
    heartbeatIntervalMs: 30000,
  },
});
