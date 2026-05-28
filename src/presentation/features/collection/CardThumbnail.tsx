import React from "react";
import { Pressable, Text, View } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { router } from "expo-router";
import { routes } from "@/shared/routes";
import type { CollectionCard } from "@/domain";
import { CardImage } from "@/presentation/components/CardImage";
import { Price } from "@/presentation/components/Price";
import { Sparkline, seededWalk } from "@/presentation/components/Sparkline";
import { gradeColor, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

interface CardThumbnailProps {
  card: CollectionCard;
  /** Optional pre-fetched sparkline (points + deltaPct). */
  spark?: { points: number[]; deltaPct: number };
  /**
   * How many total copies of this printing the user owns. When ≥ 2 the
   * tile renders a "×N" badge so duplicates pop in the grid.
   */
  copies?: number;
  /**
   * Override the default tap behaviour (navigate to card detail).
   * Used by the Vault's multi-select mode to toggle selection instead.
   */
  onPress?: () => void;
  /** Long-press handler. Used to enter Vault selection mode. */
  onLongPress?: () => void;
  /** When true, render the tile in its selected state (mint ring + check). */
  selected?: boolean;
}

// Reserved heights so every tile in the grid is identical regardless of
// title length. Tuned for the 14px title font.
const TITLE_LINE_HEIGHT = 18;
const TITLE_LINES = 2;

/**
 * Clamp truly absurd deltas (data glitches surface as ±300%+ moves that
 * are clearly noise, not market signal). Anything outside ±99% is shown
 * as "—" so the UI doesn't lie. Mirrors the guard we should add in
 * `PortfolioPills` so the value/delta story stays internally consistent.
 */
function formatDelta(delta: number): { label: string; up: boolean; valid: boolean } {
  const valid = Number.isFinite(delta) && Math.abs(delta) < 1;
  const up = delta >= 0;
  if (!valid) return { label: "—", up, valid: false };
  if (delta === 0) return { label: "0.00%", up: true, valid: true };
  return { label: `${up ? "+" : ""}${(delta * 100).toFixed(2)}%`, up, valid: true };
}

export function CardThumbnail({ card, spark, copies = 1, onPress, onLongPress, selected }: CardThumbnailProps) {
  const p = useThemedPalette();
  const tint = gradeColor(card.grade);
  const hasDuplicates = copies > 1;

  // Fall back to a deterministic walk so the tile never feels empty.
  const points =
    spark && spark.points.length >= 2
      ? spark.points
      : seededWalk(card.id, card.estimatedValueUsd, 24);
  const delta = formatDelta(spark?.deltaPct ?? 0);
  const deltaTint = !delta.valid ? p.ink.dim : delta.up ? p.accent.mint : p.accent.rose;

  return (
    <Pressable
      onPress={onPress ?? (() => router.push(routes.card(card.cardId)))}
      onLongPress={onLongPress}
      delayLongPress={280}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={
        hasDuplicates
          ? `${card.title}, grade ${card.grade.toFixed(1)}, ${delta.label}, ${copies} copies owned`
          : `${card.title}, grade ${card.grade.toFixed(1)}, ${delta.label}`
      }
      className="flex-1 overflow-hidden rounded-2xl"
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? p.accent.mint : p.line.default,
        backgroundColor: p.bg.elevated,
      })}
    >
      {/* Art — 5:7 card aspect with floating chips */}
      <View className="aspect-[5/7] w-full bg-bg-sunken">
        <CardImage
          uri={card.thumbnailUri}
          width="100%"
          height="100%"
          rounded={0}
          priority="low"
          recyclingKey={card.id}
          alt={card.title}
        />
        {/* Grade chip — top-right, color-coded by tier */}
        <View className="absolute right-2 top-2">
          <View
            className="rounded-md px-2 py-0.5"
            style={{
              backgroundColor: withAlpha(p.bg.elevated, 0.92),
              borderWidth: 1,
              borderColor: withAlpha(tint, 0.6),
            }}
          >
            <Text className="text-[11px] font-bold" style={{ color: tint }}>
              PSA {card.grade.toFixed(1)}
            </Text>
          </View>
        </View>
        {/* Delta micro-chip — top-left, mirrors Robinhood watchlist tiles.
            Hidden when the delta is exactly 0 or invalid so we don't
            crowd the art with noise. */}
        {delta.valid && delta.label !== "0.00%" ? (
          <View className="absolute left-2 top-2">
            <View
              className="rounded-md px-1.5 py-0.5"
              style={{ backgroundColor: withAlpha(deltaTint, 0.18) }}
            >
              <Text
                className="text-[10px] font-bold"
                style={{ color: deltaTint, letterSpacing: 0.3 }}
              >
                {delta.label}
              </Text>
            </View>
          </View>
        ) : null}
        {/* Duplicate-copies badge — bottom-left, mint pill so it reads
            as an inventory fact (not market signal). */}
        {hasDuplicates ? (
          <View className="absolute bottom-2 left-2">
            <View
              className="rounded-md px-1.5 py-0.5"
              style={{
                backgroundColor: withAlpha(p.accent.mint, 0.92),
              }}
            >
              <Text
                className="text-[10px] font-extrabold"
                style={{ color: "#fff", letterSpacing: 0.3 }}
              >
                ×{copies}
              </Text>
            </View>
          </View>
        ) : null}
        {/* Selected overlay — mint scrim + checkmark so it reads as a
            staged action, not just a passive highlight. */}
        {selected ? (
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ backgroundColor: withAlpha(p.accent.mint, 0.22) }}
            pointerEvents="none"
          >
            <View
              style={{
                borderRadius: 999,
                backgroundColor: p.bg.elevated,
                padding: 2,
              }}
            >
              <CheckCircle2 size={32} color={p.accent.mint} strokeWidth={2.5} />
            </View>
          </View>
        ) : null}
      </View>
      <View className="px-3 pb-3 pt-2.5">
        <Text
          numberOfLines={1}
          className="text-[10px] font-semibold uppercase tracking-[2px] text-ink-dim"
        >
          {card.set} · {card.year}
        </Text>

        <Text
          numberOfLines={TITLE_LINES}
          className="mt-1 text-[14px] font-semibold text-ink"
          style={{
            lineHeight: TITLE_LINE_HEIGHT,
            minHeight: TITLE_LINE_HEIGHT * TITLE_LINES,
            letterSpacing: -0.1,
          }}
        >
          {card.title}
        </Text>

        {/* Price + sparkline footer */}
        <View className="mt-2 flex-row items-end justify-between">
          <Price
            usd={card.estimatedValueUsd}
            numberOfLines={1}
            className="text-[15px] font-semibold text-ink"
          />
          <Sparkline
            values={points}
            width={48}
            height={18}
            showBaseline={false}
          />
        </View>
      </View>
    </Pressable>
  );
}
