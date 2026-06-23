/**
 * Tiny inline SVG sparkline — Robinhood-style mini chart for list rows.
 * Stateless, deterministic, no animation. Renders a smooth line with a
 * dashed period-start baseline matching the big PortfolioChart aesthetic.
 */
import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { buildSparkline } from "@loupe/chart";
import { useThemedPalette } from "@/presentation/theme/tokens";

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
    // Geometry from the shared `@loupe/chart` package — the web Sparkline
    // draws the same path.
    const geom = buildSparkline({ values, width, height, pad: 3 });
    return {
      path: geom.line,
      baselineY: geom.baselineY,
      tint: color ?? (geom.direction === "down" ? p.accent.rose : p.accent.mint),
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
 *
 * @deprecated Import `seededWalk` from `@/domain/charts` instead. This
 * re-export exists only for back-compat with existing call sites.
 */
export { seededWalk } from "@/domain/charts";
