/**
 * DonutChart (mobile) — the React Native twin of the web `DonutChart`.
 *
 * Renders the same allocation ring: both platforms feed the shared
 * `@loupe/chart` `buildDonut` the same data and draw the identical
 * stroke-dash segments — web with `<svg>`, mobile with `react-native-svg`.
 * A center total + a value/percent legend, with the long tail folded into
 * an "Other" slice. Colors come from the live theme palette.
 */
import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { buildDonut, type DonutDatum } from "@loupe/chart";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export type { DonutDatum };

export interface DonutChartProps {
  data: DonutDatum[];
  format?: (n: number) => string;
  /** Big figure in the ring's center (e.g. the total). */
  centerValue?: string;
  /** Quiet label under the center figure. */
  centerLabel?: string;
  /** Slices beyond this fold into an "Other" segment. */
  maxSlices?: number;
  /** Ring diameter in px. */
  size?: number;
}

export function DonutChart({
  data,
  format = (n) => String(Math.round(n)),
  centerValue,
  centerLabel,
  maxSlices = 5,
  size = 168,
}: DonutChartProps) {
  const p = useThemedPalette();
  const TONES = [
    p.accent.mint,
    p.accent.blue,
    p.accent.purple,
    p.accent.amber,
    p.accent.rose,
  ];
  const REST = p.line.default;

  const geo = buildDonut({ data, size, maxSlices });
  if (!geo) return null;

  const { stroke, radius, center } = geo;
  const segs = geo.segments.map((s) => ({
    ...s,
    color: s.isOther ? REST : TONES[s.colorIndex % TONES.length]!,
  }));

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={size} height={size}>
          {/* Track. */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={withAlpha(p.line.default, 0.5)}
            strokeWidth={stroke}
          />
          {/* Segments — rotated so the ring starts at 12 o'clock, like the web. */}
          <G transform={`rotate(-90 ${center} ${center})`}>
            {segs.map((s, i) => (
              <Circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={[s.dash, s.gap]}
                strokeDashoffset={s.offset}
              />
            ))}
          </G>
        </Svg>
        {centerValue || centerLabel ? (
          <View style={{ position: "absolute", alignItems: "center" }}>
            {centerValue ? (
              <Text
                style={{ color: p.ink.default, fontSize: 20, fontWeight: "800" }}
              >
                {centerValue}
              </Text>
            ) : null}
            {centerLabel ? (
              <Text
                style={{ color: p.ink.dim, fontSize: 11, fontWeight: "600" }}
              >
                {centerLabel}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1, gap: 8 }}>
        {segs.map((s, i) => (
          <View
            key={i}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: s.color,
              }}
            />
            <Text
              style={{ color: p.ink.muted, fontSize: 13, flex: 1 }}
              numberOfLines={1}
            >
              {s.label}
            </Text>
            <Text
              style={{ color: p.ink.default, fontSize: 13, fontWeight: "700" }}
            >
              {format(s.value)}
            </Text>
            <Text style={{ color: p.ink.dim, fontSize: 12, width: 38, textAlign: "right" }}>
              {Math.round(s.pct)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
