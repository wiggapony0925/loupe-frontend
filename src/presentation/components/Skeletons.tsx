/**
 * Skeletons — consolidated shimmer placeholders for the entire app.
 *
 * Single `useShimmer()` hook drives a shared opacity loop (0.5 ↔ 1.0
 * over ~1100ms ease-in-out) so every skeleton on screen breathes in
 * sync. Colors derive from the active theme via `useThemedPalette()`.
 *
 * Atoms:    SkeletonBox / Text / Circle / Pill / Image
 * Rows:     SkeletonSearchRow, SkeletonChipRow, SkeletonStatTile,
 *           SkeletonKVRow, SkeletonHouseRow, SkeletonChart
 * Pages:    SkeletonSearchResults, SkeletonCardDetailPage,
 *           SkeletonGradesPage, SkeletonAnalyticsPage,
 *           SkeletonScannersList
 * Carousels: SkeletonListingsCarousel
 *
 * The legacy `<Skeleton />` in `Skeleton.tsx` re-exports `SkeletonBox`
 * for back-compat.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, ScrollView, View, type DimensionValue, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  getActiveScheme,
  radius,
  spacing,
  useThemedPalette,
  withAlpha,
} from "@/presentation/theme/tokens";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/**
 * Returns a fill color that is visibly distinct from the surrounding
 * card surface in either theme. In dark mode the card sits on `bg.base`
 * (#121214) with `bg.elevated` (#1C1C1E) cards — so `line.default`
 * reads as a clear gray. In light mode cards are pure white, so we
 * tint with the muted ink at low alpha to get a recognizable shimmer
 * instead of the near-invisible white-on-white we used to render.
 */
function useSkeletonFill(): string {
  const p = useThemedPalette();
  return getActiveScheme() === "light" ? withAlpha(p.ink.dim, 0.18) : p.line.default;
}

// ─── Shared pulse ──────────────────────────────────────────────────────

/** Looping opacity 0.5 ↔ 1.0 over 1100ms ease-in-out. */
export function useShimmer(): Animated.Value {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1.0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}

/**
 * Looping 0 → 1 progress value (1600ms linear) used to translate a
 * highlight gradient across each skeleton block. Native-driver so it
 * stays smooth even when the screen is busy.
 */
function useSweep(): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v;
}

// ─── Atoms ─────────────────────────────────────────────────────────────

interface BoxProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width = "100%", height = 16, radius = 8, style }: BoxProps) {
  const fill = useSkeletonFill();
  const opacity = useShimmer();
  const sweep = useSweep();
  // Highlight tint: a touch of white in dark mode, a touch of black in
  // light mode. Either way it travels diagonally across the block to
  // sell the "loading" beat better than a flat opacity pulse can.
  const highlight = useMemo(
    () => (getActiveScheme() === "light" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.07)"),
    [],
  );
  // Translate the highlight from −100% to +100% of the block's width.
  // The block masks via `overflow: hidden` so it never bleeds outside.
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: ["-100%", "100%"],
  });
  return (
    <View style={[{ width, height, borderRadius: radius, overflow: "hidden" }, style]}>
      <Animated.View style={{ flex: 1, backgroundColor: fill, opacity }} />
      <AnimatedLinearGradient
        pointerEvents="none"
        colors={["transparent", highlight, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          transform: [{ translateX } as unknown as { translateX: number }],
        }}
      />
    </View>
  );
}

export function SkeletonText({ width = "60%", height = 12, radius = 6, style }: BoxProps) {
  return <SkeletonBox width={width} height={height} radius={radius} style={style} />;
}

export function SkeletonCircle({ size = 40 }: { size?: number }) {
  return <SkeletonBox width={size} height={size} radius={size / 2} />;
}

export function SkeletonPill({ width = 56, height = 22 }: { width?: number; height?: number }) {
  return <SkeletonBox width={width} height={height} radius={999} />;
}

export function SkeletonImage({
  width = 120,
  height = 168,
  radius = 12,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
}) {
  return <SkeletonBox width={width} height={height} radius={radius} />;
}

// ─── Compound rows ─────────────────────────────────────────────────────

export function SkeletonSearchRow() {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 14,
        backgroundColor: p.bg.elevated,
        borderWidth: 1,
        borderColor: p.line.default,
      }}
    >
      <SkeletonImage width={48} height={68} radius={8} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonText width="70%" height={14} />
        <SkeletonText width="40%" height={11} />
      </View>
      <SkeletonPill width={64} height={20} />
    </View>
  );
}

