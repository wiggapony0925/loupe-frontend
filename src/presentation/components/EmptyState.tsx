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
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: LucideIcon;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
}

/**
 * Background + border come from NativeWind classes (CSS variables) so the
 * card stays in sync with the active theme even if a parent hasn't yet
 * re-rendered the imperative `palette` snapshot. Inline `palette.*` reads
 * here previously rendered the dark surface on top of a light page when
 * the theme switched mid-render.
 */
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
      className="items-center rounded-2xl border border-line bg-bg-elevated"
      style={{
        paddingHorizontal: compact ? 16 : 20,
        paddingVertical: compact ? 16 : 28,
        gap: compact ? 6 : 10,
      }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: compact ? 36 : 48,
          height: compact ? 36 : 48,
          backgroundColor: withAlpha(p.ink.muted, 0.1),
          marginBottom: compact ? 2 : 4,
        }}
      >
        <Resolved size={compact ? 18 : 22} color={p.ink.muted} />
      </View>
      <Text
        className="text-center font-bold text-ink"
        style={{ fontSize: compact ? 13 : 15 }}
      >
        {title}
      </Text>
      {message ? (
        <Text
          className="text-center text-ink-muted"
          style={{ fontSize: compact ? 11 : 12, maxWidth: 320 }}
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
