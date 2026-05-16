/**
 * TrendPill — small colored chip showing a percentage delta with an
 * up/down arrow. Mint when ≥0, rose when negative. Used in CardTile,
 * TopMovers, analytics rows, etc.
 */
import React from "react";
import { Text, View } from "react-native";
import { useThemedPalette, withAlpha } from "@/theme/tokens";
import type { TrendInfo } from "@/components/cards/types";

export type { TrendInfo };

export interface TrendPillProps {
  trend: TrendInfo;
  /** Visual size. `sm` is the default used in tiles; `md` is for hero rows. */
  size?: "sm" | "md";
}

export function TrendPill({ trend, size = "sm" }: TrendPillProps) {
  const p = useThemedPalette();
  const up = trend.pct >= 0;
  const tint = up ? p.accent.mint : p.accent.rose;
  const padX = size === "md" ? 8 : 5;
  const padY = size === "md" ? 3 : 1;
  const radius = size === "md" ? 6 : 4;
  const font = size === "md" ? 11 : 9;
  return (
    <View
      style={{
        paddingHorizontal: padX,
        paddingVertical: padY,
        borderRadius: radius,
        backgroundColor: withAlpha(tint, 0.16),
      }}
    >
      <Text style={{ color: tint, fontSize: font, fontWeight: "800" }}>
        {up ? "▲" : "▼"} {Math.abs(trend.pct).toFixed(2)}%
      </Text>
    </View>
  );
}
