import React from "react";
import { Text, View } from "react-native";
import { Camera, Cpu, Smartphone } from "lucide-react-native";
import { palette } from "@/theme/tokens";
import type { CaptureSource } from "@/types/domain";

interface CaptureSourceBadgeProps {
  source?: CaptureSource;
}

const META: Record<
  CaptureSource,
  { label: string; tolerance: string; icon: typeof Cpu; tint: string }
> = {
  scanner: {
    label: "Scanner · Calibrated",
    tolerance: "±0.1 grade vs PSA reference",
    icon: Cpu,
    tint: palette.accent.mint,
  },
  "phone-studio": {
    label: "Phone · Studio Capture",
    tolerance: "±0.5 grade · 4-shot photometric",
    icon: Camera,
    tint: palette.accent.blue,
  },
  "phone-quick": {
    label: "Phone · Quick Triage",
    tolerance: "±1.0 grade · 2-shot estimate",
    icon: Smartphone,
    tint: palette.accent.amber,
  },
};

/**
 * Pill shown on the Forensic Report header that explains how the source
 * frames were captured + the expected grade tolerance. Sets correct user
 * expectations for phone vs scanner runs.
 */
export function CaptureSourceBadge({ source = "scanner" }: CaptureSourceBadgeProps) {
  const meta = META[source];
  const Icon = meta.icon;
  return (
    <View
      className="flex-row items-center gap-2 self-start rounded-full border px-3 py-1.5"
      style={{ borderColor: `${meta.tint}55`, backgroundColor: `${meta.tint}14` }}
    >
      <Icon size={12} color={meta.tint} />
      <View>
        <Text
          className="text-[10px] font-semibold uppercase tracking-[2px]"
          style={{ color: meta.tint }}
        >
          {meta.label}
        </Text>
        <Text className="text-[10px] text-ink-dim">{meta.tolerance}</Text>
      </View>
    </View>
  );
}
