/**
 * Robinhood-style holding row.
 *
 * Layout:
 *   [thumbnail]  Title           ─sparkline─    $value
 *                Set · Grade                    +d.dd%
 *
 * Tap to open the card detail. Sparkline + delta tint flip green/red
 * based on the period change.
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import { routes } from "@/lib/routes";
import { CardImage } from "@/components/ui/CardImage";
import { useThemedPalette } from "@/theme/tokens";
import { compactUsd } from "@/lib/format";
import type { CollectionCard } from "@/types/domain";

interface HoldingRowProps {
  card: CollectionCard;
  spark?: number[];
  deltaPct?: number;
}

export function HoldingRow({ card, spark, deltaPct = 0 }: HoldingRowProps) {
  const p = useThemedPalette();
  const up = deltaPct >= 0;
  const tint = up ? p.accent.mint : p.accent.rose;

  const path = React.useMemo(() => buildSparkPath(spark, 64, 24), [spark]);

  return (
    <Pressable
      onPress={() => router.push(routes.scan(card.id))}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className="flex-row items-center gap-3 px-1 py-3"
    >
      <View
        className="overflow-hidden rounded-lg"
        style={{ width: 36, height: 50, backgroundColor: p.bg.elevated }}
      >
        <CardImage
          uri={card.thumbnailUri}
          width={36}
          height={50}
          rounded={8}
          priority="low"
          recyclingKey={card.id}
          alt={card.title}
        />
      </View>

      <View className="flex-1">
        <Text numberOfLines={1} className="text-[15px] font-semibold text-ink">
          {card.title}
        </Text>
        <Text numberOfLines={1} className="text-[11px] text-ink-dim">
          {card.set} · Grade {card.grade.toFixed(1)}
        </Text>
      </View>

      <Svg width={64} height={24}>
        <Path d={path} stroke={tint} strokeWidth={1.5} fill="none" />
      </Svg>

      <View className="items-end" style={{ minWidth: 78 }}>
        <Text className="text-[15px] font-semibold tracking-tight text-ink">
          {compactUsd(card.estimatedValueUsd)}
        </Text>
        <Text className="text-[11px] font-semibold" style={{ color: tint }}>
          {up ? "+" : ""}
          {deltaPct.toFixed(2)}%
        </Text>
      </View>
    </Pressable>
  );
}

function buildSparkPath(values: number[] | undefined, w: number, h: number): string {
  if (!values || values.length < 2) return "";
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = hi - lo || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - lo) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
