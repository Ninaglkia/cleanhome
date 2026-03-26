import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

/**
 * Lazily initialise Firebase Admin SDK.
 * Set the following env vars (server-side only):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (newlines as \n)
 */
function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY."
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to a single FCM token.
 * Returns true on success, false if the token is invalid/expired.
 */
export async function sendPushNotification(
  fcmToken: string,
  payload: PushPayload
): Promise<boolean> {
  try {
    const app = getFirebaseApp();
    const messaging = getMessaging(app);

    await messaging.send({
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data ?? {},
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
      android: {
        notification: {
          sound: "default",
          channelId: "cleanhome_default",
        },
      },
    });

    return true;
  } catch (err: unknown) {
    // FCM error codes for invalid/expired tokens
    const errCode =
      (err as { code?: string })?.code ?? "";
    if (
      errCode === "messaging/registration-token-not-registered" ||
      errCode === "messaging/invalid-registration-token"
    ) {
      return false; // caller should delete this token
    }
    console.error("[push] sendPushNotification error:", err);
    return false;
  }
}

/**
 * Send push notifications to multiple FCM tokens.
 * Returns the list of tokens that are no longer valid and should be removed.
 */
export async function sendPushToMany(
  fcmTokens: string[],
  payload: PushPayload
): Promise<string[]> {
  if (fcmTokens.length === 0) return [];

  const results = await Promise.all(
    fcmTokens.map(async (token) => {
      const ok = await sendPushNotification(token, payload);
      return { token, ok };
    })
  );

  return results.filter((r) => !r.ok).map((r) => r.token);
}
