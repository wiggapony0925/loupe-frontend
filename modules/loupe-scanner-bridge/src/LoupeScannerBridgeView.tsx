import { requireNativeView } from "expo";
import * as React from "react";
import { LoupeScannerBridgeViewProps } from "./LoupeScannerBridge.types";

const NativeView: React.ComponentType<LoupeScannerBridgeViewProps> =
  requireNativeView("LoupeScannerBridge");

export default function LoupeScannerBridgeView(props: LoupeScannerBridgeViewProps) {
  return <NativeView {...props} />;
}
