/**
 * CarouselRail — renders the backend-owned marketplace carousels on mobile,
 * the mobile counterpart to the web `MarketplaceRail`. The backend
 * (`/v1/public/carousels`) is the single source of truth for WHICH shelves
 * exist and their filters; each client just compiles a recipe into a card rail.
 *
 * Compilation mirrors the web `recipeToRailSpec` + `cardFilters`:
 *   1. fetch the priced shelf via `/v1/cards/trending`
 *      (`source` → trending/value feed, `priceMax` as a coarse server hint),
 *   2. apply a client-side "lens" — price band, rarity pattern, sort, limit,
 *   3. self-hide when the slice is thinner than `minItems` (so a data-poor
 *      game or an over-narrow band never shows an empty rail).
 */
import React, { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { useTrendingCards } from "@/application/queries/catalog/useTrendingCards";
import { useCarousels } from "@/application/queries/catalog/useCarousels";
import { CardHorizontalRail } from "@/presentation/cards";
import { Skeleton } from "@/presentation/components/Skeleton";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import type { CarouselRecipeWire, TcgKey } from "@/infrastructure/http";
import { applyRecipeLens } from "./carouselLens";

function RailSkeleton({ edgeBleed }: { edgeBleed: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={edgeBleed > 0 ? { marginHorizontal: -edgeBleed } : undefined}
      contentContainerStyle={{
        gap: 12,
        paddingLeft: edgeBleed > 0 ? edgeBleed : 0,
        paddingRight: edgeBleed > 0 ? edgeBleed : 4,
      }}
    >
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 120 }}>
          <Skeleton width={120} height={168} radius={12} />
        </View>
      ))}
    </ScrollView>
  );
}

/** One backend recipe compiled into a titled, priced card rail. */
export function GameCarouselRail({
  recipe,
  tcg,
  label,
  edgeBleed = 20,
}: {
  recipe: CarouselRecipeWire;
  tcg: TcgKey;
  label: string;
  edgeBleed?: number;
}) {
  const sort = recipe.source === "trending" ? "trending" : "value";
  const q = useTrendingCards({
    tcg,
    sort,
    maxPrice: recipe.priceMax ?? undefined,
    limit: 24,
  });

  const cards = useMemo(
    () => applyRecipeLens(q.data?.cards ?? [], recipe),
    [q.data, recipe],
  );

  const minItems = recipe.minItems ?? 4;
  // Self-hide a thin rail once it has loaded (matches the web engine).
  if (!q.isLoading && cards.length < minItems) return null;

  return (
    <View style={{ gap: 8 }}>
      <SectionHeader eyebrow={label} title={recipe.title} />
      {q.isLoading ? (
        <RailSkeleton edgeBleed={edgeBleed} />
      ) : (
        <CardHorizontalRail
          cards={cards}
          tileSize="md"
          showPrice
          edgeBleed={edgeBleed}
        />
      )}
    </View>
  );
}

/**
 * The full backend-owned carousel set for a game — fetches the pool and
 * renders each recipe as a `GameCarouselRail`. Renders nothing for games with
 * no priced pool (catalog-only games return `[]`), so the discover surface
 * falls back to its Trending + Sealed anchors.
 */
export function CarouselRails({
  tcg,
  label,
  edgeBleed = 20,
  max = 6,
}: {
  tcg: TcgKey;
  label: string;
  edgeBleed?: number;
  /** Cap the number of rails so the surface stays light on mobile. */
  max?: number;
}) {
  const q = useCarousels(tcg);
  const recipes = (q.data?.carousels ?? []).slice(0, max);
  if (recipes.length === 0) return null;
  return (
    <>
      {recipes.map((r) => (
        <GameCarouselRail
          key={r.id}
          recipe={r}
          tcg={tcg}
          label={label}
          edgeBleed={edgeBleed}
        />
      ))}
    </>
  );
}
