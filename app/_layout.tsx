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

// Native Google Sign-In is loaded lazily and behind try/catch so the
// app keeps booting even on a dev client that doesn't yet have the
// @react-native-google-signin native module compiled in (e.g. before
// the next EAS build). When the module IS available we configure it
// once on first use; otherwise we silently fall back to the old web
// OAuth flow inside signInWithGoogle.
type GoogleSigninModule =
  typeof import("@react-native-google-signin/google-signin");
// The library's return shape changed across versions: older builds returned
// the user object directly with idToken at the top level, newer builds wrap
// success as { type: "success", data: { idToken, ... } } and cancellation as
// { type: "cancelled" }. Cover both so we don't need an `as any` cast.
type GoogleSignInResult =
  | { type: "cancelled"; data?: undefined; idToken?: undefined }
  | {
      type?: "success";
      data?: { idToken?: string | null } | null;
      idToken?: string | null;
    };
let cachedGoogleSignin: GoogleSigninModule | null | undefined = undefined;
function loadGoogleSignin(): GoogleSigninModule | null {
  if (cachedGoogleSignin !== undefined) return cachedGoogleSignin;
  try {
    const mod =
      require("@react-native-google-signin/google-signin") as GoogleSigninModule;
    mod.GoogleSignin.configure({
      webClientId:
        "255465018931-apns3c72atrijvg3l54k2aulrjtl50kj.apps.googleusercontent.com",
      iosClientId:
        "255465018931-703lire871dh8t90vu0e7cooo7vp4tfm.apps.googleusercontent.com",
    });
    cachedGoogleSignin = mod;
  } catch {
    cachedGoogleSignin = null;
  }
  return cachedGoogleSignin;
}
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
    // When "Confirm email" is enabled on the Supabase project, the
    // confirmation link in the email must come back to the app via a
    // deep link instead of the default web URL — otherwise tapping the
    // link opens a blank Safari page.
    const emailRedirectTo = Linking.createURL("auth/callback");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: fullName,
          ...(options?.role ? { role: options.role } : {}),
          ...(options?.phone ? { phone: options.phone } : {}),
        },
      },
    });
    if (error) throw error;
    // Note: when "Confirm email" is ON, Supabase returns 200 with empty
    // identities[] BOTH for repeat signups (anti-enumeration) AND for
    // genuinely new users (the identity row isn't materialized until
    // the email is confirmed). So we can't tell them apart here without
    // false positives. We just trust the success path; if the email
    // was already in use, no confirmation email is sent and the user
    // will figure it out trying to log in.
  };

  const signInWithGoogleNative = async (
    mod: NonNullable<ReturnType<typeof loadGoogleSignin>>
  ) => {
    const { GoogleSignin, statusCodes, isErrorWithCode } = mod;
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result: GoogleSignInResult = await GoogleSignin.signIn();
      if (result?.type === "cancelled") {
        setIsAuthenticating(false);
        return;
      }
      const idToken =
        result?.data?.idToken ?? result?.idToken ?? undefined;
      if (!idToken) throw new Error("Google non ha restituito un idToken");
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });
      if (error) throw error;
    } catch (e) {
      setIsAuthenticating(false);
      if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return;
      const message = e instanceof Error ? e.message : "Errore imprevisto";
      Alert.alert("Errore Google", message);
    }
  };

  // Legacy web-OAuth fallback. Used when the native Google Sign-In
  // module isn't compiled into the running dev client (i.e. before the
  // next EAS build picks it up).
  const signInWithGoogleWeb = async () => {
    const redirectUrl = Linking.createURL("auth/callback");
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) {
        setIsAuthenticating(false);
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl, {
        preferEphemeralSession: false,
      });
      if (result.type !== "success" || !result.url) {
        setIsAuthenticating(false);
        return;
      }
      const url = new URL(result.url);
      const hashParams = new URLSearchParams(url.hash.substring(1));
      const searchParams = new URLSearchParams(url.search);
      const accessToken =
        hashParams.get("access_token") ?? searchParams.get("access_token");
      const refreshToken =
        hashParams.get("refresh_token") ?? searchParams.get("refresh_token");
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
    } catch (e) {
      setIsAuthenticating(false);
      const message = e instanceof Error ? e.message : "Errore imprevisto";
      Alert.alert("Errore Google", message);
    }
  };

  const signInWithGoogle = async () => {
    setIsAuthenticating(true);
    const mod = loadGoogleSignin();
    if (mod) {
      await signInWithGoogleNative(mod);
    } else {
      await signInWithGoogleWeb();
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
    // Best-effort revoke of the cached Google credential so the next
    // tap on "Accedi con Google" lets the user pick a different account
    // instead of silently re-signing them in. Skipped when the native
    // module isn't loaded (web-OAuth fallback path).
    try {
      const mod = loadGoogleSignin();
      if (mod) await mod.GoogleSignin.signOut();
    } catch {
      /* ignore */
    }
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
