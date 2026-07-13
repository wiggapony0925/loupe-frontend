/**
 * RailResultsSection — a carousel's "view more" expanded on the SEARCH page.
 *
 * Tapping "View more" on any discovery rail plants a removable filter tag on
 * the search screen and renders THIS: the shelf's full contents from
 * `/v1/public/carousels/rail` (the same recipe lens, run server-side over the
 * deep pool with true pagination), laid out as a two-column storefront grid
 * with a real match count and a load-more that walks every page. Card taps go
 * to the native card detail like everywhere else.
 */
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { PackageOpen } from "lucide-react-native";
import { useRailCardsPaged } from "@/application/queries/catalog/useRailCardsPaged";
import { CardTile } from "@/presentation/cards";
import { Skeleton } from "@/presentation/components/Skeleton";
import type { TcgKey } from "@/infrastructure/http";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const GAME_LABELS: Record<string, string> = {
  all: "All TCGs",
  pokemon: "Pokémon",
  magic: "Magic",
  yugioh: "Yu-Gi-Oh!",
  onepiece: "One Piece",
  digimon: "Digimon",
};

/** Screen padding (dp) the search ScrollView applies — drives column math. */
const PAGE_PADDING = 20;
const GRID_GAP = 12;

export function RailResultsSection({
  game,
  railId,
  fallbackTitle,
  onClear,
  onLoaded,
}: {
  game: TcgKey | "all";
  railId: string;
  /** Title passed by the opener — paints the header before the first page lands. */
  fallbackTitle?: string;
  onClear: () => void;
  /** Fires once the canonical rail copy is known (recents recording). */
  onLoaded?: (rail: { id: string; game: string; title: string }) => void;
}) {
  const p = useThemedPalette();
  const { width: screenW } = useWindowDimensions();
  const q = useRailCardsPaged({ game, railId });

  const first = q.data?.pages?.[0];
  const cards = (q.data?.pages ?? []).flatMap((pg) => pg.cards ?? []);
  const title = first?.title ?? fallbackTitle ?? "Shelf";
  const label = GAME_LABELS[game] ?? game;

  useEffect(() => {
    if (first?.title) onLoaded?.({ id: railId, game, title: first.title });
  }, [first?.title, railId, game, onLoaded]);

  const tileW = Math.floor((screenW - PAGE_PADDING * 2 - GRID_GAP) / 2);

  return (
    <View>
      {/* ── Shelf header ── */}
      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Shelf · {label}
        </Text>
        {q.isLoading ? (
          <ActivityIndicator size="small" color={p.accent.mint} />
        ) : null}
      </View>
      <View className="mt-1 flex-row items-baseline justify-between gap-2">
        <Text
          className="flex-1 text-2xl font-semibold tracking-tight text-ink"
          numberOfLines={2}
        >
          {title}
        </Text>
        <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button">
          <Text
            style={{ color: p.accent.mint, fontSize: 12, fontWeight: "800" }}
          >
            Clear
          </Text>
        </Pressable>
      </View>
      {first?.subtitle ? (
        <Text className="mt-1 text-xs text-ink-muted">{first.subtitle}</Text>
      ) : null}
      {first ? (
        <Text className="mt-2 text-xs font-semibold text-ink-muted">
          {first.total} {first.total === 1 ? "card" : "cards"} match this shelf
        </Text>
      ) : null}

      {/* ── States ── */}
      {q.isLoading ? (
        <View
          style={{
            marginTop: 14,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: GRID_GAP,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={tileW} height={tileW * 1.55} radius={12} />
          ))}
        </View>
      ) : q.isError || cards.length === 0 ? (
        // A 404 means the shelf expired (yesterday's AI design) — same copy
        // as genuinely-empty: the shelf has nothing to show anymore.
        <View className="items-center p-8">
          <PackageOpen size={28} color={p.ink.dim} />
          <Text className="mt-3 text-sm font-semibold text-ink">
            This shelf is empty
          </Text>
          <Text className="mt-1 text-center text-[11px] text-ink-muted">
            It may have rotated out — clear the filter to keep browsing.
          </Text>
        </View>
      ) : (
        <>
          <View
            style={{
              marginTop: 14,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: GRID_GAP,
              opacity: q.isFetching && !q.isFetchingNextPage ? 0.55 : 1,
            }}
          >
            {cards.map((card, i) => (
              <CardTile
                key={`${card.id}-${i}`}
                card={card}
                size="md"
                width={tileW}
                showPrice={first?.kind === "cards"}
                priority={i < 6 ? "normal" : "low"}
              />
            ))}
          </View>

          {q.hasNextPage ? (
            <Pressable
              onPress={() => void q.fetchNextPage()}
              disabled={q.isFetchingNextPage}
              accessibilityRole="button"
              accessibilityLabel={
                first?.total != null
                  ? `Load more cards. ${first.total - cards.length} more available.`
                  : "Load more cards"
              }
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 14,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: withAlpha(p.accent.mint, 0.3),
                backgroundColor: withAlpha(p.accent.mint, pressed ? 0.12 : 0.06),
                opacity: q.isFetchingNextPage ? 0.7 : 1,
              })}
            >
              {q.isFetchingNextPage ? (
                <ActivityIndicator size="small" color={p.accent.mint} />
              ) : (
                <Text
                  style={{ color: p.accent.mint, fontSize: 13, fontWeight: "800" }}
                >
                  Load more · {Math.max((first?.total ?? 0) - cards.length, 0)} left
                </Text>
              )}
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}
