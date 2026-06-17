/**
 * Typed JS facade over the LoupeScannerBridge native module.
 *
 * Feature code MUST import from `@/native` — never from
 * `modules/loupe-scanner-bridge` directly. This boundary lets us:
 *   - expose a clear unavailable state when the native module isn't linked
 *   - rename / reorganize native modules without churning every caller
 *   - keep all `requireNativeModule` calls in one place
 */
import LoupeScannerBridge, {
  type CapturedFrame,
  type CaptureProgressPayload,
  type HapticPattern,
  type ImageQualityReport,
  type ScannerInfo,
  type ScannerStateChangePayload,
} from "../../../modules/loupe-scanner-bridge";

export type {
  CapturedFrame,
  CaptureProgressPayload,
  HapticPattern,
  ImageQualityReport,
  ScannerInfo,
  ScannerStateChangePayload,
};

export type ScannerBridgeSource = "native" | "unavailable";

type Listener<T> = (event: T) => void;

interface ScannerBridgeImpl {
  readonly source: ScannerBridgeSource;
  readonly lightCount: number;
  readonly supportedLightIndices: number[];

  connect(deviceId: string): Promise<ScannerInfo>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  captureFrame(lightIndex: number): Promise<CapturedFrame>;
  captureAllFrames(onProgress?: (p: CaptureProgressPayload) => void): Promise<CapturedFrame[]>;

  checkImageQuality(uri: string): Promise<ImageQualityReport>;
  haptic(pattern: HapticPattern): void;

  onStateChange(listener: Listener<ScannerStateChangePayload>): () => void;
  onCaptureProgress(listener: Listener<CaptureProgressPayload>): () => void;
}

// ───────────────────────────────────────────────────────────
// Native-backed implementation (used in dev/prod builds)
// ───────────────────────────────────────────────────────────
function makeNativeBridge(mod: NonNullable<typeof LoupeScannerBridge>): ScannerBridgeImpl {
  return {
    source: "native",
    lightCount: mod.LIGHT_COUNT,
    supportedLightIndices: mod.SUPPORTED_LIGHT_INDICES,

    connect: (deviceId) => mod.connectScanner(deviceId),
    disconnect: () => mod.disconnectScanner(),
    isConnected: () => mod.isConnected(),

    captureFrame: (lightIndex) => mod.captureFrame(lightIndex),

    async captureAllFrames(onProgress) {
      const frames: CapturedFrame[] = [];
      const total = mod.SUPPORTED_LIGHT_INDICES.length;
      for (const i of mod.SUPPORTED_LIGHT_INDICES) {
        onProgress?.({ lightIndex: i, totalLights: total, phase: "arming" });
        const frame = await mod.captureFrame(i);
        onProgress?.({ lightIndex: i, totalLights: total, phase: "done" });
        frames.push(frame);
      }
      return frames;
    },

    checkImageQuality: (uri) => mod.checkImageQuality(uri),
    haptic: (pattern) => mod.triggerHaptic(pattern),

    onStateChange(listener) {
      const sub = mod.addListener("onScannerStateChange", listener);
      return () => sub.remove();
    },
    onCaptureProgress(listener) {
      const sub = mod.addListener("onCaptureProgress", listener);
      return () => sub.remove();
    },
  };
}

function makeUnavailableBridge(): ScannerBridgeImpl {
  const unavailable = () =>
    Promise.reject(
      new Error(
        "Scanner native module is not linked. Install a native build with the Loupe scanner bridge.",
      ),
    );
  return {
    source: "unavailable",
    lightCount: 4,
    supportedLightIndices: [0, 1, 2, 3],
    connect: unavailable,
    disconnect: () => Promise.resolve(),
    isConnected: () => false,
    captureFrame: unavailable,
    captureAllFrames: unavailable,
    checkImageQuality: unavailable,
    haptic: () => {},
    onStateChange: () => () => {},
    onCaptureProgress: () => () => {},
  };
}

export const scannerBridge: ScannerBridgeImpl = LoupeScannerBridge
  ? makeNativeBridge(LoupeScannerBridge)
  : makeUnavailableBridge();

/** Convenience boolean for UI badges / dev panels. */
export const isNativeScannerAvailable = scannerBridge.source === "native";

export type ScannerBridge = ScannerBridgeImpl;
