/**
 * SearchResultRow — rich row used in the live search rail.
 *
 * 56×80 card thumbnail with blurhash placeholder, name + set / number /
 * year line, TCG badge, rarity, and a right-aligned market price.
 * Tap-to-navigate routes to the card detail page (`/card/[id]`).
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { routes } from "@/shared/routes";
import type { CardSearchResult } from "@/infrastructure/http";
import { CardImage } from "@/presentation/components/CardImage";
import { Price } from "@/presentation/components/Price";
import { pickCardBlurhash, pickCardImageUrl } from "@/shared/cardImage";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

interface SearchResultRowProps {
  card: CardSearchResult;
  bordered?: boolean;
  /** Priority hint for expo-image — off-screen rows should pass "low". */
  priority?: "low" | "normal" | "high";
  /** Fires *before* navigation so callers can persist analytics / recents. */
  onPressCapture?: () => void;
  /** Override the default `/card/[id]` destination (used by sealed). */
  route?: Href;
  /** Override the upper-left chip label (defaults to TCG). */
  badgeText?: string;
  /** Override the right-column eyebrow (defaults to "MARKET"). */
  priceLabel?: string;
}

export function SearchResultRow({
  card,
  bordered = false,
  priority = "low",
  onPressCapture,
  route,
  badgeText,
  priceLabel = "MARKET",
}: SearchResultRowProps) {
  const p = useThemedPalette();
  const market = card.pricing_summary?.market?.amount ?? null;
  const small = pickCardImageUrl(card, "small");
  const normal = pickCardImageUrl(card, "normal");
  return (
    <Pressable
      onPress={() => {
        onPressCapture?.();
        router.push(route ?? routes.card(card.id));
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className={`flex-row items-center gap-3 px-4 py-3 ${bordered ? "border-t border-line/60" : ""}`}
    >
      <CardImage
        uri={small ?? normal}
        fallbackUri={small && normal && small !== normal ? normal : undefined}
        blurhash={pickCardBlurhash(card)}
        width={56}
        height={80}
        rounded={8}
        priority={priority}
        recyclingKey={card.id}
        alt={card.name}
      />

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
              {(badgeText ?? card.tcg).toUpperCase()}
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
          {priceLabel}
        </Text>
      </View>
    </Pressable>
  );
}
