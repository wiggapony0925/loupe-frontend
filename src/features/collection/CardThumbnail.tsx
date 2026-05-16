import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { routes } from "@/lib/routes";
import type { CollectionCard } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { CardImage } from "@/components/ui/CardImage";
import { Price } from "@/components/ui/Price";
import { gradeColor, useThemedPalette, withAlpha } from "@/theme/tokens";

interface CardThumbnailProps {
  card: CollectionCard;
}

// Reserved heights so every tile in the grid is identical regardless of
// title length. Tuned for the 13/14px font sizes used below.
const TITLE_LINE_HEIGHT = 18;
const TITLE_LINES = 2;
const META_LINE_HEIGHT = 16;

export function CardThumbnail({ card }: CardThumbnailProps) {
  const p = useThemedPalette();
  const tint = gradeColor(card.grade);
  return (
    <Pressable
      onPress={() => router.push(routes.scan(card.id))}
      className="flex-1 overflow-hidden rounded-2xl border border-line bg-bg-elevated"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View className="aspect-[5/7] w-full bg-bg-sunken">
        <CardImage
          uri={card.thumbnailUri}
          width="100%"
          height="100%"
          rounded={0}
          priority="low"
          recyclingKey={card.id}
          alt={card.title}
        />
        <View className="absolute right-2 top-2">
          <View
            className="rounded-md px-2 py-1"
            style={{
              backgroundColor: withAlpha(p.bg.elevated, 0.92),
              borderWidth: 1,
              borderColor: withAlpha(tint, 0.55),
            }}
          >
            <Text className="text-xs font-bold" style={{ color: tint }}>
              {card.grade.toFixed(1)}
            </Text>
          </View>
        </View>
      </View>

      {/* Fixed-height meta block — every tile matches in size. */}
      <View className="p-3">
        <View className="self-start">
          <Badge label={card.set} tone="neutral" />
        </View>

        <Text
          numberOfLines={TITLE_LINES}
          className="mt-2 text-sm font-semibold text-ink"
          style={{
            lineHeight: TITLE_LINE_HEIGHT,
            minHeight: TITLE_LINE_HEIGHT * TITLE_LINES,
          }}
        >
          {card.title}
        </Text>

        <View
          className="mt-1 flex-row items-baseline justify-between"
          style={{ minHeight: META_LINE_HEIGHT }}
        >
          <Price
            usd={card.estimatedValueUsd}
            numberOfLines={1}
            className="text-sm font-semibold text-ink"
            style={{ lineHeight: META_LINE_HEIGHT }}
          />
          <Text
            numberOfLines={1}
            className="text-[11px] text-ink-dim"
            style={{ lineHeight: META_LINE_HEIGHT }}
          >
            {card.year}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

