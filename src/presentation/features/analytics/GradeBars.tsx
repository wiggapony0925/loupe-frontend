/**
 * Collectr-style horizontal grade-distribution bars.
 *
 * Each row: [grade label] [bar fill] [count].
 * Bar fills proportional to the largest bucket; tint follows grade band.
 */
import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { gradeColor, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import type { CollectionCard } from "@/domain";

interface GradeBarsProps {
  cards: CollectionCard[];
}

const BUCKETS = [
  { key: "Gem 10", min: 9.5, max: 10.1 },
  { key: "Mint 9", min: 8.5, max: 9.5 },
  { key: "NM 8",  min: 7.5, max: 8.5 },
  { key: "EX 7",  min: 6.5, max: 7.5 },
  { key: "≤ 6",  min: 0,    max: 6.5 },
];

export function GradeBars({ cards }: GradeBarsProps) {
  const p = useThemedPalette();

  const rows = useMemo(() => {
    const counts = BUCKETS.map((b) => ({
      ...b,
      count: cards.filter((c) => c.grade >= b.min && c.grade < b.max).length,
    }));
    const max = Math.max(1, ...counts.map((c) => c.count));
    return counts.map((c) => ({ ...c, pct: c.count / max }));
  }, [cards]);

  return (
    <View className="rounded-2xl border border-line bg-bg-elevated p-4">
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        Grade Distribution
      </Text>
      <View className="mt-3 gap-2.5">
        {rows.map((r) => {
          const tint = gradeColor((r.min + r.max) / 2);
          return (
            <View key={r.key} className="flex-row items-center gap-3">
              <Text
                className="text-[11px] font-semibold tracking-wider"
                style={{ width: 56, color: p.ink.muted }}
              >
                {r.key}
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
