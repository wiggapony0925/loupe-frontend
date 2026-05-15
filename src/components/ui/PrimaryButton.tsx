import React from "react";
import { ActivityIndicator, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import { HStack } from "@/components/ui/hstack";
import { palette } from "@/theme/tokens";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  variant?: "mint" | "blue" | "ghost";
  /** Optional accessibility label. Falls back to `label`. */
  accessibilityLabel?: string;
}

const GRADIENTS: Record<"mint" | "blue", [string, string]> = {
  mint: [palette.accent.mint, "#00C97E"],
  blue: [palette.accent.blue, "#0058D6"],
};

/**
 * High-contrast call-to-action with haptic feedback.
 *
 * Composed on gluestack's `Pressable` for built-in hover/focus/active state
 * tracking + a11y. Loupe-branded styling layered on top via Tailwind +
 * `LinearGradient` for the mint / blue variants.
 */
export function PrimaryButton({
  label,
  onPress,
  icon: Icon,
  loading = false,
  disabled = false,
  variant = "mint",
  accessibilityLabel,
}: PrimaryButtonProps) {
  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };

  const isGhost = variant === "ghost";
  const fg = isGhost ? palette.ink.default : variant === "mint" ? "#0B0B0D" : "#FFFFFF";

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      className="overflow-hidden rounded-2xl"
      style={({ pressed }) => ({
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      {isGhost ? (
        <HStack
          space="sm"
          className="items-center justify-center rounded-2xl border border-line bg-bg-elevated px-5 py-4"
        >
          {Icon ? <Icon size={18} color={fg} /> : null}
          <Text className="text-base font-medium text-ink">{label}</Text>
        </HStack>
      ) : (
        <LinearGradient
          colors={GRADIENTS[variant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 20,
            paddingVertical: 16,
            gap: 8,
          }}
        >
          {loading ? (
            <ActivityIndicator color={fg} />
          ) : (
            <>
              {Icon ? <Icon size={18} color={fg} /> : null}
              <Text className="text-base font-semibold" style={{ color: fg }}>
                {label}
              </Text>
            </>
          )}
        </LinearGradient>
      )}
    </Pressable>
  );
}
