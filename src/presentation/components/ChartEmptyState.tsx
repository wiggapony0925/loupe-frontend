/**
 * ChartEmptyState — a "no data yet" chart placeholder that actually looks like
 * a chart: a faint dashed ghost curve + gradient behind the message, over the
 * same faint gridlines a real chart would sit on. Deliberately neutral gray
 * (not the brand mint) and dashed, so it never reads as real/fake data.
 *
 * Shared by the card-detail price chart and any other empty chart surface so
 * the "no data" experience is consistent across the app.
 */
import React, { useId, useMemo, useState } from "react";
import { type LayoutChangeEvent, Text, View } from "react-native";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { monotoneCubic } from "@/domain/charts";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export function ChartEmptyState({
  title,
  subtitle,
  height = 172,
}: {
  title: string;
  subtitle?: string;
  height?: number;
}) {
  const p = useThemedPalette();
  const [width, setWidth] = useState(0);
  // Unique gradient id per instance — SVG <defs> ids are document-global, so a
  // shared id would cross-wire fills when two empty charts render at once.
  const gid = useId().replace(/:/g, "");

  const ghost = useMemo(() => {
    if (width === 0) return { line: "", area: "" };
    const norm = [0.62, 0.54, 0.66, 0.5, 0.58, 0.44, 0.38];
    const PAD_Y = 24;
    const coords = norm.map(
      (y, i) =>
        [
          (i / (norm.length - 1)) * width,
          PAD_Y + y * (height - PAD_Y * 2),
        ] as const,
    );
    const line = monotoneCubic(coords);
    return { line, area: line + ` L ${width} ${height} L 0 ${height} Z` };
  }, [width, height]);

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{
        height,
        borderRadius: 14,
        backgroundColor: withAlpha(p.ink.dim, 0.05),
        borderWidth: 1,
        borderColor: withAlpha(p.ink.dim, 0.12),
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {[0.25, 0.5, 0.75].map((r) => (
        <View
          key={r}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            top: height * r,
            height: 1,
            backgroundColor: withAlpha(p.ink.dim, 0.18),
          }}
        />
      ))}

      {width > 0 && ghost.line ? (
        <Svg
          width={width}
          height={height}
          style={{ position: "absolute", left: 0, top: 0 }}
          pointerEvents="none"
        >
          <Defs>
            <SvgGradient id={`emptyGhost-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={p.ink.dim} stopOpacity="0.12" />
              <Stop offset="100%" stopColor={p.ink.dim} stopOpacity="0" />
            </SvgGradient>
          </Defs>
          <Path d={ghost.area} fill={`url(#emptyGhost-${gid})`} />
          <Path
            d={ghost.line}
            stroke={withAlpha(p.ink.dim, 0.5)}
            strokeWidth={2}
            strokeDasharray="5,6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : null}

      <View pointerEvents="none" style={{ alignItems: "center", paddingHorizontal: 20 }}>
        <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "800" }}>{title}</Text>
        {subtitle ? (
          <Text
            style={{
              marginTop: 4,
              color: p.ink.muted,
              fontSize: 12,
              lineHeight: 18,
              textAlign: "center",
              maxWidth: 260,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
