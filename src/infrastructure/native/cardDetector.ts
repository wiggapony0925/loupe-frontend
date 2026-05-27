/**
 * Live card detector — typed JS facade over the iOS Vision + CoreImage
 * functions in `LoupeScannerBridge`.
 *
 * Used by the `LiveIdentifyFlow` capture loop to (a) reject frames
 * with no card / blur / glare *before* burning a network round trip,
 * and (b) perspective-correct the card to ~30KB before upload. When
 * the native module isn't linked (Expo Go, web), every method returns
 * a "no opinion" report so the caller falls through to the legacy
 * full-frame upload path. Never throws.
 *
 * Why it lives outside `scannerBridge.ts`: the BLE / photometric
 * scanner facade has a totally different lifecycle (connect / capture
 * / haptic) and we don't want feature code touching it to pull in the
 * card-detector types or vice versa.
 */
import LoupeScannerBridge, {
  type CardFrameAnalysis,
  type CroppedCard,
} from "../../../modules/loupe-scanner-bridge";

export type { CardFrameAnalysis, CroppedCard };

export type CardDetectorSource = "native" | "unavailable";

interface CardDetectorImpl {
  readonly source: CardDetectorSource;
  /**
   * True when ANY native capability is available. Most call sites just
   * want to know "should I bother calling analyzeFrame/hash"; the more
   * granular `capabilities` flags below let advanced callers (the
   * capture loop) gate on individual functions — useful on Android
   * where rectangle detection isn't implemented but dHash is.
   */
  readonly isAvailable: boolean;
  readonly capabilities: {
    /** Vision rectangle detection + blur/glare scoring. iOS only today. */
    analyze: boolean;
    /** CIPerspectiveCorrection. iOS only today. */
    crop: boolean;
    /** dHash. iOS + Android. */
    hash: boolean;
  };
  analyzeFrame(uri: string): Promise<CardFrameAnalysis>;
  crop(
    uri: string,
    corners: number[],
    outputLongEdge?: number,
    jpegQuality?: number,
  ): Promise<CroppedCard>;
  /**
   * 64-bit dHash of the image as a 16-char hex string. Returns `null`
   * when the native module is missing or hashing fails — callers must
   * tolerate that and fall through to the network identify path.
   */
  hash(uri: string): Promise<string | null>;
}

const NO_RESULT: CardFrameAnalysis = {
  corners: null,
  confidence: 0,
  blurScore: 0,
  glareScore: 0,
  alignmentOk: false,
  aspectOk: false,
  imageWidth: 0,
  imageHeight: 0,
};

function makeNative(mod: NonNullable<typeof LoupeScannerBridge>): CardDetectorImpl {
  // Each capability is detected independently so a platform that ships
  // a partial implementation (e.g. Android today: hash + quality but no
  // rectangle detection) still contributes whatever it can.
  const hasAnalyze = typeof (mod as { analyzeCardFrame?: unknown }).analyzeCardFrame === "function";
  const hasCrop = typeof (mod as { cropCardPerspective?: unknown }).cropCardPerspective === "function";
  const hasHash =
    typeof (mod as { computePerceptualHash?: unknown }).computePerceptualHash === "function";
  if (!hasAnalyze && !hasCrop && !hasHash) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        "[cardDetector] native module linked but no detector methods present — rebuild dev client",
      );
    }
    return makeUnavailable();
  }
  return {
    source: "native",
    isAvailable: true,
    capabilities: { analyze: hasAnalyze, crop: hasCrop, hash: hasHash },
    async analyzeFrame(uri) {
      if (!hasAnalyze) return NO_RESULT;
      try {
        return await mod.analyzeCardFrame(uri);
      } catch {
        return NO_RESULT;
      }
    },
    async crop(uri, corners, outputLongEdge = 720, jpegQuality = 0.7) {
      if (!hasCrop) return { uri, width: 0, height: 0, bytes: 0 };
      return mod.cropCardPerspective(uri, corners, outputLongEdge, jpegQuality);
    },
    async hash(uri) {
      if (!hasHash) return null;
      try {
        return await mod.computePerceptualHash(uri);
      } catch {
        return null;
      }
    },
  };
}

function makeUnavailable(): CardDetectorImpl {
  return {
    source: "unavailable",
    isAvailable: false,
    capabilities: { analyze: false, crop: false, hash: false },
    async analyzeFrame() {
      return NO_RESULT;
    },
    async crop(uri) {
      // Caller is expected to check `isAvailable` first. If they didn't,
      // return the original URI so the upload pipeline keeps working.
      return { uri, width: 0, height: 0, bytes: 0 };
    },
    async hash() {
      return null;
    },
  };
}

export const cardDetector: CardDetectorImpl = LoupeScannerBridge
  ? makeNative(LoupeScannerBridge)
  : makeUnavailable();

export const isNativeCardDetectorAvailable = cardDetector.isAvailable;
