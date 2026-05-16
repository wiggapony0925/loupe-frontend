/**
 * SearchResultRow — rich row used in the live search rail.
 *
 * 56×80 card thumbnail with blurhash placeholder, name + set / number /
 * year line, TCG badge, rarity, and a right-aligned market price.
 * Tap-to-navigate routes to the card detail page (`/card/[id]`).
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import type { CardSearchResult } from "@/api/types";
import { Price } from "@/components/ui/Price";
import { useThemedPalette, withAlpha } from "@/theme/tokens";

interface SearchResultRowProps {
  card: CardSearchResult;
  bordered?: boolean;
}

const BLURHASH = "L6Pj0^jE.AyE_3t7t7R**0o#DgR4";

export function SearchResultRow({ card, bordered = false }: SearchResultRowProps) {
  const p = useThemedPalette();
  const market = card.pricing_summary?.market?.amount ?? null;
  const imageUrl =
    card.images?.small?.url ?? card.images?.normal?.url ?? card.image_url ?? null;
  return (
    <Pressable
      onPress={() => router.push(`/card/${encodeURIComponent(card.id)}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className={`flex-row items-center gap-3 px-4 py-3 ${bordered ? "border-t border-line/60" : ""}`}
    >
      <View
        className="overflow-hidden rounded-lg"
        style={{ width: 56, height: 80, backgroundColor: p.bg.sunken }}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            placeholder={{ blurhash: BLURHASH }}
            transition={150}
            contentFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} className="text-sm font-semibold text-ink">
          {card.name}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 text-[11px] text-ink-muted">
          {[card.set_name, card.number, card.year].filter(Boolean).join(" · ") || "—"}
        </Text>
        <View className="mt-1 flex-row items-center gap-1.5">
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: withAlpha(p.accent.mint, 0.14),
            }}
          >
            <Text
              style={{
                color: p.accent.mint,
                fontSize: 9,
                fontWeight: "800",
                letterSpacing: 0.8,
              }}
            >
              {card.tcg.toUpperCase()}
            </Text>
          </View>
          {card.rarity ? (
            <Text className="text-[10px] text-ink-muted" numberOfLines={1}>
              {card.rarity}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ minWidth: 72, alignItems: "flex-end" }}>
        {market !== null ? (
          <Price
            usd={market}
            className="text-sm font-semibold text-ink"
            numberOfLines={1}
          />
        ) : (
          <Text className="text-sm font-semibold text-ink-muted">—</Text>
        )}
        <Text
          style={{
            color: p.ink.dim,
            fontSize: 9,
            fontWeight: "700",
            letterSpacing: 1,
            marginTop: 2,
          }}
        >
          MARKET
        </Text>
      </View>
    </Pressable>
  );
}
