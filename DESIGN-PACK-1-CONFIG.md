# CleanHome — Pack 1 — Configurazione Design + Layout Root

Stack: React Native + Expo Router v3 + NativeWind + TypeScript
Vedi DESIGN-AUDIT-README.md per il contesto completo.

---

### `tailwind.config.js`

```tsx
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ch: {
          primary: "#022420",
          "primary-container": "#1a3a35",
          secondary: "#006b55",
          "secondary-container": "#82f4d1",
          background: "#f6faf9",
          surface: "#f6faf9",
          "surface-low": "#f0f4f3",
          "surface-lowest": "#ffffff",
          "on-surface": "#181c1c",
          "on-surface-variant": "#414846",
          "outline-variant": "#c1c8c5",
          error: "#ba1a1a",
        },
      },
    },
  },
  plugins: [],
};
```

---

### `global.css`

```tsx
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

### `lib/theme.ts`

```tsx
/**
 * CleanHome Design System — "Fresh Luxe"
 *
 * Aesthetic direction: Deep emerald green as the anchor color on crisp white
 * surfaces. Premium shadows, warm teal accents, confident typography hierarchy.
 * Every surface feels intentional — not template-generated.
 */

export const Colors = {
  // --- Brand core ---
  primary: "#022420",          // Deep forest green — authority, trust
  primaryLight: "#0d3b34",     // Elevated surface variant
  primaryMid: "#1a5248",       // Interactive states on dark
  secondary: "#006b55",        // Mid-teal — CTAs, links
  secondaryLight: "#00836a",   // Hover/pressed states
  accent: "#00c896",           // Bright mint — highlights, badges
  accentLight: "#e8fdf7",      // Accent wash — chip backgrounds

  // --- Backgrounds ---
  background: "#f7faf9",       // Almost white with a green tint — body
  backgroundAlt: "#edf5f2",    // Cards on background — slightly deeper
  surface: "#ffffff",          // Pure white — cards, sheets
  surfaceElevated: "#f0f7f4",  // Slightly tinted surface for inner containers

  // --- Text ---
  text: "#0f1f1d",             // Near-black with green tint — primary text
  textSecondary: "#4a6660",    // Secondary / label text
  textTertiary: "#8aaca6",     // Placeholder / disabled text
  textOnDark: "#ffffff",       // White text on dark surfaces
  textOnDarkSecondary: "#82f4d1", // Mint on dark — brand moments
  textOnDarkTertiary: "#5e8a82", // Muted text on dark

  // --- Borders ---
  border: "#d4e4e0",           // Standard border
  borderLight: "#e8f2ef",      // Light divider
  borderFocus: "#006b55",      // Input focus ring

  // --- Semantic ---
  success: "#16a34a",
  successLight: "#dcfce7",
  warning: "#d97706",
  warningLight: "#fef3c7",
  error: "#dc2626",
  errorLight: "#fee2e2",
  info: "#2563eb",
  infoLight: "#dbeafe",

  // --- Cleaner role accent (warm brown/amber — distinguishes from client teal) ---
  cleanerPrimary: "#8B5E3C",       // Warm brown — cleaner active tint
  cleanerPrimaryLight: "#A0714F",  // Lighter variant for states
  cleanerAccent: "#D4A574",        // Cleaner amber accent
  cleanerLight: "#F5EBE0",         // Cleaner light wash
  cleanerAccentLight: "#fdf3ec",   // Warm wash — cleaner chip backgrounds

  // --- Surface system (stitch spec aliases) ---
  surfaceLow: "#f0f4f3",           // Lower surface (input fills)

  // --- Semantic (stitch spec) ---
  // warning/success/error already defined above; keep matching aliases:
  warningAmber: "#f59e0b",         // Amber variant per stitch spec
  successGreen: "#22c55e",         // Green variant per stitch spec
  errorRed: "#ba1a1a",             // Error red per stitch spec

  // Legacy aliases (keep backward compat with tailwind.config.js classes)
  primaryContainer: "#1a3a35",
  secondaryContainer: "#82f4d1",
  outlineVariant: "#c1c8c5",
  onSurface: "#0f1f1d",
  onSurfaceVariant: "#4a6660",
  muted: "#8aaca6",
} as const;

