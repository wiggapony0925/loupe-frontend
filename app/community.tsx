/**
 * Community — the web social layer (collector search, follows, profiles,
 * shared collections) bundled into the app signed-in, chrome-less
 * (`?embed=app`), the same pattern as Support and Statements. Confined to
 * the community pages so the WebView can't roam the rest of the web app.
 *
 * Card tiles in a collector's collection link to `/cards/:id` on the web —
 * the JS bridge (`nativeDetours`) swallows those taps and pushes the NATIVE
 * card screen instead, so browsing a friend's vault lands on the real card
 * page with live pricing, ownership context, and alerts.
 */
import React from "react";
import { WebPageScreen } from "@/presentation/components/WebPageScreen";
import { routes } from "@/shared/routes";

export default function CommunityScreen() {
  return (
    <WebPageScreen
      title="Community"
      path="/app/community"
      injectToken
      // Full-bleed: the web page brings its own "Community" heading, so the
      // native "Done" bar would just double the chrome.
      showHeader={false}
      confinePaths={["/app/community", "/app/u"]}
      nativeDetours={[
        { webPrefix: "/cards", toNative: (id) => routes.card(id) },
        // "Scan a card" CTA in your empty collection → the native scanner.
        { webPrefix: "/scan", toNative: () => routes.scanEntry() },
      ]}
    />
  );
}
