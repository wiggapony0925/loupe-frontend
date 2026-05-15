import { NativeModule, requireOptionalNativeModule } from "expo";
import {
  CapturedFrame,
  HapticPattern,
  ImageQualityReport,
  LoupeScannerBridgeModuleEvents,
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

  // On-device quality gate
  checkImageQuality(uri: string): Promise<ImageQualityReport>;

  // Haptics
  triggerHaptic(pattern: HapticPattern): void;
}

// `requireOptionalNativeModule` returns `null` (instead of throwing) when
// the native module isn't linked — e.g. running in Expo Go before the dev
// build is generated. The JS facade in `src/native/scannerBridge.ts` swaps
// in a mock implementation in that case.
export default requireOptionalNativeModule<LoupeScannerBridgeModule>("LoupeScannerBridge");
