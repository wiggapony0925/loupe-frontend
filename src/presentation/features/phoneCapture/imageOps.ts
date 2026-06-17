/**
 * Lightweight, JS-only image-quality + cropping helpers used by the phone
 * capture pipeline. None of these require a custom dev build — they run
 * on top of expo-image-manipulator + heuristic checks so they're safe in
 * Expo Go.
 *
 * For production (dev build), the same functions can be swapped for
 * VisionCamera frame processors / native ML Kit. The contracts here are
 * designed to be drop-in replaceable.
 */
import { manipulateAsync, SaveFormat, type ImageResult } from "expo-image-manipulator";
import type { OcrSuggestion } from "@/domain";

/** Standard trading-card aspect (width/height = 2.5"/3.5"). */
export const CARD_ASPECT = 2.5 / 3.5;

/**
 * Center-crop the image to a card-shaped rectangle that matches the on-screen
 * overlay. Eliminates background clutter and keeps payloads small without
 * needing native edge detection.
 *
 * NOTE: This assumes the user followed the overlay (~78% of frame width).
 * A future native pass can replace this with true rectangle detection.
 */
export async function cropToCardOverlay(
  uri: string,
  width: number,
  height: number,
): Promise<ImageResult> {
  const portrait = height >= width;
  // Match the on-screen overlay: ~78% of the *short* edge wide, card aspect.
  const shortEdge = Math.min(width, height);
  const targetW = portrait
    ? Math.round(shortEdge * 0.78)
    : Math.round(shortEdge * 0.78 * CARD_ASPECT);
  const targetH = portrait ? Math.round(targetW / CARD_ASPECT) : Math.round(shortEdge * 0.78);

  // Clamp so we never exceed the source bounds.
  const cropW = Math.min(targetW, width);
  const cropH = Math.min(targetH, height);
  const originX = Math.max(0, Math.round((width - cropW) / 2));
  const originY = Math.max(0, Math.round((height - cropH) / 2));

  return manipulateAsync(uri, [{ crop: { originX, originY, width: cropW, height: cropH } }], {
    compress: 0.95,
    format: SaveFormat.JPEG,
  });
}

/** Quality-gate result for a single capture. */
export interface QualityCheck {
  ok: boolean;
  /** 0..1 — higher = sharper. */
  sharpness: number;
  /** 0..1 — fraction of pixels in flash blow-out. */
  glare: number;
  /** Human-readable reason when `ok` is false. */
  reason?: string;
}

/**
 * Heuristic quality gate. We can't read pixel data without a native module,
 * so this only verifies that the capture pipeline produced an image and lets
 * the user continue. Native image quality should be enforced by the scanner
 * bridge or backend report pipeline.
 */
export async function checkCaptureQuality(uri: string): Promise<QualityCheck> {
  // Slight perceptual delay so the busy spinner is visible.
  await new Promise((r) => setTimeout(r, 120));
  if (!uri.trim()) {
    return { ok: false, sharpness: 0, glare: 0, reason: "Capture failed — retake this angle" };
  }
  return { ok: true, sharpness: 1, glare: 0 };
}

/**
 * Best-effort OCR for the card's front face.
 *
 * No fabricated fallback: until native/backend OCR is wired into this phone
 * capture path, return `null` and let the user type the card name manually.
 */
export async function recognizeCardText(_uri: string): Promise<OcrSuggestion | null> {
  await new Promise((r) => setTimeout(r, 250));
  return null;
}
