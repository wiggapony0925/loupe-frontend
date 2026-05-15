import React from "react";
import { Text, View } from "react-native";
import type { ForensicScore } from "@/types/domain";
import { palette } from "@/theme/tokens";

interface ScoreBreakdownProps {
  score: ForensicScore;
}

interface Row {
  label: string;
  value: number;
  color: string;
}

/** 1000-point granular score breakdown with horizontal bar visualization. */
export function ScoreBreakdown({ score }: ScoreBreakdownProps) {
  const rows: Row[] = [
    { label: "Surface", value: score.surface, color: palette.accent.amber },
    { label: "Edges", value: score.edges, color: palette.accent.blue },
    { label: "Corners", value: score.corners, color: palette.accent.rose },
    { label: "Centering", value: score.centering, color: palette.accent.mint },
  ];

  return (
    <View className="rounded-2xl border border-line bg-bg-elevated p-4">
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Composite Score
          </Text>
          <Text className="mt-1 text-3xl font-semibold text-ink">
            {score.composite}
            <Text className="text-base text-ink-dim"> / 1000</Text>
          </Text>
        </View>
        <View
          className="rounded-xl px-3 py-2"
          style={{
            backgroundColor: "rgba(0,245,155,0.10)",
            borderWidth: 1,
            borderColor: "rgba(0,245,155,0.35)",
          }}
        >
          <Text className="text-[10px] uppercase tracking-[2px] text-ink-dim">Grade</Text>
          <Text className="text-2xl font-semibold" style={{ color: palette.accent.mint }}>
            {score.grade.toFixed(1)}
          </Text>
        </View>
      </View>

      <View className="mt-5 gap-3">
        {rows.map((r) => (
          <ScoreRow key={r.label} {...r} />
        ))}
      </View>
    </View>
  );
}

function ScoreRow({ label, value, color }: Row) {
  const pct = Math.max(0, Math.min(1, value / 1000));
  return (
    <View>
      <View className="flex-row justify-between">
        <Text className="text-xs uppercase tracking-[2px] text-ink-muted">{label}</Text>
        <Text className="text-xs font-medium text-ink">{value} / 1000</Text>
      </View>
      <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-sunken">
        <View
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            backgroundColor: color,
            borderRadius: 999,
          }}
        />
      </View>
    </View>
  );
}
