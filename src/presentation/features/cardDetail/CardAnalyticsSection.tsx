/**
 * CardAnalyticsSection — derived market analytics for a card, from the
 * server-composed `GET /v1/cards/{id}/analytics` (public). Mirrors the web
 * "Market analytics" panel: a momentum strip (7D/30D/90D/1Y) plus a metric
 * grid (market cap, grade premium, volatility, liquidity, all-time high/low).
 *
 * Renders nothing until the endpoint returns priced data, so it's safe to
 * mount unconditionally on any card.
 */
import React from "react";
import { Text, View } from "react-native";
import { Activity } from "lucide-react-native";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { useMoney } from "@/presentation/components/Price";
import { useCardAnalytics } from "@/application/queries/catalog/useCardAnalytics";

type Tone = "neutral" | "mint" | "rose" | "amber";

function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function Tile({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
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
        flexGrow: 1,
        flexBasis: 150,
        minWidth: 108,
        padding: 12,
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
      <Text style={{ color: accent, fontSize: 17, fontWeight: "800" }}>
        {value}
      </Text>
      {sub ? (
        <Text style={{ color: p.ink.muted, fontSize: 10 }}>{sub}</Text>
      ) : null}
    </View>
  );
}

export function CardAnalyticsSection({ cardId }: { cardId: string }) {
  const p = useThemedPalette();
  const money = useMoney();
  const { data } = useCardAnalytics(cardId);

  if (!data || data.market_price_usd == null) return null;

  const marketCap = num(data.market_cap_usd);
  const ath = num(data.all_time_high_usd);
  const atl = num(data.all_time_low_usd);

  const momentum: { label: string; v: number | null }[] = [
    { label: "7D", v: data.momentum_7d },
    { label: "30D", v: data.momentum_30d },
    { label: "90D", v: data.momentum_90d },
    { label: "1Y", v: data.momentum_1y },
  ];
  const hasMomentum = momentum.some((m) => m.v != null);

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Activity size={13} color={p.ink.dim} strokeWidth={2.25} />
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Market Analytics
        </Text>
      </View>

      {hasMomentum ? (
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            padding: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
          }}
        >
          {momentum.map((m) => (
            <View key={m.label} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <Text
                style={{
                  color: p.ink.dim,
                  fontSize: 10,
                  letterSpacing: 1,
                  fontWeight: "700",
                }}
              >
                {m.label}
              </Text>
              <Text
                style={{
                  color:
                    m.v == null
                      ? p.ink.dim
                      : m.v >= 0
                        ? p.accent.mint
                        : p.accent.rose,
                  fontSize: 14,
                  fontWeight: "800",
                }}
              >
                {m.v == null ? "—" : `${m.v >= 0 ? "+" : ""}${m.v.toFixed(1)}%`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Tile
          label="Market cap"
          value={marketCap != null ? money.format(marketCap, { compact: true }) : "—"}
          sub={data.population ? `${data.population.toLocaleString()} graded` : undefined}
        />
        <Tile
          label="Grade premium"
          value={data.grade_premium != null ? `${data.grade_premium.toFixed(1)}×` : "—"}
          sub="top grade vs raw"
        />
        <Tile
          label="Volatility"
          value={data.volatility_pct != null ? `${data.volatility_pct.toFixed(1)}%` : "—"}
          sub="90d"
          tone={data.volatility_pct != null && data.volatility_pct > 25 ? "amber" : "neutral"}
        />
        <Tile
          label="Liquidity"
          value={`${data.liquidity_30d}`}
          sub="sales · 30d"
          tone={data.liquidity_30d >= 10 ? "mint" : data.liquidity_30d === 0 ? "rose" : "neutral"}
        />
        <Tile
          label="All-time high"
          value={ath != null ? money.format(ath, { compact: false }) : "—"}
          sub={
            data.pct_off_ath != null
              ? `${data.pct_off_ath > 0 ? "+" : ""}${data.pct_off_ath.toFixed(1)}% now`
              : undefined
          }
          tone={data.pct_off_ath != null && data.pct_off_ath < -1 ? "amber" : "neutral"}
        />
        <Tile
          label="All-time low"
          value={atl != null ? money.format(atl, { compact: false }) : "—"}
        />
      </View>
    </View>
  );
}
