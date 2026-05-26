/**
 * `SetProgressCarousel` — horizontal strip of set-completion tiles.
 *
 * Each tile shows the set's logo, owned / total count, and a progress
 * ring whose color reflects completion (rose < 25%, amber < 75%, mint
 * ≥ 75%). Tapping a tile routes to the set-detail screen so the user
 * can see exactly which cards they still need.
 */

import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import Svg, { Circle } from "react-native-svg";

import { useSetProgress } from "@/application/queries/useSetProgress";
import { SetLogo } from "@/presentation/brand/SetLogo";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { Skeleton } from "@/presentation/components/Skeleton";
import {
  palette,
  useThemedPalette,
  withAlpha,
} from "@/presentation/theme/tokens";
import { compactUsd } from "@/shared/format";
import type { SetProgressWire } from "@/infrastructure/http";

const TILE_W = 180;
const RING_SIZE = 64;
const RING_STROKE = 6;

function ringTint(percent: number): string {
  if (percent >= 75) return palette.accent.mint;
  if (percent >= 25) return "#FFB020";
  return palette.accent.rose;
}

export function SetProgressCarousel() {
  const { data, isLoading, error } = useSetProgress();
  const p = useThemedPalette();

  if (!isLoading && !error && (!data || data.length === 0)) {
    // Vault is empty or no owned cards belong to a known set — skip the
    // section entirely rather than showing an empty rail.
    return null;
  }
  if (error && (!data || data.length === 0)) {
    // Failed to load and we have nothing cached — hide silently rather
    // than nag. Errors surface on the toast/snackbar layer elsewhere.
    return null;
  }

  return (
    <View style={{ gap: 12 }}>
      <SectionHeader eyebrow="Progress" title="Sets" />
      {isLoading ? (
        <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 14 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={TILE_W} height={196} radius={14} />
          ))}
        </View>
      ) : (
        <FlashList
          data={data ?? []}
          keyExtractor={(s) => s.setId}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14 }}
          ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
          renderItem={({ item }) => <SetProgressTile item={item} bgElev={p.bg.elevated} line={p.line.default} inkDim={p.ink.dim} ink={p.ink.default} />}
        />
      )}
    </View>
  );
}

function SetProgressTile({
  item,
  bgElev,
  line,
  inkDim,
  ink,
}: {
  item: SetProgressWire;
  bgElev: string;
  line: string;
  inkDim: string;
  ink: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.setName}, ${item.owned} of ${item.total} cards, ${item.percent.toFixed(0)} percent complete`}
      style={{
        width: TILE_W,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: line,
        backgroundColor: bgElev,
        overflow: "hidden",
      }}
    >
      {/* Set artwork hero — Robinhood-style: large logo breathing on a
          near-neutral surface, no chunky tinted fill. Keeps the tile
          feeling premium instead of toy-like. */}
      <View
        style={{
          height: 64,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 12,
        }}
      >
        <SetLogo
          set={item.setName}
          tcg={item.tcg as "pokemon" | "magic" | "yugioh"}
          variant="logo"
          size={48}
        />
      </View>
      {/* Divider — hairline, brand-neutral. */}
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: line }} />
      <View style={{ padding: 12, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ProgressRing percent={item.percent} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: ink, fontSize: 13, fontWeight: "600" }}>
              {item.setName}
            </Text>
            <Text style={{ color: inkDim, fontSize: 11, marginTop: 2 }}>
              {item.owned} / {item.total}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: inkDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5 }}>
            {item.tcg}
          </Text>
          <Text style={{ color: ink, fontSize: 12, fontWeight: "600" }}>
            {compactUsd(item.estimatedValueUsd)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const tint = ringTint(percent);
  const r = (RING_SIZE - RING_STROKE) / 2;
  const c = Math.PI * 2 * r;
  const clamped = useMemo(() => Math.max(0, Math.min(100, percent)), [percent]);
  const dash = (clamped / 100) * c;
  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          stroke={withAlpha(tint, 0.18)}
          strokeWidth={RING_STROKE}
          fill="transparent"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          stroke={tint}
          strokeWidth={RING_STROKE}
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          fill="transparent"
          // Start the arc at 12 o'clock instead of 3 o'clock so 0% reads
          // as "empty from the top" — matches Apple Fitness rings.
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <View style={{ position: "absolute" }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: tint }}>
          {Math.round(clamped)}%
        </Text>
      </View>
    </View>
  );
}
