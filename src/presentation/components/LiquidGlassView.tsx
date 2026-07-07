/**
 * LiquidGlassView — one glass surface for the whole app.
 *
 * Renders Apple's native Liquid Glass (`expo-glass-effect`) on iOS 26+
 * dev/prod builds that include the module, and degrades gracefully:
 *
 *   1. Native `GlassView` when the bridge is present AND iOS supports it
 *   2. `expo-blur` frosted blur everywhere else it renders (older iOS)
 *   3. A plain translucent View as the last resort (Android, web)
 *
 * The native module is required lazily inside try/catch so a JS bundle
 * shipped over-the-air to a binary WITHOUT the compiled bridge can never
 * crash at import time — it just falls back to blur.
 */
import React, { type ReactNode } from "react";
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";

type GlassModule = typeof import("expo-glass-effect");

const glass: GlassModule | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-glass-effect") as GlassModule;
  } catch {
    return null;
  }
})();

const liquidAvailable: boolean = (() => {
  try {
    return !!glass?.isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

export interface LiquidGlassViewProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Native glass style — "regular" frosts more, "clear" stays lighter. */
  glassStyle?: "regular" | "clear";
  /** Blur strength for the expo-blur fallback path. */
  intensity?: number;
  /** Blur tint for the fallback path. */
  tint?: "light" | "dark" | "default";
}

/** True when this build renders real Liquid Glass (iOS 26+ w/ bridge). */
export function hasLiquidGlass(): boolean {
  return liquidAvailable;
}

export function LiquidGlassView({
  children,
  style,
  glassStyle = "regular",
  intensity = 30,
  tint = "default",
}: LiquidGlassViewProps) {
  if (liquidAvailable && glass) {
    const NativeGlass = glass.GlassView;
    return (
      <NativeGlass style={style} glassEffectStyle={glassStyle}>
        {children}
      </NativeGlass>
    );
  }
  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={intensity} tint={tint} style={style}>
        {children}
      </BlurView>
    );
  }
  // Android / web: blur is unreliable — translucent surface instead.
  return (
    <View style={[{ backgroundColor: "rgba(22,24,28,0.86)" }, style]}>{children}</View>
  );
}
