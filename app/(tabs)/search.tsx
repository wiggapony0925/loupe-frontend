/**
 * Search — Collectr-style universal browse for the collection.
 *
 * Layout:
 *   • Sticky search input + filter chips (All · Graded · Ungraded · Vintage)
 *   • Quick-filter category tiles (Pokemon, Magic, Yu-Gi-Oh, Sports, etc.)
 *     Tapping a tile sets the active category and scrolls to results.
 *   • Live search rail — filtered card list with mini sparklines.
 *   • Recent searches (in-memory, last 6).
 */
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Camera, ChevronRight, Clock, Search as SearchIcon, X } from "lucide-react-native";
import { queryKeys } from "@/application/queries/queryKeys";
import { routes } from "@/shared/routes";
import { fetchCardSparklines, fetchCollection } from "@/infrastructure/repositories/forensicRepository";
import { fetchMarketCatalog } from "@/infrastructure/repositories/marketRepository";
import { ErrorState } from "@/presentation/components/ErrorState";
import { EmptyState } from "@/presentation/components/EmptyState";
import { COPY } from "@/shared/copy";
import { useRecentSearches } from "@/application/stores/recentSearchesStore";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { useCardSearchPaged } from "@/application/queries";
import { useMixedTrending } from "@/application/queries/catalog/useMixedTrending";
import { useSealedSearch } from "@/application/queries/collection/useSealed";
import type { SealedProductWire } from "@/infrastructure/http";
import { sealedToCardSearchResult } from "@/presentation/features/search/sealedAdapter";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { SearchResultRow } from "@/presentation/features/search/SearchResultRow";
import { HotRightNowRail } from "@/presentation/features/search/HotRightNowRail";
import { ResolvedCarousels } from "@/presentation/features/search/CarouselRail";
import { SealedRail } from "@/presentation/features/search/SealedRail";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { SkeletonSearchResults } from "@/presentation/components/Skeletons";
import { CardHorizontalRail, CardSparkRow } from "@/presentation/cards";
import type { CardSearchResult, TcgKey } from "@/infrastructure/http";
import { TcgMark } from "@/presentation/brand/TcgMark";
import { gradeColor, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** All TCG facets supported by the chip row, in render order. */
type TcgChip = TcgKey | "all";
// Games the backend can actually search/browse. One Piece is data-backed via
// the apitcg catalog now; Lorcana + Sports have no provider yet, so they keep
// the "SOON" badge and fall back to "all" when tapped.
const SUPPORTED_TCGS = new Set<TcgChip>([
  "all",
  "pokemon",
  "magic",
  "yugioh",
  "onepiece",
  "digimon",
]);
const TCG_CHIPS: { key: TcgChip; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pokemon", label: "Pokémon" },
  { key: "magic", label: "Magic" },
  { key: "yugioh", label: "Yu-Gi-Oh!" },
  { key: "onepiece", label: "One Piece" },
  { key: "digimon", label: "Digimon" },
  { key: "lorcana", label: "Lorcana" },
  { key: "sports", label: "Sports" },
];

interface SearchableCard {
  id: string;
  title: string;
  set: string;
  year: number;
  estimatedValueUsd: number;
  thumbnailUri: string;
  /** undefined for catalog-only cards (not in user's vault). */
  grade: number | null;
  owned: boolean;
}

type Quickfilter = "all" | "graded" | "vintage" | "modern";
type AccentKey = "mint" | "blue" | "amber" | "rose" | "purple";

interface Category {
  key: string;
  label: string;
  /** Display monogram if no image. */
  mono: string;
  accent: AccentKey;
  /** Match predicate against any searchable card. */
  match: (c: SearchableCard) => boolean;
}

const CATEGORIES: Category[] = [
  {
    key: "pokemon",
    label: "Pokémon",
    mono: "PKM",
    accent: "amber",
    match: (c) => /pokemon/i.test(c.set),
  },
  {
    key: "magic",
    label: "Magic",
    mono: "MTG",
    accent: "blue",
    match: (c) => /magic/i.test(c.set),
  },
  {
    key: "yugioh",
    label: "Yu-Gi-Oh!",
    mono: "YGO",
    accent: "purple",
    match: (c) => /yu-?gi-?oh/i.test(c.set),
  },
  {
    key: "onepiece",
    label: "One Piece",
    mono: "OPC",
    accent: "rose",
    match: (c) => /one\s?piece/i.test(c.set),
  },
  {
    key: "lorcana",
    label: "Lorcana",
    mono: "LRC",
    accent: "amber",
    match: (c) => /lorcana/i.test(c.set),
  },
  {
    key: "sports",
    label: "Sports",
    mono: "SPT",
    accent: "mint",
    match: (c) => /world cup|topps|chrome|panini|prizm|bowman/i.test(c.set),
  },
];

const QUICK_FILTERS: { key: Quickfilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "graded", label: "Graded 9+" },
  { key: "vintage", label: "Vintage" },
  { key: "modern", label: "Modern" },
];

