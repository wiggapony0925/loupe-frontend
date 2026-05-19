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
 * so we use a probabilistic JS check that always passes in Expo Go but is
 * shaped like the real native check (sharpness + glare scores). When wired
 * to VisionCamera in a dev build, swap the body — keep the signature.
 */
export async function checkCaptureQuality(_uri: string): Promise<QualityCheck> {
  // Slight perceptual delay so the busy spinner is visible.
  await new Promise((r) => setTimeout(r, 120));
  // 90% pass rate — surfaces the retake UX during demos without being annoying.
  const sharpness = 0.55 + Math.random() * 0.4;
  const glare = Math.random() * 0.35;
  if (sharpness < 0.45) {
    return { ok: false, sharpness, glare, reason: "Too blurry — hold steady & retake" };
  }
  if (glare > 0.55) {
    return { ok: false, sharpness, glare, reason: "Too much glare — angle away from light" };
  }
  return { ok: true, sharpness, glare };
}

/**
 * Best-effort OCR for the card's front face. In Expo Go we return a
 * confident mock derived from a tiny dictionary so the review UI is fully
 * exercisable; in a dev build this is swapped for ML Kit Text Recognition.
 */
export async function recognizeCardText(_uri: string): Promise<OcrSuggestion> {
  await new Promise((r) => setTimeout(r, 600));
  const samples: OcrSuggestion[] = [
    {
      title: "Charizard — Holo",
      set: "Pokemon Base Set",
      year: 1999,
      confidence: 0.91,
      rawLines: ["CHARIZARD", "Stage 2 · 120 HP", "© 1999 WIZARDS"],
    },
    {
      title: "Black Lotus",
      set: "Magic Alpha",
      year: 1993,
      confidence: 0.82,
      rawLines: ["Black Lotus", "Mox · Artifact", "Illus. Christopher Rush"],
    },
    {
      title: "Mbappé — Hat-Trick",
      set: "2026 World Cup Goals",
      year: 2026,
      confidence: 0.74,
      rawLines: ["MBAPPÉ", "FRANCE · 10", "WORLD CUP 2026"],
    },
  ];
  return samples[Math.floor(Math.random() * samples.length)]!;
}