export function SkeletonChipRow({ count = 6 }: { count?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonPill key={i} width={48 + (i % 3) * 16} height={26} />
      ))}
    </View>
  );
}

export function SkeletonStatTile() {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 14,
        backgroundColor: p.bg.elevated,
        borderWidth: 1,
        borderColor: p.line.default,
        gap: 8,
      }}
    >
      <SkeletonText width="50%" height={10} />
      <SkeletonText width="80%" height={20} />
      <SkeletonText width="30%" height={10} />
    </View>
  );
}

export function SkeletonKVRow() {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
      }}
    >
      <SkeletonText width="35%" height={11} />
      <SkeletonText width="40%" height={12} />
    </View>
  );
}

export function SkeletonHouseRow() {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: p.line.default,
      }}
    >
      <SkeletonPill width={56} height={22} />
      <SkeletonText width={40} height={12} />
      <View style={{ flex: 1 }} />
      <SkeletonText width={60} height={12} />
      <SkeletonText width={80} height={14} />
    </View>
  );
}

export function SkeletonChart({ height = 140 }: { height?: number }) {
  return <SkeletonBox height={height} radius={16} />;
}

// ─── Composed page skeletons ───────────────────────────────────────────

export function SkeletonSearchResults({ rows = 6 }: { rows?: number }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonSearchRow key={i} />
      ))}
    </View>
  );
}

export function SkeletonCardDetailPage() {
  return (
    <View style={{ gap: 20 }}>
      {/* Hero strip */}
      <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
        <SkeletonImage width={120} height={168} radius={14} />
        <View style={{ flex: 1, gap: 10 }}>
          <SkeletonText width="80%" height={22} />
          <SkeletonText width="55%" height={12} />
          <SkeletonText width="30%" height={12} />
          <SkeletonPill width={70} height={22} />
        </View>
      </View>
      {/* Big price */}
      <View style={{ gap: 8 }}>
        <SkeletonText width="50%" height={38} />
        <SkeletonText width="30%" height={12} />
      </View>
      {/* Chart */}
      <SkeletonChart height={150} />
      {/* Range chips */}
      <SkeletonChipRow count={7} />
      {/* Three-up tiles */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SkeletonStatTile />
        <SkeletonStatTile />
        <SkeletonStatTile />
      </View>
      {/* Section header */}
      <SkeletonText width="40%" height={11} />
      {/* House filter chips */}
      <SkeletonChipRow count={6} />
      {/* House rows */}
      <View style={{ gap: 0 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonHouseRow key={i} />
        ))}
      </View>
    </View>
  );
}

export function SkeletonGradesPage({ rows = 4 }: { rows?: number }) {
  const p = useThemedPalette();
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderRadius: 14,
            backgroundColor: p.bg.elevated,
            borderWidth: 1,
            borderColor: p.line.default,
          }}
        >
          <SkeletonCircle size={36} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonText width="60%" height={13} />
            <SkeletonText width="40%" height={11} />
          </View>
          <SkeletonPill width={48} height={22} />
        </View>
      ))}
    </View>
  );
}

export function SkeletonAnalyticsPage() {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SkeletonStatTile />
        <SkeletonStatTile />
      </View>
      <SkeletonChart height={160} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SkeletonStatTile />
        <SkeletonStatTile />
      </View>
    </View>
  );
}

export function SkeletonScannersList({ rows = 3 }: { rows?: number }) {
  const p = useThemedPalette();
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 14,
            borderRadius: 14,
            backgroundColor: p.bg.elevated,
            borderWidth: 1,
            borderColor: p.line.default,
          }}
        >
          <SkeletonCircle size={32} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonText width="50%" height={13} />
            <SkeletonText width="30%" height={11} />
          </View>
          <SkeletonPill width={56} height={20} />
        </View>
      ))}
    </View>
  );
}

export function SkeletonListingsRail({ rows = 4 }: { rows?: number }) {
  const p = useThemedPalette();
  return (
    <View
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
        overflow: "hidden",
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderBottomWidth: i === rows - 1 ? 0 : 1,
            borderBottomColor: p.line.default,
          }}
        >
          <SkeletonImage width={54} height={54} radius={radius.md} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <SkeletonText width="82%" height={13} />
            <View style={{ flexDirection: "row", gap: 6 }}>
              <SkeletonPill width={54} height={18} />
              <SkeletonPill width={72} height={18} />
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: spacing.sm }}>
            <SkeletonText width={64} height={16} />
            <SkeletonPill width={44} height={16} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Horizontal carousel skeleton — matches the `MarketplaceTileCard` layout
 * (150dp-wide photo-forward tiles in a ScrollView).
 */
