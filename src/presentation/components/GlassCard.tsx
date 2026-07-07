import React, { type ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { LiquidGlassView } from "./LiquidGlassView";

interface GlassCardProps extends ViewProps {
  children: ReactNode;
  /** Bump intensity for hero overlays (modals, sheets). */
  intensity?: number;
  /** Extra Tailwind classes appended to the surface. */
  className?: string;
}

/**
 * A frosted, slate surface with a hairline border. Rides on
 * `LiquidGlassView`, so it renders Apple's native Liquid Glass on iOS 26+
 * builds and degrades to expo-blur / translucent elsewhere.
 */
export function GlassCard({ children, intensity = 30, className = "", ...rest }: GlassCardProps) {
  return (
    <View
      className={`overflow-hidden rounded-2xl border border-line bg-bg-elevated/70 ${className}`}
      {...rest}
    >
      <LiquidGlassView intensity={intensity} tint="dark" style={{ flex: 0 }}>
        <View className="p-4">{children}</View>
      </LiquidGlassView>
    </View>
  );
}
