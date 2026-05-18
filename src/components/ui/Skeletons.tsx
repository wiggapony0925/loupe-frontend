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
 *
 * The legacy `<Skeleton />` in `Skeleton.tsx` re-exports `SkeletonBox`
 * for back-compat.
 */
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  View,
  type DimensionValue,
  type ViewStyle,
} from "react-native";
import { getActiveScheme, useThemedPalette, withAlpha } from "@/theme/tokens";

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
  return getActiveScheme() === "light"
    ? withAlpha(p.ink.dim, 0.18)
    : p.line.default;
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

// ─── Atoms ─────────────────────────────────────────────────────────────

interface BoxProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({
  width = "100%",
  height = 16,
  radius = 8,
  style,
}: BoxProps) {
  const fill = useSkeletonFill();
  const opacity = useShimmer();
  return (
    <View
      style={[
        { width, height, borderRadius: radius, overflow: "hidden" },
        style,
      ]}
    >
      <Animated.View
        style={{ flex: 1, backgroundColor: fill, opacity }}
      />
    </View>
  );
}

export function SkeletonText({
  width = "60%",
  height = 12,
  radius = 6,
  style,
}: BoxProps) {
  return (
    <SkeletonBox width={width} height={height} radius={radius} style={style} />
  );
}

export function SkeletonCircle({ size = 40 }: { size?: number }) {
  return <SkeletonBox width={size} height={size} radius={size / 2} />;
}

export function SkeletonPill({
  width = 56,
  height = 22,
}: {
  width?: number;
  height?: number;
}) {
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
    <View style={{ flexDirection: "row", gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 168,
            padding: 10,
            borderRadius: 14,
            backgroundColor: p.bg.elevated,
            borderWidth: 1,
            borderColor: p.line.default,
            gap: 8,
          }}
        >
          <SkeletonImage width="100%" height={120} radius={10} />
          <SkeletonText width="80%" height={12} />
          <SkeletonText width="55%" height={13} />
          <SkeletonPill width={64} height={18} />
        </View>
      ))}
    </View>
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
          <SkeletonText width="80%" height={12} />
          <SkeletonText width="50%" height={10} />
        </View>
      ))}
    </View>
  );
}
