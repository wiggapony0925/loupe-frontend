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
import { PEER_TRANSITION, SCREEN_TRANSITION } from "@/presentation/navigation/screenMotion";

export default function CommunityLayout() {
  // The guard is at the STACK root, so a render error anywhere in the
  // micro-app becomes a screen with the actual message on it instead of a
  // dead app — in release, an uncaught render throw is fatal and silent.
  return (
    <CrashGuard label="Community">
      {/* The default is the DRILL-DOWN push, which is right for everything
          this stack owns except its own two front doors: a post, a tag page
          and the composer are all places you go deeper into. */}
      <Stack screenOptions={{ headerShown: false, ...SCREEN_TRANSITION }}>
        {/* The feed and collectors are PEERS — the island switches between
            them the way a tab bar switches tabs, and its other two segments
            (notifications, profile) live in the tab group and already fade.
            Pushing these two made one segmented control animate two
            different ways depending on which segment you hit, and reverse
            itself on the way back. */}
        <Stack.Screen name="index" options={PEER_TRANSITION} />
        <Stack.Screen name="people" options={PEER_TRANSITION} />
      </Stack>
    </CrashGuard>
  );
}
