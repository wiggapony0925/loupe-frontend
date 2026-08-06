/**
 * ChartInsights — the "why did it move?" strip under the portfolio chart.
 *
 * ONE draggable row (edge-to-edge, house carousel rule), the attribution
 * riding as its lead chip:
 *
 *   [▲ Led by Umbreon VMAX +$230 (+4.1%)] [Best day +$412] [Worst −$120] …
 *
 * The old layout spent a full line on "Led by …" and then wrapped four
 * chips into a 2x2 block — five rows of chart telemetry. As a single
 * swipeable rail it's one row, and the attribution gets the first slot
 * (the place a thumb starts) instead of its own floor.
 *
 * Everything here is backend-computed on `/v1/grades/history` with the SAME
 * ratio model that draws the line, so the numbers can never disagree with
 * the chart. Renders nothing until the enriched fields exist (older
 * backend) — progressive enhancement, no skeletons.
 */

import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ArrowDownRight, ArrowUpRight } from "lucide-react-native";
import type { PortfolioSeries } from "@/domain/charts";
import { useMoney } from "@/presentation/components/Price";
import { routes } from "@/shared/routes";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export function ChartInsights({
  series,
  bleedX = 0,
}: {
  series: PortfolioSeries | undefined;
  /** Page gutter to bleed past (the standing rule for swipe surfaces). */
  bleedX?: number;
}) {
  const p = useThemedPalette();
  const { format } = useMoney();

  if (!series) return null;
  const lead = series.movers?.[0] ?? null;
  const best = series.bestDay ?? null;
  const worst = series.worstDay ?? null;
  const hasBand =
    series.highUsd != null && series.lowUsd != null && series.highUsd > series.lowUsd;
  const added = (series.events ?? []).reduce((n, e) => n + e.count, 0);
  const addedValue = (series.events ?? []).reduce((v, e) => v + e.valueUsd, 0);

  if (!lead && !best && !worst && !hasBand && added === 0) return null;

  const leadUp = (lead?.deltaUsd ?? 0) >= 0;
  const leadTint = leadUp ? p.accent.mint : p.accent.rose;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -bleedX, marginTop: 12 }}
      contentContainerStyle={[styles.rail, { paddingHorizontal: bleedX }]}
    >
      {lead && lead.name ? (
        <Pressable
          onPress={
            lead.cardId ? () => router.push(routes.card(lead.cardId as string)) : undefined
          }
          disabled={!lead.cardId}
          accessibilityRole="button"
          accessibilityLabel={`${series.timeframe} move led by ${lead.name}, ${
            leadUp ? "up" : "down"
          } ${format(Math.abs(lead.deltaUsd))}. Open card.`}
          style={[
            styles.chip,
            {
              borderColor: withAlpha(leadTint, 0.35),
              backgroundColor: withAlpha(leadTint, 0.1),
            },
          ]}
        >
          {leadUp ? (
            <ArrowUpRight size={12} color={leadTint} strokeWidth={2.8} />
          ) : (
            <ArrowDownRight size={12} color={leadTint} strokeWidth={2.8} />
          )}
          <Text numberOfLines={1} style={[styles.leadName, { color: p.ink.muted }]}>
            Led by{" "}
            <Text style={{ color: p.ink.default, fontWeight: "800" }}>{lead.name}</Text>
          </Text>
          <Text style={[styles.chipText, { color: leadTint }]}>
            {leadUp ? "+" : "−"}
            {format(Math.abs(lead.deltaUsd))} ({leadUp ? "+" : "−"}
            {Math.abs(lead.deltaPct).toFixed(1)}%)
          </Text>
        </Pressable>
      ) : null}

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
    </ScrollView>
  );
}

function InsightChip({ label, tint }: { label: string; tint: string }) {
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: withAlpha(tint, 0.35),
          backgroundColor: withAlpha(tint, 0.1),
        },
      ]}
    >
      <Text style={[styles.chipText, { color: tint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { flexDirection: "row", alignItems: "center", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  leadName: { fontSize: 11, maxWidth: 170 },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