export default function SearchScreen() {
  const p = useThemedPalette();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [quickfilter, setQuickfilter] = useState<Quickfilter>("all");
  const [selectedTcg, setSelectedTcg] = useState<TcgChip>("all");
  const recent = useRecentSearches((s) => s.items);
  const pushRecent = useRecentSearches((s) => s.push);
  const clearRecent = useRecentSearches((s) => s.clear);
  const removeRecent = useRecentSearches((s) => s.remove);
  const [inputFocused, setInputFocused] = useState(false);

  // Both fetch the signed-in user's own data — gate so they don't run while
  // signed out (and don't fire token-less before auth hydrates).
  const { isAuthenticated } = useAuth();
  const collection = useQuery({
    queryKey: queryKeys.collection.list(),
    queryFn: () => fetchCollection(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
  const sparks = useQuery({
    queryKey: queryKeys.cards.sparklines(),
    queryFn: fetchCardSparklines,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const catalog = useQuery({
    queryKey: queryKeys.market.catalog(),
    queryFn: fetchMarketCatalog,
    staleTime: 5 * 60_000,
  });

  const owned = useMemo(() => collection.data ?? [], [collection.data]);
  const ownedIds = useMemo(() => new Set(owned.map((c) => c.id)), [owned]);

  // Merge catalog with vault → unified searchable universe.
  const cards: SearchableCard[] = useMemo(() => {
    const fromOwned: SearchableCard[] = owned.map((c) => ({
      id: c.id,
      title: c.title,
      set: c.set,
      year: c.year,
      estimatedValueUsd: c.estimatedValueUsd,
      thumbnailUri: c.thumbnailUri,
      grade: c.grade,
      owned: true,
    }));
    const fromCatalog: SearchableCard[] = (catalog.data ?? [])
      .filter((e) => !ownedIds.has(e.id))
      .map((e) => ({
        id: e.id,
        title: e.title,
        set: e.set,
        year: e.year,
        estimatedValueUsd: e.spot,
        thumbnailUri: e.imageUri,
        grade: null,
        owned: false,
      }));
    return [...fromOwned, ...fromCatalog];
  }, [owned, catalog.data, ownedIds]);

  const sparkMap = useMemo(
    () => new Map((sparks.data ?? []).map((s) => [s.cardId, s])),
    [sparks.data],
  );

  const results = useMemo(() => {
    let out = cards;
    if (activeCategory) {
      const cat = CATEGORIES.find((c) => c.key === activeCategory);
      if (cat) out = out.filter(cat.match);
    }
    if (quickfilter === "graded") out = out.filter((c) => c.grade !== null && c.grade >= 9);
    if (quickfilter === "vintage") out = out.filter((c) => c.year < 2010);
    if (quickfilter === "modern") out = out.filter((c) => c.year >= 2020);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.set.toLowerCase().includes(q) ||
          c.year.toString().includes(q),
      );
    }
    return out;
  }, [cards, activeCategory, quickfilter, query]);

  const showResults = query.trim().length > 0 || activeCategory !== null || quickfilter !== "all";

  // ── Live backend catalog search ────────────────────────────────────────────
  // Debounce the input by 200ms; map the active category to a backend `tcg`
  // facet (unsupported facets fall through as "all"). The hook itself enforces
  // the ≥2-character floor.
  const debouncedQuery = useDebouncedValue(query.trim(), 200);
  // Explicit chip beats category fallback; chips for unsupported facets
  // collapse to "all" so we still hit the wire and don't 400.
  const chipTcg: TcgChip = SUPPORTED_TCGS.has(selectedTcg) ? selectedTcg : "all";
  const liveTcg: TcgKey | "all" =
    chipTcg !== "all"
      ? chipTcg
      : activeCategory === "pokemon" || activeCategory === "magic" || activeCategory === "yugioh"
        ? activeCategory
        : "all";
  // Deep, TRUE-paginated search so every printing of a popular name is
  // reachable (Pikachu 177, Charizard 400+) instead of a capped top-20.
  const live = useCardSearchPaged({ q: debouncedQuery, tcg: liveTcg, pageSize: 24 });
  const liveResults = React.useMemo(
    () => (live.data?.pages ?? []).flatMap((pg) => pg.results ?? []),
    [live.data],
  );
  const liveTotal = live.data?.pages?.[0]?.total ?? liveResults.length;
  const liveError = live.data?.pages?.[0]?.error;
  const livePartial = live.data?.pages?.[0]?.partial;
  const showLive = debouncedQuery.length >= 2;
  // Sealed catalog runs alongside singles — same debounced query, same
  // ≥2-char gate — so "booster box" surfaces alongside cards instead of
  // returning an empty live panel. Hits the local DB so it's cheap and
  // doesn't compete with the upstream TCG fan-out.
  const sealed = useSealedSearch(showLive ? debouncedQuery : "");
  // When the user is actively typing a free-text query the *live catalog*
  // is the authoritative answer — the local vault/catalog filter below is
  // almost always empty and produces a confusing "No matches" panel
  // directly under a successful live result. Suppress the local filtered
  // block whenever live search is the primary surface.
  const showLocalResults = showResults && !showLive;

  const commitRecentSearch = (q: string) => {
    pushRecent(q);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      {/* Sticky search bar */}
      <View className="px-5 pb-3 pt-2">
        <View
          className="flex-row items-center gap-2.5 rounded-2xl border border-line bg-bg-elevated pl-4 pr-2"
          style={{ height: 48 }}
        >
          <SearchIcon size={18} color={p.ink.muted} strokeWidth={2.4} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => commitRecentSearch(query)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            returnKeyType="search"
            placeholder="Search cards, sets, years…"
            placeholderTextColor={p.ink.dim}
            style={{
              flex: 1,
              color: p.ink.default,
              fontSize: 15,
              fontWeight: "500",
            }}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => {
                setQuery("");
                Keyboard.dismiss();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              className="h-8 w-8 items-center justify-center rounded-full"
            >
              <X size={16} color={p.ink.muted} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.push(routes.scanEntry())}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Scan a card with the camera"
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: withAlpha(p.accent.mint, 0.14) }}
          >
            <Camera size={15} color={p.accent.mint} />
          </Pressable>
        </View>

        {/* Recent searches — ONLY while the keyboard is up (input focused)
            and before live results take over (<2 chars typed). Idle
            browsing never shows the strip, so the discovery bands below
            stay clean. */}
        {inputFocused && debouncedQuery.length < 2 ? (
          <RecentSearchStrip
            recent={recent}
            onPick={(value) => {
              setQuery(value);
              Keyboard.dismiss();
            }}
            onRemove={removeRecent}
            onClear={clearRecent}
          />
        ) : null}

        {/* TCG facet chips (drive the live backend search) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 12, paddingRight: 8 }}
        >
          {TCG_CHIPS.map((c) => {
            const active = selectedTcg === c.key;
            const supported = SUPPORTED_TCGS.has(c.key);
            return (
              <Pressable
                key={c.key}
                onPress={() => setSelectedTcg(c.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: active
                    ? withAlpha(p.accent.mint, 0.15)
                    : "transparent",
                  borderWidth: 1,
                  borderColor: active ? p.accent.mint : p.line.default,
                  opacity: supported ? 1 : 0.7,
                }}
              >
                <Text
                  style={{
                    color: active ? p.accent.mint : p.ink.muted,
                    fontSize: 12,
                    fontWeight: "700",
                    letterSpacing: 0.4,
                  }}
                >
                  {c.label}
                </Text>
                {!supported ? (
                  <Text
                    style={{
                      color: p.ink.dim,
                      fontSize: 9,
                      fontWeight: "800",
                      letterSpacing: 0.8,
                    }}
                  >
                    SOON
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Quickfilter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 12, paddingRight: 8 }}
        >
          {QUICK_FILTERS.map((f) => {
            const active = quickfilter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setQuickfilter(f.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: active
                    ? withAlpha(p.accent.mint, 0.15)
                    : "transparent",
                  borderWidth: 1,
                  borderColor: active ? p.accent.mint : p.line.default,
                }}
              >
                <Text
                  style={{
                    color: active ? p.accent.mint : p.ink.muted,
                    fontSize: 12,
                    fontWeight: "700",
                    letterSpacing: 0.4,
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

      </View>

      <ScrollView
        // Clear the floating iOS tab-bar pill (see Command screen note).
        contentContainerStyle={{
          padding: 20,
          paddingTop: 4,
          paddingBottom: Platform.OS === "ios" ? 116 : 64,
          gap: 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {showLive ? (
          <LiveResultsSection
            query={debouncedQuery}
            tcg={liveTcg}
            isLoading={
              live.isLoading || (live.isFetching && !live.isFetchingNextPage)
            }
            isError={live.isError}
            data={liveResults}
            total={liveTotal}
            hasMore={!!live.hasNextPage}
            isFetchingMore={live.isFetchingNextPage}
            onLoadMore={() => {
              void live.fetchNextPage();
            }}
            sealed={sealed.data ?? []}
            upstreamError={liveError}
            partial={livePartial}
            onResultTap={commitRecentSearch}
          />
        ) : null}

        {!showLocalResults ? (
          showLive ? null : (
          <>
            {/* Idle layout — organized into three clear bands so the
                discovery surfaces stop fighting each other:
                  1. BROWSE   → Categories grid (the entry point)
                  2. DISCOVER → Trending + per-TCG rails
                  3. YOUR STUFF → Vault top picks
                Each band has a single eyebrow so users can tell at a
                glance which kind of content they're scanning. */}

            {/* ── BAND 1 · BROWSE ─────────────────────────────── */}
            <View>
              <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                Browse
              </Text>
              <Text className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                Start browsing
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingTop: 16, paddingRight: 8 }}
              >
                {CATEGORIES.map((cat) => {
                  const count = cards.filter(cat.match).length;
                  const active = activeCategory === cat.key;
                  const tint = p.accent[cat.accent];
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => {
                        setActiveCategory((prev) => (prev === cat.key ? null : cat.key));
                        setSelectedTcg(cat.key as TcgChip);
                      }}
                      style={({ pressed }) => ({
                        width: 156,
                        minHeight: 136,
                        padding: 14,
                        justifyContent: "space-between",
                        opacity: pressed ? 0.9 : 1,
                        transform: pressed ? [{ scale: 0.96 }] : undefined,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: active ? withAlpha(tint, 0.55) : p.line.default,
                        backgroundColor: active ? withAlpha(tint, 0.10) : p.bg.elevated,
                      })}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 14,
                            backgroundColor: p.bg.base,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: withAlpha(tint, 0.34),
                          }}
                        >
                          <TcgMark
                            set={cat.key}
                            size={28}
                            color={tint}
                            background={p.bg.base}
                          />
                        </View>
                        <Text
                          numberOfLines={2}
                          style={{
                            flex: 1,
                            color: p.ink.default,
                            fontSize: 14,
                            fontWeight: "800",
                            lineHeight: 17,
                          }}
                        >
                          {cat.label}
                        </Text>
                      </View>
                      <View>
                        <Text
                          numberOfLines={1}
                          style={{ color: p.ink.muted, fontSize: 11, fontWeight: "700" }}
                        >
                          {count} {count === 1 ? "card" : "cards"}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{ color: active ? tint : p.ink.dim, fontSize: 10, marginTop: 2 }}
                        >
                          {active ? "Selected" : "Tap to filter"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── BAND 2 · DISCOVER ───────────────────────────
                Single header up top, then a stack of horizontal rails
                that each follow the same template:

                  [TCG eyebrow]
                  [Rail title]
                  [Horizontal card rail @ tileSize=md, w/ price]

                Each rail is gated by the active TCG chip so selecting
                "Pokémon" hides the other-TCG rails and narrows the
                band to a single focused list. */}
            <View style={{ gap: 24 }}>
              <View>
                <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                  Discover
                </Text>
                <Text className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                  What collectors are watching
                </Text>
              </View>

              {selectedTcg === "all" ? (
                // Mixed scope: a cross-game "Trending now" + sealed + per-game
                // teaser rails (no single game to resolve carousels for).
                <>
                  <View style={{ gap: 8 }}>
                    <SectionHeader
                      eyebrow="All TCGs"
                      title="Trending now"
                      trailing={
                        <Pressable
                          onPress={() => router.push(routes.markets())}
                          hitSlop={10}
                          className="flex-row items-center gap-1"
                        >
                          <Text className="text-xs font-medium text-ink-muted">
                            Browse all
                          </Text>
                          <ChevronRight size={14} color={p.ink.dim} />
                        </Pressable>
                      }
                    />
                    <TrendingSection />
                  </View>

                  <View style={{ gap: 8 }}>
                    <SectionHeader eyebrow="Sealed" title="Sealed products" />
                    <SealedRail products={sealed.data ?? []} />
                  </View>

                  <View style={{ gap: 8 }}>
                    <SectionHeader eyebrow="Pokémon" title="Chase rares" />
                    <HotRightNowRail tcg="pokemon" limit={12} />
                  </View>
                  <View style={{ gap: 8 }}>
                    <SectionHeader eyebrow="Yu-Gi-Oh!" title="Newest releases" />
                    <HotRightNowRail tcg="yugioh" limit={12} />
                  </View>
                  <View style={{ gap: 8 }}>
                    <SectionHeader eyebrow="Magic" title="EDHREC favorites" />
                    <HotRightNowRail tcg="magic" limit={12} />
                  </View>
                </>
              ) : (
                // Per-game: the EXACT same carousels the web marketplace shows,
                // resolved by the backend (/v1/public/carousels/resolved) into
                // trending + value/rarity rails + explore, each already filled
                // with cards and with empty rails dropped server-side.
                <>
                  <ResolvedCarousels tcg={selectedTcg} />
                  <View style={{ gap: 8 }}>
                    <SectionHeader eyebrow="Sealed" title="Sealed products" />
                    <SealedRail products={sealed.data ?? []} />
                  </View>
                </>
              )}
            </View>

            {/* ── BAND 3 · YOUR STUFF ─────────────────────── */}

            {/* Trending in collection (top 3 by value as a "popular" rail) */}
            {cards.length > 0 ? (
              <View>
                <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                  Your vault
                </Text>
                <Text className="mt-1 mb-3 text-base font-semibold text-ink">
                  Top picks
                </Text>
                <View>
                  {[...cards]
                    .sort((a, b) => b.estimatedValueUsd - a.estimatedValueUsd)
                    .slice(0, 3)
                    .map((card, i) => (
                      <ResultRow
                        key={card.id}
                        card={card}
                        spark={sparkMap.get(card.id)?.points}
                        deltaPct={sparkMap.get(card.id)?.deltaPct ?? 0}
                        bordered={i > 0}
                      />
                    ))}
                </View>
              </View>
            ) : null}
          </>
          )
        ) : (
          <View>
            {/* Active filter pill */}
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-ink-muted">
                {results.length} {results.length === 1 ? "result" : "results"}
                {activeCategory
                  ? ` · ${CATEGORIES.find((c) => c.key === activeCategory)?.label}`
                  : ""}
              </Text>
              {activeCategory || quickfilter !== "all" || query ? (
                <Pressable
                  onPress={() => {
                    setActiveCategory(null);
                    setQuickfilter("all");
                    setQuery("");
                  }}
                  hitSlop={6}
                >
                  <Text className="text-xs font-semibold" style={{ color: p.accent.mint }}>
                    Reset
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {results.length === 0 ? (
              <View className="items-center p-8">
                <SearchIcon size={28} color={p.ink.dim} />
                <Text className="mt-3 text-sm font-semibold text-ink">No matches</Text>
                <Text className="mt-1 text-center text-[11px] text-ink-muted">
                  Try a different category or search term.
                </Text>
              </View>
            ) : (
              <View>
                {results.map((card, i) => (
                  <ResultRow
                    key={card.id}
                    card={card}
                    spark={sparkMap.get(card.id)?.points}
                    deltaPct={sparkMap.get(card.id)?.deltaPct ?? 0}
                    bordered={i > 0}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RecentSearchStrip({
  recent,
  onPick,
  onRemove,
  onClear,
}: {
  recent: string[];
  onPick: (value: string) => void;
  onRemove: (value: string) => void;
  onClear: () => void;
}) {
  const p = useThemedPalette();
  if (recent.length === 0) return null;
  return (
    <View style={{ paddingTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Recent searches
        </Text>
        <Pressable onPress={onClear} hitSlop={8}>
          <Text style={{ color: p.ink.muted, fontSize: 11, fontWeight: "700" }}>
            Clear
          </Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 8, paddingTop: 8, paddingRight: 8 }}
      >
        {recent.map((item) => (
          <View
            key={item}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              maxWidth: 220,
              paddingLeft: 10,
              paddingRight: 4,
              paddingVertical: 5,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: p.line.default,
              backgroundColor: p.bg.elevated,
            }}
          >
            <Clock size={12} color={p.ink.dim} />
            <Pressable onPress={() => onPick(item)} hitSlop={6} style={{ flexShrink: 1 }}>
              <Text
                numberOfLines={1}
                style={{ color: p.ink.default, fontSize: 12, fontWeight: "700" }}
              >
                {item}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onRemove(item)}
              hitSlop={6}
              style={{
                width: 20,
                height: 20,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
              }}
              accessibilityRole="button"
              accessibilityLabel={`Remove recent search ${item}`}
            >
              <X size={11} color={p.ink.dim} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** Local vault/catalog row — adapts `SearchableCard` onto the canonical
 *  `CardSparkRow` so local results and live results read identically. */
function ResultRow({
  card,
  spark,
  deltaPct,
  bordered,
}: {
  card: SearchableCard;
  spark?: number[];
  deltaPct: number;
  bordered: boolean;
}) {
  const p = useThemedPalette();
  const gradeTint = card.grade !== null ? gradeColor(card.grade) : p.ink.muted;

  return (
    <CardSparkRow
      thumbUri={card.thumbnailUri}
      recyclingKey={card.id}
      title={card.title}
      badge={{
        label:
          card.grade !== null
            ? card.grade.toFixed(card.grade % 1 === 0 ? 0 : 1)
            : "RAW",
        tint: gradeTint,
      }}
      meta={[card.set, card.year].filter(Boolean).join(" · ") || null}
      spark={spark ?? null}
      priceUsd={card.estimatedValueUsd}
      deltaPct={deltaPct}
      bordered={bordered}
      onPress={() => router.push(routes.card(card.id))}
    />
  );
}

/**
 * Live Loupe-API search rail.
 * Rendered above the local results whenever the debounced query is ≥2 chars.
 * Shows loading / error / empty / success states, plus a soft banner when
 * the backend returned a 200 with an `error` field (upstream degradation).
 */
function LiveResultsSection({
  query,
  tcg,
  isLoading,
  isError,
  data,
  total,
  hasMore = false,
  isFetchingMore = false,
  onLoadMore,
  sealed = [],
  upstreamError,
  partial,
  onResultTap,
}: {
  query: string;
  tcg: TcgKey | "all";
  isLoading: boolean;
  isError: boolean;
  data: CardSearchResult[];
  /** Provider's real match count (e.g. 177 for Pikachu) — may exceed loaded. */
  total?: number;
  hasMore?: boolean;
  isFetchingMore?: boolean;
  onLoadMore?: () => void;
  sealed?: SealedProductWire[];
  upstreamError?: string;
  partial?: boolean;
  onResultTap?: (q: string) => void;
}) {
  const p = useThemedPalette();
  const tcgLabel = tcg === "all" ? "All TCGs" : tcg;

  // Per-TCG breakdown for the header subtitle so the user can tell at a
  // glance which catalogs the results came from (e.g. "5 cards · 3 Pokémon · 2 Magic")
  // without scanning each row's badge.
  const breakdown = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of data) counts[c.tcg] = (counts[c.tcg] ?? 0) + 1;
    const labels: Record<string, string> = {
      pokemon: "Pokémon",
      magic: "Magic",
      yugioh: "Yu-Gi-Oh!",
    };
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([k, n]) => `${n} ${labels[k] ?? k}`)
      .join(" · ");
  }, [data]);

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Live catalog · {tcgLabel}
        </Text>
        {isLoading ? <ActivityIndicator size="small" color={p.accent.mint} /> : null}
      </View>

      <View className="mt-1 flex-row items-baseline justify-between gap-2">
        <Text
          className="flex-1 text-base font-semibold text-ink"
          numberOfLines={1}
        >
          {data.length > 0
            ? total != null && total > data.length
              ? `${data.length} of ${total.toLocaleString()} for “${query}”`
              : `${data.length} ${data.length === 1 ? "result" : "results"} for “${query}”`
            : isLoading
              ? `Searching “${query}”…`
              : `Results for “${query}”`}
        </Text>
        {/* Partial-results pill — surfaces backend fan-out cancellation
            so the user understands why e.g. Pokémon is missing from the
            list. The next keystroke will retry the laggard (20s TTL). */}
        {partial && data.length > 0 ? (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: withAlpha(p.accent.amber, 0.12),
              borderWidth: 1,
              borderColor: withAlpha(p.accent.amber, 0.3),
            }}
          >
            <Text
              style={{
                color: p.accent.amber,
                fontSize: 9,
                fontWeight: "800",
                letterSpacing: 0.8,
              }}
            >
              PARTIAL
            </Text>
          </View>
        ) : null}
      </View>

      {breakdown && data.length > 0 ? (
        <Text className="mt-0.5 text-[11px] text-ink-muted" numberOfLines={1}>
          {breakdown}
        </Text>
      ) : null}

      {upstreamError ? (
        <View
          className="mt-2 rounded-xl border px-3 py-2"
          style={{ borderColor: withAlpha(p.accent.amber, 0.4), backgroundColor: withAlpha(p.accent.amber, 0.08) }}
        >
          <Text style={{ color: p.accent.amber, fontSize: 11, fontWeight: "600" }}>
            Upstream degraded: {upstreamError}
          </Text>
        </View>
      ) : null}

      {/* Flat results list — hairline-separated rows on the page surface
          (no more stacked white blocks). */}
      <View className="mt-2">
        {isError ? (
          <View style={{ paddingVertical: 8 }}>
            <ErrorState
              title={COPY.searchError.title}
              message={COPY.searchError.message}
              code="server"
              compact
            />
          </View>
        ) : isLoading && data.length === 0 ? (
          // First-page skeleton — far better than a centered spinner
          // because the layout doesn't jump when real rows arrive and
          // the perceived wait is shorter (eyes have something to scan).
          <View style={{ paddingVertical: 8 }}>
            <SkeletonSearchResults rows={4} />
          </View>
        ) : data.length === 0 ? (
          <View style={{ paddingVertical: 8 }}>
            <EmptyState
              title={COPY.searchEmpty.title}
              message={COPY.searchEmpty.message}
              compact
            />
          </View>
        ) : (
          // Rows fade slightly while a refresh is in-flight so the user
          // gets visual confirmation that something is updating without
          // losing the previous results (TanStack `keepPreviousData`).
          <>
            <View style={{ opacity: isLoading ? 0.55 : 1 }}>
              {data.map((card, i) => (
                <SearchResultRow
                  key={card.id}
                  card={card}
                  bordered={i > 0}
                  onPressCapture={() => onResultTap?.(query)}
                />
              ))}
            </View>

            {/* Deep pagination — every printing of a popular name is
                reachable (Pikachu 177, Charizard 400+) instead of a capped
                top-N. Tap loads the next page and appends. */}
            {hasMore ? (
              <Pressable
                onPress={onLoadMore}
                disabled={isFetchingMore}
                accessibilityRole="button"
                accessibilityLabel={
                  total != null
                    ? `Load more results. ${total - data.length} more available.`
                    : "Load more results"
                }
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  marginTop: 10,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: withAlpha(p.accent.mint, 0.3),
                  backgroundColor: withAlpha(
                    p.accent.mint,
                    pressed ? 0.12 : 0.06,
                  ),
                  opacity: isFetchingMore ? 0.7 : 1,
                })}
              >
                {isFetchingMore ? (
                  <ActivityIndicator size="small" color={p.accent.mint} />
                ) : (
                  <Text
                    style={{
                      color: p.accent.mint,
                      fontSize: 13,
                      fontWeight: "800",
                    }}
                  >
                    {total != null
                      ? `Load ${(total - data.length).toLocaleString()} more`
                      : "Load more"}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      {/* ── Sealed products subsection ─────────────────────────────────
          Sealed (booster boxes, ETBs, tins…) lives in its own panel
          beneath the cards rail so it's discoverable without competing
          with the upstream single-card results. Hidden entirely when
          the local catalog has no match for the query — better than a
          confusing empty state. Tap-through routes to /sealed/add so
          the user is one step from saving it to the vault. */}
      {sealed.length > 0 ? (
        <View className="mt-3">
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Sealed products
          </Text>
          <Text className="mt-1 text-base font-semibold text-ink" numberOfLines={1}>
            {`${sealed.length} ${sealed.length === 1 ? "match" : "matches"} \u00b7 boxes, ETBs, tins`}
          </Text>
          <View className="mt-1">
            {sealed.map((s, i) => (
              <SearchResultRow
                key={s.id}
                card={sealedToCardSearchResult(s)}
                bordered={i > 0}
                badgeText="Sealed"
                priceLabel="MSRP"
                route={routes.sealedDetail(s.id)}
                onPressCapture={() => onResultTap?.(query)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ── Trending section (empty-state default) ────────────────────────────
// Renders as a horizontal rail (not a wrap-grid) so the entire Discover
// band has consistent vertical rhythm — every rail in the band uses the
// same tile size and scroll affordance. Previously this was a 2-column
// wrap grid which broke the "rail stack" visual pattern below it.
function TrendingSection() {
  // Robust cross-game feed: prefers the movement feed, falls back to each
  // game's reliable value feed (see useMixedTrending), so "Trending now" never
  // collapses to an empty "No trending cards" card.
  const q = useMixedTrending("trending");
  const cards = q.cards.slice(0, 12);

  if (q.isLoading && cards.length === 0) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
      >
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: 120, gap: 6 }}>
            <View
              style={{
                width: 120,
                height: 168,
                borderRadius: 12,
                backgroundColor: "rgba(120,120,120,0.12)",
              }}
            />
          </View>
        ))}
      </ScrollView>
    );
  }

  // Self-hide instead of an empty-state card (matches the web marketplace).
  if (cards.length === 0) return null;

  return <CardHorizontalRail cards={cards} tileSize="md" showPrice edgeBleed={20} />;
}
