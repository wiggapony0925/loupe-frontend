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
import { Animated, Pressable, Text, View } from "react-native";
import { Check, Circle, Pencil, Trash2, TrendingDown, TrendingUp } from "lucide-react-native";
import { router } from "expo-router";
import { routes } from "@/shared/routes";
import { CardImage } from "@/presentation/components/CardImage";
import { Sparkline, seededWalk } from "@/presentation/components/Sparkline";
import { Price } from "@/presentation/components/Price";
import { usePressScale } from "@/presentation/components/usePressScale";
import { useThemedPalette, withAlpha, gradeColor } from "@/presentation/theme/tokens";
import type { CollectionCard } from "@/domain";

interface PositionRowProps {
  card: CollectionCard;
  /** Optional pre-fetched sparkline (points + deltaPct). */
  spark?: { points: number[]; deltaPct: number };
  /**
   * How many total copies of this printing the user owns. When ≥ 2 the
   * row renders a "×N" badge next to the title to flag the duplicate.
   * Defaults to 1 (no badge).
   */
  copies?: number;
  /**
   * Override the default tap behaviour (navigate to card detail).
   * Used by the Vault's multi-select mode to toggle selection instead.
   */
  onPress?: () => void;
  /** Long-press handler. Used to enter Vault selection mode. */
  onLongPress?: () => void;
  /** When true, render the row in its selected state (check + tint). */
  selected?: boolean;
  /**
   * Opens GradeForm (Apply) for this holding. Shown on every row while
   * multi-select is active (replaces the price pill with edit/remove).
   */
  onEdit?: () => void;
  /** Remove this holding — parent shows collection-vs-portfolio sheet. */
  onRemove?: () => void;
  /**
   * Horizontal padding. Defaults to {@link POSITION_ROW_INDENT}. Pass `0`
   * when the parent list already applies page gutters (Vault).
   */
  indent?: number;
}

/** Horizontal padding for the row — vault.tsx uses this to align separators. */
export const POSITION_ROW_INDENT = 14;
// Bigger thumbnail than the original 40×54 — brings the row closer to
// Collectr's trending tile size where the art carries its own weight
// rather than feeling like a list icon.
const ART_W = 52;
const ART_H = 72;
const SPARK_W = 56;
const SPARK_H = 24;
const PILL_MIN_W = 84;

export function PositionRow({
  card,
  spark,
  copies = 1,
  onPress,
  onLongPress,
  selected,
  onEdit,
  onRemove,
  indent = POSITION_ROW_INDENT,
}: PositionRowProps) {
  const p = useThemedPalette();
  const tint = gradeColor(card.grade);
  const hasDuplicates = copies > 1;
  // Selection session: hide market chrome, show edit + remove on every row.
  const inSelectSession = selected !== undefined;
  const handleEdit = onEdit ?? (() => router.push(routes.gradeEdit(card.id)));
  // Robinhood-style press feedback — row gently scales to 0.97 on
  // touch. Native-driver spring so the list keeps scrolling smoothly.
  const { scale, onPressIn, onPressOut } = usePressScale();

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
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: indent,
        marginVertical: selected ? 3 : 0,
        borderRadius: selected !== undefined ? 14 : 0,
        borderWidth: selected ? 1.5 : 0,
        borderColor: selected ? withAlpha(p.accent.mint, 0.55) : "transparent",
        backgroundColor: selected
          ? withAlpha(p.accent.mint, 0.14)
          : selected === false
            ? withAlpha(p.ink.dim, 0.03)
            : "transparent",
      }}
    >
    <Pressable
      onPress={onPress ?? (() => router.push(routes.card(card.cardId)))}
      onLongPress={onLongPress}
      delayLongPress={280}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={
        hasDuplicates
          ? `${card.title}, grade ${card.grade.toFixed(1)}, ${copies} copies owned`
          : `${card.title}, grade ${card.grade.toFixed(1)}`
      }
      android_ripple={{ color: withAlpha(p.ink.dim, 0.1) }}
      style={{ flex: 1 }}
    >
      {({ pressed }) => (
        <Animated.View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            paddingHorizontal: selected !== undefined ? 8 : 0,
            backgroundColor: pressed && selected === undefined
              ? withAlpha(p.ink.dim, 0.06)
              : "transparent",
            transform: [{ scale }],
            opacity: selected === false ? 0.72 : 1,
          }}
        >
          {/* Selection checkbox — only rendered while the parent screen
              is in select mode (it passes `selected` as a boolean rather
              than leaving it undefined). */}
          {selected !== undefined ? (
            <View style={{ marginRight: 10 }}>
              {selected ? (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: p.accent.mint,
                  }}
                >
                  <Check size={14} color="#06140d" strokeWidth={3} />
                </View>
              ) : (
                <Circle size={22} color={p.ink.dim} strokeWidth={2} />
              )}
            </View>
          ) : null}
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
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  color: p.ink.default,
                  fontSize: 15,
                  fontWeight: "700",
                  letterSpacing: -0.2,
                  flexShrink: 1,
                }}
              >
                {card.title}
              </Text>
              {hasDuplicates ? (
                <View
                  style={{
                    marginLeft: 6,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: 4,
                    backgroundColor: withAlpha(p.accent.mint, 0.18),
                  }}
                  accessibilityLabel={`${copies} copies owned`}
                >
                  <Text
                    style={{
                      color: p.accent.mint,
                      fontSize: 10,
                      fontWeight: "800",
                      letterSpacing: 0.4,
                    }}
                  >
                    ×{copies}
                  </Text>
                </View>
              ) : null}
            </View>
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
            {card.tags.length > 0 ? (
              <View
                style={{
                  marginTop: 4,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {card.tags.slice(0, 2).map((t) => (
                  <View
                    key={t}
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 1.5,
                      borderRadius: 5,
                      backgroundColor: withAlpha(p.accent.mint, 0.12),
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: p.accent.mint,
                        fontSize: 9.5,
                        fontWeight: "700",
                      }}
                    >
                      {t}
                    </Text>
                  </View>
                ))}
                {card.tags.length > 2 ? (
                  <Text
                    style={{ color: p.ink.dim, fontSize: 9.5, fontWeight: "700" }}
                  >
                    +{card.tags.length - 2}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Sparkline + price — browse only. Select session swaps these
              for edit/remove siblings outside this Pressable. */}
          {!inSelectSession ? (
            <>
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
              <View style={{ alignItems: "flex-end" }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: pillBg,
                    minWidth: PILL_MIN_W,
                    justifyContent: "center",
                  }}
                >
                  {direction === "up" ? (
                    <TrendingUp size={11} color="#fff" strokeWidth={2.75} />
                  ) : direction === "down" ? (
                    <TrendingDown size={11} color="#fff" strokeWidth={2.75} />
                  ) : null}
                  <Price
                    usd={card.estimatedValueUsd}
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
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {direction === "up" ? "+" : ""}
                    {((apiDelta as number) * 100).toFixed(2)}%
                  </Text>
                ) : null}
              </View>
            </>
          ) : null}
        </Animated.View>
      )}
    </Pressable>
      {inSelectSession ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 4 }}>
          <Pressable
            onPress={handleEdit}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${card.title}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(p.accent.mint, 0.16),
              }}
            >
              <Pencil size={15} color={p.accent.mint} strokeWidth={2.5} />
            </View>
          </Pressable>
          <Pressable
            onPress={() => onRemove?.()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${card.title}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(p.accent.rose, 0.16),
              }}
            >
              <Trash2 size={15} color={p.accent.rose} strokeWidth={2.5} />
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
