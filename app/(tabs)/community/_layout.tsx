/**
 * Community stack.
 *
 * A Stack nested inside the tab group, so the whole community micro-app —
 * feed, discovery, composer, permalinks, tag pages — registers with the
 * navigator as ONE tab entry and keeps the floating island navbar on screen
 * throughout. Pushing between these pages gets a real stack transition
 * rather than the tabs' crossfade, which is what "going deeper" should feel
 * like.
 */
import React from "react";
import { Stack } from "expo-router";

export default function CommunityLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
