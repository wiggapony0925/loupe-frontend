/**
 * Tiny inline SVG sparkline — Robinhood-style mini chart for list rows.
 * Stateless, deterministic, no animation. Renders a smooth line with a
 * dashed period-start baseline matching the big PortfolioChart aesthetic.
 */
import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { useThemedPalette } from "@/theme/tokens";

interface SparklineProps {
  values: readonly number[];
  width?: number;
  height?: number;
  /** Override stroke color. Defaults to mint/rose based on first→last delta. */
  color?: string;
  /** Show the dashed baseline at the period-start price. */
  showBaseline?: boolean;
}

export function Sparkline({
  values,
  width = 96,
  height = 36,
  color,
  showBaseline = true,
}: SparklineProps) {
  const p = useThemedPalette();

  const { path, baselineY, tint } = useMemo(() => {
    if (values.length < 2) return { path: "", baselineY: 0, tint: p.accent.mint };
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const PAD = 3;
    const yScale = (v: number) => {
      if (hi === lo) return height / 2;
      return PAD + (1 - (v - lo) / (hi - lo)) * (height - PAD * 2);
    };
    const xScale = (i: number) => (i / (values.length - 1)) * width;

    let d = `M ${xScale(0).toFixed(2)} ${yScale(values[0]!).toFixed(2)}`;
    for (let i = 1; i < values.length; i++) {
      d += ` L ${xScale(i).toFixed(2)} ${yScale(values[i]!).toFixed(2)}`;
    }
    const up = values[values.length - 1]! >= values[0]!;
    return {
      path: d,
      baselineY: yScale(values[0]!),
      tint: color ?? (up ? p.accent.mint : p.accent.rose),
    };
  }, [values, width, height, color, p.accent.mint, p.accent.rose]);

  if (!path) return <View style={{ width, height }} />;

  return (
    <Svg width={width} height={height}>
      {showBaseline ? (
        <Line
          x1={0}
          x2={width}
          y1={baselineY}
          y2={baselineY}
          stroke={p.ink.dim}
          strokeWidth={0.5}
          strokeDasharray="2,3"
          opacity={0.5}
        />
      ) : null}
      <Path
        d={path}
        stroke={tint}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Generates a deterministic short price walk for sparkline rendering.
 * Seeds off any string id so the same card always draws the same line.
 */
export function seededWalk(seedKey: string, anchor: number, length = 24): number[] {
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    h ^= seedKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let seed = (h >>> 0) || 1;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const out: number[] = [];
  let price = anchor * (0.85 + rand() * 0.1);
  for (let i = 0; i < length; i++) {
    const drift = 1 + (rand() - 0.45) * 0.07;
    price = Math.max(anchor * 0.5, price * drift);
    out.push(price);
  }
  // Anchor the last value to the current price so the chip matches reality.
  out[out.length - 1] = anchor;
  return out;
}
