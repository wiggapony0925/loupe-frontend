import React from "react";
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { useThemedPalette } from "@/theme/tokens";

interface LoupeMarkProps {
  size?: number;
  color?: string;
}

/** The Loupe brand mark — a stylized jeweler's loupe with a mint reticle. */
export function LoupeMark({ size = 28, color }: LoupeMarkProps) {
  const p = useThemedPalette();
  const stroke = color ?? p.ink.default;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Defs>
        <LinearGradient id="loupe-rim" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={0.95} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0.55} />
        </LinearGradient>
      </Defs>
      <Circle cx={13} cy={13} r={9} stroke="url(#loupe-rim)" strokeWidth={2} />
      <Circle cx={13} cy={13} r={3.4} stroke={p.accent.mint} strokeWidth={1.2} />
      <Path
        d="M13 9.4 V11.4 M13 14.6 V16.6 M9.4 13 H11.4 M14.6 13 H16.6"
        stroke={p.accent.mint}
        strokeWidth={1}
        strokeLinecap="round"
      />
      <Path d="M19.6 19.6 L27 27" stroke={stroke} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
