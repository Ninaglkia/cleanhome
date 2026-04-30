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

  // Get push token (FCM for Android, APNs for iOS). Wrapped in try/catch
  // because token retrieval can fail on simulators, on iOS devices without
  // provisioned APNs, or when the Expo project isn't linked. We don't want
  // any of those to crash the app on launch.
  let pushToken: string | null = null;
  let nativeToken: string | null = null;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    pushToken = tokenData.data;
  } catch {
    // silent — no token means no push, the app still works
  }
  try {
    const native = await Notifications.getDevicePushTokenAsync();
    nativeToken = native.data as string;
  } catch {
    // silent
  }

  if (!pushToken) return null;

  // Save token to Supabase (non-fatal if the profiles table isn't yet
  // migrated to have the push token columns — see migration 10)
  try {
    await savePushToken(userId, pushToken, nativeToken ?? "");
  } catch {
    // silent
  }

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
 * Send a push notification via the `send-push-notification` Edge Function.
 *
 * All delivery goes through the server so that:
 *   - Push tokens are never exposed to clients (profiles.expo_push_token
 *     SELECT is restricted to the owner only)
 *   - The sender is authenticated and must be a party on the booking
 *   - We can later add rate limiting, templating, and audit logging in
 *     one place
 *
 * All notifications are booking-scoped — booking_id is required.
 * Non-booking notifications (marketing, system-wide) should use a
 * dedicated endpoint, not this function.
 */
export async function sendPushNotification(
  targetUserId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  // booking_id and optional screen are passed through in `data`. We
  // forward them as top-level fields for the edge function.
  const bookingId = data?.bookingId ?? data?.booking_id;
  const screen = data?.screen;

  if (!bookingId) {
    // Without a booking_id the edge function will reject the call.
    // Log and skip — not a crash, just a no-op.
    if (__DEV__) {
      console.warn(
        "[sendPushNotification] called without bookingId, skipping",
        { targetUserId, title }
      );
    }
    return;
  }

  try {
    await supabase.functions.invoke("send-push-notification", {
      body: {
        recipient_id: targetUserId,
        title,
        body,
        booking_id: bookingId,
        screen,
        data,
      },
    });
  } catch {
    // Silent — delivery failures should not break the calling flow
  }
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
  searchWidening: () => ({
    title: "Stiamo allargando la ricerca",
    body: "Cerchiamo in un'area più ampia. Ti aggiorniamo entro 10 minuti.",
  }),
  payoutReleased: (amountEur: number) => ({
    title: "Pagamento rilasciato!",
    body: `Sono stati trasferiti €${amountEur.toFixed(2)} sul tuo conto Stripe.`,
  }),
  bookingDisputed: () => ({
    title: "Contestazione aperta",
    body: "Il cliente ha aperto una contestazione. CleanHome sta esaminando il caso.",
  }),
  bookingAutoCancelled: () => ({
    title: "Nessun cleaner disponibile",
    body: "Ti abbiamo rimborsato l'intero importo. Accredito in 5-10 giorni lavorativi.",
  }),
};
