import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";
import { Colors } from "./theme";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and save token to Supabase.
 * Uses FCM (Android) and APNs (iOS) under the hood.
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  // Check/request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // Get push token (FCM for Android, APNs for iOS)
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  const pushToken = tokenData.data;

  // Also get native FCM/APNs token
  const nativeToken = await Notifications.getDevicePushTokenAsync();

  // Save token to Supabase
  await savePushToken(userId, pushToken, nativeToken.data as string);

  // Android: configure notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "CleanHome",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: Colors.secondary,
      sound: "default",
    });

    await Notifications.setNotificationChannelAsync("bookings", {
      name: "Prenotazioni",
      description: "Notifiche per nuove prenotazioni e aggiornamenti",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });

    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messaggi",
      description: "Nuovi messaggi nelle chat",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }

  return pushToken;
}

/**
 * Save push token to user's profile in Supabase.
 */
async function savePushToken(userId: string, expoPushToken: string, nativeToken: string) {
  const { error } = await supabase
    .from("profiles")
    .update({
      expo_push_token: expoPushToken,
      fcm_token: nativeToken,
      device_platform: Platform.OS,
    })
    .eq("id", userId);

  if (error) {
    throw new Error(`Errore salvataggio token: ${error.message}`);
  }
}

/**
 * Remove push token on logout.
 */
export async function removePushToken(userId: string) {
  await supabase
    .from("profiles")
    .update({
      expo_push_token: null,
      fcm_token: null,
    })
    .eq("id", userId);
}

/**
 * Send a push notification via Supabase Edge Function.
 * Call this from the app when a booking is created, accepted, etc.
 */
export async function sendPushNotification(
  targetUserId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  // Fetch target user's push token
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("expo_push_token")
    .eq("id", targetUserId)
    .single();

  if (error || !profile?.expo_push_token) {
    return;
  }

  // Send via Expo Push API
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: profile.expo_push_token,
      title,
      body,
      sound: "default",
      data: data ?? {},
      priority: "high",
    }),
  });
}

/**
 * Notification types for the app.
 */
export const NotificationMessages = {
  newBooking: (serviceName: string) => ({
    title: "Nuova prenotazione!",
    body: `Hai ricevuto una richiesta per ${serviceName}`,
  }),
  bookingAccepted: (cleanerName: string) => ({
    title: "Prenotazione accettata!",
    body: `${cleanerName} ha accettato la tua prenotazione`,
  }),
  bookingDeclined: () => ({
    title: "Prenotazione rifiutata",
    body: "Il professionista ha rifiutato la richiesta. Cerca un altro!",
  }),
  newMessage: (senderName: string) => ({
    title: "Nuovo messaggio",
    body: `${senderName} ti ha scritto`,
  }),
  workDone: (cleanerName: string) => ({
    title: "Lavoro completato!",
    body: `${cleanerName} ha terminato il lavoro. Conferma per rilasciare il pagamento.`,
  }),
};
