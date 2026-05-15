/**
 * Analytics — the data-viz home for the collection.
 *
 * Robinhood-inspired layout:
 *   • Hero portfolio chart with interactive scrubber + range pills
 *   • Top movers / Holdings list with mini sparklines
 *   • Collectr-style grade-distribution bars
 *   • Quick KPIs (7d scans, gem mint rate)
 */
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Activity, Sparkles } from "lucide-react-native";
import { fetchCardSparklines, fetchCollection } from "@/api/forensicApi";
import { GradeBars, HoldingRow, PortfolioChart } from "@/features/analytics";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { useThemedPalette } from "@/theme/tokens";

export default function AnalyticsScreen() {
  useThemedPalette();
  const collection = useQuery({ queryKey: ["collection"], queryFn: fetchCollection });
  const sparks = useQuery({
    queryKey: ["card-sparklines"],
    queryFn: fetchCardSparklines,
    staleTime: 60_000,
  });

  const cards = collection.data ?? [];
  const sparkMap = new Map((sparks.data ?? []).map((s) => [s.cardId, s]));
  const totalValue = cards.reduce((s, c) => s + c.estimatedValueUsd, 0);

  // Sort by absolute % delta — Robinhood "Top Movers".
  const movers = [...cards]
    .map((c) => ({ card: c, sp: sparkMap.get(c.id) }))
    .sort((a, b) => Math.abs(b.sp?.deltaPct ?? 0) - Math.abs(a.sp?.deltaPct ?? 0));

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 64, gap: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Performance
          </Text>
          <Text className="mt-1 text-3xl font-semibold tracking-tight text-ink">
            Analytics
          </Text>
        </View>

        <PortfolioChart fallbackTotal={totalValue} />

        <View className="flex-row gap-3">
          <StatTile label="7d Scans" value="148" delta="+22%" icon={Activity} accent="blue" />
          <StatTile
            label="Gem Mint Rate"
            value="12.4%"
            delta="+1.1pp"
            icon={Sparkles}
            accent="mint"
          />
        </View>

        <View>
          <SectionHeader eyebrow="Holdings" title="Top movers" />
          <View className="mt-1 overflow-hidden rounded-2xl border border-line bg-bg-elevated px-3">
            {collection.isLoading || sparks.isLoading ? (
              <RowSkeletons />
            ) : (
              movers.map(({ card, sp }, i) => (
                <View key={card.id} className={i > 0 ? "border-t border-line" : ""}>
                  <HoldingRow
                    card={card}
                    spark={sp?.points}
                    deltaPct={sp?.deltaPct ?? 0}
                  />
                </View>
              ))
            )}
          </View>
        </View>

        <View>
          <SectionHeader eyebrow="Mix" title="Quality breakdown" />
          {collection.isLoading ? (
            <View className="rounded-2xl border border-line bg-bg-elevated p-4">
              <Skeleton width="100%" height={140} />
            </View>
          ) : (
            <GradeBars cards={cards} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RowSkeletons() {
  return (
    <View>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          className={`flex-row items-center gap-3 py-3 ${i > 0 ? "border-t border-line" : ""}`}
        >
          <Skeleton width={36} height={50} radius={8} />
          <View className="flex-1 gap-1.5">
            <Skeleton width="70%" height={13} />
            <Skeleton width="40%" height={10} />
          </View>
          <Skeleton width={64} height={24} />
          <View className="items-end gap-1.5" style={{ minWidth: 78 }}>
            <Skeleton width={60} height={13} />
            <Skeleton width={40} height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}
