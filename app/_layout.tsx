import "../global.css";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders } from "@/presentation/providers/AppProviders";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { AppLoadingScreen } from "@/presentation/brand/AppLoadingScreen";
import { NetworkBanner } from "@/presentation/components/NetworkBanner";
import { AnnouncementBanner } from "@/presentation/components/AnnouncementBanner";
import { ErrorBoundary } from "@/presentation/components/ErrorBoundary";
import { MinVersionGate } from "@/presentation/components/MinVersionGate";
import { ThemeProvider, useTheme } from "@/presentation/theme";
import { useRecentsSync } from "@/application/hooks/useRecentsSync";
import { useCurrencyProfileSync } from "@/application/hooks/useDisplayCurrency";
import { useActiveCollectionProfileSync } from "@/application/stores/activeCollectionStore";
import { useFxRatesSync } from "@/application/queries/market/useFxRates";
import { usePriceTicks } from "@/application/queries/market/usePriceTicks";
import { usePushNotifications } from "@/application/hooks/usePushNotifications";
import { initSentry } from "@/infrastructure/observability/sentry";
import { SCREEN_TRANSITION } from "@/presentation/navigation/screenMotion";

// Fire Sentry init once at module evaluation. The helper is a graceful
// no-op when EXPO_PUBLIC_SENTRY_DSN is unset, so dev builds stay zero-config.
initSentry();

export default function RootLayout() {
  // Minimum time the launch screen stays up, so a fast boot doesn't flash it.
  // `AppLoadingScreen` also covers the token-hydration gap after this elapses
  // (see RootStack), which is why this hold can be short.
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    // GestureHandler + SafeArea must sit ABOVE ThemeProvider because
    // they don't depend on theme but theme consumers (status bar,
    // splash, error boundaries) do.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppProviders>
            <ThemedChrome>
              <ErrorBoundary>
                <MinVersionGate>
                  <RootStack />
                </MinVersionGate>
              </ErrorBoundary>
              {/* One launch identity. This used to mount `BrandSplash` — a
                  second, older splash design — so every cold start showed
                  that for its fixed 1.3s hold and the current loading screen
                  only appeared afterwards, if hydration outlasted it. Users
                  saw the old artwork essentially always. */}
              {!splashDone ? (
                <View style={StyleSheet.absoluteFill}>
                  <AppLoadingScreen />
                </View>
              ) : null}
              <NetworkBanner />
              <AnnouncementBanner />
            </ThemedChrome>
          </AppProviders>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Tiny wrapper that paints the root canvas + status bar using the live
 * theme. Sits inside <ThemeProvider> so `useTheme()` is available.
 */
function ThemedChrome({ children }: { children: React.ReactNode }) {
  const { scheme, palette } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "light" ? "dark" : "light"} />
      <View style={{ flex: 1, backgroundColor: palette.bg.base }}>{children}</View>
    </>
  );
}


/**
 * Route groups an unauthenticated visitor may reach.
 *
 * `legal` is public because the welcome and sign-up screens link to the Terms
 * and Privacy Policy *before* an account exists — bouncing those taps back to
 * the welcome screen left the fineprint unreadable, and app review expects a
 * privacy policy that's reachable without signing in.
 *
 * `+not-found` is public so a bad link explains itself. Guarding it meant a
 * signed-out user who tapped a stale universal link was silently dropped on
 * the welcome screen with no hint that the link was dead — indistinguishable
 * from the app just having launched. The screen offers signed-out visitors
 * only the sign-in route, so nothing behind the guard is reachable from it.
 */
const PUBLIC_SEGMENTS = new Set(["(auth)", "legal", "+not-found"]);

/**
 * RootStack — auth-aware navigator.
 *
 * Lives *inside* `<AppProviders>` so it can read `useAuth()`. Until the
 * stored token has hydrated we render the launch screen; afterwards we either
 * render the tabbed app shell or redirect to /(auth)/welcome.
 */
