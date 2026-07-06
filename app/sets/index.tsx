/**
 * Sets explorer — the web set catalog bundled in-app (the YouTube pattern).
 *
 * Browse every set per game and drill into a set's cards. Embedded chrome-less
 * (`?embed=app`), signed in, in the app's scheme. The web page owns the set →
 * cards drill-in (its own id→name resolution), but tapping an individual card
 * detours to the NATIVE card detail — same rule as the Markets embed: one
 * detail surface across the app, never a web copy of it.
 */
import React from "react";
import { WebPageScreen } from "@/presentation/components/WebPageScreen";
import { routes } from "@/shared/routes";

export default function SetsScreen() {
  return (
    <WebPageScreen
      title="Sets"
      path="/sets"
      injectToken
      confinePaths={["/sets", "/cards", "/sealed", "/app/markets"]}
      nativeDetours={[
        { webPrefix: "/cards", toNative: (id) => routes.card(id) },
        { webPrefix: "/sealed", toNative: (id) => routes.sealedDetail(id) },
      ]}
    />
  );
}
