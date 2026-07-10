import React from "react";
import { Text, View } from "react-native";
import type { UpcomingReportWire } from "@/infrastructure/http";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import {
  closeWindowProgress,
  daysUntilClose,
  formatCloseDate,
  relativeUntil,
} from "./statementFormat";

interface StatementCloseProgressProps {
  upcoming: UpcomingReportWire;
  compact?: boolean;
}

/** Thin cadence bar — how far through the current statement window we are. */
export function StatementCloseProgress({
  upcoming,
  compact = false,
}: StatementCloseProgressProps) {
  const p = useThemedPalette();
  const progress = closeWindowProgress(upcoming.period_start, upcoming.closes_at);
  const daysLeft = daysUntilClose(upcoming.closes_at);
  const pct = Math.round(progress * 100);

  return (
    <View style={{ gap: compact ? 6 : 8 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text
          style={{
            color: p.ink.dim,
            fontSize: compact ? 9 : 10,
            fontWeight: "700",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {upcoming.label}
        </Text>
        <Text
          style={{
            color: p.accent.mint,
            fontSize: compact ? 10 : 11,
            fontWeight: "700",
          }}
        >
          Closes {relativeUntil(upcoming.closes_at)}
        </Text>
      </View>

      <View
        style={{
          height: compact ? 4 : 5,
          borderRadius: 999,
          backgroundColor: withAlpha(p.line.default, 0.55),
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.max(4, pct)}%`,
            height: "100%",
            borderRadius: 999,
            backgroundColor: p.accent.mint,
          }}
        />
      </View>

      <Text style={{ color: p.ink.muted, fontSize: compact ? 10 : 11 }}>
        {daysLeft > 0
          ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left · ready ${formatCloseDate(upcoming.closes_at)}`
          : `Ready ${formatCloseDate(upcoming.closes_at)}`}
      </Text>
    </View>
  );
}
