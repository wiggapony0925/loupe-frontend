import React from "react";
import { useColorScheme, View } from "react-native";
import { Tabs } from "expo-router";
import { Gauge, Layers, BarChart3, Camera, Search } from "lucide-react-native";
import { palette, withAlpha } from "@/presentation/theme/tokens";
import { useSettings } from "@/application/stores/settingsStore";

export default function TabsLayout() {
  // Subscribe to theme so the screenOptions object below is rebuilt with
  // the freshly-mutated palette values when the user toggles Light/Dark.
  const themeMode = useSettings((s) => s.themeMode);
  const systemScheme = useColorScheme();
  // Resolve to the actual visible scheme so "Auto" mode also remounts the
  // navigator when the device theme flips.
  const resolved = themeMode === "system" ? (systemScheme ?? "dark") : themeMode;

  return (
    <Tabs
      // Force the tab navigator to remount on theme change so React Navigation
      // re-applies tabBarStyle / colors cleanly (it caches some style props).
      key={resolved}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent.mint,
        tabBarInactiveTintColor: palette.ink.dim,
        tabBarStyle: {
          backgroundColor: palette.bg.elevated,
          borderTopColor: palette.line.default,
          borderTopWidth: 0.5,
          height: 84,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 1.5,
          textTransform: "uppercase",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Command",
          tabBarIcon: ({ color }) => <Gauge size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: "Vault",
          tabBarIcon: ({ color }) => <Layers size={20} color={color} />,
        }}
      />
      {/* Center-pinned Scan tab — primary verb of the app. Rendered as a
          mint-tinted pill so the eye lands on it first, the same way
          Robinhood/Cash App elevate their core action in the middle
          slot. Replaced the old Watch tab; price alerts now live behind
          the bell inside Notifications. */}
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                marginTop: -12,
                backgroundColor: focused
                  ? palette.accent.mint
                  : withAlpha(palette.accent.mint, 0.18),
                borderWidth: 1,
                borderColor: focused
                  ? palette.accent.mint
                  : withAlpha(palette.accent.mint, 0.4),
              }}
            >
              <Camera
                size={20}
                color={focused ? palette.bg.base : palette.accent.mint}
              />
            </View>
          ),
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: palette.accent.mint,
          },
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => <Search size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color }) => <BarChart3 size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}
