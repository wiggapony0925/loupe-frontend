/**
 * Capture aggregate — phone-capture pipeline & OCR.
 *
 * The capture flow yields a sequence of `PhotometricCapture` frames which
 * the backend turns into a `ForensicReport` (see `@/domain/scan`).
 */

/** Where a frame came from. Drives backend confidence weighting. */
export type CaptureSource = "scanner" | "phone-studio" | "phone-quick";

/** A single frame uploaded to `/scanner/upload`. */
export interface PhotometricCapture {
  /** Local file URI (e.g. `file://…` from the camera/scanner). */
  uri: string;
  /** Light position index 0..3 — matches the firmware's capture sequence. */
  lightIndex: 0 | 1 | 2 | 3;
  mimeType?: string;
  source?: CaptureSource;
}

/** Detected card metadata extracted from the front-face capture. */
export interface OcrSuggestion {
  title?: string;
  set?: string;
  year?: number;
  /** 0..1 — model confidence, drives "verify before saving" UX. */
  confidence: number;
  /** Raw recognized text lines, ordered top → bottom. */
  rawLines: string[];
}

/** Maps a phone-capture step to the `lightIndex` slot the backend expects. */
export interface PhoneCaptureStep {
  index: 0 | 1 | 2 | 3;
  side: "front" | "back";
  flash: boolean;
  tilt: "flat" | "top" | "bottom";
  /** Short instruction shown over the camera preview. */
  instruction: string;
  /** One-word badge shown above the shutter (e.g. "Ambient", "Flash"). */
  label: string;
}
