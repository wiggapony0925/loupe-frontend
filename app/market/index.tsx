/**
 * Markets — the full web marketplace bundled in-app (the YouTube pattern).
 *
 * Rather than re-building the storefront natively, this embeds the exact web
 * experience (`/app/markets`: rails, live prices, deep search across the full
 * catalog) chrome-less via `?embed=app`, signed in as the current user and in
 * the app's color scheme. Card taps stay inside (client-side routing); hard
 * navigations are confined to marketplace sections.
 */
import React from "react";
import { WebPageScreen } from "@/presentation/components/WebPageScreen";

export default function MarketsScreen() {
  return (
    <WebPageScreen
      title="Markets"
      path="/app/markets"
      injectToken
      confinePaths={["/app/markets", "/cards", "/sealed", "/sets"]}
    />
  );
}
