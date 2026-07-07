import * as React from "react";
import { View } from "react-native";
import type { LoupeCameraViewProps } from "./LoupeCameraView";

// The native AVFoundation camera has no web counterpart. Render an inert
// surface so web builds resolve; scan features are gated to native anyway.
export default function LoupeCameraView(props: LoupeCameraViewProps) {
  return <View style={props.style} />;
}
