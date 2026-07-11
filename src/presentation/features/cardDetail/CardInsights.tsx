/**
 * Card detail "insights" — three derived strips that surface every
 * useful number we already have on hand without adding any new
 * endpoints:
 *
 *   1. `CardQuickStats` — server-derived via `/v1/cards/{id}/analytics`:
 *      Spread (Raw → PSA10), Volatility (90d stdev
 *      %), Liquidity (sales in last 30d), Last sale (relative time).
 *
 *   2. `CardMarketSignals` — 52-week high/low pills, "X% off high"
 *      chip, trend-agreement chip, cross-house arbitrage spread
 *      (BGS 10 vs PSA 10), and auction-ending-soon count.
 *
 *   3. `CardCostBasisStrip` — owned-card unrealized P/L, straight from
 *      the backend `/v1/cards/{id}/ownership` rollup (the SAME numbers
 *      `CardOwnershipSection` and the web ownership panel render — the
 *      client never re-derives P/L from market price).
 *
 * Each component renders nothing (returns `null`) when its inputs
 * aren't available, so the parent can mount all three unconditionally
 * and the screen stays clean for cards with thin data.
 */
import React from "react";
import { Text, View } from "react-native";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Flame,
  Gavel,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { Price, useMoney } from "@/presentation/components/Price";
import { useCardAnalytics } from "@/application/queries/catalog/useCardAnalytics";
import { useCardComps } from "@/application/queries/catalog/useCardComps";
import { useCardListings } from "@/application/queries/catalog/useCardListings";
import { useCardOwnership } from "@/application/queries/collection/useCardOwnership";
import type {
  HouseBlockWire,
  MarketSnapshotWire,
} from "@/infrastructure/http";

/* ── shared helpers ──────────────────────────────────────────────── */

