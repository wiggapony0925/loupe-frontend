import React from "react";
import { View, type ViewStyle } from "react-native";
import { FileText } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

interface StatementFileIconProps {
  size?: number;
  /** List rows use a smaller, neutral tile. */
  variant?: "default" | "row";
}

/** Minimal document glyph — consistent across statements surfaces. */
export function StatementFileIcon({
  size = 40,
  variant = "default",
}: StatementFileIconProps) {
  const p = useThemedPalette();
  const isRow = variant === "row";
  const radius = isRow ? 10 : 12;
  const iconSize = Math.round(size * 0.46);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isRow ? p.bg.base : withAlpha(p.ink.default, 0.04),
        borderWidth: 1,
        borderColor: p.line.default,
      }}
    >
      <FileText
        size={iconSize}
        color={isRow ? p.ink.muted : p.ink.default}
        strokeWidth={2.2}
      />
    </View>
  );
}

interface StatementCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/** Elevated surface for statement summaries — no decorative sheen. */
export function StatementCard({ children, style }: StatementCardProps) {
  const p = useThemedPalette();

  return (
    <View
      style={[
        {
          borderRadius: 16,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** @deprecated Use StatementCard */
export const StatementMetalCard = StatementCard;
