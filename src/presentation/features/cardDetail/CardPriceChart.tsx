/**
 * CardPriceChart (mobile) — the canonical wrapper that feeds a card's price
 * history into the shared `MarketChart`. Mirrors the web `CardPriceChart`:
 * owns the active range, maps it to the backend bucket (1W→7d … ALL→all),
 * and renders the shared chart in controlled mode so web + mobile draw the
 * exact same line.
 *
 * When a (house, grade) filter is active — e.g. the user tapped a graded-row
 * to scope the chart to "PSA 10" — it fetches the scaled per-tier series via
 * `useCardPriceHistory`; otherwise it reads the pre-loaded snapshot buckets.
 */
import React, { useMemo, useState } from "react";
import type { ChartSeries, RangeKey } from "@loupe/chart";
import { useCardPriceHistory } from "@/application/queries/catalog/useCardPriceHistory";
import { MarketChart } from "@/presentation/components/MarketChart";
import type { MarketSnapshotWire } from "@/infrastructure/http";

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

function formatUsd(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export interface CardPriceChartProps {
  history: MarketSnapshotWire["history"] | undefined;
  cardId?: string;
  /** Grading house to scope to ("raw" | "psa" | …). Omit for the raw line. */
  houseFilter?: string;
  /** Grade within the house (e.g. "10"). */
  gradeFilter?: string;
  defaultRange?: RangeKey;
  height?: number;
  title?: string;
  /** Suspends the navigator swipe-back while scrubbing (see MarketChart). */
  onScrubbingChange?: (active: boolean) => void;
}

export function CardPriceChart({
  history,
  cardId,
  houseFilter,
  gradeFilter,
  defaultRange = "1Y",
  height = 220,
  title,
  onScrubbingChange,
}: CardPriceChartProps) {
  const [range, setRange] = useState<RangeKey>(defaultRange);
  const bucket = RANGE_TO_BUCKET[range];

  // (house, grade) filter → fetch the scaled per-tier series. The raw line
  // uses the buckets already loaded with the market snapshot (no refetch).
  const filterActive = !!cardId && !!houseFilter && houseFilter !== "raw";
  const filteredQuery = useCardPriceHistory({
    id: filterActive ? cardId : null,
    range: bucket,
    house: houseFilter,
    grade: gradeFilter,
    enabled: filterActive,
  });

  const wire = filterActive ? filteredQuery.data : history?.[bucket];

  const series: ChartSeries[] = useMemo(() => {
    const points = wire?.points ?? [];
    if (points.length < 2) return [];
    return [
      {
        id: "price",
        // `ts` is an ISO date; normalizeSeries falls back to index spacing
        // if any timestamp fails to parse.
        points: points.map((pt) => ({ t: Date.parse(pt.ts), v: pt.price })),
      },
    ];
  }, [wire]);

  return (
    <MarketChart
      series={series}
      height={height}
      title={title}
      range={range}
      ranges={RANGES}
      onRangeChange={setRange}
      onScrubbingChange={onScrubbingChange}
      format={formatUsd}
    />
  );
}
