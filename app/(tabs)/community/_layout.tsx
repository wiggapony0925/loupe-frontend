/**
 * Community stack.
 *
 * A Stack nested inside the tab group, so the whole community micro-app —
 * feed, discovery, composer, permalinks, tag pages — registers with the
 * navigator as ONE tab entry and keeps the floating island navbar on screen
 * throughout.
 *
 * The transition comes from `SCREEN_TRANSITION`, the single definition every
 * navigator in the app shares. Before that, this stack used React
 * Navigation's default while the tab group used `shift` and notifications
 * used `slide_from_right` — three feelings inside one micro-app.
 */
import React from "react";
import { Stack } from "expo-router";
import { CrashGuard } from "@/presentation/components/CrashGuard";
import { SCREEN_TRANSITION } from "@/presentation/navigation/screenMotion";

export default function CommunityLayout() {
  // The guard is at the STACK root, so a render error anywhere in the
  // micro-app becomes a screen with the actual message on it instead of a
  // dead app — in release, an uncaught render throw is fatal and silent.
  return (
    <CrashGuard label="Community">
      <Stack screenOptions={{ headerShown: false, ...SCREEN_TRANSITION }} />
    </CrashGuard>
  );
}
