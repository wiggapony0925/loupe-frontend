/**
 * Sets explorer — the web set catalog bundled in-app (the YouTube pattern).
 *
 * Browse every set per game and drill into a set's cards. Embedded chrome-less
 * (`?embed=app`), signed in, in the app's scheme. The web page owns the set →
 * cards drill-in (its own id→name resolution); hard navigations are confined
 * to the catalog surfaces so taps stay in-app.
 */
import React from "react";
import { WebPageScreen } from "@/presentation/components/WebPageScreen";

export default function SetsScreen() {
  return (
    <WebPageScreen
      title="Sets"
      path="/sets"
      injectToken
      confinePaths={["/sets", "/cards", "/sealed", "/app/markets"]}
    />
  );
}