function formatRelative(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diffSec = Math.max(0, (Date.now() - t) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.round(diffSec / 3600)}h ago`;
  const days = Math.round(diffSec / 86_400);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

function findGrade(
  houses: HouseBlockWire[],
  house: string,
  gradeLabel: string,
) {
  const block = houses.find((b) => b.house === house);
  if (!block) return undefined;
  return block.grades.find((g) => g.grade_label === gradeLabel);
}

/* ── shared atom: a labelled stat tile ───────────────────────────── */

interface MicroTileProps {
  label: string;
  value: string;
  tone?: "neutral" | "mint" | "rose" | "amber";
  sub?: string;
}

function MicroTile({ label, value, tone = "neutral", sub }: MicroTileProps) {
  const p = useThemedPalette();
  const accent =
    tone === "mint"
      ? p.accent.mint
      : tone === "rose"
        ? p.accent.rose
        : tone === "amber"
          ? p.accent.amber
          : p.ink.default;
  return (
    <View
      style={{
        flex: 1,
        minWidth: 84,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
        gap: 2,
      }}
    >
      <Text
        style={{
          color: p.ink.dim,
          fontSize: 9,
          letterSpacing: 1.2,
          fontWeight: "700",
        }}
      >
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: accent, fontSize: 15, fontWeight: "800" }}>
        {value}
      </Text>
      {sub ? (
        <Text style={{ color: p.ink.muted, fontSize: 10 }}>{sub}</Text>
      ) : null}
    </View>
  );
}

/* ── 1. Quick stats ──────────────────────────────────────────────── */

export function CardQuickStats({
  snapshot,
  cardId,
}: {
  snapshot: MarketSnapshotWire | undefined;
  cardId: string;
}) {
  // Spread / volatility / liquidity come from the backend
  // `/v1/cards/{id}/analytics` — the SAME payload CardAnalyticsSection
  // renders (React Query dedupes), so web + mobile show identical figures
  // and the client never re-derives them from raw history/comps.
  const analyticsQ = useCardAnalytics(cardId);
  const analytics = analyticsQ.data;
  // Comps are only the last-sale fallback now — never re-aggregated.
  const compsQ = useCardComps(cardId, { days: 90, limit: 100 });
  const comps = compsQ.data?.comps ?? [];

  const spread = analytics?.grade_premium ?? null;
  const vol = analytics?.volatility_pct ?? null;
  const last30 = analytics?.liquidity_30d ?? 0;

  // Last sale freshness — prefer summary, fall back to newest comp.
  const lastSaleIso =
    snapshot?.summary.last_sale_at ?? comps[0]?.sold_at ?? null;
  const lastSaleRel = formatRelative(lastSaleIso);

  // Bail early if we have literally nothing.
  if (
    spread === null &&
    vol === null &&
    last30 === 0 &&
    lastSaleRel === null
  ) {
    return null;
  }

  return (
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      <MicroTile
        label="Spread"
        value={spread !== null ? `${spread.toFixed(1)}×` : "—"}
        sub="PSA 10 / Raw"
      />
      <MicroTile
        label="Volatility"
        value={vol !== null ? `${vol.toFixed(1)}%` : "—"}
        sub="90d stdev"
        tone={vol !== null && vol > 25 ? "amber" : "neutral"}
      />
      <MicroTile
        label="Liquidity"
        value={`${last30}`}
        sub="sales · 30d"
        tone={last30 >= 10 ? "mint" : last30 === 0 ? "rose" : "neutral"}
      />
      <MicroTile
        label="Last sale"
        value={lastSaleRel ?? "—"}
        sub={
          snapshot?.summary.primary_house
            ? snapshot.summary.primary_house.toString().toUpperCase()
            : undefined
        }
      />
    </View>
  );
}

/* ── 2. Market signals (chips) ───────────────────────────────────── */

interface SignalChipProps {
  icon?: React.ReactNode;
  label: string;
  tone?: "neutral" | "mint" | "rose" | "amber";
}

function SignalChip({ icon, label, tone = "neutral" }: SignalChipProps) {
  const p = useThemedPalette();
  const color =
    tone === "mint"
      ? p.accent.mint
      : tone === "rose"
        ? p.accent.rose
        : tone === "amber"
          ? p.accent.amber
          : p.ink.muted;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: withAlpha(color, 0.35),
        backgroundColor: withAlpha(color, 0.1),
      }}
    >
      {icon}
      <Text style={{ color, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function CardMarketSignals({
  snapshot,
  cardId,
}: {
  snapshot: MarketSnapshotWire | undefined;
  cardId: string;
}) {
  const listingsQ = useCardListings(cardId);
  const listings = listingsQ.data?.listings ?? [];
  const p = useThemedPalette();

  const oneYear = snapshot?.history?.["1y"];
  const hi = oneYear?.summary?.max ?? null;
  const lo = oneYear?.summary?.min ?? null;
  const current = oneYear?.summary?.current ?? snapshot?.summary.pop_top?.amount ?? null;
  const offHighPct =
    hi !== null && current !== null && hi > 0
      ? ((current - hi) / hi) * 100
      : null;

  // Find when the 52w high / low actually happened so the chip can
  // show "high $X · 3mo ago" rather than just a bare number.
  const oneYearPoints = oneYear?.points ?? [];
  const hiPoint =
    hi !== null
      ? oneYearPoints.reduce<typeof oneYearPoints[number] | null>(
          (best, pt) =>
            best === null || pt.price > best.price ? pt : best,
          null,
        )
      : null;
  const loPoint =
    lo !== null
      ? oneYearPoints.reduce<typeof oneYearPoints[number] | null>(
          (best, pt) =>
            best === null || pt.price < best.price ? pt : best,
          null,
        )
      : null;
  const hiAgo = hiPoint ? formatRelative(hiPoint.ts) : null;
  const loAgo = loPoint ? formatRelative(loPoint.ts) : null;

  // Trend agreement — do 30d, 90d, 1y all point the same direction?
  const ch30 = snapshot?.history?.["30d"]?.summary?.change_pct ?? null;
  const ch90 = snapshot?.history?.["90d"]?.summary?.change_pct ?? null;
  const ch1y = snapshot?.history?.["1y"]?.summary?.change_pct ?? null;
  let trendChip: { label: string; tone: "mint" | "rose" | "neutral" } | null = null;
  if (ch30 !== null && ch90 !== null && ch1y !== null) {
    const allUp = ch30 > 0 && ch90 > 0 && ch1y > 0;
    const allDown = ch30 < 0 && ch90 < 0 && ch1y < 0;
    if (allUp) trendChip = { label: "Trending up", tone: "mint" };
    else if (allDown) trendChip = { label: "Trending down", tone: "rose" };
  }

  // Cross-house arbitrage — PSA 10 vs BGS 10 spread.
  const psa10 = findGrade(snapshot?.houses ?? [], "psa", "10");
  const bgs10 = findGrade(snapshot?.houses ?? [], "bgs", "10");
  let arbChip: { label: string; tone: "amber" | "neutral" } | null = null;
  if (psa10?.market.amount && bgs10?.market.amount) {
    const diff = ((bgs10.market.amount - psa10.market.amount) / psa10.market.amount) * 100;
    if (Math.abs(diff) >= 8) {
      arbChip = {
        label: `BGS 10 ${diff > 0 ? "+" : ""}${diff.toFixed(0)}% vs PSA 10`,
        tone: "amber",
      };
    }
  }

  // Auction-ending-soon.
  const endingSoon = listings.filter(
    (l) => l.is_auction && l.time_left_seconds !== null && l.time_left_seconds < 86_400,
  ).length;

  const hasAny =
    hi !== null ||
    lo !== null ||
    offHighPct !== null ||
    trendChip ||
    arbChip ||
    endingSoon > 0;
  if (!hasAny) return null;

  return (
    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
      {hi !== null ? (
        <SignalChip
          icon={<TrendingUp size={11} color={p.accent.mint} />}
          label={`52w high $${hi.toLocaleString(undefined, { maximumFractionDigits: 0 })}${hiAgo ? ` · ${hiAgo}` : ""}`}
          tone="mint"
        />
      ) : null}
      {lo !== null ? (
        <SignalChip
          icon={<TrendingDown size={11} color={p.accent.rose} />}
          label={`52w low $${lo.toLocaleString(undefined, { maximumFractionDigits: 0 })}${loAgo ? ` · ${loAgo}` : ""}`}
          tone="rose"
        />
      ) : null}
      {offHighPct !== null && offHighPct < -1 ? (
        <SignalChip
          label={`${offHighPct.toFixed(1)}% off high`}
          tone="amber"
        />
      ) : null}
      {trendChip ? (
        <SignalChip
          icon={
            trendChip.tone === "mint" ? (
              <ArrowUpRight size={11} color={p.accent.mint} />
            ) : (
              <ArrowDownRight size={11} color={p.accent.rose} />
            )
          }
          label={trendChip.label}
          tone={trendChip.tone}
        />
      ) : null}
      {arbChip ? (
        <SignalChip
          icon={<Flame size={11} color={p.accent.amber} />}
          label={arbChip.label}
          tone={arbChip.tone}
        />
      ) : null}
      {endingSoon > 0 ? (
        <SignalChip
          icon={<Gavel size={11} color={p.accent.amber} />}
          label={`${endingSoon} auction${endingSoon > 1 ? "s" : ""} ending <24h`}
          tone="amber"
        />
      ) : null}
      {snapshot?.tiers_total ? (
        <SignalChip
          icon={<Clock size={11} color={p.ink.muted} />}
          label={`${snapshot.tiers_total} priced tiers`}
        />
      ) : null}
    </View>
  );
}

/* ── 3. Cost basis strip (owned card) ────────────────────────────── */

/** Decimal-string wire value → finite number (null-safe). */
function decimalNum(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function CardCostBasisStrip({ cardId }: { cardId: string }) {
  const { format: money } = useMoney();
  const p = useThemedPalette();
  // Backend-composed rollup across every owned copy — grade-aware holding
  // value vs recorded cost. React Query dedupes with CardOwnershipSection's
  // call on the same screen, so this costs no extra request.
  const { data: ownership } = useCardOwnership(cardId);

  const cost = decimalNum(ownership?.cost_basis_usd);
  const current = decimalNum(ownership?.holding_value_usd);
  const pnl = decimalNum(ownership?.unrealized_pl_usd);
  const pnlPct = ownership?.unrealized_pl_pct ?? null;

  if (
    !ownership?.owned ||
    cost === null ||
    current === null ||
    pnl === null ||
    pnlPct === null
  ) {
    return null;
  }

  const positive = pnl >= 0;
  const color = positive ? p.accent.mint : p.accent.rose;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: withAlpha(color, 0.35),
        backgroundColor: withAlpha(color, 0.08),
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(color, 0.2),
        }}
      >
        {positive ? (
          <ArrowUpRight size={16} color={color} />
        ) : (
          <ArrowDownRight size={16} color={color} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: p.ink.dim,
            fontSize: 9,
            letterSpacing: 1.4,
            fontWeight: "700",
          }}
        >
          YOUR P/L
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Text style={{ color, fontSize: 18, fontWeight: "800" }}>
            {positive ? "+" : "−"}
            {money(Math.abs(pnl), { compact: false })}
          </Text>
          <Text style={{ color, fontSize: 12, fontWeight: "700" }}>
            ({positive ? "+" : ""}
            {pnlPct.toFixed(1)}%)
          </Text>
        </View>
        <Text style={{ color: p.ink.muted, fontSize: 11, marginTop: 2 }}>
          Cost{" "}
          <Price usd={cost} className="text-[11px] text-ink-muted" /> · Now{" "}
          <Price usd={current} className="text-[11px] text-ink-muted" />
        </Text>
      </View>
    </View>
  );
}
