/**
 * CardSparkRow — THE list row for card results (search, vault picks, live
 * catalog). One visual language everywhere, matching the vault rows:
 *
 *   ┌────┐  Name                ─sparkline─    $price
 *   │ art│  [badge] set · # · yr  (or range)   ▲ 5.16%
 *   └────┘
 *
 * Purely presentational — callers adapt their wire shape onto plain props.
 * The middle slot renders REAL data only: a sparkline when history points
 * exist, else a low↔high price-range meter from the pricing summary, else
 * nothing. The right column is price + delta% (colored) or a tiny uppercase
 * price label ("MARKET" / "MSRP") when no delta is known.
 */
import React, { memo } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { CardImage } from "@/presentation/components/CardImage";
import { Price } from "@/presentation/components/Price";
import { Sparkline } from "@/presentation/components/Sparkline";
import { usePressScale } from "@/presentation/components/usePressScale";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const THUMB_W = 52;
const THUMB_H = 72;
const SPARK_W = 56;
const SPARK_H = 24;

export interface CardSparkRowBadge {
  label: string;
  tint: string;
}

export interface CardSparkRowProps {
  /** Primary art URL (small variant). */
  thumbUri?: string;
  /** Larger fallback if the small variant 404s. */
  thumbFallbackUri?: string;
  blurhash?: string;
  /** Stable id for expo-image recycling inside lists. */
  recyclingKey?: string;
  title: string;
  /** Tinted pill before the meta text — grade ("9") or TCG ("Pokémon"). */
  badge?: CardSparkRowBadge | null;
  /** "Base Set · #4 · 1999" — already joined by the caller. */
  meta?: string | null;
  /** Middle slot: real history points (≥2) render a sparkline. */
  spark?: readonly number[] | null;
  /** Middle slot fallback: low↔high market range meter (real pricing data). */
  range?: { low: number; high: number; market: number | null } | null;
  priceUsd: number | null;
  /** Colored ▲/▼ percent under the price. */
  deltaPct?: number | null;
  /** Fallback right-column eyebrow when no delta is known. */
  priceLabel?: string;
  onPress: () => void;
  bordered?: boolean;
  priority?: "low" | "normal" | "high";
  accessibilityLabel?: string;
}

function CardSparkRowImpl({
  thumbUri,
  thumbFallbackUri,
  blurhash,
  recyclingKey,
  title,
  badge,
  meta,
  spark,
  range,
  priceUsd,
  deltaPct,
  priceLabel = "Market",
  onPress,
  bordered = false,
  priority = "low",
  accessibilityLabel,
}: CardSparkRowProps) {
  const p = useThemedPalette();
  const { scale, onPressIn, onPressOut } = usePressScale();

  const hasSpark = !!spark && spark.length >= 2;
  const hasRange =
    !hasSpark && !!range && range.high > range.low && range.low >= 0;
  const delta = deltaPct ?? null;
  const deltaTint =
    delta == null ? p.ink.dim : delta >= 0 ? p.accent.mint : p.accent.rose;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}${meta ? `, ${meta}` : ""}`}
    >
      <Animated.View
        style={{ transform: [{ scale }] }}
        className={`flex-row items-center gap-3 px-1 py-2.5 ${
          bordered ? "border-t border-line/60" : ""
        }`}
      >
        <View
          style={{
            width: THUMB_W,
            height: THUMB_H,
            borderRadius: 10,
            overflow: "hidden",
            backgroundColor: p.bg.sunken,
          }}
        >
          <CardImage
            uri={thumbUri}
            fallbackUri={thumbFallbackUri}
            blurhash={blurhash}
            width={THUMB_W}
            height={THUMB_H}
            rounded={0}
            contentFit="cover"
            priority={priority}
            recyclingKey={recyclingKey}
            alt={title}
          />
        </View>

        {/* Identity block */}
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            numberOfLines={1}
            style={{
              color: p.ink.default,
              fontSize: 15,
              fontWeight: "700",
              letterSpacing: -0.2,
            }}
          >
            {title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {badge ? (
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: withAlpha(badge.tint, 0.14),
                }}
              >
                <Text
                  style={{
                    color: badge.tint,
                    fontSize: 9.5,
                    fontWeight: "800",
                    letterSpacing: 0.4,
                  }}
                >
                  {badge.label}
                </Text>
              </View>
            ) : null}
            {meta ? (
              <Text
                numberOfLines={1}
                style={{ flexShrink: 1, color: p.ink.muted, fontSize: 11.5 }}
              >
                {meta}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Middle slot — sparkline (real history) or low↔high range meter */}
        {hasSpark ? (
          <View style={{ width: SPARK_W, height: SPARK_H, justifyContent: "center" }}>
            <Sparkline
              values={spark!}
              width={SPARK_W}
              height={SPARK_H}
              showBaseline={false}
              color={delta != null ? deltaTint : undefined}
            />
          </View>
        ) : hasRange ? (
          <RangeMeter low={range!.low} high={range!.high} market={range!.market} />
        ) : null}

        {/* Right column — price + delta% (or tiny label) */}
        <View style={{ minWidth: 72, alignItems: "flex-end", gap: 2 }}>
          {priceUsd != null ? (
            <Price
              usd={priceUsd}
              numberOfLines={1}
              style={{
                color: p.ink.default,
                fontSize: 15,
                fontWeight: "800",
                letterSpacing: -0.3,
                fontVariant: ["tabular-nums"],
              }}
            />
          ) : (
            <Text style={{ color: p.ink.dim, fontSize: 15, fontWeight: "700" }}>—</Text>
          )}
          {delta != null ? (
            <Text
              numberOfLines={1}
              style={{
                color: deltaTint,
                fontSize: 10,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}%
            </Text>
          ) : (
            <Text
              style={{
                color: p.ink.dim,
                fontSize: 9,
                fontWeight: "700",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {priceLabel}
            </Text>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Low↔high market-range meter — where today's market price sits inside the
 * provider's low/high band. Honest pricing data for rows with no history.
 */
function RangeMeter({
  low,
  high,
  market,
}: {
  low: number;
  high: number;
  market: number | null;
}) {
  const p = useThemedPalette();
  const span = high - low;
  const ratio =
    market != null && span > 0
      ? Math.min(1, Math.max(0, (market - low) / span))
      : null;

  return (
    <View style={{ width: SPARK_W, gap: 3 }}>
      <View
        style={{
          height: 3,
          borderRadius: 2,
          backgroundColor: withAlpha(p.ink.muted, 0.18),
          overflow: "visible",
        }}
      >
        {ratio != null ? (
          <View
            style={{
              position: "absolute",
              left: `${ratio * 100}%`,
              top: -2.5,
              width: 8,
              height: 8,
              marginLeft: -4,
              borderRadius: 4,
              backgroundColor: p.accent.mint,
            }}
          />
        ) : null}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: p.ink.dim, fontSize: 8, fontWeight: "700" }}>LO</Text>
        <Text style={{ color: p.ink.dim, fontSize: 8, fontWeight: "700" }}>HI</Text>
      </View>
    </View>
  );
}

export const CardSparkRow = memo(CardSparkRowImpl);
