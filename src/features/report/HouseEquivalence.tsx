/**
 * House Equivalence — what would PSA / CGC / BGS / TAG call this card?
 *
 * Renders the four major authentication houses as a compact 2×2 grid of
 * "slab" tiles. Each tile shows a monogram, the headline grade in big
 * type, the tier label, and a one-line subgrade summary when the house
 * publishes them.
 */
import React from "react";
import { Text, View } from "react-native";
import type { ForensicScore } from "@/types/domain";
import { gradeAcrossHouses, type HouseGradeResult } from "@/lib/grading";
import { useThemedPalette, withAlpha } from "@/theme/tokens";

interface HouseEquivalenceProps {
  score: ForensicScore;
}

export function HouseEquivalence({ score }: HouseEquivalenceProps) {
  const results = gradeAcrossHouses(score);
  return (
    <View className="rounded-2xl border border-line bg-bg-elevated p-4">
      <View className="mb-3 flex-row items-end justify-between">
        <View>
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Cross-House Estimate
          </Text>
          <Text className="mt-1 text-base font-semibold text-ink">
            How major graders would score it
          </Text>
        </View>
      </View>

      <View className="-mx-1 flex-row flex-wrap">
        {results.map((r) => (
          <View key={r.house} className="w-1/2 p-1">
            <HouseTile result={r} />
          </View>
        ))}
      </View>

      <Text className="mt-3 text-[10px] leading-4 text-ink-dim">
        Predictive only. Final house grades depend on submission policies,
        eye-appeal, and authentication that Loupe does not perform.
      </Text>
    </View>
  );
}

function HouseTile({ result }: { result: HouseGradeResult }) {
  const p = useThemedPalette();
  const tint = pickTone(p, result.tone);
  const isTag = result.house === "TAG";

  return (
    <View
      className="rounded-xl border p-3"
      style={{
        borderColor: withAlpha(tint, 0.3),
        backgroundColor: withAlpha(tint, 0.06),
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className="text-[10px] font-bold uppercase tracking-[3px]"
          style={{ color: tint }}
        >
          {result.house}
        </Text>
        <Text className="text-[9px] uppercase tracking-[2px] text-ink-dim">
          {isTag ? "0–1000" : "1–10"}
        </Text>
      </View>
      <View className="mt-1 flex-row items-baseline">
        <Text
          className="font-semibold text-ink"
          style={{ fontSize: isTag ? 26 : 30, lineHeight: isTag ? 30 : 34 }}
        >
          {result.headline}
        </Text>
        {!isTag ? (
          <Text className="ml-1 text-xs text-ink-dim">/ 10</Text>
        ) : null}
      </View>
      <Text
        className="mt-0.5 text-[11px] font-semibold uppercase tracking-[1.5px]"
        style={{ color: tint }}
      >
        {result.short}
      </Text>
      {result.detail ? (
        <Text className="mt-1 text-[10px] text-ink-muted" numberOfLines={1}>
          {result.detail}
        </Text>
      ) : (
        <Text className="mt-1 text-[10px] text-ink-muted" numberOfLines={1}>
          {result.long}
        </Text>
      )}
    </View>
  );
}

function pickTone(
  p: ReturnType<typeof useThemedPalette>,
  tone: HouseGradeResult["tone"],
): string {
  switch (tone) {
    case "mint": return p.accent.mint;
    case "blue": return p.accent.blue;
    case "amber": return p.accent.amber;
    case "rose": return p.accent.rose;
    case "muted": return p.ink.muted;
  }
}