/**
 * Booking status visual config — color, label, and icon name
 */
export const BookingStatusConfig: Record<
  string,
  { color: string; bgColor: string; label: string; icon: string }
> = {
  pending: {
    color: Colors.warning,
    bgColor: Colors.warningLight,
    label: "In attesa",
    icon: "time-outline",
  },
  accepted: {
    color: Colors.secondary,
    bgColor: Colors.accentLight,
    label: "Accettata",
    icon: "checkmark-circle-outline",
  },
  declined: {
    color: Colors.error,
    bgColor: Colors.errorLight,
    label: "Rifiutata",
    icon: "close-circle-outline",
  },
  completed: {
    color: Colors.success,
    bgColor: Colors.successLight,
    label: "Completata",
    icon: "checkmark-done-circle-outline",
  },
  work_done: {
    color: Colors.info,
    bgColor: Colors.infoLight,
    label: "Lavoro fatto",
    icon: "hammer-outline",
  },
  disputed: {
    color: Colors.error,
    bgColor: Colors.errorLight,
    label: "Contestata",
    icon: "alert-circle-outline",
  },
  cancelled: {
    color: Colors.muted,
    bgColor: Colors.surfaceElevated,
    label: "Cancellata",
    icon: "ban-outline",
  },
  auto_cancelled: {
    color: Colors.muted,
    bgColor: Colors.surfaceElevated,
    label: "Auto-cancellata",
    icon: "ban-outline",
  },
};

/**
 * Legacy map — keeps existing code compatible
 */
export const BookingStatusColors: Record<string, { color: string; label: string }> = Object.fromEntries(
  Object.entries(BookingStatusConfig).map(([k, v]) => [k, { color: v.color, label: v.label }])
);

/**
 * Spacing scale — always multiples of 4
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

/**
 * Border radius system — consistent across the app
 */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

/**
 * Shadow presets — layered for depth
 */
export const Shadows = {
  sm: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
  },
} as const;

/**
 * Spring animation presets for react-native-reanimated
 */
