import "../global.css";
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { useColorScheme } from "nativewind";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { queryClient } from "@/lib/queryClient";
import { useSettings } from "@/store/settingsStore";
import { palette } from "@/theme/tokens";

function ThemeSync() {
  const themeMode = useSettings((s) => s.themeMode);
  const { setColorScheme } = useColorScheme();
  useEffect(() => {
    setColorScheme(themeMode);
  }, [themeMode, setColorScheme]);
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.bg.base }}>
      <SafeAreaProvider>
        <GluestackUIProvider mode="dark">
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <ThemeSync />
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: palette.bg.base },
                  animation: "fade",
                }}
              >
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
                  name="compare"
                  options={{ presentation: "card", animation: "slide_from_right" }}
                />
                <Stack.Screen
                  name="settings"
                  options={{ presentation: "card", animation: "slide_from_right" }}
                />
              </Stack>
            </ThemeProvider>
          </QueryClientProvider>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
