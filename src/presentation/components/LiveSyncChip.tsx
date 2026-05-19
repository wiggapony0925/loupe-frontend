import React from "react";
import { Text, View } from "react-native";
import { Activity } from "lucide-react-native";
import { StatusDot } from "@/presentation/components/StatusDot";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { relativeTime } from "@/shared/format";

interface LiveSyncChipProps {
  lastSyncIso?: string;
  online: boolean;
}

/** Tiny live-status pill shown in the Command Center header. */
export function LiveSyncChip({ lastSyncIso, online }: LiveSyncChipProps) {
  const p = useThemedPalette();
  const tint = online ? p.accent.mint : p.accent.rose;
  return (
    <View
      className="flex-row items-center gap-2 rounded-full border px-2.5 py-1"
      style={{ borderColor: withAlpha(tint, 0.4), backgroundColor: withAlpha(tint, 0.08) }}
    >
      <StatusDot color={tint} size={6} pulse={online} />
      <Activity size={11} color={tint} />
      <Text
        className="text-[10px] font-semibold uppercase tracking-[1.5px]"
        style={{ color: tint }}
      >
        {online ? "Live" : "Offline"}
        {lastSyncIso ? ` · ${relativeTime(lastSyncIso)}` : ""}
      </Text>
    </View>
  );
}
