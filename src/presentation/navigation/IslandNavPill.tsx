/**
 * IslandNavPill — shared floating glass capsule used by the tab bar and
 * contextual modes (e.g. vault multi-select). Keeps shadow / radius / glass
 * identical so mode swaps feel like one control changing state.
 */
import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { LiquidGlassView } from "@/presentation/components/LiquidGlassView";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export const ISLAND_PILL_HEIGHT = 60;

interface IslandNavPillProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function IslandNavPill({ children, style }: IslandNavPillProps) {
  const p = useThemedPalette();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 10,
          height: ISLAND_PILL_HEIGHT,
          borderRadius: 30,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOpacity: 0.22,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
        },
        style,
      ]}
    >
      {/* Solid underlay keeps the pill color stable while inner content animates. */}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: 30,
          backgroundColor: withAlpha(p.bg.elevated, 0.88),
        }}
      />
      <LiquidGlassView
        glassStyle="regular"
        intensity={40}
        tint="default"
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: 30,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: withAlpha(p.ink.default, 0.14),
        }}
      />
      {children}
    </View>
  );
}
