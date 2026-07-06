import { NativeModule, requireOptionalNativeModule } from "expo";
import {
  CapturedFrame,
  CardFrameAnalysis,
  CroppedCard,
  HapticPattern,
  ImageQualityReport,
  LoupeScannerBridgeModuleEvents,
  RecognizedCardText,
  ScannerInfo,
} from "./LoupeScannerBridge.types";

declare class LoupeScannerBridgeModule extends NativeModule<LoupeScannerBridgeModuleEvents> {
  // Constants
  LIGHT_COUNT: number;
  SUPPORTED_LIGHT_INDICES: number[];

  // BLE lifecycle
  connectScanner(deviceId: string): Promise<ScannerInfo>;
  disconnectScanner(): Promise<void>;
  isConnected(): boolean;

  // Capture
  captureFrame(lightIndex: number): Promise<CapturedFrame>;

  // On-device quality gate (legacy 4-field response)
  checkImageQuality(uri: string): Promise<ImageQualityReport>;

  // Live card detector (iOS Vision + CoreImage)
  analyzeCardFrame(uri: string): Promise<CardFrameAnalysis>;
  cropCardPerspective(
    uri: string,
    corners: number[],
    outputLongEdge: number,
    jpegQuality: number,
  ): Promise<CroppedCard>;
  /** dHash over a 9×8 grayscale downsample. Returns 16-char hex. */
  computePerceptualHash(uri: string): Promise<string>;
  /** Apple Vision on-device OCR (accurate, no autocorrect). iOS only. */
  recognizeCardText(uri: string): Promise<RecognizedCardText>;

  // Haptics
  triggerHaptic(pattern: HapticPattern): void;
}

// `requireOptionalNativeModule` returns `null` (instead of throwing) when
// the native module isn't linked — e.g. running in Expo Go before the dev
// build is generated. The JS facade in `src/native/scannerBridge.ts` swaps
// in a mock implementation in that case.
export default requireOptionalNativeModule<LoupeScannerBridgeModule>("LoupeScannerBridge");
