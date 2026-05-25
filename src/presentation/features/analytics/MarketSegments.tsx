/**
 * Market segment analytics — server-driven slices of the portfolio.
 *
 * All widgets are purely presentational; the data is produced by
 * `GET /v1/analytics/overview` (see `analyticsRepository`). No
 * client-side aggregation lives here.
 */
import React from "react";
import { Text, View } from "react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { compactUsd } from "@/shared/format";
import type {
  AnalyticsOverview,
  AnalyticsSetIndex,
  AnalyticsYearBucket,
} from "@/infrastructure/repositories/analyticsRepository";

/* ─── Set Indexes ───────────────────────────────────────────────────── */

interface SetIndexesProps {
  indexes: AnalyticsSetIndex[];
}

export function SetIndexes({ indexes }: SetIndexesProps) {
  const p = useThemedPalette();
  if (indexes.length === 0) return null;
  return (
    <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
      {indexes.map((idx, i) => {
        const hasChange = idx.changePct1y != null;
        const up = hasChange ? idx.changePct1y! >= 0 : true;
        const tint = !hasChange ? p.ink.muted : up ? p.accent.mint : p.accent.rose;
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
                  {idx.count} {idx.count === 1 ? "holding" : "holdings"} ·{" "}
                  {idx.sharePct.toFixed(1)}% of book
                </Text>
              </View>
              <View style={{ minWidth: 84, alignItems: "flex-end" }}>
                <Text className="text-sm font-bold text-ink">
                  {compactUsd(idx.totalValueUsd)}
                </Text>
                <Text style={{ color: tint, fontSize: 11, fontWeight: "700" }}>
                  {hasChange
                    ? `${up ? "▲" : "▼"} ${Math.abs(idx.changePct1y!).toFixed(2)}%`
                    : "NO DATA"}
                </Text>
              </View>
            </View>
            <View
              className="mt-2 h-1 overflow-hidden rounded-full"
              style={{ backgroundColor: withAlpha(p.ink.dim, 0.12) }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${Math.max(2, idx.sharePct)}%`,
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
  buckets: AnalyticsYearBucket[];
}

export function YearDistribution({ buckets }: YearDistributionProps) {
  const p = useThemedPalette();
  if (buckets.length === 0) return null;
  const maxValue = Math.max(...buckets.map((b) => b.valueUsd));
  return (
    <View className="rounded-2xl border border-line bg-bg-elevated p-4">
      <View
        className="flex-row items-end justify-between"
        style={{ height: 110, gap: 8 }}
      >
        {buckets.map((b) => {
          const h = maxValue > 0 ? Math.max(6, (b.valueUsd / maxValue) * 96) : 6;
          return (
            <View key={b.decade} className="flex-1 items-center" style={{ gap: 6 }}>
              <Text className="text-[10px] font-semibold text-ink-dim">
                {compactUsd(b.valueUsd)}
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
  concentration: AnalyticsOverview["concentration"];
}

export function ConcentrationCard({ concentration }: ConcentrationCardProps) {
  const p = useThemedPalette();
  if (!concentration) return null;
  return (
    <View className="rounded-2xl border border-line bg-bg-elevated p-4">
      <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-ink-dim">
        Top holding
      </Text>
      <Text numberOfLines={1} className="mt-1 text-base font-semibold text-ink">
        {concentration.top1.cardName ?? "—"}
      </Text>
      <View className="mt-3 gap-2.5">
        <ConcentrationBar label="Top 1" pct={concentration.top1Pct} tint={p.accent.amber} />
        <ConcentrationBar label="Top 3" pct={concentration.top3Pct} tint={p.accent.blue} />
        <ConcentrationBar label="Top 5" pct={concentration.top5Pct} tint={p.accent.mint} />
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
  stats: AnalyticsOverview["stats"];
}

export function StatsGrid({ stats }: StatsGridProps) {
  if (stats.holdings === 0) return null;
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      <StatCell label="Holdings" value={stats.holdings.toString()} />
      <StatCell label="Sets" value={stats.uniqueSets.toString()} />
      <StatCell label="Avg Grade" value={stats.avgGrade.toFixed(2)} />
      <StatCell label="Gem Rate" value={`${stats.gemRatePct.toFixed(0)}%`} />
      <StatCell label="Avg Value" value={compactUsd(stats.avgValueUsd)} />
      <StatCell label="Oldest" value={stats.oldestYear?.toString() ?? "—"} />
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
