/**
 * Loupe Support — the web Help/Support page bundled into the app, signed-in.
 */
import React from "react";
import { WebPageScreen } from "@/presentation/components/WebPageScreen";

export default function SupportScreen() {
  return <WebPageScreen title="Loupe Support" path="/help" injectToken />;
}
