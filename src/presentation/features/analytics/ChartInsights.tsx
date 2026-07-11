/**
 * ChartInsights — the "why did it move?" strip under the portfolio chart.
 *
 *   ▲ Led by Umbreon VMAX   +$230.00 (+4.1%)        ← tap → card detail
 *   [Best day +$412]  [Worst day −$120]  [Lo $58.2k · Hi $62.1k]  [+3 added]
 *
 * Everything here is backend-computed on `/v1/grades/history` with the SAME
 * ratio model that draws the line, so the numbers can never disagree with
 * the chart. Renders nothing until the enriched fields exist (older
 * backend) — progressive enhancement, no skeletons.
 */

import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ArrowDownRight, ArrowUpRight } from "lucide-react-native";
import type { PortfolioSeries } from "@/domain/charts";
import { useMoney } from "@/presentation/components/Price";
import { routes } from "@/shared/routes";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export function ChartInsights({ series }: { series: PortfolioSeries | undefined }) {
  const p = useThemedPalette();
  const { format } = useMoney();

  if (!series) return null;
  const lead = series.movers?.[0] ?? null;
  const best = series.bestDay ?? null;
  const worst = series.worstDay ?? null;
  const hasBand = series.highUsd != null && series.lowUsd != null && series.highUsd > series.lowUsd;
  const added = (series.events ?? []).reduce((n, e) => n + e.count, 0);
  const addedValue = (series.events ?? []).reduce((v, e) => v + e.valueUsd, 0);

  if (!lead && !best && !worst && !hasBand && added === 0) return null;

  return (
    <View style={{ gap: 10, marginTop: 12 }}>
      {lead && lead.name ? (
        <Pressable
          onPress={lead.cardId ? () => router.push(routes.card(lead.cardId as string)) : undefined}
          accessibilityRole="button"
          accessibilityLabel={`${series.timeframe} move led by ${lead.name}, ${
            lead.deltaUsd >= 0 ? "up" : "down"
          } ${format(Math.abs(lead.deltaUsd))}. Open card.`}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          {lead.deltaUsd >= 0 ? (
            <ArrowUpRight size={14} color={p.accent.mint} strokeWidth={2.6} />
          ) : (
            <ArrowDownRight size={14} color={p.accent.rose} strokeWidth={2.6} />
          )}
          <Text numberOfLines={1} style={{ flexShrink: 1, color: p.ink.muted, fontSize: 12.5 }}>
            Led by <Text style={{ color: p.ink.default, fontWeight: "700" }}>{lead.name}</Text>
          </Text>
          <Text
            style={{
              color: lead.deltaUsd >= 0 ? p.accent.mint : p.accent.rose,
              fontSize: 12.5,
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
            }}
          >
            {lead.deltaUsd >= 0 ? "+" : "−"}
            {format(Math.abs(lead.deltaUsd))} ({lead.deltaUsd >= 0 ? "+" : "−"}
            {Math.abs(lead.deltaPct).toFixed(1)}%)
          </Text>
        </Pressable>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {best ? (
          <InsightChip label={`Best day +${format(best.deltaUsd)}`} tint={p.accent.mint} />
        ) : null}
        {worst ? (
          <InsightChip
            label={`Worst day −${format(Math.abs(worst.deltaUsd))}`}
            tint={p.accent.rose}
          />
        ) : null}
        {hasBand ? (
          <InsightChip
            label={`Lo ${format(series.lowUsd as number)} · Hi ${format(series.highUsd as number)}`}
            tint={p.ink.muted}
          />
        ) : null}
        {added > 0 ? (
          <InsightChip label={`+${added} added · ${format(addedValue)}`} tint={p.accent.blue} />
        ) : null}
      </View>
    </View>
  );
}

function InsightChip({ label, tint }: { label: string; tint: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: withAlpha(tint, 0.35),
        backgroundColor: withAlpha(tint, 0.1),
      }}
    >
      <Text
        style={{
          color: tint,
          fontSize: 11,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        }}
      >
        {label}
      </Text>
    </View>
  );
}
