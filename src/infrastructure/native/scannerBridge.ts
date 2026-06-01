/**
 * Typed JS facade over the LoupeScannerBridge native module.
 *
 * Feature code MUST import from `@/native` — never from
 * `modules/loupe-scanner-bridge` directly. This boundary lets us:
 *   - swap the implementation (auto-falls back to a JS mock in Expo Go
 *     when the native module isn't linked yet)
 *   - rename / reorganize native modules without churning every caller
 *   - keep all `requireNativeModule` calls in one place
 */
import { config } from "@/shared/config";
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

export type ScannerBridgeSource = "native" | "mock";

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

// ───────────────────────────────────────────────────────────
// Mock implementation (used in Expo Go / before dev build exists)
// ───────────────────────────────────────────────────────────
function makeMockBridge(): ScannerBridgeImpl {
  let connected = false;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  return {
    source: "mock",
    lightCount: 4,
    supportedLightIndices: [0, 1, 2, 3],

    async connect(deviceId) {
      await wait(400);
      connected = true;
      return {
        id: deviceId || "mock-scanner",
        firmware: "0.0.0-mock",
        battery: 87,
        connected: true,
      };
    },
    async disconnect() {
      connected = false;
    },
    isConnected: () => connected,

    async captureFrame(lightIndex) {
      await wait(180);
      return {
        uri: `mock://capture-light-${lightIndex}.jpg`,
        lightIndex,
        width: 4032,
        height: 3024,
      };
    },

    async captureAllFrames(onProgress) {
      const frames: CapturedFrame[] = [];
      for (const i of [0, 1, 2, 3]) {
        onProgress?.({ lightIndex: i, totalLights: 4, phase: "arming" });
        await wait(180);
        onProgress?.({ lightIndex: i, totalLights: 4, phase: "done" });
        frames.push({
          uri: `mock://capture-light-${i}.jpg`,
          lightIndex: i,
          width: 4032,
          height: 3024,
        });
      }
      return frames;
    },

    async checkImageQuality() {
      await wait(60);
      return {
        blurScore: 0.08,
        glareScore: 0.05,
        alignmentOk: true,
        aspectOk: true,
      };
    },

    haptic() {
      /* no-op in mock */
    },

    onStateChange: () => () => {},
    onCaptureProgress: () => () => {},
  };
}

function makeUnavailableBridge(): ScannerBridgeImpl {
  const unavailable = () =>
    Promise.reject(
      new Error(
        "Scanner native module is not linked. Build the dev client or set EXPO_PUBLIC_ENABLE_MOCK_BRIDGE=true in development.",
      ),
    );
  return {
    source: "mock",
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
  : __DEV__ && config.enableMockBridge
    ? makeMockBridge()
    : makeUnavailableBridge();

/** Convenience boolean for UI badges / dev panels. */
export const isNativeScannerAvailable = scannerBridge.source === "native";

export type ScannerBridge = ScannerBridgeImpl;
