/**
 * Markets — the full web marketplace bundled in-app (the YouTube pattern).
 *
 * Rather than re-building the storefront natively, this embeds the exact web
 * experience (`/app/markets`: rails, live prices, deep search across the full
 * catalog) chrome-less via `?embed=app`, signed in as the current user and in
 * the app's color scheme.
 *
 * Card and sealed-product taps do NOT stay in the embed: they detour to the
 * NATIVE detail screens, so browsing the storefront and tapping a card lands
 * on the same card page as everywhere else in the app (price by grade, comps,
 * scrub chart, add-to-vault) — one detail surface, never a web copy of it.
 */
import React from "react";
import { WebPageScreen } from "@/presentation/components/WebPageScreen";
import { routes } from "@/shared/routes";

export default function MarketsScreen() {
  return (
    <WebPageScreen
      title="Markets"
      path="/app/markets"
      injectToken
      confinePaths={["/app/markets", "/cards", "/sealed", "/sets"]}
      nativeDetours={[
        { webPrefix: "/cards", toNative: (id) => routes.card(id) },
        { webPrefix: "/sealed", toNative: (id) => routes.sealedDetail(id) },
      ]}
    />
  );
}
