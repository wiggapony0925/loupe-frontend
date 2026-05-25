/**
 * TodaysDeltaHero — the first thing a returning user sees on the home tab.
 *
 * Composes two existing queries — `usePortfolioHistory({timeframe:"1D"})`
 * for the day's signed delta, and `useTopMovers({limit:1})` for the card
 * that led the move — into a single Collectr-style "opening line":
 *
 *     +$47.20 today (+2.1%) · Led by Charizard VMAX
 *
 * Renders nothing while signed out (PortfolioChart already handles that
 * case below). Renders nothing on hard error rather than showing a noisy
 * banner — the chart below will still surface the failure with its own
 * inline error state. Falls back to a quiet "Quiet day" copy when the
 * delta is exactly zero so the strip never reads as broken.
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ArrowDownRight, ArrowUpRight } from "lucide-react-native";

import { usePortfolioHistory, useTopMovers } from "@/application/queries";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { Skeleton } from "@/presentation/components/Skeleton";
import { palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { compactUsd } from "@/shared/format";
import { routes } from "@/shared/routes";

export function TodaysDeltaHero() {
  const { isAuthenticated } = useAuth();
  const history = usePortfolioHistory({ timeframe: "1D", enabled: isAuthenticated });
  const movers = useTopMovers({ limit: 1 });
  const p = useThemedPalette();

  if (!isAuthenticated) return null;

  if (history.isLoading) {
    return (
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          paddingHorizontal: 16,
          paddingVertical: 14,
          gap: 8,
        }}
      >
        <Skeleton width={60} height={9} />
        <Skeleton width={180} height={22} />
        <Skeleton width={140} height={10} />
      </View>
    );
  }

  // Silent fail: chart below will render its own error state.
  if (history.isError || !history.data) return null;

  const delta = history.data.deltaUsd;
  const pct = history.data.deltaPct;
  const isUp = delta > 0;
  const isFlat = delta === 0;
  const tint = isFlat ? p.ink.muted : isUp ? palette.accent.mint : palette.accent.rose;
  const Arrow = isUp ? ArrowUpRight : ArrowDownRight;

  const leader = movers.rows[0] ?? null;
  const leaderName = leader?.card.name ?? null;

  const onPress = () => router.push(routes.analytics());

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        isFlat
          ? "Portfolio unchanged today. Open analytics."
          : `Portfolio ${isUp ? "up" : "down"} ${compactUsd(Math.abs(delta))} today, ${pct.toFixed(1)} percent.${leaderName ? ` Led by ${leaderName}.` : ""} Open analytics.`
      }
      style={({ pressed }) => ({
        borderRadius: 16,
        borderWidth: 1,
        borderColor: isFlat ? p.line.default : withAlpha(tint, 0.35),
        backgroundColor: isFlat ? p.bg.elevated : withAlpha(tint, 0.06),
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 6,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: tint,
          }}
        />
        <Text
          style={{
            color: p.ink.dim,
            fontSize: 9,
            fontWeight: "700",
            letterSpacing: 2.4,
          }}
        >
          TODAY
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {!isFlat ? <Arrow size={20} color={tint} /> : null}
        <Text
          style={{
            color: tint,
            fontSize: 22,
            fontWeight: "700",
            letterSpacing: -0.4,
            fontVariant: ["tabular-nums"],
          }}
        >
          {isFlat
            ? "Quiet day, +$0.00"
            : `${isUp ? "+" : "−"}${compactUsd(Math.abs(delta))} (${isUp ? "+" : "−"}${Math.abs(pct).toFixed(1)}%)`}
        </Text>
      </View>

      {leaderName ? (
        <Text
          numberOfLines={1}
          style={{ color: p.ink.muted, fontSize: 12, marginTop: 2 }}
        >
          Led by{" "}
          <Text style={{ color: p.ink.default, fontWeight: "600" }}>
            {leaderName}
          </Text>
          {leader?.trend?.pct != null
            ? ` (${leader.trend.pct >= 0 ? "+" : ""}${leader.trend.pct.toFixed(1)}%)`
            : ""}
        </Text>
      ) : null}
    </Pressable>
  );
}
