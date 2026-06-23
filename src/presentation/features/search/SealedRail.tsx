/**
 * SealedRail — horizontal discovery carousel of sealed products (booster
 * boxes, ETBs, tins…). Mirrors the trending-cards rail so the Discover band
 * keeps one visual rhythm. Tapping a tile routes to /sealed/add with the
 * product pre-selected (the same target the search results use), so the user
 * is one tap from saving it to the vault.
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { CardImage } from "@/presentation/components/CardImage";
import { routes } from "@/shared/routes";
import { useThemedPalette } from "@/presentation/theme/tokens";
import type { SealedProductWire } from "@/infrastructure/http";

const TILE_W = 132;
const IMG_H = 150;

export function SealedRail({ products }: { products: SealedProductWire[] }) {
  const p = useThemedPalette();
  if (products.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -20 }}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingTop: 14 }}
    >
      {products.slice(0, 16).map((s) => (
        <Pressable
          key={s.id}
          onPress={() => router.push(routes.sealedAdd(s.id))}
          style={({ pressed }) => ({ width: TILE_W, opacity: pressed ? 0.85 : 1 })}
          accessibilityRole="button"
          accessibilityLabel={`${s.name}. Sealed product. Add to collection.`}
        >
          <View
            style={{
              width: TILE_W,
              height: IMG_H,
              borderRadius: 14,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: p.line.default,
              backgroundColor: p.bg.elevated,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CardImage
              uri={s.image_url}
              width={TILE_W - 8}
              height={IMG_H - 8}
              rounded={10}
              contentFit="contain"
              alt={s.name}
            />
          </View>
          <Text
            numberOfLines={2}
            style={{
              color: p.ink.default,
              fontSize: 12,
              fontWeight: "600",
              marginTop: 6,
              lineHeight: 15,
            }}
          >
            {s.name}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: p.ink.dim, fontSize: 11, marginTop: 2 }}
          >
            {s.set_name ?? "Sealed"}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
