import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import type { CollectionCard } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { gradeColor, useThemedPalette, withAlpha } from "@/theme/tokens";

interface CardThumbnailProps {
  card: CollectionCard;
}

export function CardThumbnail({ card }: CardThumbnailProps) {
  const p = useThemedPalette();
  const tint = gradeColor(card.grade);
  return (
    <Pressable
      onPress={() => router.push(`/scan/${card.id}`)}
      className="overflow-hidden rounded-2xl border border-line bg-bg-elevated"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View className="aspect-[5/7] w-full bg-bg-sunken">
        <Image
          source={{ uri: card.thumbnailUri }}
          resizeMode="cover"
          style={{ width: "100%", height: "100%" }}
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
      <View className="gap-1.5 p-3">
        <Badge label={card.set} tone="neutral" />
        <Text numberOfLines={1} className="text-sm font-semibold text-ink">
          {card.title}
        </Text>
        <Text className="text-xs text-ink-muted">
          ${card.estimatedValueUsd.toLocaleString()} · {card.year}
        </Text>
      </View>
    </Pressable>
  );
}
