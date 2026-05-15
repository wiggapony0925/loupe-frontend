import React from "react";
import { Text, View } from "react-native";
import { Activity } from "lucide-react-native";
import { StatusDot } from "@/components/ui/StatusDot";
import { palette } from "@/theme/tokens";
import { relativeTime } from "@/lib/format";

interface LiveSyncChipProps {
  lastSyncIso?: string;
  online: boolean;
}

/** Tiny live-status pill shown in the Command Center header. */
export function LiveSyncChip({ lastSyncIso, online }: LiveSyncChipProps) {
  const tint = online ? palette.accent.mint : palette.accent.rose;
  return (
    <View
      className="flex-row items-center gap-2 rounded-full border px-2.5 py-1"
      style={{ borderColor: tint, backgroundColor: "rgba(0,245,155,0.06)" }}
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