export const SpringConfig = {
  // Button press — snappy and responsive
  press: { damping: 18, stiffness: 300, mass: 0.8 },
  // Card entrance — gentle and premium
  entrance: { damping: 22, stiffness: 180 },
  // Modal / sheet slide — smooth
  modal: { damping: 28, stiffness: 200 },
} as const;
```

---

### `app.json`

```tsx
{
  "expo": {
    "name": "CleanHome",
    "slug": "cleanhome",
    "version": "1.0.0",
    "description": "Prenota professionisti delle pulizie verificati nella tua zona in pochi tocchi. Paga in app, traccia il cleaner in tempo reale, lascia recensioni. Niente contanti, niente trattative.",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "scheme": "cleanhome",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#022420"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.cleanhome.app",
      "buildNumber": "1",
      "usesAppleSignIn": true,
      "googleServicesFile": "./GoogleService-Info.plist",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "CleanHome usa la tua posizione per trovare i professionisti vicino a te.",
        "NSPhotoLibraryUsageDescription": "CleanHome accede alle tue foto per caricare l'avatar del profilo e le foto delle case da pulire.",
        "NSPhotoLibraryAddUsageDescription": "CleanHome può salvare ricevute e conferme nella tua libreria foto quando glielo chiedi.",
        "NSCameraUsageDescription": "CleanHome usa la fotocamera per scattare foto del documento d'identità e per le pulizie.",
        "NSMicrophoneUsageDescription": "CleanHome usa il microfono durante la verifica liveness del documento d'identità Stripe.",
        "NSUserTrackingUsageDescription": "CleanHome non traccia la tua attività tra app di terze parti.",
        "UIBackgroundModes": [
          "remote-notification"
        ],
        "ITSAppUsesNonExemptEncryption": false,
        "LSApplicationQueriesSchemes": [
          "tel",
          "mailto",
          "https"
        ]
      }
    },
    "android": {
      "package": "com.cleanhome.app",
      "versionCode": 1,
      "adaptiveIcon": {
        "backgroundColor": "#022420",
        "foregroundImage": "./assets/android-icon-foreground.png"
      },
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "READ_EXTERNAL_STORAGE",
        "CAMERA",
        "POST_NOTIFICATIONS",
        "VIBRATE"
      ],
      "googleServicesFile": "./google-services.json",
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [
            {
              "scheme": "cleanhome"
            }
          ],
          "category": [
            "BROWSABLE",
            "DEFAULT"
          ]
        }
      ]
    },
    "plugins": [
      "expo-router",
      "expo-location",
      "expo-apple-authentication",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#006b55"
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "CleanHome accede alle foto per caricare avatar e documenti di verifica.",
          "cameraPermission": "CleanHome usa la fotocamera per scattare foto del documento d'identità."
        }
      ],
      [
        "@stripe/stripe-react-native",
        {
          "merchantIdentifier": "merchant.com.cleanhome.app",
          "enableGooglePay": false
        }
      ],
      "@sentry/react-native",
      "expo-secure-store",
      "react-native-bottom-tabs"
    ],
    "extra": {
      "router": {},
      "eas": {
        "projectId": "ed26a96b-0801-4170-a67a-1a46a7b671e2"
      },
      "privacyPolicyUrl": "https://www.cleanhomeapp.com/privacy",
      "termsOfServiceUrl": "https://www.cleanhomeapp.com/terms"
    }
  }
}
```

---

### `app/_layout.tsx`

```tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { Platform, Alert, View, Image, Text, LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StripeProvider } from "@stripe/stripe-react-native";

// Silence React 19 forwardRef deprecation warnings emitted by Stripe SDK
// internals. These are cosmetic and will be fixed upstream.
LogBox.ignoreLogs([
  "forwardRef render functions accept exactly two parameters",
]);
import ErrorBoundary from "../components/ErrorBoundary";
import * as Sentry from "@sentry/react-native";

// Initialize Sentry — replace the DSN with your project's DSN from
// https://sentry.io when you create a project. Until then crash
// reports are only logged to console.
const ENV = process.env.EXPO_PUBLIC_ENV ?? "local";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "",
  environment: ENV,
  // Disabled only in local dev to avoid noise. Staging and production always send.
  enabled: ENV !== "local",
  tracesSampleRate: ENV === "production" ? 1.0 : 0.1,
});

// Production safety checks — these warn at runtime so accidental
// misconfigurations surface immediately on first launch of a prod build.
if (!__DEV__) {
  const stripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  if (stripeKey.startsWith("pk_test_")) {
    console.warn(
      "[CleanHome] WARNING: Stripe publishable key is a TEST key in a production build. " +
        "Replace EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY with the live key before shipping."
    );
  }

  // Inside `if (!__DEV__)` we are by definition in a production build,
  // so the earlier `__DEV__ &&` check made this branch unreachable
  // dead code. Drop the redundant guard.
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";
  if (!sentryDsn) {
    console.warn(
      "[CleanHome] WARNING: EXPO_PUBLIC_SENTRY_DSN is not set. " +
        "Crash reports will NOT be captured by Sentry."
    );
  }
}

