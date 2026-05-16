/**
 * CardTile — compact, memoized card tile used inside grids and rails.
 *
 * Wraps `CardImage` (5:7 aspect, blurhash placeholder, automatic fallback)
 * with consistent typography (name + set·year subtitle), an optional price,
 * and an optional trend pill. Tap routes to `/card/[id]` unless `onPress`
 * overrides.
 */
import React, { memo, useCallback } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import { router } from "expo-router";
import { CardImage } from "@/components/ui/CardImage";
import { pickCardBlurhash, pickCardImageUrl } from "@/lib/cardImage";
import { compactUsd } from "@/lib/format";
import { useThemedPalette, withAlpha } from "@/theme/tokens";
import type { CardWire, CardTileSize, TrendInfo } from "./types";
import { TILE_WIDTH } from "./types";

export interface CardTileProps {
  card: CardWire;
  size?: CardTileSize;
  showName?: boolean;
  showSet?: boolean;
  showPrice?: boolean;
  trend?: TrendInfo | null;
  onPress?: () => void;
  priority?: "low" | "normal" | "high";
  /** Optional outer style override (e.g. width: "47%" inside a wrap grid). */
  style?: ViewStyle;
}

function CardTileImpl({
  card,
  size = "md",
  showName = true,
  showSet,
  showPrice = false,
  trend = null,
  onPress,
  priority = "normal",
  style,
}: CardTileProps) {
  const p = useThemedPalette();
  const showSetResolved = showSet ?? size !== "sm";
  const price = card.pricing_summary?.market?.amount ?? null;
  const small = pickCardImageUrl(card, "small");
  const normal = pickCardImageUrl(card, "normal");

  const handlePress = useCallback(() => {
    if (onPress) return onPress();
    router.push(`/card/${encodeURIComponent(card.id)}`);
  }, [onPress, card.id]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={card.name}
      style={({ pressed }) => [
        { width: TILE_WIDTH[size], opacity: pressed ? 0.85 : 1, gap: 6 },
        style,
      ]}
    >
      <View style={{ width: "100%", aspectRatio: 5 / 7 }}>
        <CardImage
          // Tiles are small (≤160dp wide) — always use the `small` variant.
          // Pokemon normal (`*_hires.png`) is ~900KB vs ~165KB for small;
          // Scryfall/YGO have similar ~5× size deltas. Loading `normal`
          // here was the dominant cause of "images load slowly" complaints.
          // Fall back to `normal` only if small is missing or fails.
          uri={small ?? normal}
          fallbackUri={small && normal && small !== normal ? normal : undefined}
          blurhash={pickCardBlurhash(card)}
          rounded={12}
          priority={priority}
          recyclingKey={card.id}
          alt={card.name}
          aspectRatio={undefined as unknown as number}
        />
      </View>
      {showName ? (
        <Text numberOfLines={2} className="text-[12px] font-semibold text-ink">
          {card.name}
        </Text>
      ) : null}
      {showSetResolved ? (
        <Text numberOfLines={1} className="text-[10px] text-ink-muted">
          {[card.set_name, card.year].filter(Boolean).join(" · ") || "—"}
        </Text>
      ) : null}
      {showPrice || trend ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
          }}
        >
          {showPrice && price !== null ? (
            <Text
              style={{ color: p.accent.mint, fontSize: 11, fontWeight: "700" }}
              numberOfLines={1}
            >
              {compactUsd(price)}
            </Text>
          ) : (
            <View />
          )}
          {trend ? <TrendPill trend={trend} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function TrendPill({ trend }: { trend: TrendInfo }) {
  const p = useThemedPalette();
  const up = trend.pct >= 0;
  const tint = up ? p.accent.mint : p.accent.rose;
  return (
    <View
      style={{
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        backgroundColor: withAlpha(tint, 0.16),
      }}
    >
      <Text style={{ color: tint, fontSize: 9, fontWeight: "800" }}>
        {up ? "▲" : "▼"} {Math.abs(trend.pct).toFixed(2)}%
      </Text>
    </View>
  );
}

export const CardTile = memo(CardTileImpl);
