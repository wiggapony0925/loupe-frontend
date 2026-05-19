/**
 * PositionRow — Robinhood-style horizontal list row for the Vault.
 *
 *   ┌────┐  Title                 ─sparkline─    ┌────────┐
 *   │ art│  set · year · grade                   │ $price │
 *   └────┘                                       └────────┘
 *
 * Single hard-coded flex row. Layout lives on an inner <View> so the
 * Pressable wrapper can't mangle it via its style callback. The price
 * always renders inside a brand-mint pill — the brand color anchors the
 * eye, while the sparkline + delta carry the up/down signal.
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { routes } from "@/shared/routes";
import { CardImage } from "@/presentation/components/CardImage";
import { Sparkline, seededWalk } from "@/presentation/components/Sparkline";
import { Price } from "@/presentation/components/Price";
import { useThemedPalette, withAlpha, gradeColor } from "@/presentation/theme/tokens";
import type { CollectionCard } from "@/domain";

interface PositionRowProps {
  card: CollectionCard;
  /** Optional pre-fetched sparkline (points + deltaPct). */
  spark?: { points: number[]; deltaPct: number };
}

/** Horizontal padding for the row — vault.tsx uses this to align separators. */
export const POSITION_ROW_INDENT = 14;
const ART_W = 40;
const ART_H = 54;
const SPARK_W = 52;
const SPARK_H = 22;
const PILL_MIN_W = 76;

export function PositionRow({ card, spark }: PositionRowProps) {
  const p = useThemedPalette();
  const tint = gradeColor(card.grade);

  const points =
    spark && spark.points.length >= 2
      ? spark.points
      : seededWalk(card.id, card.estimatedValueUsd, 24);
  // Direction is derived from the *visible* sparkline (first→last point)
  // so the pill/line color always matches what the row actually draws.
  // Falling back to the API delta when present keeps small intraday
  // moves accurate; otherwise the seeded-walk anchors the visual.
  const apiDelta = spark?.deltaPct;
  const walkDelta = points.length >= 2
    ? (points[points.length - 1]! - points[0]!) / (points[0]! || 1)
    : 0;
  const rawDelta = Number.isFinite(apiDelta) && Math.abs(apiDelta ?? 0) < 1
    ? (apiDelta as number)
    : walkDelta;
  // Robinhood rule:
  //   • move ≥ +0.05%  → green (mint)
  //   • move ≤ -0.05%  → red   (rose)
  //   • effectively flat → neutral gray
  // The 0.05% floor stops sub-cent rounding noise from flipping rows.
  const FLAT_THRESHOLD = 0.0005;
  const direction: "up" | "down" | "flat" =
    rawDelta >= FLAT_THRESHOLD
      ? "up"
      : rawDelta <= -FLAT_THRESHOLD
        ? "down"
        : "flat";
  const directionTint =
    direction === "up"
      ? p.accent.mint
      : direction === "down"
        ? p.accent.rose
        : p.ink.muted;
  // Pill matches the sparkline so the row reads as one consistent
  // up/down signal. Flat stays muted gray (not a fake green).
  const pillBg = directionTint;
  // Only surface the % chip when we have a *real* API delta — the
  // seeded walk is for visual continuity, not for stating numbers.
  const showDeltaChip =
    Number.isFinite(apiDelta) &&
    Math.abs(apiDelta ?? 0) < 1 &&
    Math.abs(apiDelta ?? 0) >= FLAT_THRESHOLD;

  return (
    <Pressable
      onPress={() => router.push(routes.scan(card.id))}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}, grade ${card.grade.toFixed(1)}`}
      android_ripple={{ color: withAlpha(p.ink.dim, 0.1) }}
    >
      {({ pressed }) => (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            paddingHorizontal: POSITION_ROW_INDENT,
            backgroundColor: pressed ? withAlpha(p.ink.dim, 0.06) : "transparent",
          }}
        >
          {/* Art */}
          <View
            style={{
              width: ART_W,
              height: ART_H,
              borderRadius: 8,
              overflow: "hidden",
              backgroundColor: p.bg.sunken,
            }}
          >
            <CardImage
              uri={card.thumbnailUri}
              width={ART_W}
              height={ART_H}
              rounded={0}
              priority="low"
              recyclingKey={card.id}
              alt={card.title}
            />
          </View>

          {/* Title + meta */}
          <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                color: p.ink.default,
                fontSize: 15,
                fontWeight: "700",
                letterSpacing: -0.2,
              }}
            >
              {card.title}
            </Text>
            <View
              style={{
                marginTop: 3,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text
                numberOfLines={1}
                style={{ color: p.ink.muted, fontSize: 12, flexShrink: 1 }}
              >
                {card.set} · {card.year}
              </Text>
              <View
                style={{
                  marginLeft: 6,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: 4,
                  backgroundColor: withAlpha(tint, 0.18),
                }}
              >
                <Text
                  style={{
                    color: tint,
                    fontSize: 10,
                    fontWeight: "800",
                    letterSpacing: 0.4,
                  }}
                >
                  {card.grade.toFixed(1)}
                </Text>
              </View>
            </View>
          </View>

          {/* Sparkline */}
          <View
            style={{
              width: SPARK_W,
              height: SPARK_H,
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            <Sparkline
              values={points}
              width={SPARK_W}
              height={SPARK_H}
              showBaseline={false}
              color={directionTint}
            />
          </View>

          {/* Price pill */}
          <View style={{ alignItems: "flex-end" }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: pillBg,
                minWidth: PILL_MIN_W,
                alignItems: "center",
              }}
            >
              <Price
                usd={card.estimatedValueUsd}
                compact
                numberOfLines={1}
                style={{
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: "700",
                  letterSpacing: -0.1,
                }}
              />
            </View>
            {showDeltaChip ? (
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 4,
                  color: directionTint,
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 0.2,
                }}
              >
                {direction === "up" ? "+" : ""}
                {((apiDelta as number) * 100).toFixed(2)}%
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}
