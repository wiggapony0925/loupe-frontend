/**
 * GradeBars — server-driven horizontal grade-distribution.
 *
 * Bucket counts come from `GET /v1/analytics/overview` and the bar
 * fills proportionally to the largest bucket; tint follows grade band.
 */
import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { gradeColor, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import type { AnalyticsGradeBucket } from "@/infrastructure/repositories/analyticsRepository";

interface GradeBarsProps {
  buckets: AnalyticsGradeBucket[];
}

// Visual centre-grade used purely for the row tint (must match backend buckets).
const TINT_CENTER: Record<string, number> = {
  "Gem 10": 10,
  "Mint 9.5": 9.5,
  "NM 9": 9,
  "8": 8,
  "7": 7,
  "≤ 6": 6,
};

export function GradeBars({ buckets }: GradeBarsProps) {
  const p = useThemedPalette();
  const rows = useMemo(() => {
    const max = Math.max(1, ...buckets.map((b) => b.count));
    return buckets.map((b) => ({ ...b, pct: b.count / max }));
  }, [buckets]);

  return (
    <View className="rounded-2xl border border-line bg-bg-elevated p-4">
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        Grade Distribution
      </Text>
      <View className="mt-3 gap-2.5">
        {rows.map((r) => {
          const tint = gradeColor(TINT_CENTER[r.bucket] ?? 8);
          return (
            <View key={r.bucket} className="flex-row items-center gap-3">
              <Text
                className="text-[11px] font-semibold tracking-wider"
                style={{ width: 64, color: p.ink.muted }}
              >
                {r.bucket}
              </Text>
              <View
                className="flex-1 overflow-hidden rounded-full"
                style={{ height: 8, backgroundColor: withAlpha(p.ink.dim, 0.1) }}
              >
                <View
                  style={{
                    width: `${Math.max(4, r.pct * 100)}%`,
                    height: 8,
                    backgroundColor: tint,
                    borderRadius: 999,
                  }}
                />
              </View>
              <Text
                className="text-[11px] font-semibold tabular-nums"
                style={{ width: 24, textAlign: "right", color: p.ink.default }}
              >
                {r.count}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
