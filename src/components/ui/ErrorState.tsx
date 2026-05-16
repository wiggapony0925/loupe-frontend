/**
 * ErrorState — themed error scaffold for both inline and full-page slots.
 *
 * Picks a default icon from the `AppErrorCode` if none is provided. Pair
 * with `<RetryButton>` for the primary action; `secondaryActionLabel`
 * covers "Open Settings" / "Sign in" / etc. flows.
 */

import React from "react";
import { Pressable, Text, View } from "react-native";
import {
  AlertTriangle,
  Lock,
  SearchX,
  ServerCrash,
  ShieldOff,
  TimerReset,
  WifiOff,
  type LucideIcon,
} from "lucide-react-native";
import { RetryButton } from "@/components/ui/RetryButton";
import type { AppErrorCode } from "@/lib/errors";
import { useThemedPalette, withAlpha } from "@/theme/tokens";

interface ErrorStateProps {
  title: string;
  message?: string;
  icon?: LucideIcon;
  code?: AppErrorCode;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
}

function iconForCode(code: AppErrorCode | undefined): LucideIcon {
  switch (code) {
    case "offline":
      return WifiOff;
    case "timeout":
      return TimerReset;
    case "server":
      return ServerCrash;
    case "unauthorized":
      return Lock;
    case "forbidden":
      return ShieldOff;
    case "not_found":
      return SearchX;
    case "rate_limited":
      return TimerReset;
    default:
      return AlertTriangle;
  }
}

export function ErrorState({
  title,
  message,
  icon: Icon,
  code,
  onRetry,
  retryLabel,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
}: ErrorStateProps) {
  const p = useThemedPalette();
  const Resolved = Icon ?? iconForCode(code);
  const accent =
    code === "offline" || code === "timeout" ? p.accent.amber : p.accent.rose;

  return (
    <View
      accessibilityRole="alert"
      style={{
        alignItems: "center",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: withAlpha(accent, 0.35),
        backgroundColor: withAlpha(accent, 0.06),
        paddingHorizontal: compact ? 16 : 20,
        paddingVertical: compact ? 16 : 28,
        gap: compact ? 6 : 10,
      }}
    >
      <View
        style={{
          width: compact ? 36 : 48,
          height: compact ? 36 : 48,
          borderRadius: 999,
          backgroundColor: withAlpha(accent, 0.14),
          alignItems: "center",
          justifyContent: "center",
          marginBottom: compact ? 2 : 4,
        }}
      >
        <Resolved size={compact ? 18 : 22} color={accent} />
      </View>
      <Text
        style={{
          color: p.ink.default,
          fontSize: compact ? 13 : 15,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {message ? (
        <Text
          style={{
            color: p.ink.muted,
            fontSize: compact ? 11 : 12,
            textAlign: "center",
            maxWidth: 320,
          }}
        >
          {message}
        </Text>
      ) : null}
      {(onRetry || onSecondaryAction) ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          {onRetry ? (
            <RetryButton onRetry={onRetry} label={retryLabel} compact={compact} />
          ) : null}
          {onSecondaryAction && secondaryActionLabel ? (
            <Pressable
              onPress={onSecondaryAction}
              hitSlop={8}
              style={({ pressed }) => ({
                paddingHorizontal: compact ? 10 : 14,
                paddingVertical: compact ? 6 : 9,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: p.line.default,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  color: p.ink.default,
                  fontSize: compact ? 11 : 12,
                  fontWeight: "700",
                  letterSpacing: 0.4,
                }}
              >
                {secondaryActionLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
