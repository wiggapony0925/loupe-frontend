/**
 * Shared scanner overlay — the camera-agnostic chrome (top bar with game
 * selector, banners, framing hints, the rolling session tray, the TCG
 * picker sheet, the shutter, manual-search) rendered over BOTH scan
 * surfaces: the expo-camera `LiveIdentifyFlow` and the native Swift/Kotlin
 * `LoupeCameraView` screen. Keeping it here means the two flows can never
 * drift — one set of banners, one tray, one material system.
 */
export { GLASS, GLASS_STRONG, HAIRLINE, BLUR_INTENSITY } from "./theme";
export { GlassCircle } from "./GlassCircle";
export {
  LOCK_CONFIDENCE,
  PREVIEW_CONFIDENCE,
  SESSION_RESULT_CONFIDENCE,
  ERROR_DISMISS_MS,
  HINT_DISMISS_MS,
  MAX_SCAN_SESSION_ITEMS,
  TCG_OPTIONS,
  scannerErrorCopy,
  isTransientCameraCaptureError,
} from "./constants";
export type { ScanSessionItem } from "./types";
export { CandidateCardImage, candidateKey } from "./CandidateCardImage";
export { ErrorBanner, HintPill, ResultArea } from "./ScannerBanners";
export { TcgPickerSheet } from "./TcgPickerSheet";
export { ScannerTopBar } from "./ScannerTopBar";
export { ScanSessionTray } from "./ScanSessionTray";
export { ScannerBottomPanel } from "./ScannerBottomPanel";
