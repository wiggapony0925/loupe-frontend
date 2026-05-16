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
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/api/queryKeys";
import { router } from "expo-router";
import { routes } from "@/lib/routes";
import { Camera, Clock, Search as SearchIcon, X } from "lucide-react-native";
import { fetchCardSparklines, fetchCollection } from "@/api/forensicApi";
import { fetchMarketCatalog } from "@/api/marketApi";
import { Sparkline } from "@/components/ui/Sparkline";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { COPY } from "@/lib/copy";
import { useCardSearch, useTrendingCards } from "@/hooks/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SearchResultRow } from "@/features/search/SearchResultRow";
import { CardImage } from "@/components/ui/CardImage";
import { SkeletonTrendingGrid } from "@/components/ui/Skeletons";
import { CardTile } from "@/components/cards";
import { pickCardImageUrl, pickCardBlurhash } from "@/lib/cardImage";
import type { CardSearchResult, TcgKey } from "@/api/types";
import { compactUsd } from "@/lib/format";
import { getBrandLogo } from "@/lib/brandAssets";
import { gradeColor, palette, useThemedPalette, withAlpha } from "@/theme/tokens";

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

interface Category {
  key: string;
  label: string;
  /** Display monogram if no image. */
  mono: string;
  tint: string;
  /** Match predicate against any searchable card. */
  match: (c: SearchableCard) => boolean;
}

