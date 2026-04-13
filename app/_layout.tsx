import { useEffect, useState, useCallback, useRef } from "react";
import { Platform, Alert, View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StripeProvider } from "@stripe/stripe-react-native";
import ErrorBoundary from "../components/ErrorBoundary";
import * as Sentry from "@sentry/react-native";

// Initialize Sentry — replace the DSN with your project's DSN from
// https://sentry.io when you create a project. Until then crash
// reports are only logged to console.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "",
  // Disable in dev to avoid noise during development
  enabled: !__DEV__,
  tracesSampleRate: 0.2,
});
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
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
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
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

  // Register push notifications when user is authenticated
  useEffect(() => {
    if (user) {
      registerForPushNotifications(user.id).catch(() => {});
    }
  }, [user]);

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
      if (!profile) {
        // Profilo non ancora creato dal trigger — vai a role-selection
        router.replace("/(auth)/role-selection");
      } else if (!profile.cleaner_onboarded) {
        // Primo accesso: l'utente non ha completato l'onboarding
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
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      if (!url.includes("auth/callback")) return;

      try {
        const parsed = new URL(url);
        const code = parsed.searchParams.get("code");
        const hashParams = new URLSearchParams(parsed.hash.substring(1));
        const accessToken = hashParams.get("access_token") ?? parsed.searchParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token") ?? parsed.searchParams.get("refresh_token");

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      } catch (err) {
        console.error("Deep link auth error:", err);
      }
    };

    // Listen for incoming deep links
    const sub = Linking.addEventListener("url", handleDeepLink);

    // Also check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => sub.remove();
  }, []);

  // Handle notification taps (open correct screen)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.screen) {
        router.push(data.screen as string);
      }
    });
    return () => sub.remove();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
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

    // Generate a cryptographic nonce to prevent replay attacks.
    // We use a UUID built from Math.random since expo-crypto is not installed.
    // NOTE: expo-crypto must be installed (`npx expo install expo-crypto`) and this
    // replaced with Crypto.getRandomValues for production-grade randomness.
    const rawNonce = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }
    );

    // SHA-256 hash of the nonce sent to Apple; Apple embeds it in the identity token.
    const encoder = new TextEncoder();
    const data = encoder.encode(rawNonce);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedNonce = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

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
      <View style={{ flex: 1, backgroundColor: "#f0f4f3", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#006b55" />
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
          </Stack>
        </AuthContext.Provider>
      </StripeProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
