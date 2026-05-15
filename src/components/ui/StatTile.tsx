import React from "react";
import { Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { palette } from "@/theme/tokens";

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  icon?: LucideIcon;
  accent?: "mint" | "blue" | "amber" | "rose" | "neutral";
}

const ACCENT_HEX: Record<NonNullable<StatTileProps["accent"]>, string> = {
  mint: palette.accent.mint,
  blue: palette.accent.blue,
  amber: palette.accent.amber,
  rose: palette.accent.rose,
  neutral: palette.ink.muted,
};

/** Compact metric tile used across the Command Center. */
export function StatTile({ label, value, delta, icon: Icon, accent = "neutral" }: StatTileProps) {
  const tint = ACCENT_HEX[accent];
  return (
    <View className="flex-1 rounded-2xl border border-line bg-bg-elevated p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] uppercase tracking-[2px] text-ink-dim">{label}</Text>
        {Icon ? <Icon size={14} color={tint} /> : null}
      </View>
      <Text className="mt-3 text-2xl font-semibold text-ink">{value}</Text>
      {delta ? (
        <Text className="mt-1 text-xs" style={{ color: tint }}>
          {delta}
        </Text>
      ) : null}
    </View>
  );
}
