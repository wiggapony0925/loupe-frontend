import React from "react";
import { Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useThemedPalette } from "@/presentation/theme/tokens";

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  icon?: LucideIcon;
  accent?: "mint" | "blue" | "amber" | "rose" | "neutral";
}

/** Compact metric tile used across the Command Center. */
export function StatTile({ label, value, delta, icon: Icon, accent = "neutral" }: StatTileProps) {
  const p = useThemedPalette();
  const tint =
    accent === "neutral"
      ? p.ink.muted
      : accent === "mint"
        ? p.accent.mint
        : accent === "blue"
          ? p.accent.blue
          : accent === "amber"
            ? p.accent.amber
            : p.accent.rose;
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