export function SkeletonListingsCarousel({ count = 4 }: { count?: number }) {
  const p = useThemedPalette();
  const TILE_W = 150;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={false}
      contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: TILE_W,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
            overflow: "hidden",
          }}
        >
          {/* photo */}
          <SkeletonBox width={TILE_W} height={116} radius={0} />
          {/* body */}
          <View style={{ padding: 11, gap: spacing.sm }}>
            <SkeletonText width="90%" height={12} />
            <SkeletonText width="55%" height={9} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
              <SkeletonText width={56} height={18} />
              <SkeletonBox width={14} height={14} radius={3} />
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export function SkeletonCompsList({ rows = 5 }: { rows?: number }) {
  const p = useThemedPalette();
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 12,
            borderRadius: 12,
            backgroundColor: p.bg.elevated,
            borderWidth: 1,
            borderColor: p.line.default,
          }}
        >
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonText width="75%" height={12} />
            <SkeletonText width="40%" height={10} />
          </View>
          <SkeletonPill width={48} height={18} />
          <SkeletonText width={60} height={13} />
        </View>
      ))}
    </View>
  );
}

export function SkeletonTrendingGrid({ count = 6 }: { count?: number }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ flexBasis: "47%", flexGrow: 1, gap: 6 }}>
          <View style={{ aspectRatio: 5 / 7, width: "100%" }}>
            <SkeletonImage width="100%" height="100%" radius={12} />
          </View>
          {/* Two name bars match CardTile's 2-line name clamp so the
              shimmer height equals the loaded height and the grid
              doesn't shift when data arrives. */}
          <SkeletonText width="90%" height={12} />
          <SkeletonText width="65%" height={12} />
          <SkeletonText width="50%" height={10} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton for `/compare` — mirrors the two-column ReportColumn layout
 * (image with 2.5:3.5 aspect, title, sub-set, big grade row, four
 * score lines) plus the delta strip beneath.
 */
export function SkeletonComparePage() {
  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[0, 1].map((i) => (
          <View key={i} style={{ flex: 1, gap: 12, padding: 12, borderRadius: 16 }}>
            <View style={{ aspectRatio: 2.5 / 3.5, width: "100%" }}>
              <SkeletonImage width="100%" height="100%" radius={12} />
            </View>
            <View style={{ gap: 6 }}>
              <SkeletonText width="85%" height={14} />
              <SkeletonText width="55%" height={11} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <SkeletonText width={60} height={28} />
              <SkeletonText width={48} height={12} />
            </View>
            <View style={{ gap: 6 }}>
              {Array.from({ length: 4 }).map((_, k) => (
                <SkeletonKVRow key={k} />
              ))}
            </View>
          </View>
        ))}
      </View>
      {/* Delta strip */}
      <View style={{ gap: 8 }}>
        <SkeletonText width="35%" height={11} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={{ flex: 1 }}>
              <SkeletonStatTile />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Skeleton for the legacy `/market/[id]` route — hero image + title,
 * big chart placeholder, condition toggle, market stats grid. Used
 * while the market-card payload streams in so the page never collapses
 * to a single spinner.
 */
export function SkeletonMarketDetailPage() {
  return (
    <View style={{ gap: 20, paddingHorizontal: 20, paddingTop: 8 }}>
      {/* Hero */}
      <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
        <SkeletonImage width={96} height={134} radius={12} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonText width="60%" height={10} />
          <SkeletonText width="90%" height={20} />
          <SkeletonText width="70%" height={20} />
          <SkeletonPill width={90} height={20} />
        </View>
      </View>
      {/* Big price + delta */}
      <View style={{ gap: 8 }}>
        <SkeletonText width="55%" height={36} />
        <SkeletonText width="35%" height={12} />
      </View>
      {/* Chart */}
      <SkeletonChart height={200} />
      {/* Range pills */}
      <SkeletonChipRow count={7} />
      {/* Condition toggle */}
      <View style={{ flexDirection: "row", gap: 0, borderRadius: 12, overflow: "hidden" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={{ flex: 1 }}>
            <SkeletonStatTile />
          </View>
        ))}
      </View>
      {/* Stat grid */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SkeletonStatTile />
        <SkeletonStatTile />
      </View>
      {/* Comps rail */}
      <SkeletonText width="40%" height={11} />
      <SkeletonListingsRail rows={4} />
    </View>
  );
}
