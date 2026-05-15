import React from "react";
import { Tabs } from "expo-router";
import { Gauge, Layers, BarChart3 } from "lucide-react-native";
import { palette } from "@/theme/tokens";
import { useSettings } from "@/store/settingsStore";

export default function TabsLayout() {
  // Re-render this layout when the user toggles theme so `palette.*`
  // reads below pick up the new (already-mutated) values.
  useSettings((s) => s.themeMode);

  return (
    <Tabs
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
