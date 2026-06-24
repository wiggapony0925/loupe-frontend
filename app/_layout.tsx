import "../global.css";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders } from "@/presentation/providers/AppProviders";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { BrandSplash } from "@/presentation/brand/BrandSplash";
import { NetworkBanner } from "@/presentation/components/NetworkBanner";
import { AnnouncementBanner } from "@/presentation/components/AnnouncementBanner";
import { ErrorBoundary } from "@/presentation/components/ErrorBoundary";
import { MinVersionGate } from "@/presentation/components/MinVersionGate";
import { ThemeProvider, useTheme } from "@/presentation/theme";
import { useRecentsSync } from "@/application/hooks/useRecentsSync";
import { initSentry } from "@/infrastructure/observability/sentry";

// Fire Sentry init once at module evaluation. The helper is a graceful
// no-op when EXPO_PUBLIC_SENTRY_DSN is unset, so dev builds stay zero-config.
initSentry();

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

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
              {!splashDone ? <BrandSplash onFinish={() => setSplashDone(true)} /> : null}
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
 * RootStack — auth-aware navigator.
 *
 * Lives *inside* `<AppProviders>` so it can read `useAuth()`. Until the
 * stored token has hydrated we render an empty View (the BrandSplash is
 * already on top); afterwards we either render the tabbed app shell or
 * redirect to /(auth)/welcome.
 */
function RootStack() {
  const { isAuthenticated, isLoading } = useAuth();
  const { palette } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  // Cross-device sync of recent searches (+ preserve recently-viewed).
  useRecentsSync();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/welcome");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  // Don't mount any screen until the stored token has hydrated and been
  // attached to the HTTP client. Mounting the tabs first meant their queries
  // fired token-less on cold boot, cached an empty/401 result, and only a
  // pull-to-refresh recovered (the "$0.00 / No history yet until I swipe"
  // bug). The BrandSplash overlays this gap, so the user just sees the splash.
  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: palette.bg.base }} />;
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
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="notifications"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="watchlist"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="sealed/index"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="sealed/add"
        options={{ presentation: "card", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="sealed/[id]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="support"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      {/* Primary push destinations — register them so they use the same
          iOS-standard slide as the rest of the stack instead of the
          default `fade` screenOption (card detail is the most-hit screen
          in the app and was fading in, which read as a flicker). */}
      <Stack.Screen
        name="card/[id]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="grade/[id]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="grade/new"
        options={{ presentation: "card", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="scan/identify"
        options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="scan/pair"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="admin"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
    </Stack>
  );
}