/**
 * SearchResultRow — the one row style for live search results.
 *
 * Flat, Robinhood-style: no card containers, just a roomy 64×90 thumbnail,
 * a two-line identity block (name · set/number/year), a per-game tinted
 * badge, and a right-aligned market price. Parents separate rows with
 * hairlines; the row itself stays transparent so the list reads as one
 * continuous surface instead of stacked white blocks.
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { routes } from "@/shared/routes";
import type { CardSearchResult } from "@/infrastructure/http";
import { CardImage } from "@/presentation/components/CardImage";
import { Price } from "@/presentation/components/Price";
import { pickCardBlurhash, pickCardImageUrl } from "@/shared/cardImage";
import { useThemedPalette, withAlpha, type Palette } from "@/presentation/theme/tokens";

/** Brand tint per game so the badge (and only the badge) carries the TCG. */
function tcgTint(tcg: string, p: Palette): string {
  switch (tcg) {
    case "pokemon":
      return p.accent.amber;
    case "magic":
      return p.accent.blue;
    case "yugioh":
      return p.accent.purple;
    default:
      return p.accent.mint;
  }
}

function tcgLabel(tcg: string): string {
  switch (tcg) {
    case "pokemon":
      return "Pokémon";
    case "magic":
      return "Magic";
    case "yugioh":
      return "Yu-Gi-Oh!";
    default:
      return tcg.toUpperCase();
  }
}

interface SearchResultRowProps {
  card: CardSearchResult;
  bordered?: boolean;
  /** Priority hint for expo-image — off-screen rows should pass "low". */
  priority?: "low" | "normal" | "high";
  /** Fires *before* navigation so callers can persist analytics / recents. */
  onPressCapture?: () => void;
  /** Override the default `/card/[id]` destination (used by sealed). */
  route?: Href;
  /** Override the badge label (defaults to the TCG name). */
  badgeText?: string;
  /** Override the right-column eyebrow (defaults to "Market"). */
  priceLabel?: string;
}

export function SearchResultRow({
  card,
  bordered = false,
  priority = "low",
  onPressCapture,
  route,
  badgeText,
  priceLabel = "Market",
}: SearchResultRowProps) {
  const p = useThemedPalette();
  const market = card.pricing_summary?.market?.amount ?? null;
  const small = pickCardImageUrl(card, "small");
  const normal = pickCardImageUrl(card, "normal");
  const tint = tcgTint(card.tcg, p);
  const meta = [card.set_name, card.number ? `#${card.number}` : null, card.year]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={() => {
        onPressCapture?.();
        router.push(route ?? routes.card(card.id));
      }}
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, ${meta || card.tcg}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderTopWidth: bordered ? 1 : 0,
        borderTopColor: withAlpha(p.line.default, 0.6),
        backgroundColor: pressed ? p.bg.elevated : "transparent",
        borderRadius: pressed ? 12 : 0,
      })}
    >
      <View
        style={{
          width: 64,
          height: 90,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: p.bg.sunken,
        }}
      >
        <CardImage
          uri={small ?? normal}
          fallbackUri={small && normal && small !== normal ? normal : undefined}
          blurhash={pickCardBlurhash(card)}
          width={64}
          height={90}
          rounded={0}
          contentFit="cover"
          priority={priority}
          recyclingKey={card.id}
          alt={card.name}
        />
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <Text
          numberOfLines={1}
          style={{
            color: p.ink.default,
            fontSize: 15,
            fontWeight: "700",
            letterSpacing: -0.2,
          }}
        >
          {card.name}
        </Text>
        {meta ? (
          <Text numberOfLines={1} style={{ color: p.ink.muted, fontSize: 12 }}>
            {meta}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 7,
              paddingVertical: 2.5,
              borderRadius: 999,
              backgroundColor: withAlpha(tint, 0.12),
            }}
          >
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: tint }} />
            <Text
              style={{
                color: tint,
                fontSize: 9.5,
                fontWeight: "800",
                letterSpacing: 0.4,
              }}
            >
              {badgeText ?? tcgLabel(card.tcg)}
            </Text>
          </View>
          {card.rarity ? (
            <Text
              numberOfLines={1}
              style={{ flexShrink: 1, color: p.ink.dim, fontSize: 10.5, fontWeight: "600" }}
            >
              {card.rarity}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ alignItems: "flex-end", gap: 2, minWidth: 74 }}>
        {market !== null ? (
          <Price
            usd={market}
            numberOfLines={1}
            style={{
              color: p.ink.default,
              fontSize: 15,
              fontWeight: "800",
              letterSpacing: -0.3,
            }}
          />
        ) : (
          <Text style={{ color: p.ink.dim, fontSize: 15, fontWeight: "700" }}>—</Text>
        )}
        <Text
          style={{
            color: p.ink.dim,
            fontSize: 9,
            fontWeight: "700",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {priceLabel}
        </Text>
      </View>

      <ChevronRight size={15} color={withAlpha(p.ink.dim, 0.7)} />
    </Pressable>
  );
}
