/**
 * ResolvedCarousels — renders a game's backend-resolved discovery carousels,
 * the mobile counterpart to the web marketplace rails. The backend
 * (`/v1/public/carousels/resolved`) is the single source of truth: it decides
 * WHICH rails exist AND fills them with cards (trending anchor + recipe rails +
 * explore), dropping any rail too thin to show. So this component does no
 * filtering — it just paints `rails[].cards`, guaranteeing mobile shows the
 * exact same carousels as web.
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useResolvedCarousels } from "@/application/queries/catalog/useResolvedCarousels";
import { CardHorizontalRail } from "@/presentation/cards";
import { Skeleton } from "@/presentation/components/Skeleton";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import type { ResolvedRailWire, TcgKey } from "@/infrastructure/http";
import { useThemedPalette } from "@/presentation/theme/tokens";

const GAME_LABELS: Partial<Record<TcgKey, string>> = {
  pokemon: "Pokémon",
  magic: "Magic",
  yugioh: "Yu-Gi-Oh!",
  onepiece: "One Piece",
  digimon: "Digimon",
};

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

/**
 * The full backend-resolved carousel set for one game — trending anchor +
 * recipe rails + explore, each already filled with cards. Renders nothing for
 * games with no rails (catalog-only games with an empty priced pool still get
 * an explore rail from the backend).
 */
export function ResolvedCarousels({
  tcg,
  edgeBleed = 20,
  onViewMore,
}: {
  tcg: TcgKey;
  edgeBleed?: number;
  /**
   * "View more" on a rail — the search page opens its rail-filter tag with
   * the shelf's FULL paginated contents. Omitted → no affordance rendered.
   */
  onViewMore?: (rail: ResolvedRailWire) => void;
}) {
  const p = useThemedPalette();
  const q = useResolvedCarousels(tcg);
  const eyebrow = GAME_LABELS[tcg] ?? tcg;

  if (q.isLoading) {
    return (
      <View style={{ gap: 8 }}>
        <SectionHeader eyebrow={eyebrow} title="Loading marketplace…" />
        <RailSkeleton edgeBleed={edgeBleed} />
      </View>
    );
  }

  const rails = q.data?.rails ?? [];
  if (rails.length === 0) return null;

  return (
    <>
      {rails.map((rail) => (
        <View key={rail.id} style={{ gap: 8 }}>
          <SectionHeader
            eyebrow={eyebrow}
            title={rail.title}
            trailing={
              onViewMore ? (
                <Pressable
                  onPress={() => onViewMore(rail)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`View every card on ${rail.title}`}
                  className="flex-row items-center gap-1"
                >
                  <Text className="text-xs font-medium text-ink-muted">
                    View more
                  </Text>
                  <ChevronRight size={14} color={p.ink.dim} />
                </Pressable>
              ) : undefined
            }
          />
          <CardHorizontalRail
            cards={rail.cards}
            tileSize="md"
            showPrice={rail.kind === "cards"}
            edgeBleed={edgeBleed}
          />
        </View>
      ))}
    </>
  );
}
