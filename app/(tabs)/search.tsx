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
import { Sparkline } from "@/presentation/components/Sparkline";
import { ErrorState } from "@/presentation/components/ErrorState";
import { EmptyState } from "@/presentation/components/EmptyState";
import { COPY } from "@/shared/copy";
import { useRecentSearches } from "@/application/stores/recentSearchesStore";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { useCardSearch, useTrendingCards } from "@/application/queries";
import { useSealedSearch } from "@/application/queries/collection/useSealed";
import type { SealedProductWire } from "@/infrastructure/http";
import { sealedToCardSearchResult } from "@/presentation/features/search/sealedAdapter";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { SearchResultRow } from "@/presentation/features/search/SearchResultRow";
import { HotRightNowRail } from "@/presentation/features/search/HotRightNowRail";
import { SealedRail } from "@/presentation/features/search/SealedRail";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { CardImage } from "@/presentation/components/CardImage";
import { SkeletonSearchResults } from "@/presentation/components/Skeletons";
import { CardHorizontalRail } from "@/presentation/cards";
import type { CardSearchResult, TcgKey } from "@/infrastructure/http";
import { compactUsd } from "@/shared/format";
import { TcgMark } from "@/presentation/brand/TcgMark";
import { gradeColor, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** All TCG facets supported by the chip row, in render order. */
type TcgChip = TcgKey | "all";
const SUPPORTED_TCGS = new Set<TcgChip>(["all", "pokemon", "magic", "yugioh"]);
const TCG_CHIPS: { key: TcgChip; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pokemon", label: "Pokémon" },
  { key: "magic", label: "Magic" },
  { key: "yugioh", label: "Yu-Gi-Oh!" },
  { key: "onepiece", label: "One Piece" },
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
  const live = useCardSearch({ q: debouncedQuery, tcg: liveTcg, limit: 20 });
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
              className="h-8 w-8 items-center justify-center rounded-full"
            >
              <X size={16} color={p.ink.muted} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.push(routes.scanIdentify())}
            hitSlop={8}
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: withAlpha(p.accent.mint, 0.14) }}
          >
            <Camera size={15} color={p.accent.mint} />
          </Pressable>
        </View>

        {/* Inline recent-searches strip — surfaces saved queries the
            moment the user focuses the input, so re-running a recent
            search is one tap instead of scrolling to the idle band.
            Hidden once the user starts typing (≥2 chars) so it doesn't
            compete with live results. */}
        {inputFocused && debouncedQuery.length < 2 && recent.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8, paddingTop: 12, paddingRight: 8 }}
          >
            {recent.map((r) => (
              <View
                key={r}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingLeft: 10,
                  paddingRight: 4,
                  paddingVertical: 4,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: p.line.default,
                  backgroundColor: p.bg.elevated,
                }}
              >
                <Clock size={11} color={p.ink.dim} />
                <Pressable
                  onPress={() => {
                    setQuery(r);
                    Keyboard.dismiss();
                  }}
                  hitSlop={6}
                >
                  <Text
                    style={{
                      color: p.ink.default,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {r}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => removeRecent(r)}
                  hitSlop={6}
                  style={{
                    width: 18,
                    height: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                  }}
                >
                  <X size={11} color={p.ink.dim} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
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

        {!showLive && recent.length > 0 ? (
          <RecentSearchStrip
            recent={recent}
            onPick={(value) => setQuery(value)}
            onRemove={removeRecent}
            onClear={clearRecent}
          />
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 64, gap: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {showLive ? (
          <LiveResultsSection
            query={debouncedQuery}
            tcg={liveTcg}
            isLoading={live.isLoading || live.isFetching}
            isError={live.isError}
            data={live.data?.results ?? []}
            sealed={sealed.data ?? []}
            upstreamError={live.data?.error}
            partial={live.data?.partial}
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

              <View style={{ gap: 8 }}>
                <SectionHeader
                  eyebrow={selectedTcg === "all" ? "All TCGs" : TCG_CHIPS.find((c) => c.key === selectedTcg)?.label ?? "Trending"}
                  title="Trending now"
                  trailing={
                    <Pressable
                      onPress={() => router.push(routes.markets())}
                      hitSlop={10}
                      className="flex-row items-center gap-1"
                    >
                      <Text className="text-xs font-medium text-ink-muted">Browse all</Text>
                      <ChevronRight size={14} color={p.ink.dim} />
                    </Pressable>
                  }
                />
                <TrendingSection tcg={selectedTcg} />
              </View>

              <View style={{ gap: 8 }}>
                <SectionHeader eyebrow="Sealed" title="Sealed products" />
                <SealedRail products={sealed.data ?? []} />
              </View>

              {selectedTcg === "all" || selectedTcg === "pokemon" ? (
                <View style={{ gap: 8 }}>
                  <SectionHeader eyebrow="Pokémon" title="Chase rares" />
                  <HotRightNowRail tcg="pokemon" limit={12} />
                </View>
              ) : null}
              {selectedTcg === "all" || selectedTcg === "yugioh" ? (
                <View style={{ gap: 8 }}>
                  <SectionHeader eyebrow="Yu-Gi-Oh!" title="Newest releases" />
                  <HotRightNowRail tcg="yugioh" limit={12} />
                </View>
              ) : null}
              {selectedTcg === "all" || selectedTcg === "magic" ? (
                <View style={{ gap: 8 }}>
                  <SectionHeader eyebrow="Magic" title="EDHREC favorites" />
                  <HotRightNowRail tcg="magic" limit={12} />
                </View>
              ) : null}
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
                <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
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
              <View className="items-center rounded-2xl border border-line bg-bg-elevated p-8">
                <SearchIcon size={28} color={p.ink.dim} />
                <Text className="mt-3 text-sm font-semibold text-ink">No matches</Text>
                <Text className="mt-1 text-center text-[11px] text-ink-muted">
                  Try a different category or search term.
                </Text>
              </View>
            ) : (
              <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
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
  const up = deltaPct >= 0;
  const tint = up ? p.accent.mint : p.accent.rose;
  const gradeTint = card.grade !== null ? gradeColor(card.grade) : p.ink.muted;

  return (
    <Pressable
      onPress={() => router.push(routes.card(card.id))}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className={`flex-row items-center gap-3 px-4 py-3 ${bordered ? "border-t border-line/60" : ""}`}
    >
      <View
        className="overflow-hidden rounded-lg"
        style={{ width: 36, height: 50, backgroundColor: p.bg.sunken }}
      >
        <CardImage
          uri={card.thumbnailUri}
          width={36}
          height={50}
          rounded={8}
          priority="low"
          recyclingKey={card.id}
          alt={card.title}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} className="text-sm font-semibold text-ink">
          {card.title}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          {card.grade !== null ? (
            <View
              style={{
                paddingHorizontal: 5,
                paddingVertical: 1,
                borderRadius: 4,
                backgroundColor: withAlpha(gradeTint, 0.18),
              }}
            >
              <Text style={{ color: gradeTint, fontSize: 9, fontWeight: "800" }}>
                {card.grade.toFixed(card.grade % 1 === 0 ? 0 : 1)}
              </Text>
            </View>
          ) : (
            <View
              style={{
                paddingHorizontal: 5,
                paddingVertical: 1,
                borderRadius: 4,
                backgroundColor: withAlpha(p.ink.muted, 0.12),
              }}
            >
              <Text style={{ color: p.ink.muted, fontSize: 9, fontWeight: "800" }}>RAW</Text>
            </View>
          )}
          <Text numberOfLines={1} className="text-[11px] text-ink-muted">
            {card.set} · {card.year}
          </Text>
        </View>
      </View>
      <View style={{ width: 56 }}>
        <Sparkline values={spark ?? []} width={56} height={24} showBaseline={false} />
      </View>
      <View style={{ minWidth: 72, alignItems: "flex-end" }}>
        <Text className="text-sm font-bold text-ink">{compactUsd(card.estimatedValueUsd)}</Text>
        <Text style={{ color: tint, fontSize: 10, fontWeight: "700" }}>
          {up ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(2)}%
        </Text>
      </View>
    </Pressable>
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
            ? `${data.length} ${data.length === 1 ? "result" : "results"} for “${query}”`
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

      <View className="mt-3 overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        {isError ? (
          <View style={{ padding: 8 }}>
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
          <View style={{ padding: 8 }}>
            <SkeletonSearchResults rows={4} />
          </View>
        ) : data.length === 0 ? (
          <View style={{ padding: 8 }}>
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
          <View className="mt-2 overflow-hidden rounded-2xl border border-line bg-bg-elevated">
            {sealed.map((s, i) => (
              <SearchResultRow
                key={s.id}
                card={sealedToCardSearchResult(s)}
                bordered={i > 0}
                badgeText="SEALED"
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
function TrendingSection({ tcg = "all" }: { tcg?: TcgChip }) {
  const trending = useTrendingCards({ tcg, limit: 12 });
  const cards = trending.data?.cards ?? [];

  if (trending.isLoading) {
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

  if (trending.isError) {
    return (
      <ErrorState
        title={COPY.searchError.title}
        message={COPY.searchError.message}
      />
    );
  }

  if (cards.length === 0) {
    return <EmptyState title="No trending cards right now" message="" />;
  }

  return <CardHorizontalRail cards={cards} tileSize="md" showPrice edgeBleed={20} />;
}
