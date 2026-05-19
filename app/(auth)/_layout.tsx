/**
 * /(auth) route group layout — pure stack, no tabs/header, dark bg.
 */
import React from "react";
import { Stack } from "expo-router";
import { palette } from "@/presentation/theme/tokens";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.bg.base },
        animation: "fade",
      }}
    />
  );
}