function RootStack() {
  const { isAuthenticated, isLoading } = useAuth();
  const { palette } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  // Cross-device sync of recent searches (+ preserve recently-viewed).
  useRecentsSync();
  // Adopt the profile's saved display currency (set here or on the web).
  useCurrencyProfileSync();
  // Adopt the profile's saved active portfolio (set here or on the web).
  useActiveCollectionProfileSync();
  // Live FX table from the backend — one conversion source for all clients.
  useFxRatesSync();
  // Live price ticks for owned cards — holdings caches refresh the moment
  // the backend records a real price change (Robinhood-style liveness).
  usePriceTicks(isAuthenticated);
  usePushNotifications();

  useEffect(() => {
    if (isLoading) return;
    const root = segments[0] ?? "";
    const inAuthGroup = root === "(auth)";
    if (!isAuthenticated && !PUBLIC_SEGMENTS.has(root)) {
      router.replace("/(auth)/welcome");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  // Don't mount any screen until the stored token has hydrated and been
  // attached to the HTTP client. Mounting the tabs first meant their queries
  // fired token-less on cold boot, cached an empty/401 result, and only a
  // pull-to-refresh recovered (the "$0.00 / No history yet until I swipe"
  // bug). The launch screen covers the first ~0.9s; hydration that outlasts it
  // used to surface as a blank canvas, so the same screen takes over here.
  if (isLoading) {
    return <AppLoadingScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.bg.base },
        animation: "fade",
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="scan/[id]"
        options={{ presentation: "card", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="scan/phone"
        options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="settings"
        options={{ presentation: "card", ...SCREEN_TRANSITION }}
      />
      <Stack.Screen
        name="change-password"
        options={{ presentation: "card", ...SCREEN_TRANSITION }}
      />
      <Stack.Screen
        name="watchlist"
        options={{ presentation: "card", ...SCREEN_TRANSITION }}
      />
      <Stack.Screen
        name="sealed/index"
        options={{ presentation: "card", ...SCREEN_TRANSITION }}
      />
      <Stack.Screen
        name="sealed/add"
        options={{ presentation: "card", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="sealed/[id]"
        options={{ presentation: "card", ...SCREEN_TRANSITION }}
      />
      <Stack.Screen
        name="support"
        options={{ presentation: "card", ...SCREEN_TRANSITION }}
      />
      <Stack.Screen
        name="sets/index"
        options={{ presentation: "card", ...SCREEN_TRANSITION }}
      />
      <Stack.Screen
        name="blog/index"
        options={{ presentation: "card", ...SCREEN_TRANSITION }}
      />
      {/* Primary push destinations — register them so they use the same
          iOS-standard slide as the rest of the stack instead of the
          default `fade` screenOption (card detail is the most-hit screen
          in the app and was fading in, which read as a flicker). */}
      <Stack.Screen
        name="card/[id]"
        options={{ presentation: "card", ...SCREEN_TRANSITION }}
      />
      <Stack.Screen
        name="grade/[id]"
        options={{ presentation: "card", ...SCREEN_TRANSITION }}
      />
      <Stack.Screen
        name="grade/new"
        options={{ presentation: "card", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="grade/playground"
        options={{ presentation: "card", ...SCREEN_TRANSITION }}
      />
      <Stack.Screen
        name="grade/measure"
        options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="scan/identify"
        options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="scan/pair"
        options={{ presentation: "card", ...SCREEN_TRANSITION }}
      />
      <Stack.Screen
        name="admin"
        options={{ presentation: "card", ...SCREEN_TRANSITION }}
      />
      {/* Collector profiles live INSIDE the tab group (`(tabs)/u/[handle]`)
          so the island navbar stays on screen — the registration that used
          to sit here pointed at a route that no longer exists at this
          level, and expo-router was discarding it with a warning. */}
      {/* Unmatched routes. Keeps the stack's default `fade` — a dead link
          shouldn't arrive with the confident slide of a real destination. */}
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}