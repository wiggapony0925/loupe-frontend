/**
 * LiveAnalyticsCard — server-derived KPI tiles (scans / avg grade /
 * gem rate / last scan) plus a small grader-distribution bar.
 *
 * Data source is `GET /v1/analytics/overview` — the same payload that
 * powers the rest of the screen, so this component shares the cache.
 */
import React from "react";
import { Text, View } from "react-native";
import { useAnalyticsOverview } from "@/application/queries";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { QueryState } from "@/presentation/components/QueryState";
import { Skeleton } from "@/presentation/components/Skeleton";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export function LiveAnalyticsCard() {
  const { isAuthenticated } = useAuth();
  const q = useAnalyticsOverview();
  const p = useThemedPalette();

  if (!isAuthenticated) {
    return (
      <View>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Live · analytics
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

  const kpis = q.data?.kpis;
  const isEmpty = !q.isLoading && !q.isError && (kpis?.totalScans ?? 0) === 0;
  const lastScan = kpis?.lastScanAt
    ? new Date(kpis.lastScanAt).toLocaleDateString()
    : null;

  return (
    <View>
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        Live · analytics
      </Text>
      <View className="mt-2">
        <QueryState
          isLoading={q.isLoading}
          isError={q.isError}
          isEmpty={isEmpty}
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
          {kpis ? (
            <>
              <View className="flex-row" style={{ gap: 8 }}>
                <Kpi label="Scans" value={String(kpis.totalScans)} />
                <Kpi label="Avg" value={kpis.avgGrade.toFixed(1)} />
                <Kpi label="Gem %" value={`${kpis.gemRatePct.toFixed(0)}%`} />
                <Kpi label="Last" value={lastScan ?? "—"} />
              </View>

              <View
                className="mt-3 overflow-hidden rounded-xl border"
                style={{ borderColor: p.line.default, height: 14, flexDirection: "row" }}
              >
                <GraderBar count={kpis.graderSplit.psa} total={kpis.totalScans} color={p.accent.mint} />
                <GraderBar count={kpis.graderSplit.bgs} total={kpis.totalScans} color={p.accent.amber} />
                <GraderBar count={kpis.graderSplit.cgc} total={kpis.totalScans} color={p.accent.rose} />
              </View>
              <View className="mt-1 flex-row justify-between">
                <Legend label="PSA" color={p.accent.mint} count={kpis.graderSplit.psa} />
                <Legend label="BGS" color={p.accent.amber} count={kpis.graderSplit.bgs} />
                <Legend label="CGC" color={p.accent.rose} count={kpis.graderSplit.cgc} />
              </View>
            </>
          ) : null}
        </QueryState>
      </View>
    </View>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-xl border border-line bg-bg-elevated px-3 py-2.5">
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
