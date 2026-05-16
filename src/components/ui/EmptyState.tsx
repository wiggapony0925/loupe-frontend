/**
 * EmptyState — companion to `ErrorState` for "no data" slots.
 *
 * Visually softer than an error: neutral palette, no retry by default.
 * A secondary action ("Scan a card", "Search to begin") nudges users
 * toward the next useful step.
 */

import React from "react";
import { Pressable, Text, View } from "react-native";
import { Inbox, type LucideIcon } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/theme/tokens";

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: LucideIcon;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
}

export function EmptyState({
  title,
  message,
  icon: Icon,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
}: EmptyStateProps) {
  const p = useThemedPalette();
  const Resolved = Icon ?? Inbox;
  return (
    <View
      accessibilityRole="summary"
      style={{
        alignItems: "center",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
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
          backgroundColor: withAlpha(p.ink.muted, 0.1),
          alignItems: "center",
          justifyContent: "center",
          marginBottom: compact ? 2 : 4,
        }}
      >
        <Resolved size={compact ? 18 : 22} color={p.ink.muted} />
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
      {onSecondaryAction && secondaryActionLabel ? (
        <Pressable
          onPress={onSecondaryAction}
          hitSlop={8}
          style={({ pressed }) => ({
            marginTop: 4,
            paddingHorizontal: compact ? 12 : 16,
            paddingVertical: compact ? 6 : 9,
            borderRadius: 999,
            backgroundColor: withAlpha(p.accent.mint, 0.15),
            borderWidth: 1,
            borderColor: withAlpha(p.accent.mint, 0.4),
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: p.accent.mint,
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
  );
}