// Global safety net: catch any promise that escapes a try/catch / .catch().
// Without this React Native LogBox surfaces "Uncaught (in promise)" warnings
// that confuse users on dev builds. In prod, also ship to Sentry for
// visibility instead of silently swallowing.
if (typeof globalThis !== "undefined") {
  type RNPromiseTracker = {
    onUnhandled?: (id: number, err: unknown) => void;
  };
  const rejectionTracking =
    (globalThis as { HermesInternal?: { promiseRejectionTrackingOptions?: RNPromiseTracker } })
      .HermesInternal?.promiseRejectionTrackingOptions;
  if (rejectionTracking) {
    rejectionTracking.onUnhandled = (_id, err) => {
      if (__DEV__) {
        // Quiet log instead of LogBox red box — non-fatal warnings only
        // (any actual bug should fail loud during testing)
        // eslint-disable-next-line no-console
        console.warn("[unhandled promise]", err);
      } else {
        try { Sentry.captureException(err); } catch {}
      }
    };
  }
}
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import * as Crypto from "expo-crypto";
import { supabase } from "../lib/supabase";
import { AuthContext } from "../lib/auth";
import { UserProfile } from "../lib/types";
import { fetchProfile, upsertActiveRole } from "../lib/api";
import { registerForPushNotifications } from "../lib/notifications";
import "../global.css";

WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const router = useRouter();

  const refreshProfile = useCallback(async () => {
    if (!user) return null;
    setIsProfileLoading(true);
    try {
      const p = await fetchProfile(user.id);
      setProfile(p);
      return p;
    } catch {
      setProfile(null);
      return null;
    } finally {
      setIsProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(async ({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          try {
            const p = await fetchProfile(s.user.id);
            setProfile(p);
          } catch {
            setProfile(null);
          }
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (__DEV__) console.warn("[auth] getSession failed:", err?.message ?? err);
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setIsProfileLoading(true);
        fetchProfile(s.user.id)
          .then(setProfile)
          .catch(() => setProfile(null))
          .finally(() => setIsProfileLoading(false));
      } else {
        setProfile(null);
        setIsProfileLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Register push notifications AFTER onboarding rather than at first
  // launch. Apple flags apps that prompt for push permission with no
  // user context as a common review reason — we defer until the user
  // has a populated profile (i.e. confirmed signup, completed role
  // selection / cleaner setup), so the system prompt appears after
  // they've already engaged with the app. The lib helper is itself a
  // no-op if permissions were already requested previously.
  useEffect(() => {
    if (user && profile?.full_name && profile.full_name.length > 0) {
      registerForPushNotifications(user.id).catch(() => {});
    }
  }, [user, profile?.full_name]);

  // Redirect to correct dashboard only on first load (not on role switch)
  const hasRedirected = useRef(false);
  const prevUser = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading || isProfileLoading) return;

    // Reset redirect flag when user changes (login/logout)
    const currentUserId = user?.id ?? null;
    if (currentUserId !== prevUser.current) {
      hasRedirected.current = false;
      prevUser.current = currentUserId;
    }

    if (hasRedirected.current) return;

    if (user) {
      hasRedirected.current = true;
      if (!profile || !profile.cleaner_onboarded) {
        // First login OR profile row not yet created by the DB trigger.
        // Both cases go to /onboarding/welcome, which is the unified entry
        // point: it shows Lottie slides AND collects the user's role via
        // radio cards on the first slide, then persists both the role and
        // `cleaner_onboarded=true` before forwarding to the right home.
        router.replace("/onboarding/welcome");
      } else if (profile.active_role === "cleaner") {
        router.replace("/(tabs)/cleaner-home");
      } else {
        router.replace("/(tabs)/home");
      }
    }
  }, [user, isLoading, isProfileLoading, profile?.active_role]);

  // Handle OAuth deep link callback (cleanhome://auth/callback?code=...)
  useEffect(() => {
    let mounted = true;

    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      // Only process our own scheme to prevent open-redirect / fixation
      // attacks via crafted external links.
      if (!url || !url.startsWith("cleanhome://") || !url.includes("auth/callback")) {
        return;
      }

      try {
        // new URL() can throw on malformed URLs even when our prefix
        // checks pass — wrap defensively.
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          if (__DEV__) console.warn("Deep link: malformed URL", url);
          return;
        }

        const code = parsed.searchParams.get("code");
        const hashParams = new URLSearchParams(parsed.hash.substring(1));
        const accessToken =
          hashParams.get("access_token") ?? parsed.searchParams.get("access_token");
        const refreshToken =
          hashParams.get("refresh_token") ?? parsed.searchParams.get("refresh_token");

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      } catch (err) {
        if (__DEV__) console.error("Deep link auth error:", err);
      }
    };

    // Listen for incoming deep links
    const sub = Linking.addEventListener("url", handleDeepLink);

    // Also check if app was opened via deep link
    Linking.getInitialURL()
      .then((url) => {
        if (mounted && url) handleDeepLink({ url });
      })
      .catch(() => {});

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // Handle notification taps (open correct screen)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { screen?: string; bookingId?: string }
        | undefined;
      if (!data?.screen) return;

      // Map screen keys sent from the backend to real Expo Router paths.
      // Keeping this in one place avoids scattering path strings across
      // the notification senders.
      switch (data.screen) {
        case "bookings":
          router.push("/(tabs)/bookings");
          break;
        case "cleaner-home":
          router.push("/(tabs)/cleaner-home");
          break;
        case "home":
          router.push("/(tabs)/home");
          break;
        case "chat":
          if (data.bookingId) router.push(`/chat/${data.bookingId}`);
          break;
        case "jobs":
          router.push("/cleaner/jobs");
          break;
        case "reviews":
          router.push("/cleaner/reviews");
          break;
        default:
          break;
      }
    });
    return () => sub.remove();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    fullName: string,
    options?: { role?: "client" | "cleaner"; phone?: string }
  ) => {
    // role + phone are read by the handle_new_user trigger from
    // raw_user_meta_data to populate profiles.active_role and
    // profiles.phone. Without them every signup defaulted to 'client'
    // and the phone was discarded — that was the registration bug
    // where "Professionista" became "Cliente".
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          ...(options?.role ? { role: options.role } : {}),
          ...(options?.phone ? { phone: options.phone } : {}),
        },
      },
    });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const redirectUrl = Linking.createURL("auth/callback");
    setIsAuthenticating(true); // Blocco lo schermo subito!

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl,
          { preferEphemeralSession: false }
        );

        // Se l'utente annulla il browser, sblocchiamo lo schermo
        if (result.type !== "success") {
          setIsAuthenticating(false);
          return;
        }

        if (result.type === "success" && result.url) {
          const url = new URL(result.url);
          const hashParams = new URLSearchParams(url.hash.substring(1));
          const searchParams = new URLSearchParams(url.search);

          const accessToken = hashParams.get("access_token") ?? searchParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token") ?? searchParams.get("refresh_token");
          const code = searchParams.get("code");

          if (code) {
            const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
            if (exErr) throw exErr;
          } else if (accessToken && refreshToken) {
            const { error: sErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sErr) throw sErr;
          }
          // NOTA: isAuthenticating rimarrà true finché il redirect automatico non ci sposta!
        }
      } else {
        setIsAuthenticating(false);
      }
    } catch (e) {
      setIsAuthenticating(false);
      const message = e instanceof Error ? e.message : "Errore imprevisto";
      Alert.alert("Errore Google", message);
    }
  };

  const signInWithApple = async () => {
    if (Platform.OS !== "ios") return;

    // Cryptographically secure nonce — mandatory to prevent replay attacks
    // on the Apple ID token. The previous implementation used Math.random
    // which is predictable and would be flagged by a security review.
    // We generate 32 random bytes and hex-encode them to get a 64-char
    // nonce, then hash it with SHA-256 before sending to Apple.
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    const rawNonce = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (credential.identityToken) {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error) throw error;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const setActiveRole = async (role: string) => {
    if (!user) return;
    // Aggiorna subito localmente per reattività istantanea
    setProfile((prev) => prev ? { ...prev, active_role: role } : null);
    // Poi sincronizza col DB in background
    const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name;
    upsertActiveRole(user.id, role, fullName).catch(() => {});
  };

  if (isLoading || (user && isProfileLoading && !profile)) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#022420",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require("../assets/icon.png")}
          style={{ width: 220, height: 220, borderRadius: 36, marginBottom: 24 }}
          resizeMode="contain"
        />
        <Text
          style={{
            color: "#ffffff",
            fontSize: 40,
            fontWeight: "700",
            marginBottom: 8,
          }}
        >
          CleanHome
        </Text>
        <Text
          style={{
            color: "#82f4d1",
            fontSize: 12,
            fontWeight: "500",
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          La tua casa al meglio
        </Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider
        publishableKey={
          process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
        }
        merchantIdentifier="merchant.com.cleanhome.app"
        urlScheme="cleanhome"
      >
        <AuthContext.Provider
          value={{
            session,
            user,
            profile,
            isLoading,
            signInWithEmail,
            signUpWithEmail,
            signInWithGoogle,
            signInWithApple,
            signOut,
            setActiveRole,
            refreshProfile,
          }}
        >
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="cleaner" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="support" />
            <Stack.Screen name="documents" />
            <Stack.Screen name="payments" />
            <Stack.Screen name="booking" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="listing" />
            <Stack.Screen name="listings" />
            <Stack.Screen
              name="review"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen name="profile" />
            <Stack.Screen name="legal" />
          </Stack>
        </AuthContext.Provider>
      </StripeProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
```

---

### `app/index.tsx`

```tsx
import { useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useAuth } from "../lib/auth";
import HouseIcon, {
  TILE_SIZE,
  DOOR_CENTER_IN_TILE_X,
  DOOR_CENTER_IN_TILE_Y,
} from "../components/splash/HouseIcon";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

SplashScreen.preventAutoHideAsync();

// ─── Phase timeline (matches design handoff PDF) ──────────────────────────────
const T_MOUNT = 50;
const T_IDLE = 1400;
const T_ZOOM = 2400;              // zoom starts (single fluid motion 1→60)
const ZOOM_DURATION = 2000;       // per design spec
const T_DOOR_OPEN = 3300;         // door starts opening 900ms into zoom
const DOOR_OPEN_DURATION = 600;   // 3D rotateY -78deg
const T_INSIDE = 4400;            // navigate

const SCALE_MAX = 60;

// ─── Door pivot in screen coordinates ─────────────────────────────────────────
const TILE_CENTER_X = SCREEN_W / 2;
const TILE_CENTER_Y = SCREEN_H * 0.42;
const DOOR_SCREEN_X = TILE_CENTER_X + (DOOR_CENTER_IN_TILE_X - TILE_SIZE / 2);
const DOOR_SCREEN_Y = TILE_CENTER_Y + (DOOR_CENTER_IN_TILE_Y - TILE_SIZE / 2);
const DOOR_DX = DOOR_SCREEN_X - SCREEN_W / 2;
const DOOR_DY = DOOR_SCREEN_Y - SCREEN_H / 2;


export default function SplashScreenView() {
  const { isLoading, user, profile } = useAuth();
  const router = useRouter();

  // Entry & idle
  const mount = useSharedValue(0);
  const idleFloat = useSharedValue(0);
  const idlePulse = useSharedValue(0);

  // Outro — world zoom (moderate)
  const worldScale = useSharedValue(1);
  const titleOpacity = useSharedValue(0);

  // Door animation
  const doorOpen = useSharedValue(0);
  const doorGlow = useSharedValue(0);

  // Final dark fade — fades in as we exit through the doorway,
  // hides the moment of transition to the next screen.
  const exitFade = useSharedValue(0);
  // Dim of the world during go-through (we're entering a darker space)
  const worldDim = useSharedValue(0);
  // Loading dots (3 mint dots that bounce during idle)
  const dotsOpacity = useSharedValue(0);
  const dotPulse = useSharedValue(0);

  const onLayoutReady = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  const navigateAway = async () => {
    // Non-logged-in users ALWAYS see the onboarding tour first.
    // Returning users can tap "Ho già un account — Accedi" from the tour
    // to jump to the login screen.
    if (!user) {
      router.replace("/onboarding/features");
    } else if (!profile || !profile.cleaner_onboarded) {
      router.replace("/onboarding/welcome");
    } else if (profile.active_role === "cleaner") {
      router.replace("/(tabs)/cleaner-home");
    } else {
      router.replace("/(tabs)/home");
    }
  };

  // ─── Entrance choreography ────────────────────────────────────────────────
  useEffect(() => {
    mount.value = withDelay(
      T_MOUNT,
      withTiming(1, {
        duration: 900,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      })
    );
    titleOpacity.value = withDelay(
      T_MOUNT + 200,
      withTiming(1, {
        duration: 700,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      })
    );

    idleFloat.value = withDelay(
      T_IDLE,
      withRepeat(
        withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );
    idlePulse.value = withDelay(
      T_IDLE,
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );

    // Loading dots fade in at idle, then bounce continuously
    dotsOpacity.value = withDelay(
      T_IDLE,
      withTiming(0.85, { duration: 400, easing: Easing.out(Easing.cubic) })
    );
    dotPulse.value = withDelay(
      T_IDLE,
      withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        -1,
        false
      )
    );
  }, []);

  // ─── Outro (per design handoff PDF) ──────────────────────────────────────
  // Single fluid camera move: scale 1 → 60 over 2000ms with ease-zoom.
  // Door opens 3D rotateY -78° at 900ms in (~scale 10x). Final blackout.
  useEffect(() => {
    if (isLoading) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Title + dots fade out as zoom begins
    timers.push(
      setTimeout(() => {
        titleOpacity.value = withTiming(0, {
          duration: 400,
          easing: Easing.out(Easing.cubic),
        });
        dotsOpacity.value = withTiming(0, { duration: 250 });
      }, T_ZOOM - 200)
    );

    // ZOOM — single fluid scale 1→60 over 2000ms with ease-zoom (per design)
    timers.push(
      setTimeout(() => {
        worldScale.value = withTiming(SCALE_MAX, {
          duration: ZOOM_DURATION,
          easing: Easing.bezier(0.5, 0, 0.85, 0.3),
        });
      }, T_ZOOM)
    );

    // DOOR OPENS — 3D rotateY -78° at 900ms into zoom (scale ~10x at that point)
    timers.push(
      setTimeout(() => {
        doorOpen.value = withTiming(1, {
          duration: DOOR_OPEN_DURATION,
          easing: Easing.bezier(0.5, 0, 0.3, 1),
        });
        doorGlow.value = withTiming(1, {
          duration: 400,
          easing: Easing.out(Easing.cubic),
        });
      }, T_DOOR_OPEN)
    );

    // Late blackout — covers navigation handoff
    timers.push(
      setTimeout(() => {
        worldDim.value = withTiming(1, {
          duration: 500,
          easing: Easing.in(Easing.cubic),
        });
        exitFade.value = withDelay(
          200,
          withTiming(1, { duration: 400, easing: Easing.in(Easing.cubic) })
        );
      }, T_INSIDE - 600)
    );

    // Navigate when fade is complete
    timers.push(
      setTimeout(() => {
        runOnJS(navigateAway)();
      }, T_INSIDE)
    );

    return () => timers.forEach(clearTimeout);
  }, [isLoading, user, profile]);

  // ─── World transform: scale + perfect centering on door ───────────────────
  // Pivot math that ALSO smoothly slides the door to screen center as we zoom.
  // At s=1: identity (door at natural y, slightly above center).
  // At s=SCALE_MAX: door is exactly on screen center (0, 0).
  // Formula: ty = -DOOR_DY * (SCALE_MAX / (SCALE_MAX - 1)) * (s - 1)
  const CENTERING_FACTOR = SCALE_MAX / (SCALE_MAX - 1);
  const worldStyle = useAnimatedStyle(() => {
    const s = worldScale.value;
    return {
      opacity: 1 - worldDim.value * 0.85,
      transform: [
        { translateX: -DOOR_DX * CENTERING_FACTOR * (s - 1) },
        { translateY: -DOOR_DY * CENTERING_FACTOR * (s - 1) },
        { scale: s },
      ],
    };
  });

  // ─── Icon entrance + idle float ────────────────────────────────────────────
  const iconStyle = useAnimatedStyle(() => {
    const m = mount.value;
    const float = idleFloat.value;
    return {
      opacity: m,
      transform: [
        { translateX: -TILE_SIZE / 2 },
        { translateY: -TILE_SIZE / 2 + (1 - m) * 30 + float * -6 },
        { scale: 0.85 + 0.15 * m },
      ],
    };
  });

  // ─── Title ─────────────────────────────────────────────────────────────────
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: (1 - titleOpacity.value) * 16 }],
  }));

  // Final dark fade — covers the screen at end of "going through" so the
  // navigation handoff is invisible.
  const exitStyle = useAnimatedStyle(() => ({
    opacity: exitFade.value,
  }));

  // 3 bouncing loading dots — visible during idle phase
  const dotsStyle = useAnimatedStyle(() => ({
    opacity: dotsOpacity.value,
  }));

  // Each dot bounces with a phase offset (sequential bounce, design uses 0.15s stagger)
  const dot1Style = useAnimatedStyle(() => {
    const phase = dotPulse.value % 1;
    const bounce = phase < 0.4 ? Math.sin((phase / 0.4) * Math.PI) : 0;
    return {
      opacity: 0.4 + bounce * 0.6,
      transform: [{ translateY: -bounce * 6 }],
    };
  });
  const dot2Style = useAnimatedStyle(() => {
    const phase = (dotPulse.value + 0.15) % 1;
    const bounce = phase < 0.4 ? Math.sin((phase / 0.4) * Math.PI) : 0;
    return {
      opacity: 0.4 + bounce * 0.6,
      transform: [{ translateY: -bounce * 6 }],
    };
  });
  const dot3Style = useAnimatedStyle(() => {
    const phase = (dotPulse.value + 0.3) % 1;
    const bounce = phase < 0.4 ? Math.sin((phase / 0.4) * Math.PI) : 0;
    return {
      opacity: 0.4 + bounce * 0.6,
      transform: [{ translateY: -bounce * 6 }],
    };
  });

  return (
    <View style={styles.container} onLayout={onLayoutReady}>
      {/* Scaling world */}
      <Animated.View style={[StyleSheet.absoluteFill, worldStyle]}>
        {/* House icon */}
        <Animated.View
          style={[
            {
              position: "absolute",
              left: SCREEN_W / 2,
              top: SCREEN_H * 0.42,
            },
            iconStyle,
          ]}
        >
          <HouseIcon
            doorOpen={doorOpen}
            doorGlow={doorGlow}
            idle={idlePulse}
          />
        </Animated.View>

        {/* Title */}
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              top: SCREEN_H * 0.62,
              alignItems: "center",
            },
            titleStyle,
          ]}
        >
          <Text style={styles.brand}>CleanHome</Text>
          <Text style={styles.tagline}>LA TUA CASA AL MEGLIO</Text>
        </Animated.View>

        {/* 3 bouncing loading dots near bottom */}
        <Animated.View style={[styles.dotsRow, dotsStyle]}>
          <Animated.View style={[styles.dot, dot1Style]} />
          <Animated.View style={[styles.dot, dot2Style]} />
          <Animated.View style={[styles.dot, dot3Style]} />
        </Animated.View>
      </Animated.View>

      {/* Final dark fade — covers screen during navigation handoff */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.exit, exitStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#062a23",
    overflow: "hidden",
  },
  dotsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 80,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#3ee0a8",
  },
  brand: {
    color: "#ffffff",
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -0.7,
  },
  tagline: {
    marginTop: 10,
    color: "#3ee0a8",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 3.5,
  },
  exit: {
    backgroundColor: "#062a23",
  },
});

```
