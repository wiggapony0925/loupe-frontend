/**
 * Device scanner — the web Scanner page bundled into the app.
 */
import React from "react";
import { WebPageScreen } from "@/presentation/components/WebPageScreen";

export default function ScannerScreen() {
  return <WebPageScreen title="Device Scanner" path="/scanner" />;
}