const CATEGORIES: Category[] = [
  {
    key: "pokemon",
    label: "Pokémon",
    mono: "PKM",
    tint: "#FFCB05",
    match: (c) => /pokemon/i.test(c.set),
  },
  {
    key: "magic",
    label: "Magic",
    mono: "MTG",
    tint: "#E33D3D",
    match: (c) => /magic/i.test(c.set),
  },
  {
    key: "yugioh",
    label: "Yu-Gi-Oh!",
    mono: "YGO",
    tint: "#A347D6",
    match: (c) => /yu-?gi-?oh/i.test(c.set),
  },
  {
    key: "onepiece",
    label: "One Piece",
    mono: "OPC",
    tint: "#FF6B35",
    match: (c) => /one\s?piece/i.test(c.set),
  },
  {
    key: "lorcana",
    label: "Lorcana",
    mono: "LRC",
    tint: "#C8A24A",
    match: (c) => /lorcana/i.test(c.set),
  },
  {
    key: "sports",
    label: "Sports",
    mono: "SPT",
    tint: "#0A84FF",
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
  const [recent, setRecent] = useState<string[]>([]);

  const collection = useQuery({ queryKey: queryKeys.collection.list(), queryFn: fetchCollection });
  const sparks = useQuery({
    queryKey: ["card-sparklines"],
    queryFn: fetchCardSparklines,
    staleTime: 60_000,
  });
  const catalog = useQuery({
    queryKey: ["market-catalog"],
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
  // Debounce the input by 300ms; map the active category to a backend `tcg`
  // facet (unsupported facets fall through as "all"). The hook itself enforces
  // the ≥2-character floor.
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
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

  const commitRecentSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecent((prev) => [trimmed, ...prev.filter((r) => r !== trimmed)].slice(0, 6));
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
            onPress={() => router.push(routes.scanPhone("quick"))}
            hitSlop={8}
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: withAlpha(p.accent.mint, 0.14) }}
          >
            <Camera size={15} color={p.accent.mint} />
          </Pressable>
        </View>

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
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 64, gap: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {showLive ? (
          <LiveResultsSection
            query={debouncedQuery}
            tcg={liveTcg}
            isLoading={live.isLoading}
            isError={live.isError}
            data={live.data?.results ?? []}
            upstreamError={live.data?.error}
          />
        ) : null}

        {!showResults ? (
          <>
            {query.trim().length === 0 && !activeCategory && quickfilter === "all" ? (
              <TrendingSection tcg={selectedTcg} />
            ) : null}
            {/* Quick category grid — Collectr-style */}
            <View>
              <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                Browse
              </Text>
              <Text className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                Quick filters
              </Text>
              <View className="mt-4 flex-row flex-wrap" style={{ gap: 12 }}>
                {CATEGORIES.map((cat) => {
                  const count = cards.filter(cat.match).length;
                  const logo = getBrandLogo(cat.key);
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => setActiveCategory(cat.key)}
                      style={({ pressed }) => ({
                        flexBasis: "47%",
                        flexGrow: 1,
                        height: 110,
                        opacity: pressed ? 0.85 : 1,
                      })}
                      className="overflow-hidden rounded-2xl border border-line bg-bg-elevated p-4"
                    >
                      {logo ? (
                        <View
                          style={{
                            alignSelf: "flex-start",
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            backgroundColor: withAlpha(cat.tint, 0.14),
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          <Image
                            source={logo}
                            style={{ width: 28, height: 28 }}
                            resizeMode="contain"
                          />
                        </View>
                      ) : (
                        <View
                          style={{
                            alignSelf: "flex-start",
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                            backgroundColor: withAlpha(cat.tint, 0.18),
                          }}
                        >
                          <Text
                            style={{
                              color: cat.tint,
                              fontSize: 10,
                              fontWeight: "800",
                              letterSpacing: 1,
                            }}
                          >
                            {cat.mono}
                          </Text>
                        </View>
                      )}
                      <Text className="mt-2 text-base font-bold text-ink">{cat.label}</Text>
                      <Text className="mt-0.5 text-[11px] text-ink-muted">
                        {count} {count === 1 ? "card" : "cards"} in vault
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Recent searches */}
            {recent.length > 0 ? (
              <View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                    Recent
                  </Text>
                  <Pressable onPress={() => setRecent([])} hitSlop={6}>
                    <Text className="text-[11px] font-semibold text-ink-muted">Clear</Text>
                  </Pressable>
                </View>
                <View className="mt-3 overflow-hidden rounded-2xl border border-line bg-bg-elevated">
                  {recent.map((r, i) => (
                    <Pressable
                      key={r}
                      onPress={() => setQuery(r)}
                      className={`flex-row items-center gap-3 px-4 py-3 ${
                        i > 0 ? "border-t border-line/60" : ""
                      }`}
                    >
                      <Clock size={14} color={p.ink.muted} />
                      <Text className="flex-1 text-sm text-ink">{r}</Text>
                      <SearchIcon size={14} color={p.ink.dim} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Trending in collection (top 3 by value as a "popular" rail) */}
            {cards.length > 0 ? (
              <View>
                <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                  Trending in vault
                </Text>
                <Text className="mt-1 mb-3 text-base font-semibold text-ink">
                  Highest value picks
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
      onPress={() => router.push(routes.market(card.id))}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className={`flex-row items-center gap-3 px-4 py-3 ${bordered ? "border-t border-line/60" : ""}`}
    >
      <View
        className="overflow-hidden rounded-lg"
        style={{ width: 36, height: 50, backgroundColor: palette.bg.sunken }}
      >
        <CardImage
          uri={card.thumbnailUri}
          width={36}
          height={50}
          rounded={8}
          priority="low"
          recyclingKey={card.id}
          alt={card.title}
          aspectRatio={undefined as unknown as number}
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
  upstreamError,
}: {
  query: string;
  tcg: TcgKey | "all";
  isLoading: boolean;
  isError: boolean;
  data: CardSearchResult[];
  upstreamError?: string;
}) {
  const p = useThemedPalette();
  const tcgLabel = tcg === "all" ? "All TCGs" : tcg;
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Live catalog · {tcgLabel}
        </Text>
        {isLoading ? <ActivityIndicator size="small" color={p.accent.mint} /> : null}
      </View>
      <Text className="mt-1 text-base font-semibold text-ink">
        Results for “{query}”
      </Text>

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
        ) : isLoading ? (
          <View className="items-center px-4 py-6">
            <ActivityIndicator size="small" color={p.accent.mint} />
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
          data.map((card, i) => (
            <SearchResultRow key={card.id} card={card} bordered={i > 0} />
          ))
        )}
      </View>
    </View>
  );
}

function LiveResultRow({ card, bordered }: { card: CardSearchResult; bordered: boolean }) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={() => router.push(routes.market(card.id))}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className={`flex-row items-center gap-3 px-4 py-3 ${bordered ? "border-t border-line/60" : ""}`}
    >
      <View
        className="overflow-hidden rounded-lg"
        style={{ width: 36, height: 50, backgroundColor: palette.bg.sunken }}
      >
        <CardImage
          uri={pickCardImageUrl(card, "small")}
          fallbackUri={card.image_url ?? undefined}
          blurhash={pickCardBlurhash(card)}
          width={36}
          height={50}
          rounded={8}
          priority="low"
          recyclingKey={card.id}
          alt={card.name}
          aspectRatio={undefined as unknown as number}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} className="text-sm font-semibold text-ink">
          {card.name}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 text-[11px] text-ink-muted">
          {[card.set_name, card.number, card.year].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <View style={{ minWidth: 56, alignItems: "flex-end" }}>
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
        {card.rarity ? (
          <Text className="mt-0.5 text-[10px] text-ink-muted" numberOfLines={1}>
            {card.rarity}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── Trending section (empty-state default) ────────────────────────────
function TrendingSection({ tcg = "all" }: { tcg?: TcgChip }) {
  const trending = useTrendingCards({ tcg, limit: 24 });
  const cards = trending.data?.cards ?? [];

  return (
    <View style={{ marginBottom: 24 }}>
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        Trending
      </Text>
      <Text className="mt-1 text-2xl font-semibold tracking-tight text-ink">
        What collectors are watching
      </Text>

      <View style={{ marginTop: 16 }}>
        {trending.isLoading ? (
          <SkeletonTrendingGrid count={6} />
        ) : trending.isError ? (
          <ErrorState
            title={COPY.searchError.title}
            message={COPY.searchError.message}
          />
        ) : cards.length === 0 ? (
          <EmptyState title="No trending cards right now" message="" />
        ) : (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              columnGap: 12,
              rowGap: 16,
            }}
          >
            {cards.map((card, idx) => (
              // Cell geometry mirrors SkeletonTrendingGrid exactly
              // (flexBasis 47% + flexGrow 1) so the loading state and
              // the loaded state are visually identical and the grid
              // doesn't shift when data arrives.
              <View
                key={card.id}
                style={{ flexBasis: "47%", flexGrow: 1 }}
              >
                <CardTile
                  card={card}
                  size="md"
                  showName
                  showSet
                  showPrice={false}
                  priority={idx < 4 ? "normal" : "low"}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function TrendingTile(_: {
  card: CardSearchResult;
  priority: "low" | "normal" | "high";
}): null {
  // Deprecated: replaced by reusable <CardTile> primitive. Retained as a
  // no-op shim only to avoid ripping out the symbol mid-refactor; new
  // call sites should use `CardTile` directly from `@/components/cards`.
  return null;
}
