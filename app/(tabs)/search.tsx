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
  Animated,
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
import { router, useLocalSearchParams } from "expo-router";
import { Camera, ChevronRight, Clock, ListFilter, Search as SearchIcon, Sparkles as SparklesIcon, X } from "lucide-react-native";
import { queryKeys } from "@/application/queries/queryKeys";
import { routes } from "@/shared/routes";
import { fetchCardSparklines, fetchCollection } from "@/infrastructure/repositories/forensicRepository";
import { fetchMarketCatalog } from "@/infrastructure/repositories/marketRepository";
import { ErrorState } from "@/presentation/components/ErrorState";
import { EmptyState } from "@/presentation/components/EmptyState";
import { COPY } from "@/shared/copy";
import { useRecentSearches } from "@/application/stores/recentSearchesStore";
import { useRecentRails, type RecentRail } from "@/application/stores/recentRailsStore";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { useCardSearchPaged, useFilterMetadata } from "@/application/queries";
import { useMixedTrending } from "@/application/queries/catalog/useMixedTrending";
import { useSealedSearch } from "@/application/queries/collection/useSealed";
import type { SealedProductWire } from "@/infrastructure/http";
import { sealedToCardSearchResult } from "@/presentation/features/search/sealedAdapter";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { SearchResultRow } from "@/presentation/features/search/SearchResultRow";
import { AiModePanel } from "@/presentation/features/search/AiModePanel";
import { useAiSearchLimits } from "@/application/queries/catalog/useAiSearch";
import { HotRightNowRail } from "@/presentation/features/search/HotRightNowRail";
import { ResolvedCarousels } from "@/presentation/features/search/CarouselRail";
import { RailResultsSection } from "@/presentation/features/search/RailResultsSection";
import { SealedRail } from "@/presentation/features/search/SealedRail";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { SkeletonSearchResults } from "@/presentation/components/Skeletons";
import { CardHorizontalRail, CardSparkRow } from "@/presentation/cards";
import type { CardSearchResult, SearchInterpretation, TcgKey } from "@/infrastructure/http";
import { BrowseCategoryCarousel } from "@/presentation/features/search/BrowseCategoryCarousel";
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
    key: "digimon",
    label: "Digimon",
    mono: "DIG",
    accent: "blue",
    match: (c) => /digimon/i.test(c.set),
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

  // ── Rail filter mode — a carousel's "view more" as a search filter tag ──
  // Driven by route params so the home screen can deep-open a shelf and the
  // back gesture behaves. `openRail` plants the tag; the X clears it.
  const railParams = useLocalSearchParams<{
    railId?: string | string[];
    railGame?: string | string[];
    railTitle?: string | string[];
  }>();
  const oneParam = (v: string | string[] | undefined): string =>
    (Array.isArray(v) ? v[0] : v) ?? "";
  const railId = oneParam(railParams.railId);
  const railGameRaw = oneParam(railParams.railGame) || "all";
  const railGame = (
    SUPPORTED_TCGS.has(railGameRaw as TcgChip) ? railGameRaw : "all"
  ) as TcgKey | "all";
  const railTitle = oneParam(railParams.railTitle);
  const railActive = railId.length > 0;
  const recentRails = useRecentRails((s) => s.items);
  const pushRecentRail = useRecentRails((s) => s.push);
  const removeRecentRail = useRecentRails((s) => s.remove);
  const openRail = React.useCallback((rail: RecentRail) => {
    router.setParams({ railId: rail.id, railGame: rail.game, railTitle: rail.title });
  }, []);
  const clearRail = React.useCallback(() => {
    router.setParams({ railId: "", railGame: "", railTitle: "" });
  }, []);
  const [inputFocused, setInputFocused] = useState(false);
  // Backend-served description cap (offline fallback baked in).
  const { queryMaxChars } = useAiSearchLimits();

  // ── AI MODE — the Notion-style "/" trigger ──────────────────────────
  // Typing "/" (or tapping the sparkle toggle) autocompletes into a
  // "Loupe AI" tag inside the search bar; the input becomes a description
  // box and the results area becomes the AI panel. Free accounts get the
  // paywall instead of the mode.
  const [aiMode, setAiMode] = useState(false);
  const [aiAsked, setAiAsked] = useState(false);
  const aiPill = React.useRef(new Animated.Value(0)).current;
  const enterAiMode = React.useCallback(() => {
    setAiMode(true);
    setAiAsked(false);
    aiPill.setValue(0);
    Animated.spring(aiPill, {
      toValue: 1,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [aiPill]);
  const exitAiMode = React.useCallback(() => {
    setAiMode(false);
    setAiAsked(false);
    aiPill.setValue(0);
  }, [aiPill]);
  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (aiMode) setAiAsked(false); // editing the description resets the ask
  };
  // Slack-style command palette: typing "/" (then optionally letters of
  // "ai") floats a command card under the search bar; tapping it — or
  // submitting — autocompletes into the Loupe AI tag.
  const slashPanel =
    !aiMode &&
    query.startsWith("/") &&
    "ai".startsWith(query.slice(1).trim().toLowerCase()) &&
    query.length <= 3;
  const acceptSlashCommand = React.useCallback(() => {
    setQuery("");
    enterAiMode();
  }, [enterAiMode]);
  // The active game tag rides to the backend as the user's preference —
  // "they're most likely describing a Pokémon card".
  const aiGame =
    aiMode && selectedTcg !== "all" && SUPPORTED_TCGS.has(selectedTcg)
      ? (selectedTcg as string)
      : undefined;

  const debouncedQuery = useDebouncedValue(query.trim(), 200);
  // A leading "/" is a command, never a keyword search.
  const showLive =
    !aiMode && !query.startsWith("/") && debouncedQuery.length >= 2;

  const metaQuery = useFilterMetadata();
  const meta = metaQuery.data;
  const tcgChips = meta?.tcgs ?? TCG_CHIPS;

  const { isAuthenticated } = useAuth();
  // Lightweight owned lookup for badges — top 150 by value, not the full vault.
  const collection = useQuery({
    queryKey: queryKeys.collection.list({ limit: 150, sort: "value_desc", lookup: true }),
    queryFn: () => fetchCollection({ limit: 150, sort: "value_desc" }),
    enabled: isAuthenticated,
    staleTime: 120_000,
  });

  const showResults =
    (query.trim().length > 0 && !query.startsWith("/")) ||
    activeCategory !== null ||
    quickfilter !== "all";
  const showLocalResults = showResults && !showLive;

  const sparks = useQuery({
    queryKey: queryKeys.cards.sparklines(),
    queryFn: fetchCardSparklines,
    enabled: isAuthenticated && showLocalResults,
    staleTime: 60_000,
  });
  const catalog = useQuery({
    queryKey: queryKeys.market.catalog(),
    queryFn: fetchMarketCatalog,
    enabled: showLocalResults,
    staleTime: 5 * 60_000,
  });

  const owned = useMemo(() => collection.data ?? [], [collection.data]);
  const ownedGradeIds = useMemo(() => new Set(owned.map((c) => c.id)), [owned]);

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
      .filter((e) => !ownedGradeIds.has(e.id))
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
  }, [owned, catalog.data, ownedGradeIds]);

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

  // ── Live backend catalog search ────────────────────────────────────────────
  const chipTcg: TcgChip = SUPPORTED_TCGS.has(selectedTcg) ? selectedTcg : "all";
  const liveTcg: TcgKey | "all" =
    chipTcg !== "all"
      ? chipTcg
      : activeCategory === "pokemon" || activeCategory === "magic" || activeCategory === "yugioh"
        ? activeCategory
        : "all";
  const live = useCardSearchPaged({ q: debouncedQuery, tcg: liveTcg, pageSize: 24 });
  const liveResults = React.useMemo(() => {
    let out = (live.data?.pages ?? []).flatMap((pg) => pg.results ?? []);
    if (quickfilter === "vintage") {
      out = out.filter((c) => (c.year ?? 0) < 2010);
    }
    if (quickfilter === "modern") {
      out = out.filter((c) => (c.year ?? 9999) >= 2020);
    }
    return out;
  }, [live.data, quickfilter]);
  const liveTotal = live.data?.pages?.[0]?.total ?? liveResults.length;
  const liveError = live.data?.pages?.[0]?.error;
  const livePartial = live.data?.pages?.[0]?.partial;
  const sealed = useSealedSearch(showLive ? debouncedQuery : "");

  const commitRecentSearch = (q: string) => {
    pushRecent(q);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      {/* Sticky search bar */}
      <View className="px-5 pb-3 pt-2">
        <View
          className="flex-row items-center gap-2.5 rounded-2xl border bg-bg-elevated pl-4 pr-2"
          style={{
            height: 50,
            // AI mode: the whole bar glows mint (the Notion "you're in a
            // different surface now" cue) — otherwise the normal hairline.
            borderColor: aiMode ? withAlpha(p.accent.mint, 0.55) : p.line.default,
            backgroundColor: aiMode
              ? withAlpha(p.accent.mint, 0.05)
              : undefined,
            shadowColor: aiMode ? p.accent.mint : "#000",
            shadowOpacity: aiMode ? 0.28 : 0.05,
            shadowRadius: aiMode ? 14 : 6,
            shadowOffset: { width: 0, height: aiMode ? 0 : 2 },
            elevation: aiMode ? 5 : 2,
          }}
        >
          {aiMode ? (
            <Animated.View
              style={{
                opacity: aiPill,
                transform: [
                  {
                    scale: aiPill.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
              }}
            >
              <Pressable
                onPress={exitAiMode}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Exit Loupe AI mode"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingLeft: 8,
                  paddingRight: 6,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: p.accent.mint,
                }}
              >
                <SparklesIcon size={11} color="#04150c" />
                <Text
                  style={{ color: "#04150c", fontSize: 11, fontWeight: "800" }}
                >
                  Loupe AI
                </Text>
                <X size={10} color="#04150c" />
              </Pressable>
            </Animated.View>
          ) : (
            <SearchIcon size={18} color={p.ink.muted} strokeWidth={2.4} />
          )}
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            maxLength={queryMaxChars}
            onSubmitEditing={() => {
              if (slashPanel) {
                acceptSlashCommand();
              } else if (aiMode) {
                if (query.trim().length >= 3) setAiAsked(true);
              } else {
                commitRecentSearch(query);
              }
            }}
            onKeyPress={(e) => {
              // Backspace on an empty description pops the Loupe AI tag —
              // the same muscle memory as removing a Notion inline tag.
              if (aiMode && query.length === 0 && e.nativeEvent.key === "Backspace") {
                exitAiMode();
              }
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            returnKeyType="search"
            placeholder={
              aiMode
                ? "Describe the card — colours, creatures, attacks…"
                : "Search cards, sets, years…  ( / for AI )"
            }
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
            onPress={() => (aiMode ? exitAiMode() : enterAiMode())}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={aiMode ? "Exit Loupe AI mode" : "Ask Loupe AI"}
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{
              backgroundColor: aiMode
                ? p.accent.mint
                : withAlpha(p.accent.mint, 0.14),
            }}
          >
            <SparklesIcon
              size={15}
              color={aiMode ? "#04150c" : p.accent.mint}
            />
          </Pressable>
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

        {/* Slash command palette (Slack-style): "/" lists the available
            command; tapping autocompletes into the Loupe AI tag. */}
        {slashPanel ? (
          <Pressable
            onPress={acceptSlashCommand}
            accessibilityRole="button"
            accessibilityLabel="Ask Loupe AI — describe the card in your own words"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginTop: 10,
              paddingHorizontal: 12,
              paddingVertical: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: withAlpha(p.accent.mint, 0.4),
              backgroundColor: withAlpha(p.accent.mint, 0.06),
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(p.accent.mint, 0.16),
              }}
            >
              <SparklesIcon size={16} color={p.accent.mint} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text
                  style={{ color: p.accent.mint, fontSize: 13, fontWeight: "800" }}
                >
                  /ai
                </Text>
                <Text
                  style={{ color: p.ink.default, fontSize: 13, fontWeight: "700" }}
                >
                  Ask Loupe AI
                </Text>
              </View>
              <Text style={{ color: p.ink.dim, fontSize: 11, marginTop: 1 }}>
                Command · describe the card in your own words
              </Text>
            </View>
            <ChevronRight size={15} color={p.ink.dim} />
          </Pressable>
        ) : null}

        {/* Recent searches — ONLY while the keyboard is up (input focused)
            and before live results take over (<2 chars typed). Idle
            browsing never shows the strip, so the discovery bands below
            stay clean. */}
        {!aiMode && !slashPanel && inputFocused && debouncedQuery.length < 2 ? (
          <RecentSearchStrip
            recent={recent}
            rails={recentRails}
            onPick={(value) => {
              setQuery(value);
              Keyboard.dismiss();
            }}
            onPickRail={(rail) => {
              openRail(rail);
              Keyboard.dismiss();
            }}
            onRemove={removeRecent}
            onRemoveRail={removeRecentRail}
            onClear={clearRecent}
          />
        ) : null}

        {/* Active rail-filter tag — the shelf the user expanded via "view
            more". Sticky beside the input so it's obvious what's filtering
            the page; the X returns to normal browsing. */}
        {railActive ? (
          <View style={{ flexDirection: "row", paddingTop: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                maxWidth: "100%",
                paddingLeft: 10,
                paddingRight: 4,
                paddingVertical: 5,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: p.accent.mint,
                backgroundColor: withAlpha(p.accent.mint, 0.12),
              }}
            >
              <ListFilter size={12} color={p.accent.mint} />
              <Text
                numberOfLines={1}
                style={{
                  flexShrink: 1,
                  color: p.accent.mint,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {railTitle || railId}
                {railGame !== "all"
                  ? ` · ${TCG_CHIPS.find((c) => c.key === railGame)?.label ?? railGame}`
                  : ""}
              </Text>
              <Pressable
                onPress={clearRail}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Clear shelf filter"
                style={{
                  width: 20,
                  height: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                }}
              >
                <X size={11} color={p.accent.mint} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* TCG facet chips (drive the live backend search) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 12, paddingRight: 8 }}
        >
          {tcgChips.map((c) => {
            const active = selectedTcg === c.key;
            const supported = SUPPORTED_TCGS.has(c.key as any);
            return (
              <Pressable
                key={c.key}
                onPress={() => setSelectedTcg(c.key as any)}
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

        {/* Quickfilter chips — hidden in AI mode (only the game tags
            matter to a description). */}
        {aiMode ? null : (
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
        )}

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
        {aiMode ? (
          <AiModePanel
            query={query}
            game={aiGame}
            asked={aiAsked}
            onAsk={() => setAiAsked(true)}
            onPickCandidate={(name) => {
              // A candidate tap = "that's the one": pop back to normal
              // search with the exact name.
              exitAiMode();
              setQuery(name);
            }}
          />
        ) : showLive ? (
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
            interpreted={live.data?.pages?.[0]?.interpreted ?? null}
            onResultTap={commitRecentSearch}
            onTryAi={enterAiMode}
          />
        ) : railActive ? (
          // The expanded shelf — full paginated contents behind the tag above.
          // A typed query takes over (live search), and returns here on clear.
          <RailResultsSection
            game={railGame}
            railId={railId}
            fallbackTitle={railTitle}
            onClear={clearRail}
            onLoaded={pushRecentRail}
          />
        ) : !showLocalResults ? (
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
              <BrowseCategoryCarousel
                categories={CATEGORIES}
                activeKey={selectedTcg}
                onSelect={(key) => {
                  // Same facet as the TCG chips above — drives
                  // ResolvedCarousels (/v1/public/carousels/resolved),
                  // identical to the web marketplace. Toggle off → All.
                  setSelectedTcg((prev) =>
                    prev === key ? "all" : (key as TcgChip),
                  );
                  setActiveCategory(null);
                }}
              />
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
                        <ViewMoreLink
                          label="View more"
                          onPress={() =>
                            openRail({
                              id: "trending",
                              game: "all",
                              title: "Trending now",
                            })
                          }
                        />
                      }
                    />
                    <TrendingSection />
                  </View>

                  <View style={{ gap: 8 }}>
                    <SectionHeader eyebrow="Sealed" title="Sealed products" />
                    <SealedRail products={sealed.data ?? []} />
                  </View>

                  <View style={{ gap: 8 }}>
                    <SectionHeader
                      eyebrow="Pokémon"
                      title="Chase rares"
                      trailing={
                        <ViewMoreLink
                          onPress={() =>
                            openRail({
                              id: "trending",
                              game: "pokemon",
                              title: "Trending in Pokémon",
                            })
                          }
                        />
                      }
                    />
                    <HotRightNowRail tcg="pokemon" limit={12} />
                  </View>
                  <View style={{ gap: 8 }}>
                    <SectionHeader
                      eyebrow="Yu-Gi-Oh!"
                      title="Newest releases"
                      trailing={
                        <ViewMoreLink
                          onPress={() =>
                            openRail({
                              id: "trending",
                              game: "yugioh",
                              title: "Trending in Yu-Gi-Oh!",
                            })
                          }
                        />
                      }
                    />
                    <HotRightNowRail tcg="yugioh" limit={12} />
                  </View>
                  <View style={{ gap: 8 }}>
                    <SectionHeader
                      eyebrow="Magic"
                      title="EDHREC favorites"
                      trailing={
                        <ViewMoreLink
                          onPress={() =>
                            openRail({
                              id: "trending",
                              game: "magic",
                              title: "Trending in Magic",
                            })
                          }
                        />
                      }
                    />
                    <HotRightNowRail tcg="magic" limit={12} />
                  </View>
                </>
              ) : (
                // Per-game: the EXACT same carousels the web marketplace shows,
                // resolved by the backend (/v1/public/carousels/resolved) into
                // trending + value/rarity rails + explore, each already filled
                // with cards and with empty rails dropped server-side.
                <>
                  <ResolvedCarousels
                    tcg={selectedTcg}
                    onViewMore={(rail) =>
                      openRail({
                        id: rail.id,
                        game: selectedTcg,
                        title: rail.title,
                      })
                    }
                  />
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

/** The standard "View more ›" rail affordance — opens a shelf filter tag. */
function ViewMoreLink({
  onPress,
  label = "View more",
}: {
  onPress: () => void;
  label?: string;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-1"
    >
      <Text className="text-xs font-medium text-ink-muted">{label}</Text>
      <ChevronRight size={14} color={p.ink.dim} />
    </Pressable>
  );
}

function RecentSearchStrip({
  recent,
  rails,
  onPick,
  onPickRail,
  onRemove,
  onRemoveRail,
  onClear,
}: {
  recent: string[];
  rails: RecentRail[];
  onPick: (value: string) => void;
  onPickRail: (rail: RecentRail) => void;
  onRemove: (value: string) => void;
  onRemoveRail: (rail: RecentRail) => void;
  onClear: () => void;
}) {
  const p = useThemedPalette();
  if (recent.length === 0 && rails.length === 0) return null;
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
        {rails.map((rail) => (
          <View
            key={`rail:${rail.game}:${rail.id}`}
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
              borderColor: withAlpha(p.accent.mint, 0.45),
              backgroundColor: withAlpha(p.accent.mint, 0.08),
            }}
          >
            <ListFilter size={12} color={p.accent.mint} />
            <Pressable
              onPress={() => onPickRail(rail)}
              hitSlop={6}
              style={{ flexShrink: 1 }}
            >
              <Text
                numberOfLines={1}
                style={{ color: p.accent.mint, fontSize: 12, fontWeight: "700" }}
              >
                {rail.title}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onRemoveRail(rail)}
              hitSlop={6}
              style={{
                width: 20,
                height: 20,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
              }}
              accessibilityRole="button"
              accessibilityLabel={`Remove shelf filter ${rail.title}`}
            >
              <X size={11} color={p.ink.dim} />
            </Pressable>
          </View>
        ))}
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
  interpreted,
  onResultTap,
  onTryAi,
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
  /** What the backend's zero-AI parser understood ("Newest · Pokémon · Under $50"). */
  interpreted?: SearchInterpretation | null;
  onResultTap?: (q: string) => void;
  /** Enter Loupe AI mode ("describe it instead") from a dead-end search. */
  onTryAi?: () => void;
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

      {/* What the backend's zero-AI parser understood from the query —
          "newest pokemon under $50" → chips, Google's "showing results
          for" pattern. Purely informative; the filters already applied. */}
      {interpreted && interpreted.chips.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            marginTop: 8,
          }}
        >
          <ListFilter size={12} color={p.accent.mint} />
          {interpreted.chips.map((chip) => (
            <View
              key={chip}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: withAlpha(p.accent.mint, 0.4),
                backgroundColor: withAlpha(p.accent.mint, 0.08),
              }}
            >
              <Text
                style={{ color: p.accent.mint, fontSize: 10, fontWeight: "800" }}
              >
                {chip}
              </Text>
            </View>
          ))}
        </View>
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
            {/* No name match — describing it is the natural next step. */}
            {onTryAi ? (
              <Pressable
                onPress={onTryAi}
                accessibilityRole="button"
                accessibilityLabel="Switch to Loupe AI and describe the card"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 12,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: withAlpha(p.accent.mint, 0.35),
                  backgroundColor: withAlpha(p.accent.mint, pressed ? 0.14 : 0.07),
                })}
              >
                <SparklesIcon size={15} color={p.accent.mint} />
                <Text
                  style={{ color: p.accent.mint, fontSize: 13, fontWeight: "800" }}
                >
                  Try Loupe AI — describe it instead
                </Text>
              </Pressable>
            ) : null}
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
