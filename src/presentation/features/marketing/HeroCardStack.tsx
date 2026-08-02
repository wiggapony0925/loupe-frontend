/**
 * HeroCardStack — the fanned trio of live trending cards in the pre-auth hero.
 *
 * Mirrors loupe-web's marketing hero: two rotated cards behind, one elevated
 * "glass" card in front carrying the name, set, and live market price. Same
 * fan angles as the web's SCSS (-13°/+11° behind, +2° in front) so the two
 * surfaces are recognizably the same composition.
 *
 * Tapping shuffles to the next trending card rather than opening card detail.
 * The detail route lives outside the `(auth)` group, so an unauthenticated tap
 * would be bounced straight back here by the root layout's redirect — a shuffle
 * keeps the interaction rewarding without the dead end.
 */
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { CardImage } from "@/presentation/components/CardImage";
import { LoupeMark } from "@/presentation/brand/LoupeMark";
import { PriceText } from "@/presentation/components/PriceText";
import { SkeletonBox } from "@/presentation/components/Skeletons";
import { pickCardImageUrl } from "@/shared/cardImage";
import type { CardSearchResult } from "@/infrastructure/http";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** Trading-card aspect (5:7). Height is always derived from width. */
const CARD_RATIO = 1.4;

export function HeroCardStack({
  cards,
  isLoading,
  /** Every upstream feed failed — changes the resting copy, nothing else. */
  isError = false,
  /** Front card width. The caller sizes this from the space it actually has,
   *  so the hero shrinks to fit a small phone instead of forcing a scroll. */
  width = 176,
}: {
  cards: readonly CardSearchResult[];
  isLoading: boolean;
  isError?: boolean;
  width?: number;
}) {
  const p = useThemedPalette();
  const [offset, setOffset] = useState(0);
  const CARD_W = width;
  const CARD_H = Math.round(width * CARD_RATIO);
  const styles = useMemo(() => makeStyles(CARD_W, CARD_H), [CARD_W, CARD_H]);

  // Only cards with art AND a price reach the hero — a featured card showing
  // "—" undercuts the "live market data, no mock numbers" promise beside it.
  const pool = useMemo(() => {
    const priced = cards.filter(
      (c) => pickCardImageUrl(c) && c.pricing_summary?.market?.amount,
    );
    return priced.length >= 3 ? priced : cards.filter((c) => pickCardImageUrl(c));
  }, [cards]);

  const shuffle = useCallback(() => {
    if (pool.length < 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setOffset((o) => (o + 1) % pool.length);
  }, [pool.length]);

  if (isLoading) {
    return (
      <View style={styles.wrap}>
        <SkeletonBox width={CARD_W} height={CARD_H + 76} radius={20} />
      </View>
    );
  }

  // Settled with nothing to draw — a first launch with no connectivity, or
  // every upstream feed down at once. A shimmering skeleton would sit there
  // forever implying it's still coming, so rest on the brand mark instead.
  //
  // Reaching here now means the feed really has settled: `useHeroCards` keeps
  // `isLoading` true until both the local cache and the network have answered.
  // Previously any slow fetch fell through to this state and told the user
  // they were offline while they were watching it load.
  if (pool.length === 0) {
    return (
      <View style={styles.wrap}>
        <View
          style={[
            styles.resting,
            { backgroundColor: p.bg.elevated, borderColor: p.line.default },
          ]}
        >
          <LoupeMark size={44} color={p.ink.muted} />
          <Text style={[styles.restingText, { color: p.ink.dim }]}>
            {isError
              ? "Couldn't reach live prices just now."
              : "Live prices appear here once you're online."}
          </Text>
        </View>
      </View>
    );
  }

  const at = (i: number) => pool[(offset + i) % pool.length];
  const featured = at(0);
  const back1 = pool.length > 1 ? at(1) : undefined;
  const back2 = pool.length > 2 ? at(2) : undefined;
  // `pool` is non-empty here, so `at(0)` always resolves — this only satisfies
  // the compiler's indexed-access check.
  if (!featured) return null;

  return (
    <View style={styles.wrap}>
      {back2 ? (
        <View style={[styles.behind, styles.back2]}>
          <CardImage
            uri={pickCardImageUrl(back2, "small")}
            width={CARD_W * 0.86}
            height={CARD_H * 0.86}
            rounded={12}
            priority="low"
          />
        </View>
      ) : null}
      {back1 ? (
        <View style={[styles.behind, styles.back1]}>
          <CardImage
            uri={pickCardImageUrl(back1, "small")}
            width={CARD_W * 0.86}
            height={CARD_H * 0.86}
            rounded={12}
            priority="low"
          />
        </View>
      ) : null}

      <Pressable
        onPress={shuffle}
        accessibilityRole="button"
        accessibilityLabel={`Featured card: ${featured.name}. Tap to see another.`}
        style={({ pressed }) => [
          styles.glass,
          {
            backgroundColor: p.bg.elevated,
            borderColor: p.line.default,
            shadowColor: "#000",
            transform: [{ rotate: "2deg" }, { scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <Animated.View key={featured.id} entering={FadeIn.duration(260)}>
          {/* `small`, not `large`. The backend maps BOTH `normal` and `large`
              to pokemontcg's `_hires.png` — 792KB for a card rendered at
              ~168pt, which was blowing CardImage's 12s timeout and leaving the
              first screen of the app empty. `small` is 207KB and ample here. */}
          <CardImage
            uri={pickCardImageUrl(featured, "small")}
            width={CARD_W}
            height={CARD_H}
            rounded={10}
            priority="high"
          />
          <View style={styles.meta}>
            <Text
              numberOfLines={1}
              style={[styles.name, { color: p.ink.default }]}
            >
              {featured.name}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.set, { color: p.ink.dim }]}
            >
              {featured.set_name ?? featured.set?.name ?? "—"}
            </Text>
            <View style={styles.priceRow}>
              <PriceText
                amount={featured.pricing_summary?.market?.amount ?? null}
                size={20}
                tone="ink"
              />
              <View
                style={[
                  styles.livePill,
                  { backgroundColor: withAlpha(p.accent.mint, 0.14) },
                ]}
              >
                <View
                  style={[styles.liveDot, { backgroundColor: p.accent.mint }]}
                />
                <Text style={[styles.liveText, { color: p.accent.mint }]}>
                  LIVE
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

/** Styles depend on the caller's card width, so they're built per size. */
const makeStyles = (CARD_W: number, CARD_H: number) =>
  StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  resting: {
    width: CARD_W + 28,
    height: CARD_H,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 22,
  },
  restingText: { fontSize: 12, lineHeight: 17, textAlign: "center" },
  behind: { position: "absolute", top: 10 },
  // Same fan as the web hero's .stackBack1 / .stackBack2. The offset tracks
  // card width so the three stay overlapped at any size.
  back1: {
    transform: [{ rotate: "-13deg" }, { translateX: -CARD_W * 0.35 }],
  },
  back2: { transform: [{ rotate: "11deg" }, { translateX: CARD_W * 0.35 }] },
  glass: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  meta: { marginTop: 12, gap: 2 },
  name: { fontSize: 16, fontWeight: "700", maxWidth: CARD_W },
  set: { fontSize: 12, maxWidth: CARD_W },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5 },
  liveText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  });
