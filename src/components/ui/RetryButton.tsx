/**
 * RetryButton — controlled retry affordance with exponential-backoff cooldown.
 *
 * Disables itself after a tap, walking the backoff sequence
 * 0 → 2 → 4 → 8 → 16 → 30 seconds. While disabled, the label updates
 * with the remaining countdown so users get clear feedback that another
 * tap won't help.
 */

import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { RefreshCcw } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/theme/tokens";

const BACKOFF_SECONDS = [0, 2, 4, 8, 16, 30] as const;

interface RetryButtonProps {
  onRetry: () => void;
  label?: string;
  /** Optional caller-controlled attempt count (defaults to internal). */
  attempts?: number;
  /** Disable entirely. */
  disabled?: boolean;
  compact?: boolean;
}

export function RetryButton({
  onRetry,
  label = "Try again",
  attempts,
  disabled,
  compact,
}: RetryButtonProps) {
  const p = useThemedPalette();
  const [internalAttempts, setInternalAttempts] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const effective = attempts ?? internalAttempts;

  const handlePress = () => {
    if (disabled || remaining > 0) return;
    Haptics.selectionAsync().catch(() => {});
    const nextIdx = Math.min(effective + 1, BACKOFF_SECONDS.length - 1);
    const wait = BACKOFF_SECONDS[nextIdx] ?? 0;
    setInternalAttempts((n) => n + 1);
    onRetry();
    if (wait > 0) {
      setRemaining(wait);
      timer.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            if (timer.current) clearInterval(timer.current);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
  };

  const isDisabled = !!disabled || remaining > 0;
  const text = remaining > 0 ? `Try again in ${remaining}s` : label;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: compact ? 10 : 14,
        paddingVertical: compact ? 6 : 9,
        borderRadius: 999,
        backgroundColor: withAlpha(p.accent.mint, isDisabled ? 0.06 : 0.15),
        borderWidth: 1,
        borderColor: withAlpha(p.accent.mint, isDisabled ? 0.15 : 0.45),
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <RefreshCcw
        size={compact ? 12 : 14}
        color={isDisabled ? p.ink.dim : p.accent.mint}
      />
      <Text
        style={{
          color: isDisabled ? p.ink.dim : p.accent.mint,
          fontSize: compact ? 11 : 12,
          fontWeight: "700",
          letterSpacing: 0.4,
        }}
      >
        {text}
      </Text>
    </Pressable>
  );
}
