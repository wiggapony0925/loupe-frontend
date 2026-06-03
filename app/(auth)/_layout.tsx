/**
 * /(auth) route group layout — pure stack, no tabs/header, dark bg.
 */
import React from "react";
import { Stack } from "expo-router";
import { useThemedPalette } from "@/presentation/theme/tokens";

export default function AuthLayout() {
  const p = useThemedPalette();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: p.bg.base },
        animation: "fade",
      }}
    />
  );
}
