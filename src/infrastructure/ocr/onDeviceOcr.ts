/**
 * On-device OCR with a first-party-first strategy:
 *
 *   1. Apple Vision (`VNRecognizeTextRequest`) via our own
 *      `loupe-scanner-bridge` native module — ships with iOS, no extra
 *      pod, tuned for card titles (accurate mode, autocorrect off).
 *   2. `@react-native-ml-kit/text-recognition` — the Android path and
 *      the fallback for builds that predate the bridge OCR.
 *
 * ML Kit ships a native module that only resolves inside a custom dev
 * build (or production binary). In Expo Go the native side isn't
 * linked, so a naive import throws at module-load time and takes the
 * whole screen down before the fallback path ever runs. We `require()`
 * it lazily on first call, swallow the resolution error, and report
 * `available=false` so callers can degrade gracefully (in practice:
 * surface a "scanning over budget — please try again later" message
 * instead of crashing).
 */
import { cardDetector } from "../native";

let _impl: { recognize(uri: string): Promise<{ text: string }> } | null = null;
let _loaded = false;

function loadMlKit(): { recognize(uri: string): Promise<{ text: string }> } | null {
  if (_loaded) return _impl;
  _loaded = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@react-native-ml-kit/text-recognition");
    _impl = (mod?.default ?? mod) as typeof _impl;
  } catch {
    _impl = null;
  }
  return _impl;
}

export function isOnDeviceOcrAvailable(): boolean {
  return cardDetector.capabilities.recognizeText || loadMlKit() !== null;
}

export interface OnDeviceOcrResult {
  text: string;
  /** Vision path: mean line confidence in [0,1]. ML Kit path: crude
   *  proxy — 1.0 if text was extracted, 0.0 otherwise. */
  confidence: number;
  /** Which engine produced the text — reported to identify telemetry. */
  provider: "vision" | "mlkit";
}

/**
 * Run text recognition on a local image URI. Returns empty text when
 * no recognizer is available (Expo Go) or extraction fails.
 */
export async function recognizeTextOnDevice(uri: string): Promise<OnDeviceOcrResult> {
  // Apple Vision first — first-party, no extra native dependency, and
  // returns a real confidence signal the identify endpoint can use.
  const vision = await cardDetector.recognizeText(uri);
  if (vision) {
    return { text: vision.text.trim(), confidence: vision.confidence, provider: "vision" };
  }

  const mlkit = loadMlKit();
  if (!mlkit) return { text: "", confidence: 0, provider: "mlkit" };
  try {
    const result = await mlkit.recognize(uri);
    const text = (result?.text ?? "").trim();
    return { text, confidence: text.length > 0 ? 1 : 0, provider: "mlkit" };
  } catch {
    return { text: "", confidence: 0, provider: "mlkit" };
  }
}
