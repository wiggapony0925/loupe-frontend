/**
 * The catch-all route.
 *
 * expo-router renders this for any path it can't match — a stale deep link, a
 * push notification pointing at a card that's since been removed, a typo'd
 * universal link off the website. Without this file the user got the router's
 * bare unstyled "Unmatched Route" screen, which looks like the app crashed.
 *
 * Everything real lives in `NotFoundScreen`, mirroring loupe-web's 404.
 */
import React from "react";
import { Stack } from "expo-router";
import { NotFoundScreen } from "@/presentation/features/misc/NotFoundScreen";

export default function NotFoundRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: "Not found" }} />
      <NotFoundScreen />
    </>
  );
}
