/**
 * `(tabs)/scan` — the center tab slot.
 *
 * There is deliberately NO landing page here anymore. Scanning is the
 * app's primary verb, and the old interstitial hub ("Scan a card" hero +
 * secondary links) cost every scan an extra tap and read as filler. The
 * center FAB in the tab bar (`ScanTabButton` in `_layout.tsx`) now opens
 * the live camera directly — the Collectr/Instagram center-tab pattern —
 * and its long-press sheet carries the deliberate alternatives (grade,
 * playground). The hub's other links live where they belong: add-by-
 * catalog on Vault and the card page, hardware pairing in Settings and
 * the home widget.
 *
 * This file stays only because the tab slot needs a registered route;
 * anything that still navigates here (a stale deep link) lands in the
 * camera too.
 */
import { Redirect } from "expo-router";
import { routes } from "@/shared/routes";

export default function ScanTabScreen() {
  // iOS gets the native Swift AVFoundation scanner; the screen itself
  // falls back to the expo-camera flow if the native view isn't linked.
  const href = routes.scanEntry();
  return <Redirect href={href} />;
}
