/**
 * CardPriceChart (mobile) — the canonical wrapper that feeds a card's price
 * history into the shared `MarketChart`. Mirrors the web `CardPriceChart`:
 * owns the active range, maps it to the backend bucket (1W→7d … ALL→all), and
 * renders the shared chart in controlled mode so web + mobile draw the same line.
 *
 * Primary line = the current tier (raw, or the tapped house/grade filter). When
 * `compare` tiers are supplied (the "compare grades" chips), each is fetched in
 * parallel from `/v1/cards/{id}/prices?house&grade` and overlaid as a distinctly
 * colored line — so you can compare PSA vs BGS vs CGC vs raw at a glance, just
 * like the web.
 */
import React, { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { ChartSeries, RangeKey } from "@loupe/chart";
import { useCardPriceHistory } from "@/application/queries/catalog/useCardPriceHistory";
import { queryKeys } from "@/application/queries/queryKeys";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { MarketChart } from "@/presentation/components/MarketChart";
import { palette } from "@/presentation/theme/tokens";
import { useMoney } from "@/presentation/components/Price";
import type { MarketSnapshotWire, PriceHistoryWire } from "@/infrastructure/http";
import type { ComparePreset } from "./compareTiers";

type Bucket = "7d" | "30d" | "90d" | "1y" | "all";

/** The card chart's range set (matches the web `CARD_CHART_RANGES`). */
const RANGES: RangeKey[] = ["1W", "1M", "3M", "1Y", "ALL"];

const RANGE_TO_BUCKET: Record<RangeKey, Bucket> = {
  "1D": "7d",
  "1W": "7d",
  "1M": "30d",
  "3M": "90d",
  "6M": "1y",
  "1Y": "1y",
  ALL: "all",
};

/** Color for the primary (your-selection) line when overlaying compares —
 *  read from the live palette so it tracks the active theme. */
const primaryColor = () => palette.accent.mint;

function toPoints(wire: PriceHistoryWire | undefined) {
  return (wire?.points ?? [])
    .filter((pt) => Number.isFinite(pt.price))
    .map((pt) => ({ t: Date.parse(pt.ts), v: pt.price }));
}

export interface CardPriceChartProps {
  history: MarketSnapshotWire["history"] | undefined;
  cardId?: string;
  /** Grading house to scope the primary line to ("raw" | "psa" | …). */
  houseFilter?: string;
  /** Grade within the house (e.g. "10"). */
  gradeFilter?: string;
  /** Grading-house tiers to overlay as distinct compare lines. */
  compare?: ComparePreset[];
  defaultRange?: RangeKey;
  height?: number;
  title?: string;
  /** Suspends the navigator swipe-back while scrubbing (see MarketChart). */
  onScrubbingChange?: (active: boolean) => void;
  /** Bleed the plot past host padding (Robinhood full-bleed). */
  bleedX?: number;
  /** Rendered at the right end of the range row (e.g. Advanced). */
  rangeTrailing?: React.ReactNode;
}

export function CardPriceChart({
  history,
  cardId,
  houseFilter,
  gradeFilter,
  compare = [],
  defaultRange = "1Y",
  height = 220,
  title,
  onScrubbingChange,
  bleedX,
  rangeTrailing,
}: CardPriceChartProps) {
  const [range, setRange] = useState<RangeKey>(defaultRange);
  // Chart header + axis render in the display currency via the shared
  // conversion hook (live backend FX), like every other price surface.
  const { format: money } = useMoney();
  const formatUsd = (v: number) => (Number.isFinite(v) ? money(v, { compact: false }) : "—");
  const bucket = RANGE_TO_BUCKET[range];
  const comparing = compare.length > 0;

  // Primary line: (house, grade) filter → fetch the scaled per-tier series; the
  // raw line uses the buckets already loaded with the market snapshot.
  const filterActive = !!cardId && !!houseFilter && houseFilter !== "raw";
  const filteredQuery = useCardPriceHistory({
    id: filterActive ? cardId : null,
    range: bucket,
    house: houseFilter,
    grade: gradeFilter,
    enabled: filterActive,
  });
  const primaryWire = filterActive ? filteredQuery.data : history?.[bucket];

  // Compare overlays — fetched in parallel from the per-tier prices endpoint.
  const compareResults = useQueries({
    queries: compare.map((t) => ({
      queryKey: queryKeys.cards.priceHistory(cardId ?? "", bucket, t.house, t.grade),
      queryFn: () => {
        const qs = new URLSearchParams({ range: bucket, house: t.house });
        if (t.grade) qs.set("grade", t.grade);
        return apiFetch<PriceHistoryWire>(`${ENDPOINTS.cards.prices(cardId!)}?${qs.toString()}`);
      },
      enabled: !!cardId,
      staleTime: 5 * 60_000,
    })),
  });

  const series: ChartSeries[] = useMemo(() => {
    const out: ChartSeries[] = [];
    const primaryPts = toPoints(primaryWire);
    if (primaryPts.length >= 2) {
      out.push({
        id: "primary",
        label:
          houseFilter && houseFilter !== "raw"
            ? `${houseFilter.toUpperCase()} ${gradeFilter ?? ""}`.trim()
            : "Raw",
        points: primaryPts,
        // Fixed color only when overlaying; otherwise undefined → MarketChart
        // applies color-by-change (mint/rose).
        color: comparing ? primaryColor() : undefined,
      });
    }
    compare.forEach((t, i) => {
      const pts = toPoints(compareResults[i]?.data);
      if (pts.length >= 2) {
        out.push({ id: t.key, label: t.label, points: pts, color: t.color });
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryWire, compareResults, compare, comparing, houseFilter, gradeFilter]);

  return (
    <MarketChart
      series={series}
      height={height}
      title={title}
      range={range}
      ranges={RANGES}
      onRangeChange={setRange}
      onScrubbingChange={onScrubbingChange}
      bleedX={bleedX}
      rangeTrailing={rangeTrailing}
      format={formatUsd}
      colorByChange={!comparing}
      fillArea={!comparing}
    />
  );
}
