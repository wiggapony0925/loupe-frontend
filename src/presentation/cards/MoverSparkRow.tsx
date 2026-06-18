/**
 * MoverSparkRow — the Command Center "Top movers" row.
 *
 * Mirrors the Vault's `PositionRow` look (art · title/subtitle · sparkline ·
 * solid price pill) so the two surfaces read as one product, but composes the
 * shared `CardRow` frame and drops the grade badge (movers aren't graded).
 *
 *   ┌────┐  Name              ─sparkline─   ┌──────────┐
 *   │ art│  set · # · year                  │ ▲ $price │
 *   └────┘                                  └──────────┘
 *                                              +32.14%
 *
 * The sparkline uses REAL points from `/v1/grades/sparklines` when supplied,
 * falling back to a deterministic `seededWalk` for visual continuity. Color +
 * the % chip are driven by the authoritative trailing-1y `trend.pct`.
 */
import React, { memo } from "react";
import { Text, View } from "react-native";
import { TrendingDown, TrendingUp } from "lucide-react-native";
import { Sparkline, seededWalk } from "@/presentation/components/Sparkline";
import { Price } from "@/presentation/components/Price";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { CardRow } from "./CardRow";
import type { CardWire, TrendInfo } from "./types";

export interface MoverSparkRowProps {
  card: CardWire;
  /** Live USD price. When `null`, the pill renders "—". */
  price: number | null;
  /** Trailing-1y trend. `null` ⇒ neutral pill, no % chip. */
  trend: TrendInfo | null;
  /** Pre-fetched sparkline (points + deltaPct) from `/v1/grades/sparklines`. */
  spark?: { points: number[]; deltaPct: number };
  onPress?: () => void;
  bordered?: boolean;
}

const SPARK_W = 56;
const SPARK_H = 24;
const PILL_MIN_W = 88;

function MoverSparkRowImpl({ card, price, trend, spark, onPress, bordered }: MoverSparkRowProps) {
  return (
    <CardRow
      card={card}
      onPress={onPress}
      bordered={bordered}
      rightSlot={<MoverSparkRight cardId={card.id} price={price} trend={trend} spark={spark} />}
    />
  );
}

function MoverSparkRight({
  cardId,
  price,
  trend,
  spark,
}: {
  cardId: string;
  price: number | null;
  trend: TrendInfo | null;
  spark?: { points: number[]; deltaPct: number };
}) {
  const p = useThemedPalette();
  const pct = trend?.pct ?? null;
  const direction: "up" | "down" | "flat" =
    pct == null || pct === 0 ? "flat" : pct > 0 ? "up" : "down";
  const tint =
    direction === "up" ? p.accent.mint : direction === "down" ? p.accent.rose : p.ink.muted;

  // Real points when we have ≥2; otherwise a deterministic walk so the row
  // always shows a line (visual continuity, never fabricated numbers).
  const points =
    spark && spark.points.length >= 2 ? spark.points : seededWalk(cardId, price ?? 0, 24);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: SPARK_W, height: SPARK_H, justifyContent: "center" }}>
        <Sparkline values={points} width={SPARK_W} height={SPARK_H} showBaseline={false} color={tint} />
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: tint,
            minWidth: PILL_MIN_W,
            justifyContent: "center",
          }}
        >
          {direction === "up" ? (
            <TrendingUp size={11} color="#fff" strokeWidth={2.75} />
          ) : direction === "down" ? (
            <TrendingDown size={11} color="#fff" strokeWidth={2.75} />
          ) : null}
          {price != null ? (
            <Price
              usd={price}
              compact
              numberOfLines={1}
              style={{
                color: "#fff",
                fontSize: 13,
                fontWeight: "700",
                letterSpacing: -0.1,
                fontVariant: ["tabular-nums"],
              }}
            />
          ) : (
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>—</Text>
          )}
        </View>
        {pct != null ? (
          <Text
            numberOfLines={1}
            style={{
              marginTop: 4,
              color: tint,
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 0.2,
              fontVariant: ["tabular-nums"],
            }}
          >
            {direction === "up" ? "+" : ""}
            {pct.toFixed(2)}%
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export const MoverSparkRow = memo(MoverSparkRowImpl);
