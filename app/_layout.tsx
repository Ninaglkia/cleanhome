import { useEffect, useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Notifications from "expo-notifications";
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
  const router = useRouter();

  const refreshProfile = useCallback(async () => {
    if (!user) return null;
    try {
      const p = await fetchProfile(user.id);
      setProfile(p);
      return p;
    } catch {
      setProfile(null);
      return null;
    }
  }, [user]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id)
          .then(setProfile)
          .catch(() => setProfile(null));
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id)
          .then(setProfile)
          .catch(() => setProfile(null));
      } else {
        setProfile(null);
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
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "cleanhome://auth/callback",
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        "cleanhome://auth/callback"
      );
      if (result.type === "success" && result.url) {
        const url = new URL(result.url);

        // Try hash fragment first (implicit flow), then fall back to query params (PKCE flow)
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const searchParams = new URLSearchParams(url.search);

        const accessToken =
          hashParams.get("access_token") ?? searchParams.get("access_token");
        const refreshToken =
          hashParams.get("refresh_token") ?? searchParams.get("refresh_token");

        if (!accessToken || !refreshToken) {
          throw new Error(
            "Google OAuth: no access_token or refresh_token found in callback URL (checked both hash and search params)"
          );
        }

        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }
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
    const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name;
    const p = await upsertActiveRole(user.id, role, fullName);
    setProfile(p);
  };

  return (
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
      </Stack>
    </AuthContext.Provider>
  );
}
