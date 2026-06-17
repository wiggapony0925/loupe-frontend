/**
 * `RecentSoldPanel` — last-90-day recent-sold scatter + median, aggregated
 * across every comp source the backend can reach.
 *
 * The backend (`comps_service.py` → `registry.fan_out_comps`) already fans
 * out across all configured providers — eBay's API *and* the keyless
 * 130point scraper — and returns a unified `SoldCompWire[]`, each tagged
 * with its `source`. We render whatever comes back (no client-side source
 * filter), so recent-sold stays populated even when eBay's API is down or
 * unconfigured. Each row shows a small source chip for provenance, and the
 * header summarizes which sources contributed.
 *
 * The list under the chart is capped to ten most-recent rows; the eBay
 * header action opens sold-search for the card as a convenience escape
 * hatch to the full firehose.
 */

import React, { useMemo } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import Svg, { Circle, Line as SvgLine, Text as SvgText } from "react-native-svg";
import { useCardComps } from "@/application/queries/catalog/useCardComps";
import { Skeleton } from "@/presentation/components/Skeleton";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import type { SoldCompWire } from "@/infrastructure/http";

export interface RecentSoldPanelProps {
  cardId: string;
  /** Display name used to build a generic eBay search fallback link. */
  cardName?: string | null;
}

const CHART_H = 140;
const CHART_PAD = { top: 12, right: 12, bottom: 20, left: 32 };

/** Human label for a comp `source` slug (e.g. "ebay" → "eBay"). */
function sourceLabel(source: string): string {
  switch (source.toLowerCase()) {
    case "ebay":
      return "eBay";
    case "130point":
      return "130point";
    case "pwcc":
      return "PWCC";
    case "goldin":
      return "Goldin";
    default:
      return source.charAt(0).toUpperCase() + source.slice(1);
  }
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!;
}

function fmtUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RecentSoldPanel({ cardId, cardName }: RecentSoldPanelProps) {
  const p = useThemedPalette();
  const q = useCardComps(cardId, { days: 90, limit: 100 });

  // Render every source the backend returned, ascending by date for the
  // scatter. No client-side source filter — provenance is shown per-row.
  const comps = useMemo<SoldCompWire[]>(
    () =>
      (q.data?.comps ?? [])
        .slice()
        .sort(
          (a, b) =>
            new Date(a.sold_at).getTime() - new Date(b.sold_at).getTime(),
        ),
    [q.data?.comps],
  );

  const med = useMemo(
    () => median(comps.map((c) => c.price.amount).filter((n) => Number.isFinite(n))),
    [comps],
  );

  // Distinct contributing sources, ordered by sale count, for the header.
  const sourceSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of comps) {
      counts.set(c.source, (counts.get(c.source) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([source]) => sourceLabel(source));
  }, [comps]);

  const ebaySearchUrl = cardName
    ? `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(cardName)}&LH_Sold=1&LH_Complete=1`
    : null;

  function openEbay() {
    if (ebaySearchUrl) {
      Linking.openURL(ebaySearchUrl).catch(() => undefined);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{
              color: p.ink.dim,
              fontSize: 10,
              fontWeight: "700",
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            Recent Sales
          </Text>
          <Text numberOfLines={1} style={{ color: p.ink.muted, fontSize: 11, flexShrink: 1 }}>
            90d · {comps.length} sales
            {sourceSummary.length > 0 ? ` · ${sourceSummary.join(" + ")}` : ""}
          </Text>
        </View>
        {ebaySearchUrl ? (
          <Pressable onPress={openEbay} hitSlop={8} accessibilityRole="button">
            <Text style={{ color: p.accent.mint, fontSize: 11, fontWeight: "800" }}>
              eBay
            </Text>
          </Pressable>
        ) : null}
      </View>

      {q.isLoading ? (
        <Skeleton width="100%" height={CHART_H} radius={14} />
      ) : comps.length === 0 ? (
        <View
          style={{
            paddingVertical: 16,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: p.line.default,
          }}
        >
          <Text style={{ color: p.ink.muted, fontSize: 12 }}>
            No recent sales in the last 90 days
          </Text>
        </View>
      ) : (
        <>
          <ScatterChart points={comps} median={med} palette={p} />
          <View
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: p.line.default,
              backgroundColor: p.bg.elevated,
              overflow: "hidden",
            }}
          >
            {comps.slice(-10).reverse().map((c, i, arr) => (
              <CompRow
                key={`${c.url || c.sold_at}:${i}`}
                comp={c}
                isLast={i === arr.length - 1}
                palette={p}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function ScatterChart({
  points,
  median,
  palette: p,
}: {
  points: SoldCompWire[];
  median: number;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  const W = 320;
  const H = CHART_H;
  const innerW = W - CHART_PAD.left - CHART_PAD.right;
  const innerH = H - CHART_PAD.top - CHART_PAD.bottom;

  const times = points.map((c) => new Date(c.sold_at).getTime()).filter((t) => !Number.isNaN(t));
  const prices = points.map((c) => c.price.amount).filter((n) => Number.isFinite(n));
  if (times.length === 0 || prices.length === 0) return null;

  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const tRange = tMax - tMin || 1;
  const pRange = pMax - pMin || 1;

  const medianY = CHART_PAD.top + innerH - ((median - pMin) / pRange) * innerH;

  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
        padding: 8,
      }}
    >
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Median line */}
        <SvgLine
          x1={CHART_PAD.left}
          x2={W - CHART_PAD.right}
          y1={medianY}
          y2={medianY}
          stroke={withAlpha(p.accent.mint, 0.5)}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <SvgText
          x={W - CHART_PAD.right}
          y={medianY - 4}
          fill={p.accent.mint}
          fontSize={9}
          fontWeight="700"
          textAnchor="end"
        >
          {`med ${fmtUsd(median)}`}
        </SvgText>
        {/* Y-axis bounds */}
        <SvgText x={4} y={CHART_PAD.top + 8} fill={p.ink.dim} fontSize={9}>
          {fmtUsd(pMax)}
        </SvgText>
        <SvgText x={4} y={H - CHART_PAD.bottom + 4} fill={p.ink.dim} fontSize={9}>
          {fmtUsd(pMin)}
        </SvgText>
        {/* Points */}
        {points.map((c, i) => {
          const t = new Date(c.sold_at).getTime();
          if (Number.isNaN(t)) return null;
          const x = CHART_PAD.left + ((t - tMin) / tRange) * innerW;
          const y = CHART_PAD.top + innerH - ((c.price.amount - pMin) / pRange) * innerH;
          return (
            <Circle
              key={i}
              cx={x}
              cy={y}
              r={3}
              fill={p.accent.mint}
              fillOpacity={0.7}
            />
          );
        })}
        {/* X-axis bounds */}
        <SvgText x={CHART_PAD.left} y={H - 4} fill={p.ink.dim} fontSize={9}>
          {fmtDate(new Date(tMin).toISOString())}
        </SvgText>
        <SvgText
          x={W - CHART_PAD.right}
          y={H - 4}
          fill={p.ink.dim}
          fontSize={9}
          textAnchor="end"
        >
          {fmtDate(new Date(tMax).toISOString())}
        </SvgText>
      </Svg>
    </View>
  );
}

function CompRow({
  comp,
  isLast,
  palette: p,
}: {
  comp: SoldCompWire;
  isLast: boolean;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  function open() {
    if (comp.url) Linking.openURL(comp.url).catch(() => undefined);
  }
  return (
    <Pressable
      onPress={open}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: p.line.default,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: p.ink.default, fontSize: 12, fontWeight: "600" }}>
          {comp.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 5,
              backgroundColor: withAlpha(p.ink.dim, 0.12),
            }}
          >
            <Text style={{ color: p.ink.muted, fontSize: 9, fontWeight: "700", letterSpacing: 0.3 }}>
              {sourceLabel(comp.source)}
            </Text>
          </View>
          <Text style={{ color: p.ink.muted, fontSize: 10 }}>
            {fmtDate(comp.sold_at)}
            {comp.grade ? ` · ${(comp.house ?? "").toUpperCase()} ${comp.grade}` : ""}
            {comp.condition ? ` · ${comp.condition}` : ""}
          </Text>
        </View>
      </View>
      <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "700" }}>
        ${comp.price.amount.toFixed(2)}
      </Text>
    </Pressable>
  );
}
