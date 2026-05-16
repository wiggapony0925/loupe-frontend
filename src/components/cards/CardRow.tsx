/**
 * CardRow — horizontal list row with a 44×60 thumbnail, title + subtitle,
 * and an optional right-aligned slot (defaults to market price).
 */
import React, { memo, useCallback, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { CardImage } from "@/components/ui/CardImage";
import { pickCardBlurhash, pickCardImageUrl } from "@/lib/cardImage";
import { compactUsd } from "@/lib/format";
import { useThemedPalette } from "@/theme/tokens";
import type { CardWire } from "./types";

export interface CardRowProps {
  card: CardWire;
  rightSlot?: ReactNode;
  subtitle?: string;
  onPress?: () => void;
  bordered?: boolean;
}

function CardRowImpl({
  card,
  rightSlot,
  subtitle,
  onPress,
  bordered = false,
}: CardRowProps) {
  const p = useThemedPalette();
  const price = card.pricing_summary?.market?.amount ?? null;
  const small = pickCardImageUrl(card, "small");
  const normal = pickCardImageUrl(card, "normal");

  const handlePress = useCallback(() => {
    if (onPress) return onPress();
    router.push(`/card/${encodeURIComponent(card.id)}`);
  }, [onPress, card.id]);

  const resolvedSubtitle =
    subtitle ?? [card.set_name, card.number, card.year].filter(Boolean).join(" · ") ?? "—";

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={card.name}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className={`flex-row items-center gap-3 px-4 py-3 ${
        bordered ? "border-t border-line/60" : ""
      }`}
    >
      <CardImage
        uri={small ?? normal}
        fallbackUri={small && normal && small !== normal ? normal : undefined}
        blurhash={pickCardBlurhash(card)}
        width={44}
        height={60}
        rounded={8}
        priority="low"
        recyclingKey={card.id}
        alt={card.name}
      />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} className="text-sm font-semibold text-ink">
          {card.name}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 text-[11px] text-ink-muted">
          {resolvedSubtitle || "—"}
        </Text>
      </View>
      {rightSlot ?? (
        <Text
          className="text-sm font-semibold"
          style={{ color: price !== null ? p.ink.default : p.ink.muted }}
        >
          {price !== null ? compactUsd(price) : "—"}
        </Text>
      )}
    </Pressable>
  );
}

export const CardRow = memo(CardRowImpl);
