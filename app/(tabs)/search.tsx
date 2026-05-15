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
import { router } from "expo-router";
import { Camera, Clock, Search as SearchIcon, X } from "lucide-react-native";
import { fetchCardSparklines, fetchCollection } from "@/api/forensicApi";
import { Sparkline } from "@/components/ui/Sparkline";
import { compactUsd } from "@/lib/format";
import { gradeColor, palette, useThemedPalette, withAlpha } from "@/theme/tokens";
import type { CollectionCard } from "@/types/domain";

type Quickfilter = "all" | "graded" | "vintage" | "modern";

interface Category {
  key: string;
  label: string;
  /** Display monogram if no image. */
  mono: string;
  tint: string;
  /** Match predicate against a card to decide membership. */
  match: (c: CollectionCard) => boolean;
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
  const [recent, setRecent] = useState<string[]>([]);

  const collection = useQuery({ queryKey: ["collection"], queryFn: fetchCollection });
  const sparks = useQuery({
    queryKey: ["card-sparklines"],
    queryFn: fetchCardSparklines,
    staleTime: 60_000,
  });

  const cards = useMemo(() => collection.data ?? [], [collection.data]);
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
    if (quickfilter === "graded") out = out.filter((c) => c.grade >= 9);
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
          className="flex-row items-center gap-2 rounded-2xl border border-line bg-bg-elevated px-3"
          style={{ height: 48 }}
        >
          <Pressable
            onPress={() => router.push("/scan/phone?mode=quick")}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: withAlpha(p.accent.mint, 0.12) }}
          >
            <Camera size={16} color={p.accent.mint} />
          </Pressable>
          <SearchIcon size={16} color={p.ink.muted} />
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
            >
              <X size={16} color={p.ink.muted} />
            </Pressable>
          ) : null}
        </View>

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
        {!showResults ? (
          <>
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
  card: CollectionCard;
  spark?: number[];
  deltaPct: number;
  bordered: boolean;
}) {
  const p = useThemedPalette();
  const up = deltaPct >= 0;
  const tint = up ? p.accent.mint : p.accent.rose;
  const gradeTint = gradeColor(card.grade);

  return (
    <Pressable
      onPress={() => router.push(`/scan/${card.id}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className={`flex-row items-center gap-3 px-4 py-3 ${bordered ? "border-t border-line/60" : ""}`}
    >
      <View
        className="overflow-hidden rounded-lg"
        style={{ width: 36, height: 50, backgroundColor: palette.bg.sunken }}
      >
        <Image source={{ uri: card.thumbnailUri }} style={{ width: 36, height: 50 }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} className="text-sm font-semibold text-ink">
          {card.title}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1.5">
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
