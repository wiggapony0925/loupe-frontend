import React from "react";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import type { HeatmapDing } from "@/domain";
import { useThemedPalette } from "@/presentation/theme/tokens";

interface HeatmapOverlayProps {
  dings: HeatmapDing[];
}

/**
 * Semi-transparent SVG layer that highlights "DINGS" detected by the AI grader.
 * Coordinates are normalized 0..1 against the parent capture frame.
 */
export function HeatmapOverlay({ dings }: HeatmapOverlayProps) {
  const p = useThemedPalette();
  const CATEGORY_COLOR: Record<HeatmapDing["category"], string> = {
    surface: p.accent.amber,
    edges: p.accent.blue,
    corners: p.accent.rose,
    centering: p.accent.mint,
  };
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        {(["surface", "edges", "corners", "centering"] as const).map((cat) => (
          <RadialGradient id={`grad-${cat}`} key={cat} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <Stop offset="0%" stopColor={CATEGORY_COLOR[cat]} stopOpacity={0.75} />
            <Stop offset="70%" stopColor={CATEGORY_COLOR[cat]} stopOpacity={0.15} />
            <Stop offset="100%" stopColor={CATEGORY_COLOR[cat]} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>

      {dings.map((d) => (
        <Circle
          key={d.id}
          cx={d.x * 100}
          cy={d.y * 100}
          r={d.radius * 100}
          fill={`url(#grad-${d.category})`}
          opacity={0.4 + d.severity * 0.6}
        />
      ))}
    </Svg>
  );
}
