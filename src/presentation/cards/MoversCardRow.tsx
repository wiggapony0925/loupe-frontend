/**
 * MoversCardRow — `CardRow` variant whose right slot is a tinted price
 * pill with the trailing % change. Used in the Command Center "Top
 * Movers" section.
 */
import React, { memo } from "react";
import { Text, View } from "react-native";
import { compactUsd } from "@/shared/format";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { CardRow } from "./CardRow";
import type { CardWire, TrendInfo } from "./types";

export interface MoversCardRowProps {
  card: CardWire;
  price: number;
  trend: TrendInfo;
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

function MoverPill({ price, trend }: { price: number; trend: TrendInfo }) {
  const p = useThemedPalette();
  const up = trend.pct >= 0;
  const tint = up ? p.accent.mint : p.accent.rose;
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
        {compactUsd(price)}
      </Text>
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
    </View>
  );
}

export const MoversCardRow = memo(MoversCardRowImpl);
