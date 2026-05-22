/**
 * MoversCardRow — `CardRow` variant whose right slot is a tinted price
 * pill with the trailing % change. Used in the Command Center "Top
 * Movers" section.
 */
import React, { memo } from "react";
import { Text, View } from "react-native";
import { useCompactUsd } from "@/shared/format";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { CardRow } from "./CardRow";
import type { CardWire, TrendInfo } from "./types";

export interface MoversCardRowProps {
  card: CardWire;
  /** Live USD price. When `null`, the pill renders "—". */
  price: number | null;
  /** 1y trend. When `null`, the pill omits the arrow/percent line. */
  trend: TrendInfo | null;
  onPress?: () => void;
  bordered?: boolean;
}

function MoversCardRowImpl({ card, price, trend, onPress, bordered }: MoversCardRowProps) {
  return (
    <CardRow
      card={card}
      onPress={onPress}
      bordered={bordered}
      rightSlot={<MoverPill price={price} trend={trend} />}
    />
  );
}

function MoverPill({
  price,
  trend,
}: {
  price: number | null;
  trend: TrendInfo | null;
}) {
  const p = useThemedPalette();
  const compactUsd = useCompactUsd();
  // No trend → neutral slate pill. Up → mint. Down → rose.
  const tint =
    trend == null
      ? p.ink.muted
      : trend.pct >= 0
        ? p.accent.mint
        : p.accent.rose;
  const up = (trend?.pct ?? 0) >= 0;
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: withAlpha(tint, 0.14),
        borderWidth: 1,
        borderColor: withAlpha(tint, 0.45),
        minWidth: 88,
        alignItems: "center",
      }}
    >
      <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "700" }}>
        {price != null ? compactUsd(price) : "—"}
      </Text>
      {trend != null ? (
        <Text
          style={{
            color: tint,
            fontSize: 9,
            fontWeight: "800",
            letterSpacing: 0.3,
            marginTop: 1,
          }}
        >
          {up ? "▲" : "▼"} {Math.abs(trend.pct).toFixed(2)}%
        </Text>
      ) : (
        <Text
          style={{
            color: tint,
            fontSize: 9,
            fontWeight: "800",
            letterSpacing: 0.3,
            marginTop: 1,
          }}
        >
          NO DATA
        </Text>
      )}
    </View>
  );
}

export const MoversCardRow = memo(MoversCardRowImpl);
