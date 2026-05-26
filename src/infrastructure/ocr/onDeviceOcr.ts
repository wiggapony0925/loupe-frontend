/**
 * Lazy, fail-soft wrapper around `@react-native-ml-kit/text-recognition`.
 *
 * The package ships a native module that only resolves inside a custom
 * dev build (or production binary). In Expo Go the native side isn't
 * linked, so a naive import throws at module-load time and takes the
 * whole screen down before the fallback path ever runs.
 *
 * We `require()` it lazily on first call, swallow the resolution error,
 * and report `available=false` so callers can degrade gracefully (in
 * practice: surface a "scanning over budget — please try again later"
 * message instead of crashing).
 */
let _impl: { recognize(uri: string): Promise<{ text: string }> } | null = null;
let _loaded = false;

function load(): { recognize(uri: string): Promise<{ text: string }> } | null {
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
  return load() !== null;
}

export interface OnDeviceOcrResult {
  text: string;
  /** Crude proxy: 1.0 if text was extracted, 0.0 otherwise. */
  confidence: number;
}

/**
 * Run text recognition on a local image URI. Returns empty text when
 * the native module is unavailable (Expo Go) or extraction fails.
 */
export async function recognizeTextOnDevice(uri: string): Promise<OnDeviceOcrResult> {
  const impl = load();
  if (!impl) return { text: "", confidence: 0 };
  try {
    const result = await impl.recognize(uri);
    const text = (result?.text ?? "").trim();
    return { text, confidence: text.length > 0 ? 1 : 0 };
  } catch {
    return { text: "", confidence: 0 };
  }
}
