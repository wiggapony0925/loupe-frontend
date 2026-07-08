/**
 * Legal document — `/legal/[doc]`
 *
 * The web legal pages (Terms / Privacy / Cookies) bundled in-app, chrome-less
 * (`?embed=app`) like Support and Blog, instead of kicking the user out to the
 * system browser. Confined to `/legal` so the embed can't roam the web app.
 */
import React from "react";
import { useLocalSearchParams } from "expo-router";
import { WebPageScreen } from "@/presentation/components/WebPageScreen";

const TITLES: Record<string, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  cookies: "Cookie Policy",
};

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  // Fall back to Terms for an unknown slug — the web route redirects the same
  // way, so the confined WebView always lands on a real page.
  const slug = doc && doc in TITLES ? doc : "terms";

  return (
    <WebPageScreen
      title={TITLES[slug] ?? "Legal"}
      path={`/legal/${slug}`}
      confinePaths={["/legal"]}
    />
  );
}
