import type { CapacitorConfig } from "@capacitor/cli";

const isDev = process.env.NODE_ENV !== "production";

const config: CapacitorConfig = {
  appId: "com.cleanhome.app",
  appName: "CleanHome",
  // In development, point the WebView at the deployed Vercel URL so we can
  // preview native features without a full static export build.
  // In production (App Store build) we bundle the Next.js static export.
  webDir: "out",
  server: isDev
    ? {
        url: process.env.CAPACITOR_SERVER_URL ?? "https://cleanhome.vercel.app",
        cleartext: false,
      }
    : undefined,
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1a3a35",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    Camera: {
      ios: {
        // Camera usage description shown in iOS permissions dialog
      },
    },
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#f0f4f3",
  },
};

export default config;
