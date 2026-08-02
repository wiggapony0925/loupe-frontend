import React, { type ReactNode } from "react";
import { useColorScheme, View, type ViewProps } from "react-native";
import { useSettings } from "@/application/stores/settingsStore";
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
  // Tint tracks the active theme. It was pinned to "dark", which put a dark
  // blur on a light background — the paired-device card in the scanner flow
  // rendered as a flat opaque grey slab instead of a frosted surface.
  const themeMode = useSettings((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark =
    themeMode === "dark" || (themeMode !== "light" && systemScheme === "dark");

  return (
    <View
      className={`overflow-hidden rounded-2xl border border-line bg-bg-elevated/70 ${className}`}
      {...rest}
    >
      <LiquidGlassView
        intensity={intensity}
        tint={isDark ? "dark" : "light"}
        style={{ flex: 0 }}
      >
        <View className="p-4">{children}</View>
      </LiquidGlassView>
    </View>
  );
}
