import React, { useEffect, useRef } from "react";
import { Animated, View, type ViewStyle } from "react-native";

interface SkeletonProps {
  width?: ViewStyle["width"];
  height?: ViewStyle["height"];
  radius?: number;
  className?: string;
}

/** Shimmering placeholder used while TanStack Query fetches scan data. */
export function Skeleton({
  width = "100%",
  height = 16,
  radius = 8,
  className = "",
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 850, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 850, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View className={className} style={{ width, height, borderRadius: radius, overflow: "hidden" }}>
      <Animated.View style={{ flex: 1, backgroundColor: "#2A2A2E", opacity }} />
    </View>
  );
}
