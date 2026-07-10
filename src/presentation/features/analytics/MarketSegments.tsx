/**
 * Market segment analytics — server-driven slices of the portfolio.
 *
 * All widgets are purely presentational; the data is produced by
 * `GET /v1/analytics/overview` (see `analyticsRepository`). No
 * client-side aggregation lives here.
 */
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import {
  Award,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import { buildBars } from "@loupe/chart";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useMoney } from "@/presentation/components/Price";
import type {
  AnalyticsOverview,
  AnalyticsSetIndex,
  AnalyticsYearBucket,
} from "@/infrastructure/repositories/analyticsRepository";

/* ─── Set Indexes ───────────────────────────────────────────────────── */

/** Rows shown before the list collapses (web Analytics parity). */
const VISIBLE_SETS = 4;

interface SetIndexesProps {
  indexes: AnalyticsSetIndex[];
}

export function SetIndexes({ indexes }: SetIndexesProps) {
  const p = useThemedPalette();
  const [showAll, setShowAll] = useState(false);
  if (indexes.length === 0) return null;
  const visible = showAll ? indexes : indexes.slice(0, VISIBLE_SETS);
  const hiddenCount = indexes.length - VISIBLE_SETS;
  return (
    <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
      {visible.map((idx, i) => (
        <SetIndexRow key={idx.setName} idx={idx} first={i === 0} />
      ))}
      {indexes.length > VISIBLE_SETS ? (
        <Pressable
          onPress={() => setShowAll((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={
            showAll ? "Show fewer sets" : `Show ${hiddenCount} more sets`
          }
          style={({ pressed }) => ({
            alignItems: "center",
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: withAlpha(p.ink.dim, 0.14),
            opacity: pressed ? 0.75 : 1,
          })}
        >
          {/* Inner row keeps label + chevron on ONE line regardless of
              outer layout — pill wash so the control reads as a button. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: withAlpha(p.accent.mint, 0.1),
            }}
          >
            <Text
              numberOfLines={1}
              style={{ color: p.accent.mint, fontSize: 12.5, fontWeight: "800" }}
            >
              {showAll ? "Show less" : `Show ${hiddenCount} more sets`}
            </Text>
            {showAll ? (
              <ChevronUp size={14} color={p.accent.mint} strokeWidth={2.8} />
            ) : (
              <ChevronDown size={14} color={p.accent.mint} strokeWidth={2.8} />
            )}
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

function SetIndexRow({ idx, first }: { idx: AnalyticsSetIndex; first: boolean }) {
  const p = useThemedPalette();
  const { format } = useMoney();
  const hasChange = idx.changePct1y != null;
  const up = hasChange ? idx.changePct1y! >= 0 : true;
  const tint = !hasChange ? p.ink.muted : up ? p.accent.mint : p.accent.rose;
  return (
    <View className={`px-4 py-3 ${first ? "" : "border-t border-line/60"}`}>
      <View className="flex-row items-center gap-3">
        {/* Official set logo — Layers glyph when the catalog has none. */}
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(p.ink.dim, 0.08),
            overflow: "hidden",
          }}
        >
          {idx.setLogoUrl ? (
            <Image
              source={{ uri: idx.setLogoUrl }}
              style={{ width: 28, height: 28 }}
              contentFit="contain"
              transition={120}
            />
          ) : (
            <Layers size={15} color={p.ink.muted} strokeWidth={2.2} />
          )}
        </View>
        <View style={{ flex: 1.2, minWidth: 0 }}>
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
            {format(idx.totalValueUsd)}
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
}

/* ─── Year Distribution ─────────────────────────────────────────────── */

interface YearDistributionProps {
  buckets: AnalyticsYearBucket[];
}

export function YearDistribution({ buckets }: YearDistributionProps) {
  const p = useThemedPalette();
  const { format } = useMoney();
  if (buckets.length === 0) return null;
  // `fraction` (valueUsd / max) from the shared `@loupe/chart` bar math — the
  // web BarChart + mobile GradeBars use the same.
  const { bars } = buildBars({
    data: buckets.map((b) => ({ label: String(b.decade), value: b.valueUsd })),
  });
  return (
    <View className="rounded-2xl border border-line bg-bg-elevated p-4">
      <View
        className="flex-row items-end justify-between"
        style={{ height: 110, gap: 8 }}
      >
        {buckets.map((b, i) => {
          const h = Math.max(6, (bars[i]?.fraction ?? 0) * 96);
          return (
            <View key={b.decade} className="flex-1 items-center" style={{ gap: 6 }}>
              <Text className="text-[10px] font-semibold text-ink-dim">
                {format(b.valueUsd)}
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
  const { format } = useMoney();
  const p = useThemedPalette();
  if (stats.holdings === 0) return null;
  // 2×2 tinted hero metrics (web Analytics MetricCard parity).
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      <HeroCell
        tint={p.accent.mint}
        icon={Wallet}
        label="Collection value"
        value={format(stats.totalValueUsd)}
        caption={`${stats.holdings.toLocaleString()} cards`}
      />
      <HeroCell
        tint={p.accent.blue}
        icon={Layers}
        label="Holdings"
        value={stats.holdings.toLocaleString()}
        caption={`${stats.uniqueSets} ${stats.uniqueSets === 1 ? "set" : "sets"} · avg ${format(stats.avgValueUsd)}`}
      />
      <HeroCell
        tint={p.accent.purple}
        icon={Award}
        label="Avg grade"
        value={stats.avgGrade ? stats.avgGrade.toFixed(1) : "—"}
        caption={`${stats.gemRatePct.toFixed(0)}% gem rate`}
      />
      <HeroCell
        tint={p.accent.amber}
        icon={Sparkles}
        label="Oldest card"
        value={stats.oldestYear?.toString() ?? "—"}
        caption={stats.oldestYear ? "vintage anchor" : "no dated cards yet"}
      />
    </View>
  );
}

function HeroCell({
  tint,
  icon: Icon,
  label,
  value,
  caption,
}: {
  tint: string;
  icon: LucideIcon;
  label: string;
  value: string;
  caption: string;
}) {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flexBasis: "47%",
        flexGrow: 1,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: withAlpha(tint, 0.28),
        backgroundColor: withAlpha(tint, 0.06),
        paddingHorizontal: 13,
        paddingVertical: 12,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon size={13} color={tint} strokeWidth={2.5} />
        <Text
          numberOfLines={1}
          style={{
            color: p.ink.dim,
            fontSize: 9,
            fontWeight: "800",
            letterSpacing: 1.4,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: p.ink.default,
          fontSize: 19,
          fontWeight: "800",
          letterSpacing: -0.4,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Text numberOfLines={1} style={{ color: p.ink.muted, fontSize: 10.5 }}>
        {caption}
      </Text>
    </View>
  );
}
