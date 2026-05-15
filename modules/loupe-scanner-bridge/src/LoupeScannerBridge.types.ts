import type { StyleProp, ViewStyle } from "react-native";

// ───── Domain types ─────

export type ScannerState = "disconnected" | "connecting" | "connected" | "capturing" | "error";

export type ScannerInfo = {
  id: string;
  firmware: string;
  battery: number;
  connected: boolean;
};

export type CapturedFrame = {
  uri: string;
  lightIndex: number;
  width: number;
  height: number;
};

export type ImageQualityReport = {
  /** 0 = razor sharp, 1 = unusable. Reject above ~0.35. */
  blurScore: number;
  /** 0 = no glare, 1 = blown out. Reject above ~0.5. */
  glareScore: number;
  /** Card edges within the expected ROI. */
  alignmentOk: boolean;
  /** Detected aspect ratio matches a trading-card-shaped rectangle. */
  aspectOk: boolean;
};

export type HapticPattern = "tick" | "success" | "warning" | "failure";

// ───── Native event payloads ─────

export type ScannerStateChangePayload = {
  state: ScannerState;
  info?: ScannerInfo;
  errorMessage?: string;
};

export type CaptureProgressPayload = {
  lightIndex: number;
  totalLights: number;
  phase: "arming" | "exposing" | "reading" | "done";
};

export type LoupeScannerBridgeModuleEvents = {
  onScannerStateChange: (params: ScannerStateChangePayload) => void;
  onCaptureProgress: (params: CaptureProgressPayload) => void;
};

// ───── Template View types (kept so the generated View files still compile) ─────

export type OnLoadEventPayload = { url: string };

export type LoupeScannerBridgeViewProps = {
  url: string;
  onLoad: (event: { nativeEvent: OnLoadEventPayload }) => void;
  style?: StyleProp<ViewStyle>;
};
