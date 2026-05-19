/**
 * LiveAnalyticsCard — backend-derived aggregate stats from `/me/grades`.
 *
 * Renders four KPI tiles (total scans, avg grade, gem rate, last scan)
 * and a small grader-distribution bar (PSA / BGS / CGC). Unauthenticated
 * state shows a sign-in CTA; loading state shows skeleton tiles.
 */
import React, { useMemo } from "react";
import { Text, View } from "react-native";
import type { GradedCard } from "@/infrastructure/http";
import { useMyGrades } from "@/application/queries/useMyGrades";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { QueryState } from "@/presentation/components/QueryState";
import { Skeleton } from "@/presentation/components/Skeleton";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export function LiveAnalyticsCard() {
  const { isAuthenticated } = useAuth();
  const q = useMyGrades<GradedCard[]>();
  const p = useThemedPalette();

  const stats = useMemo(() => {
    const grades = q.data ?? [];
    if (!grades.length) {
      return {
        count: 0,
        avg: 0,
        gemRate: 0,
        lastScan: null as string | null,
        graders: { psa: 0, bgs: 0, cgc: 0 },
      };
    }
    // Backend serializes Decimal as string; coerce for arithmetic.
    const asNumber = (g: GradedCard) => Number(g.grade) || 0;
    const avg = grades.reduce((s, g) => s + asNumber(g), 0) / grades.length;
    const gem = grades.filter((g) => asNumber(g) >= 9).length;
    const last = grades
      .map((g) => g.graded_at ?? g.created_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] as string | undefined;
    // Backend `house` includes loupe/sgc/tag/etc — only surface the 3 the UI tracks.
    const graders = grades.reduce(
      (a, g) => {
        const key = g.house as "psa" | "bgs" | "cgc";
        if (key === "psa" || key === "bgs" || key === "cgc") {
          a[key] = (a[key] ?? 0) + 1;
        }
        return a;
      },
      { psa: 0, bgs: 0, cgc: 0 } as Record<"psa" | "bgs" | "cgc", number>,
    );
    return {
      count: grades.length,
      avg,
      gemRate: (gem / grades.length) * 100,
      lastScan: last ? new Date(last).toLocaleDateString() : null,
      graders,
    };
  }, [q.data]);

  if (!isAuthenticated) {
    return (
      <View>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Live · /me/grades
        </Text>
        <View className="mt-2 items-center rounded-2xl border border-line bg-bg-elevated px-4 py-6">
          <Text className="text-sm font-semibold text-ink">
            Sign in to see your stats
          </Text>
          <Text className="mt-1 text-center text-[11px] text-ink-muted">
            Analytics powered by your real Loupe scans.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        Live · /me/grades
      </Text>
      <View className="mt-2">
        <QueryState
          isLoading={q.isLoading}
          isError={q.isError}
          isEmpty={!q.isLoading && !q.isError && stats.count === 0}
          loadingFallback={
            <View className="flex-row" style={{ gap: 8 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} width="23%" height={66} radius={12} />
              ))}
            </View>
          }
          emptyTitle="No scans yet"
          emptyMessage="Scan a card to start unlocking analytics."
          errorMessage="Couldn't load your stats"
          onRetry={() => void q.refetch()}
        >
          <View className="flex-row" style={{ gap: 8 }}>
            <Kpi label="Scans" value={String(stats.count)} />
            <Kpi label="Avg" value={stats.avg.toFixed(1)} />
            <Kpi label="Gem %" value={`${stats.gemRate.toFixed(0)}%`} />
            <Kpi label="Last" value={stats.lastScan ?? "—"} />
          </View>

          <View
            className="mt-3 overflow-hidden rounded-xl border"
            style={{ borderColor: p.line.default, height: 14, flexDirection: "row" }}
          >
            <GraderBar count={stats.graders.psa} total={stats.count} color={p.accent.mint} />
            <GraderBar count={stats.graders.bgs} total={stats.count} color={p.accent.amber} />
            <GraderBar count={stats.graders.cgc} total={stats.count} color={p.accent.rose} />
          </View>
          <View className="mt-1 flex-row justify-between">
            <Legend label="PSA" color={p.accent.mint} count={stats.graders.psa} />
            <Legend label="BGS" color={p.accent.amber} count={stats.graders.bgs} />
            <Legend label="CGC" color={p.accent.rose} count={stats.graders.cgc} />
          </View>
        </QueryState>
      </View>
    </View>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-1 rounded-xl border border-line bg-bg-elevated px-3 py-2.5"
    >
      <Text className="text-[9px] uppercase tracking-[2px] text-ink-dim">
        {label}
      </Text>
      <Text className="mt-1 text-base font-semibold text-ink" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function GraderBar({
  count,
  total,
  color,
}: {
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? count / total : 0;
  if (pct === 0) return null;
  return <View style={{ flex: pct, backgroundColor: withAlpha(color, 0.6) }} />;
}

function Legend({
  label,
  color,
  count,
}: {
  label: string;
  color: string;
  count: number;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text className="text-[10px] text-ink-muted">
        {label} · {count}
      </Text>
    </View>
  );
}
