import React, { useMemo } from "react";
import { Text, View } from "react-native";
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { TrendingDown, TrendingUp } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { compactUsd } from "@/shared/format";
import type { PricePoint } from "@/domain";

interface PriceHistoryChartProps {
  points: PricePoint[];
  height?: number;
}

/**
 * Pure-SVG sparkline of recent sold-comp prices. Renders the price line, an
 * area fill, end-point dot, and a delta chip vs the first observation.
 */
export function PriceHistoryChart({ points, height = 120 }: PriceHistoryChartProps) {
  const p = useThemedPalette();
  const { pathLine, pathArea, last, first, latest, lo, hi } = useMemo(() => {
    if (points.length < 2) {
      return {
        pathLine: "",
        pathArea: "",
        last: null,
        first: null,
        latest: 0,
        lo: 0,
        hi: 0,
      };
    }
    const xs = points.map((_, i) => i);
    const ys = points.map((p) => p.priceUsd);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const W = 320;
    const H = height;
    const PAD = 6;
    const xScale = (i: number) => PAD + (i / (xs.length - 1)) * (W - PAD * 2);
    const yScale = (v: number) => {
      if (hi === lo) return H / 2;
      return PAD + (1 - (v - lo) / (hi - lo)) * (H - PAD * 2);
    };
    const coords = points.map((p, i) => [xScale(i), yScale(p.priceUsd)] as const);
    const pathLine = coords
      .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(" ");
    const pathArea =
      pathLine +
      ` L ${coords[coords.length - 1]![0].toFixed(2)} ${H - PAD} L ${coords[0]![0].toFixed(2)} ${H - PAD} Z`;
    return {
      pathLine,
      pathArea,
      last: coords[coords.length - 1]!,
      first: points[0]!.priceUsd,
      latest: points[points.length - 1]!.priceUsd,
      lo,
      hi,
    };
  }, [points, height]);

  if (!last || first === null) return null;

  const delta = latest - first;
  const deltaPct = first > 0 ? (delta / first) * 100 : 0;
  const up = delta >= 0;
  const tint = up ? p.accent.mint : p.accent.rose;
  const Trend = up ? TrendingUp : TrendingDown;

  return (
    <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated p-4">
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Sold comps · 12mo
          </Text>
          <Text className="mt-1 text-2xl font-semibold text-ink">{compactUsd(latest)}</Text>
        </View>
        <View
          className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
          style={{ backgroundColor: withAlpha(tint, 0.13) }}
        >
          <Trend size={12} color={tint} />
          <Text className="text-xs font-semibold" style={{ color: tint }}>
            {up ? "+" : ""}
            {deltaPct.toFixed(1)}%
          </Text>
        </View>
      </View>

      <View className="mt-3" style={{ height }}>
        <Svg width="100%" height={height} viewBox={`0 0 320 ${height}`} preserveAspectRatio="none">
          <Defs>
            <SvgGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={tint} stopOpacity="0.45" />
              <Stop offset="100%" stopColor={tint} stopOpacity="0" />
            </SvgGradient>
          </Defs>
          <Path d={pathArea} fill="url(#areaFill)" />
          <Path d={pathLine} stroke={tint} strokeWidth={2} fill="none" />
          <Circle cx={last[0]} cy={last[1]} r={3.5} fill={tint} />
        </Svg>
      </View>

      <View className="mt-2 flex-row justify-between">
        <Text className="text-[10px] uppercase tracking-[2px] text-ink-dim">
          Low {compactUsd(lo)}
        </Text>
        <Text className="text-[10px] uppercase tracking-[2px] text-ink-dim">
          High {compactUsd(hi)}
        </Text>
      </View>
    </View>
  );
}
