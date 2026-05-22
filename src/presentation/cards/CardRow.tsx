/**
 * CardRow — horizontal list row with a 44×60 thumbnail, title + subtitle,
 * and an optional right-aligned slot (defaults to market price).
 */
import React, { memo, useCallback, type ReactNode } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { routes } from "@/shared/routes";
import { CardImage } from "@/presentation/components/CardImage";
import { usePressScale } from "@/presentation/components/usePressScale";
import { pickCardBlurhash, pickCardImageUrl } from "@/shared/cardImage";
import { useCompactUsd } from "@/shared/format";
import { useThemedPalette } from "@/presentation/theme/tokens";
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
  const compactUsd = useCompactUsd();
  const price = card.pricing_summary?.market?.amount ?? null;
  const small = pickCardImageUrl(card, "small");
  const normal = pickCardImageUrl(card, "normal");

  const handlePress = useCallback(() => {
    if (onPress) return onPress();
    router.push(routes.card(card.id));
  }, [onPress, card.id]);

  const resolvedSubtitle =
    subtitle ?? [card.set_name, card.number, card.year].filter(Boolean).join(" · ") ?? "—";

  // Robinhood-style press feedback — the whole row pulses to 0.97 on
  // touch and springs back on release. Native-driver spring stays
  // smooth while the surrounding list is scrolling.
  const { scale, onPressIn, onPressOut } = usePressScale();

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={card.name}
    >
      <Animated.View
        style={{ transform: [{ scale }] }}
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
            style={{
              color: price !== null ? p.ink.default : p.ink.muted,
              fontVariant: ["tabular-nums"],
            }}
          >
            {price !== null ? compactUsd(price) : "—"}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export const CardRow = memo(CardRowImpl);
