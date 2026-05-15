import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { palette } from "@/theme/tokens";

interface StatusDotProps {
  color: string;
  pulse?: boolean;
  size?: number;
}

/** Pulsing connection indicator (BLE/Wi-Fi). */
export function StatusDot({ color, pulse = true, size = 10 }: StatusDotProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1400, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, progress]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <View
      style={{
        width: size * 2.4,
        height: size * 2.4,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {pulse ? (
        <Animated.View
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            transform: [{ scale }],
            opacity,
          }}
        />
      ) : null}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: 0.8,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
          borderWidth: 1,
          borderColor: palette.bg.base,
        }}
      />
    </View>
  );
}
