/**
 * Scanner tuning constants + copy helpers shared across every scan
 * surface. Kept camera-agnostic so the expo-camera flow and the native
 * Swift/Kotlin flow read the same thresholds and speak the same language.
 */
import type { useThemedPalette } from "@/presentation/theme/tokens";
import type { IdentifyTcgHint } from "@/infrastructure/repositories/identifyRepository";

/** Confidence at which we fire the success haptic + light the shutter mint. */
export const LOCK_CONFIDENCE = 0.62;
/** Lowest confidence worth counting as a real match (status line, reticle). */
export const PREVIEW_CONFIDENCE = 0.35;
/** Lowest candidate worth swapping into a captured-photo session tile. */
export const SESSION_RESULT_CONFIDENCE = 0.2;
/** How long an identify-error banner stays up before it clears itself. */
export const ERROR_DISMISS_MS = 4200;
/** How long a framing hint ("Center the card…") stays up after a capture. */
export const HINT_DISMISS_MS = 3000;
/** Cap on the rolling session tray so a long stack-scan stays performant. */
export const MAX_SCAN_SESSION_ITEMS = 8;

/**
 * TCG hints surfaced as a chevron pill in the top bar. Each carries a
 * brand-ish accent so the pill can show a colored dot for the selected
 * game — a small, modern affordance that also makes a wrong auto-detect
 * (e.g. a Pokémon card read as Yu-Gi-Oh) visible at a glance.
 */
export const TCG_OPTIONS: {
  key: IdentifyTcgHint;
  label: string;
  accent: keyof ReturnType<typeof useThemedPalette>["accent"];
}[] = [
  { key: null, label: "Auto-detect", accent: "mint" },
  { key: "pokemon", label: "Pokémon", accent: "amber" },
  { key: "magic", label: "Magic", accent: "blue" },
  { key: "yugioh", label: "Yu-Gi-Oh!", accent: "purple" },
];

/** Human-readable rewrite of a raw scanner/identify error message. */
export function scannerErrorCopy(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("cameraview") ||
    lower.includes("takepicture") ||
    lower.includes("view with tag")
  ) {
    return "Camera lost the preview for a moment. Keep Loupe open, point at the card, and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Loupe could not reach the scanner service. Check your connection and try again.";
  }
  if (lower.includes("monthly budget") || lower.includes("budget")) {
    return "The live OCR fallback is temporarily unavailable. Try search or scan again in better light.";
  }
  return message.length > 150
    ? "Loupe could not scan that frame. Re-frame the card and try again."
    : message;
}

/** True for camera-capture errors worth silently retrying rather than surfacing. */
export function isTransientCameraCaptureError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("image could not be captured") ||
    lower.includes("cameraview") ||
    lower.includes("takepicture") ||
    lower.includes("camera not ready") ||
    lower.includes("camera is not running") ||
    lower.includes("camera is closed")
  );
}
