/**
 * PriceText — themed price label. Renders compact USD in mint by
 * default; falls back to `—` when `amount` is null/undefined. Keeps
 * pricing typography consistent across tiles, rails, and detail rows.
 */
import React from "react";
import { Text, type TextProps } from "react-native";
import { useCompactUsd } from "@/shared/format";
import { useThemedPalette } from "@/presentation/theme/tokens";

export interface PriceTextProps extends Omit<TextProps, "children"> {
  amount: number | null | undefined;
  /** Font size in px. Defaults to 11 (tile-friendly). */
  size?: number;
  /** Tone: `accent` (mint) or `ink` (regular ink). */
  tone?: "accent" | "ink";
  fallback?: string;
}

export function PriceText({
  amount,
  size = 11,
  tone = "accent",
  fallback = "—",
  style,
  ...rest
}: PriceTextProps) {
  const p = useThemedPalette();
  const compactUsd = useCompactUsd();
  const color = tone === "accent" ? p.accent.mint : p.ink.default;
  return (
    <Text
      numberOfLines={1}
      style={[{ color, fontSize: size, fontWeight: "700", fontVariant: ["tabular-nums"] }, style]}
      {...rest}
    >
      {amount !== null && amount !== undefined ? compactUsd(amount) : fallback}
    </Text>
  );
}
