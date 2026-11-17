import { Capacitor } from "@capacitor/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PushNotifications,
  type PushNotificationSchema
} from "@capacitor/push-notifications";

type PushCleanup = () => Promise<void>;

export async function registerAndroidPushNotifications(
  db: SupabaseClient,
  userId: string
): Promise<PushCleanup> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return async () => undefined;
  }

  let disposed = false;
  let registeredToken = "";
  const listeners: Array<{ remove: () => Promise<void> }> = [];

  const removeListeners = async () => {
    await Promise.all(listeners.map(async (listener) => {
      try {
        await listener.remove();
      } catch (error) {
        console.warn("Could not remove a push notification listener:", error);
      }
    }));
    listeners.length = 0;
  };

  try {
    listeners.push(await PushNotifications.addListener("registration", async ({ value }) => {
      if (disposed || !value) return;
      registeredToken = value;
      const { error } = await db.rpc("register_customer_push_token", {
        p_token: value,
        p_platform: "android"
      });
      if (error) {
        console.warn("Could not save this Android device for push notifications:", error.message);
      }
    }));

    listeners.push(await PushNotifications.addListener("registrationError", (error) => {
      console.warn("Android push registration failed:", error);
    }));

    listeners.push(await PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => {
      window.dispatchEvent(new CustomEvent("vpn:push-received", { detail: notification }));
    }));

    listeners.push(await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const screen = String(action.notification.data?.screen || "");
      if (screen === "orders") {
        window.dispatchEvent(new CustomEvent("vpn:open-orders"));
      }
    }));

    await PushNotifications.createChannel({
      id: "orders",
      name: "Order updates",
      description: "Order confirmations, cancellations and delivery updates",
      importance: 4,
      visibility: 1,
      sound: "default",
      vibration: true
    });

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive !== "granted") {
      permission = await PushNotifications.requestPermissions();
    }

    if (permission.receive === "granted") {
      await PushNotifications.register();
    } else {
      console.info("VPN Products push notifications are disabled for this device.");
    }
  } catch (error) {
    await removeListeners();
    console.warn("Could not initialise Android push notifications:", error);
  }

  return async () => {
    disposed = true;
    await removeListeners();
    if (registeredToken) {
      const { error } = await db.rpc("unregister_customer_push_token", {
        p_token: registeredToken
      });
      if (error) {
        console.warn("Could not detach the Android push token from this account:", error.message);
      }
    }
  };
}
