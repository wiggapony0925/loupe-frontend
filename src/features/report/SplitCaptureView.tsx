import React from "react";
import { Image, Text, View } from "react-native";

interface SplitCaptureViewProps {
  frontUri: string;
  backUri: string;
  /** Optional overlay rendered above each capture (e.g., heatmap). */
  renderOverlay?: (side: "front" | "back") => React.ReactNode;
}

/** Side-by-side high-res capture view used at the top of the Forensic Report. */
export function SplitCaptureView({ frontUri, backUri, renderOverlay }: SplitCaptureViewProps) {
  return (
    <View className="flex-row gap-3">
      <CaptureFrame label="Front" uri={frontUri} overlay={renderOverlay?.("front")} />
      <CaptureFrame label="Back" uri={backUri} overlay={renderOverlay?.("back")} />
    </View>
  );
}

function CaptureFrame({
  label,
  uri,
  overlay,
}: {
  label: string;
  uri: string;
  overlay?: React.ReactNode;
}) {
  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-line bg-bg-sunken">
      <View className="aspect-[5/7] w-full">
        <Image source={{ uri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
        {overlay ? (
          <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
            {overlay}
          </View>
        ) : null}
      </View>
      <View className="flex-row items-center justify-between border-t border-line px-3 py-2">
        <Text className="text-[10px] uppercase tracking-[2px] text-ink-dim">{label}</Text>
        <Text className="text-[10px] uppercase tracking-[2px] text-ink-muted">8K · RAW</Text>
      </View>
    </View>
  );
}
