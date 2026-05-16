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
import { PriceText } from "@/components/ui/PriceText";
import { TrendPill } from "@/components/ui/TrendPill";
import { pickCardBlurhash, pickCardImageUrl } from "@/lib/cardImage";
import { routes } from "@/lib/routes";
import type { CardWire, CardTileSize, TrendInfo } from "./types";

export interface CardTileProps {
  card: CardWire;
  size?: CardTileSize;
  showName?: boolean;
  showSet?: boolean;
  showPrice?: boolean;
  trend?: TrendInfo | null;
  onPress?: () => void;
  priority?: "low" | "normal" | "high";
  /** Optional outer style override (e.g. width override inside a wrap grid). */
  style?: ViewStyle;
  /** Override tile width (dp). When omitted, the tile fills its parent container (fluid mode). */
  width?: number;
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
  width,
}: CardTileProps) {
  const showSetResolved = showSet ?? size !== "sm";
  const price = card.pricing_summary?.market?.amount ?? null;
  const small = pickCardImageUrl(card, "small");
  const normal = pickCardImageUrl(card, "normal");

  // Two modes:
  //   • Fixed:  caller passed a numeric `width` — tile uses exact pixel
  //             dimensions, image is `width × width*7/5`.
  //   • Fluid:  no width passed — tile fills its parent column and the
  //             image uses `width:"100%"` + 5/7 aspect ratio. This is
  //             what every grid layout (e.g. trending, search results)
  //             actually wants and is what the skeleton was built for;
  //             going fluid is what makes the rendered grid line up
  //             with `SkeletonTrendingGrid` cell-for-cell.
  const fluid = width === undefined;
  const tileWidth = fluid ? undefined : Math.round(width!);
  const tileHeight = fluid ? undefined : Math.round((tileWidth as number) * (7 / 5));

  // Reserve consistent vertical space for the text rows so every tile
  // in a wrap-row resolves to the same height. Without this, a card
  // missing a set/year would be shorter than its neighbor and the next
  // wrap-row would visually misalign (the bug visible in the trending
  // grid screenshot). Heights match the skeleton primitive (12 / 10).
  const NAME_HEIGHT = 16;
  const SUBTITLE_HEIGHT = 14;
  const PRICE_ROW_HEIGHT = 18;

  const handlePress = useCallback(() => {
    if (onPress) return onPress();
    router.push(routes.card(card.id));
  }, [onPress, card.id]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={card.name}
      style={({ pressed }) => [
        fluid
          ? { width: "100%", opacity: pressed ? 0.85 : 1, gap: 6 }
          : { width: tileWidth, opacity: pressed ? 0.85 : 1, gap: 6 },
        style,
      ]}
    >
      <CardImage
        uri={small ?? normal}
        fallbackUri={small && normal && small !== normal ? normal : undefined}
        blurhash={pickCardBlurhash(card)}
        width={fluid ? "100%" : tileWidth}
        height={fluid ? undefined : tileHeight}
        aspectRatio={5 / 7}
        rounded={12}
        priority={priority}
        recyclingKey={card.id}
        alt={card.name}
      />
      {showName ? (
        <Text
          numberOfLines={1}
          style={{ height: NAME_HEIGHT, lineHeight: NAME_HEIGHT }}
          className="text-[12px] font-semibold text-ink"
        >
          {card.name}
        </Text>
      ) : null}
      {showSetResolved ? (
        <Text
          numberOfLines={1}
          style={{ height: SUBTITLE_HEIGHT, lineHeight: SUBTITLE_HEIGHT }}
          className="text-[10px] text-ink-muted"
        >
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
            height: PRICE_ROW_HEIGHT,
          }}
        >
          {showPrice ? <PriceText amount={price} /> : <View />}
          {trend ? <TrendPill trend={trend} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export const CardTile = memo(CardTileImpl);
