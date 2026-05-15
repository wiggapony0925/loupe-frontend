import React, { type ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";

interface GlassCardProps extends ViewProps {
  children: ReactNode;
  /** Bump intensity for hero overlays (modals, sheets). */
  intensity?: number;
  /** Extra Tailwind classes appended to the surface. */
  className?: string;
}

/**
 * A frosted, slate surface with a hairline border. Built on expo-blur so it
 * renders true glassmorphism on iOS and degrades gracefully on Android.
 */
export function GlassCard({ children, intensity = 30, className = "", ...rest }: GlassCardProps) {
  return (
    <View
      className={`overflow-hidden rounded-2xl border border-line bg-bg-elevated/70 ${className}`}
      {...rest}
    >
      <BlurView intensity={intensity} tint="dark" style={{ flex: 0 }}>
        <View className="p-4">{children}</View>
      </BlurView>
    </View>
  );
}
