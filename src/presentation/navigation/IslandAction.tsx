/**
 * IslandAction — circular icon button used inside island navbar faces
 * (vault multi-select, community rail, …). One shared primitive keeps every
 * face's touch targets, pressed states, and disabled treatment identical.
 */
import React from "react";
import { Pressable, View } from "react-native";
import {
  ISLAND_PILL_HEIGHT,
} from "@/presentation/navigation/IslandNavPill";
import { withAlpha } from "@/presentation/theme/tokens";

export const ISLAND_ACTION_WIDTH = 56;

export function IslandAction({
  label,
  onPress,
  disabled = false,
  accent,
  active = false,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accent: string;
  /** Persistent tint (e.g. the "you are here" slot), not just while pressed. */
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      style={{
        width: ISLAND_ACTION_WIDTH,
        height: ISLAND_PILL_HEIGHT,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {({ pressed }) => (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(accent, pressed ? 0.28 : active ? 0.2 : 0.16),
            transform: [{ scale: pressed ? 0.92 : 1 }],
          }}
        >
          {children}
        </View>
      )}
    </Pressable>
  );
}
