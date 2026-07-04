/**
 * Native push registration + tap routing (mirrors `useRecentsSync`'s
 * mount-once-in-RootStack pattern).
 *
 * On sign-in: ask the OS for permission (no-op if already granted), fetch
 * the Expo push token, and register it with the backend — from then on the
 * price worker pushes fired alerts to this device (`push_service` on the
 * backend prunes the token automatically if the app is uninstalled).
 * Tapping a notification deep-links: `data.cardId` → the card screen.
 * On sign-out the device token is unregistered. Best-effort throughout —
 * push is never allowed to break the session.
 */
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { routes } from "@/shared/routes";
import { useAuth } from "@/presentation/providers/AuthProvider";

// Foreground notifications show as banners (quiet — no sound replay).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function obtainExpoToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators can't receive push
  const perms = await Notifications.getPermissionsAsync();
  let status = perms.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Alerts",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  // EAS builds must pass the projectId explicitly — auto-resolution from the
  // manifest is unreliable in standalone/TestFlight builds and throws
  // `No "projectId" found`, which would silently kill push registration.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  return data ?? null;
}

export function usePushNotifications(): void {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const registeredToken = useRef<string | null>(null);

  // Register on sign-in; unregister the device on sign-out.
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      const stale = registeredToken.current;
      registeredToken.current = null;
      if (stale) {
        void apiFetch(ENDPOINTS.me.pushToken(stale), { method: "DELETE" }).catch(
          () => {},
        );
      }
      return;
    }
    void (async () => {
      try {
        const token = await obtainExpoToken();
        if (cancelled || !token) return;
        await apiFetch(ENDPOINTS.me.pushTokens, {
          method: "POST",
          json: { token, platform: Platform.OS === "android" ? "android" : "ios" },
        });
        registeredToken.current = token;
      } catch {
        /* permission denied / offline — retry next sign-in */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Tapping a notification routes to its subject.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { cardId?: string }
        | undefined;
      if (data?.cardId) router.push(routes.card(String(data.cardId)));
    });
    return () => sub.remove();
  }, []);
}
