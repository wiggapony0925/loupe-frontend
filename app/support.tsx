/**
 * Loupe Support — the web Help/Support page bundled into the app, signed-in.
 * Confined to support-related pages so the WebView can't roam the whole app.
 */
import React from "react";
import { WebPageScreen } from "@/presentation/components/WebPageScreen";

export default function SupportScreen() {
  return (
    <WebPageScreen
      title="Loupe Support"
      path="/help"
      injectToken
      confinePaths={["/help", "/contact", "/status", "/legal", "/blog"]}
    />
  );
}
