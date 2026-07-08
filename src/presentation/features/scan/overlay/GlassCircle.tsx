import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { BLUR_INTENSITY, GLASS, HAIRLINE } from "./theme";

/**
 * Circular camera-overlay button — iOS-camera frosted glass: a real
 * BlurView under a light tint, clipped to the circle, with a hairline
 * edge. No solid fills, no drop shadows — the blur itself lifts the
 * control off the viewfinder the way Apple's own camera chrome does.
 */
export function GlassCircle({
  children,
  onPress,
  accessibilityLabel,
  tint = GLASS,
  borderColor = HAIRLINE,
  size = 44,
}: {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  tint?: string;
  borderColor?: string;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor,
        opacity: pressed ? 0.82 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <BlurView
        intensity={BLUR_INTENSITY}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tint,
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}
