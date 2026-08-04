/**
 * Community — the web social layer (collector search, follows, profiles,
 * shared collections) bundled into the app signed-in, chrome-less
 * (`?embed=app`), the same pattern as Support and Statements. Confined to
 * the community pages so the WebView can't roam the rest of the web app.
 */
import React from "react";
import { WebPageScreen } from "@/presentation/components/WebPageScreen";

export default function CommunityScreen() {
  return (
    <WebPageScreen
      title="Community"
      path="/app/community"
      injectToken
      confinePaths={["/app/community", "/app/u"]}
    />
  );
}
