import * as React from "react";
import { LoupeScannerBridgeViewProps } from "./LoupeScannerBridge.types";

export default function LoupeScannerBridgeView(props: LoupeScannerBridgeViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
