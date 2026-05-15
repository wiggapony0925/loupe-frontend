/**
 * Market segment analytics — PriceCharting-style data slices over the
 * collection. Bundles four reusable read-only widgets:
 *
 *   • SetIndexes      — per-set aggregate "index" with sparkline + delta
 *   • YearDistribution — bar histogram of holdings by year
 *   • ConcentrationCard — top-N share of total portfolio value
 *   • StatsGrid       — compact 6-up KPI grid
 *
 * All widgets are pure derivations of the collection + sparkline maps
 * the parent screen already fetches — no new API calls.
 */
import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { Sparkline } from "@/components/ui/Sparkline";
import { useThemedPalette, withAlpha } from "@/theme/tokens";
import { compactUsd } from "@/lib/format";
import type { CollectionCard } from "@/types/domain";

interface SparkData {
  cardId: string;
  points: number[];
  deltaPct: number;
}

/* ─── Set Indexes ───────────────────────────────────────────────────── */

interface SetIndexesProps {
  cards: CollectionCard[];
  sparkMap: Map<string, SparkData>;
}

export function SetIndexes({ cards, sparkMap }: SetIndexesProps) {
  const p = useThemedPalette();
  const indexes = useMemo(() => {
    const groups = new Map<string, CollectionCard[]>();
    for (const c of cards) {
      const list = groups.get(c.set) ?? [];
      list.push(c);
      groups.set(c.set, list);
    }
    return Array.from(groups.entries())
      .map(([setName, items]) => {
        const totalValue = items.reduce((s, c) => s + c.estimatedValueUsd, 0);
        // Aggregate sparkline by summing per-card points point-wise (length-aware).
        const len = sparkMap.get(items[0]!.id)?.points.length ?? 14;
        const agg = new Array(len).fill(0);
        for (const c of items) {
          const sp = sparkMap.get(c.id);
          if (!sp) continue;
          for (let i = 0; i < len; i++) agg[i] += sp.points[i] ?? c.estimatedValueUsd;
        }
        const first = agg[0] || 1;
        const last = agg[len - 1] || first;
        const deltaPct = ((last - first) / first) * 100;
        return {
          setName,
          count: items.length,
          totalValue,
          spark: agg,
          deltaPct,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [cards, sparkMap]);

  const grandTotal = indexes.reduce((s, x) => s + x.totalValue, 0);

  if (indexes.length === 0) return null;

  return (
    <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
      {indexes.map((idx, i) => {
        const up = idx.deltaPct >= 0;
        const tint = up ? p.accent.mint : p.accent.rose;
        const sharePct = grandTotal > 0 ? (idx.totalValue / grandTotal) * 100 : 0;
        return (
          <View
            key={idx.setName}
            className={`px-4 py-3 ${i > 0 ? "border-t border-line/60" : ""}`}
          >
            <View className="flex-row items-center gap-3">
              <View style={{ flex: 1.2 }}>
                <Text numberOfLines={1} className="text-sm font-semibold text-ink">
                  {idx.setName}
                </Text>
                <Text className="text-[11px] text-ink-muted">
                  {idx.count} {idx.count === 1 ? "holding" : "holdings"} · {sharePct.toFixed(1)}%
                  of book
                </Text>
              </View>
              <View style={{ width: 72 }}>
                <Sparkline values={idx.spark} width={72} height={28} showBaseline={false} />
              </View>
              <View style={{ minWidth: 84, alignItems: "flex-end" }}>
                <Text className="text-sm font-bold text-ink">{compactUsd(idx.totalValue)}</Text>
                <Text style={{ color: tint, fontSize: 11, fontWeight: "700" }}>
                  {up ? "▲" : "▼"} {Math.abs(idx.deltaPct).toFixed(2)}%
                </Text>
              </View>
            </View>
            {/* Share-of-book bar */}
            <View
              className="mt-2 h-1 overflow-hidden rounded-full"
              style={{ backgroundColor: withAlpha(p.ink.dim, 0.12) }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${Math.max(2, sharePct)}%`,
                  backgroundColor: tint,
                  borderRadius: 999,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ─── Year Distribution ─────────────────────────────────────────────── */

interface YearDistributionProps {
  cards: CollectionCard[];
}

export function YearDistribution({ cards }: YearDistributionProps) {
  const p = useThemedPalette();
  const buckets = useMemo(() => {
    const counts = new Map<number, { count: number; value: number }>();
    for (const c of cards) {
      const decade = Math.floor(c.year / 10) * 10;
      const cur = counts.get(decade) ?? { count: 0, value: 0 };
      counts.set(decade, {
        count: cur.count + 1,
        value: cur.value + c.estimatedValueUsd,
      });
    }
    return Array.from(counts.entries())
      .map(([decade, v]) => ({ decade, ...v }))
      .sort((a, b) => a.decade - b.decade);
  }, [cards]);

  if (buckets.length === 0) return null;
  const maxValue = Math.max(...buckets.map((b) => b.value));

  return (
    <View className="rounded-2xl border border-line bg-bg-elevated p-4">
      <View
        className="flex-row items-end justify-between"
        style={{ height: 110, gap: 8 }}
      >
        {buckets.map((b) => {
          const h = maxValue > 0 ? Math.max(6, (b.value / maxValue) * 96) : 6;
          return (
            <View key={b.decade} className="flex-1 items-center" style={{ gap: 6 }}>
              <Text className="text-[10px] font-semibold text-ink-dim">
                {compactUsd(b.value)}
              </Text>
              <View
                style={{
                  width: "70%",
                  height: h,
                  borderRadius: 6,
                  backgroundColor: withAlpha(p.accent.mint, 0.85),
                }}
              />
            </View>
          );
        })}
      </View>
      <View className="mt-2 flex-row justify-between" style={{ gap: 8 }}>
        {buckets.map((b) => (
          <View key={b.decade} className="flex-1 items-center">
            <Text className="text-[11px] font-bold text-ink">{b.decade}s</Text>
            <Text className="text-[10px] text-ink-muted">
              {b.count} {b.count === 1 ? "card" : "cards"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─── Concentration Card ────────────────────────────────────────────── */

interface ConcentrationCardProps {
  cards: CollectionCard[];
}

export function ConcentrationCard({ cards }: ConcentrationCardProps) {
  const p = useThemedPalette();
  const stats = useMemo(() => {
    if (cards.length === 0) return null;
    const sorted = [...cards].sort((a, b) => b.estimatedValueUsd - a.estimatedValueUsd);
    const total = sorted.reduce((s, c) => s + c.estimatedValueUsd, 0);
    const top1 = sorted[0]!.estimatedValueUsd;
    const top3 = sorted.slice(0, 3).reduce((s, c) => s + c.estimatedValueUsd, 0);
    const top5 = sorted.slice(0, 5).reduce((s, c) => s + c.estimatedValueUsd, 0);
    return {
      total,
      top1Pct: (top1 / total) * 100,
      top3Pct: (top3 / total) * 100,
      top5Pct: (top5 / total) * 100,
      top1Name: sorted[0]!.title,
    };
  }, [cards]);

  if (!stats) return null;

  return (
    <View className="rounded-2xl border border-line bg-bg-elevated p-4">
      <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-ink-dim">
        Top holding
      </Text>
      <Text numberOfLines={1} className="mt-1 text-base font-semibold text-ink">
        {stats.top1Name}
      </Text>
      <View className="mt-3 gap-2.5">
        <ConcentrationBar label="Top 1" pct={stats.top1Pct} tint={p.accent.amber} />
        <ConcentrationBar label="Top 3" pct={stats.top3Pct} tint={p.accent.blue} />
        <ConcentrationBar label="Top 5" pct={stats.top5Pct} tint={p.accent.mint} />
      </View>
    </View>
  );
}

function ConcentrationBar({ label, pct, tint }: { label: string; pct: number; tint: string }) {
  const p = useThemedPalette();
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-semibold uppercase tracking-[1.5px] text-ink-muted">
          {label}
        </Text>
        <Text className="text-[12px] font-bold text-ink">{pct.toFixed(1)}%</Text>
      </View>
      <View
        className="mt-1 h-1.5 overflow-hidden rounded-full"
        style={{ backgroundColor: withAlpha(p.ink.dim, 0.12) }}
      >
        <View
          style={{
            height: "100%",
            width: `${Math.min(100, pct)}%`,
            backgroundColor: tint,
            borderRadius: 999,
          }}
        />
      </View>
    </View>
  );
}

/* ─── Stats Grid ────────────────────────────────────────────────────── */

interface StatsGridProps {
  cards: CollectionCard[];
}

export function StatsGrid({ cards }: StatsGridProps) {
  const stats = useMemo(() => {
    if (cards.length === 0) return null;
    const total = cards.reduce((s, c) => s + c.estimatedValueUsd, 0);
    const avgGrade = cards.reduce((s, c) => s + c.grade, 0) / cards.length;
    const gemCount = cards.filter((c) => c.grade >= 9.5).length;
    const setCount = new Set(cards.map((c) => c.set)).size;
    const years = cards.map((c) => c.year);
    return {
      holdings: cards.length,
      sets: setCount,
      avgGrade,
      gemRate: (gemCount / cards.length) * 100,
      avgValue: total / cards.length,
      vintage: Math.min(...years),
    };
  }, [cards]);

  if (!stats) return null;

  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      <StatCell label="Holdings" value={stats.holdings.toString()} />
      <StatCell label="Sets" value={stats.sets.toString()} />
      <StatCell label="Avg Grade" value={stats.avgGrade.toFixed(2)} />
      <StatCell label="Gem Rate" value={`${stats.gemRate.toFixed(0)}%`} />
      <StatCell label="Avg Value" value={compactUsd(stats.avgValue)} />
      <StatCell label="Oldest" value={stats.vintage.toString()} />
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="rounded-xl border border-line bg-bg-elevated px-3 py-2.5"
      style={{ flexBasis: "31%", flexGrow: 1 }}
    >
      <Text className="text-[9px] font-semibold uppercase tracking-[2px] text-ink-dim">
        {label}
      </Text>
      <Text className="mt-1 text-base font-bold text-ink">{value}</Text>
    </View>
  );
}
