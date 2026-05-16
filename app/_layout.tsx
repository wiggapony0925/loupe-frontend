import "../global.css";
import React, { useEffect, useState } from "react";
import { Appearance, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { AppProviders } from "@/providers/AppProviders";
import { BrandSplash } from "@/components/brand/BrandSplash";
import { useSettings } from "@/store/settingsStore";
import { applyTheme, palette } from "@/theme/tokens";

/**
 * Resolves the user's preference (`themeMode`) to a concrete scheme,
 * mutates the JS palette so inline-style consumers re-read the new values,
 * tells NativeWind to flip the `.dark` class (CSS vars do the rest), and
 * bumps a key so the entire tree remounts to pick up new module-time reads.
 */
function useResolvedScheme(): "dark" | "light" {
  const themeMode = useSettings((s) => s.themeMode);
  const [system, setSystem] = useState<"dark" | "light">(
    Appearance.getColorScheme() === "light" ? "light" : "dark",
  );
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme === "light" ? "light" : "dark");
    });
    return () => sub.remove();
  }, []);
  return themeMode === "system" ? system : themeMode;
}

export default function RootLayout() {
  const scheme = useResolvedScheme();
  const { setColorScheme } = useColorScheme();
  const [splashDone, setSplashDone] = useState(false);
  // Subscribing here makes the root re-render when the user changes their
  // currency in the bottom-sheet picker. We pipe it into the inner View as
  // a `key` so the entire app tree remounts and every formatter (every $
  // sign, every chart label) is re-evaluated against the new currency.
  const currency = useSettings((s) => s.currency);

  // Mutate the JS palette + flip the NativeWind class on every change.
  // Synchronous so the first render after a toggle already sees new values.
  if (typeof scheme === "string") {
    applyTheme(scheme);
  }
  useEffect(() => {
    setColorScheme(scheme);
  }, [scheme, setColorScheme]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.bg.base }}>
      <SafeAreaProvider>
        <GluestackUIProvider mode={scheme}>
          <AppProviders>
            <StatusBar style={scheme === "light" ? "dark" : "light"} />
            <View key={`ccy-${currency}`} style={{ flex: 1 }}>
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
              {!splashDone ? <BrandSplash onFinish={() => setSplashDone(true)} /> : null}
            </View>
          </AppProviders>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
