import { requireNativeView } from "expo";
import * as React from "react";
import { View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

/** Emitted continuously with the live framing signals. */
export type CardDetectedEvent = {
  detected: boolean;
  confidence: number;
  /** Card confidently framed AND held still — the auto-capture trigger. */
  steady: boolean;
  /** Card area / frame area in [0,1] — drives "move closer" hints. */
  fill: number;
};
/** Emitted when the camera session is live. */
export type CameraReadyEvent = { ready: boolean };
/** Emitted after a still capture — echoes the triggering requestId. */
export type CaptureEvent = {
  requestId: string;
  uri?: string;
  corners?: number[] | null;
  error?: string;
};
/** Emitted when the capture session couldn't start. */
export type MountErrorEvent = { message: string };

export interface LoupeCameraViewProps {
  style?: StyleProp<ViewStyle>;
  /** Start/stop the AVCaptureSession. */
  active?: boolean;
  /** Torch on/off. */
  torchEnabled?: boolean;
  /** Run live Vision rectangle detection + the native reticle. */
  detectionEnabled?: boolean;
  /** Auto-fire a capture when the card is confidently framed + steady. */
  autoCapture?: boolean;
  /** Optical/digital zoom factor (1–5). */
  zoom?: number;
  /** Set a fresh id (uuid) to fire a still capture; result on onCapture. */
  captureRequestId?: string;
  onCameraReady?: (e: { nativeEvent: CameraReadyEvent }) => void;
  onCardDetected?: (e: { nativeEvent: CardDetectedEvent }) => void;
  onCapture?: (e: { nativeEvent: CaptureEvent }) => void;
  onMountError?: (e: { nativeEvent: MountErrorEvent }) => void;
}

// Second view registered on the LoupeScannerBridge module — referenced by
// its Swift class name. Resolution is guarded so importing this file on a
// platform/build without the native view can never crash at load time;
// `isNativeCameraAvailable` lets callers gate to the fallback flow.
let NativeView: React.ComponentType<LoupeCameraViewProps> | null = null;
try {
  NativeView = requireNativeView("LoupeScannerBridge", "LoupeCameraView");
} catch {
  NativeView = null;
}

export const isNativeCameraAvailable = NativeView != null;

export default function LoupeCameraView(props: LoupeCameraViewProps) {
  if (!NativeView) return <View style={props.style} />;
  return <NativeView {...props} />;
}
