/**
 * 4-axis subgrade radar — Centering / Corners / Edges / Surface.
 *
 * Mirrors the visual language CGC and BGS slabs use on their labels: a
 * small spider chart with the actual scores polygon drawn over a
 * concentric grid. Scores are normalized to the 0..10 scale and rendered
 * with a coloured fill that picks up the lowest subgrade's tone.
 */
import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import type { ForensicScore } from "@/types/domain";
import { useThemedPalette, withAlpha } from "@/theme/tokens";
import { formatGrade, gradeTone, scoreTo10 } from "@/lib/grading";

interface SubgradeRadarProps {
  score: ForensicScore;
  size?: number;
}

const AXES = ["Centering", "Corners", "Edges", "Surface"] as const;
const RINGS = [2, 4, 6, 8, 10];

export function SubgradeRadar({ score, size = 220 }: SubgradeRadarProps) {
  const p = useThemedPalette();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 28; // leave room for axis labels

  const subs = [
    scoreTo10(score.centering),
    scoreTo10(score.corners),
    scoreTo10(score.edges),
    scoreTo10(score.surface),
  ] as const;

  const tone = pickTone(p, gradeTone(Math.min(...subs)));

  // Top, right, bottom, left.
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

  const points = subs
    .map((v, i) => {
      const ratio = v / 10;
      const x = cx + Math.cos(angles[i]!) * r * ratio;
      const y = cy + Math.sin(angles[i]!) * r * ratio;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const axisEnds = angles.map((a) => ({
    x: cx + Math.cos(a) * r,
    y: cy + Math.sin(a) * r,
  }));

  return (
    <View
      className="rounded-2xl border border-line bg-bg-elevated p-4"
      accessibilityRole="image"
      accessibilityLabel={`Subgrades centering ${subs[0]}, corners ${subs[1]}, edges ${subs[2]}, surface ${subs[3]}`}
    >
      <View className="mb-3 flex-row items-end justify-between">
        <View>
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Subgrade Profile
          </Text>
          <Text className="mt-1 text-base font-semibold text-ink">
            CGC / BGS axes
          </Text>
        </View>
        <Text className="text-[10px] uppercase tracking-[2px] text-ink-dim">
          0 — 10
        </Text>
      </View>

      <View className="items-center">
        <Svg width={size} height={size}>
          {RINGS.map((ring) => (
            <Circle
              key={ring}
              cx={cx}
              cy={cy}
              r={(r * ring) / 10}
              stroke={p.line.default}
              strokeWidth={ring === 10 ? 1 : 0.5}
              opacity={ring === 10 ? 1 : 0.5}
              fill="none"
            />
          ))}
          {axisEnds.map((pt, i) => (
            <Line
              key={i}
              x1={cx}
              y1={cy}
              x2={pt.x}
              y2={pt.y}
              stroke={p.line.default}
              strokeWidth={0.5}
            />
          ))}
          <Polygon
            points={points}
            fill={withAlpha(tone, 0.22)}
            stroke={tone}
            strokeWidth={1.5}
          />
          {subs.map((v, i) => {
            const ratio = v / 10;
            const x = cx + Math.cos(angles[i]!) * r * ratio;
            const y = cy + Math.sin(angles[i]!) * r * ratio;
            return <Circle key={i} cx={x} cy={y} r={3} fill={tone} />;
          })}
          {AXES.map((label, i) => {
            const lx = cx + Math.cos(angles[i]!) * (r + 16);
            const ly = cy + Math.sin(angles[i]!) * (r + 16) + 3;
            return (
              <SvgText
                key={label}
                x={lx}
                y={ly}
                fontSize={10}
                fontWeight="600"
                fill={p.ink.muted}
                textAnchor="middle"
              >
                {label.toUpperCase()}
              </SvgText>
            );
          })}
        </Svg>
      </View>

      <View className="mt-3 flex-row justify-between">
        {AXES.map((label, i) => (
          <View key={label} className="items-center">
            <Text className="text-[9px] font-semibold uppercase tracking-[2px] text-ink-dim">
              {abbrev(label)}
            </Text>
            <Text
              className="mt-0.5 text-base font-semibold"
              style={{ color: pickTone(p, gradeTone(subs[i]!)) }}
            >
              {formatGrade(subs[i]!)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function abbrev(label: string): string {
  if (label === "Centering") return "Cntr";
  if (label === "Corners") return "Crnr";
  return label.slice(0, 4);
}

function pickTone(
  p: ReturnType<typeof useThemedPalette>,
  tone: ReturnType<typeof gradeTone>,
): string {
  switch (tone) {
    case "mint": return p.accent.mint;
    case "blue": return p.accent.blue;
    case "amber": return p.accent.amber;
    case "rose": return p.accent.rose;
    case "muted": return p.ink.muted;
  }
}
