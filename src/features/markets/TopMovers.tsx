/**
 * Robinhood-style "Top Movers" list — turns the user's collection into a
 * stock-market watchlist. Each row: symbol + name on the left, sparkline
 * in the middle, tinted price chip on the right. Tap a row to open the
 * card's forensic report.
 *
 * The sparkline data is a deterministic seeded walk per card id so the
 * UI is stable across renders without needing a real per-card price API.
 */
import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Sparkline, seededWalk } from "@/components/ui/Sparkline";
import { useThemedPalette, withAlpha } from "@/theme/tokens";
import { compactUsd } from "@/lib/format";
import type { CollectionCard } from "@/types/domain";

interface TopMoversProps {
  cards: CollectionCard[];
  /** How many rows to render. Defaults to 5. */
  limit?: number;
}

export function TopMovers({ cards, limit = 5 }: TopMoversProps) {
  const p = useThemedPalette();
  const rows = useMemo(() => {
    return cards
      .slice()
      .sort((a, b) => b.estimatedValueUsd - a.estimatedValueUsd)
      .slice(0, limit)
      .map((c) => {
        const walk = seededWalk(c.id, c.estimatedValueUsd, 24);
        const first = walk[0]!;
        const last = walk[walk.length - 1]!;
        const deltaUsd = last - first;
        const deltaPct = first > 0 ? (deltaUsd / first) * 100 : 0;
        return { card: c, walk, deltaUsd, deltaPct, up: deltaUsd >= 0 };
      });
  }, [cards, limit]);

  if (rows.length === 0) return null;

  return (
    <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
      {rows.map((row, i) => {
        const tint = row.up ? p.accent.mint : p.accent.rose;
        return (
          <Pressable
            key={row.card.id}
            onPress={() => router.push(`/scan/${row.card.id}`)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            className={`flex-row items-center gap-3 px-4 py-3 ${
              i > 0 ? "border-t border-line/60" : ""
            }`}
          >
            {/* Symbol + name */}
            <View style={{ flex: 1.2 }}>
              <Text numberOfLines={1} className="text-sm font-semibold text-ink">
                {symbolFor(row.card)}
              </Text>
              <Text numberOfLines={1} className="text-[11px] text-ink-muted">
                {row.card.title}
              </Text>
            </View>

            {/* Sparkline */}
            <View style={{ width: 80 }}>
              <Sparkline values={row.walk} width={80} height={32} />
            </View>

            {/* Price chip */}
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: tint,
                minWidth: 88,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                {compactUsd(row.card.estimatedValueUsd)}
              </Text>
              <Text
                style={{
                  color: withAlpha("#ffffff", 0.85),
                  fontSize: 9,
                  fontWeight: "600",
                  letterSpacing: 0.3,
                  marginTop: 1,
                }}
              >
                {row.up ? "▲" : "▼"} {Math.abs(row.deltaPct).toFixed(2)}%
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Builds a stock-ticker-style symbol from the card's set + grade.
 * "Charizard — Holo" / Pokemon Base Set / 9.5 → "CHA · 9.5"
 */
function symbolFor(card: CollectionCard): string {
  const base = card.title.split(/[—\-:·]/)[0]!.trim();
  const ticker = base.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "CARD";
  return `${ticker} · ${card.grade.toFixed(card.grade % 1 === 0 ? 0 : 1)}`;
}
