/**
 * ProviderHealthBadge — tiny pill that surfaces data provenance.
 *
 *   • live      — green dot, fresh upstream data
 *   • estimated — gray dot, synthesized fallback
 *   • cached    — amber dot, served from cache (stale-but-recent)
 */

import React from "react";
import { Text, View } from "react-native";
import { useThemedPalette, withAlpha } from "@/theme/tokens";

export type ProviderHealthSource = "real" | "synthesized" | "cached";

interface ProviderHealthBadgeProps {
  source: ProviderHealthSource;
  sourceName?: string;
  compact?: boolean;
}

const LABELS: Record<ProviderHealthSource, string> = {
  real: "live",
  synthesized: "estimated",
  cached: "cached",
};

export function ProviderHealthBadge({
  source,
  sourceName,
  compact = false,
}: ProviderHealthBadgeProps) {
  const p = useThemedPalette();
  const color =
    source === "real" ? p.accent.mint : source === "cached" ? p.accent.amber : p.ink.dim;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: compact ? 5 : 7,
        paddingVertical: compact ? 2 : 3,
        borderRadius: 999,
        backgroundColor: withAlpha(color, 0.12),
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: color,
        }}
      />
      <Text
        style={{
          color,
          fontSize: compact ? 9 : 10,
          fontWeight: "700",
          letterSpacing: 0.4,
        }}
      >
        {LABELS[source]}
        {sourceName ? ` · ${sourceName}` : ""}
      </Text>
    </View>
  );
}
