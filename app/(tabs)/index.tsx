import React, { useCallback, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ArrowUpRight,
  Bell,
  Camera,
  Settings2,
} from "lucide-react-native";
import { queryKeys } from "@/application/queries/queryKeys";
import { routes } from "@/shared/routes";
import { fetchCollectionSummary } from "@/infrastructure/repositories/forensicRepository";
import { HardwareStatusWidget, useScannerConnection } from "@/presentation/features/scanner";
import { PortfolioChart, TodaysDeltaHero } from "@/presentation/features/analytics";
import { SetProgressCarousel } from "@/presentation/features/collection/SetProgressCarousel";
import { MixedTrendingRail } from "@/presentation/features/search/MixedTrendingRail";
import { SealedRail } from "@/presentation/features/search/SealedRail";
import { useSealedSearch } from "@/application/queries/collection/useSealed";
import { Skeleton } from "@/presentation/components/Skeleton";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { EmptyState } from "@/presentation/components/EmptyState";
import { ErrorState } from "@/presentation/components/ErrorState";
import { LoupeMark } from "@/presentation/brand/LoupeMark";
import { useApiHealth, useHomeFeed, useTopMovers } from "@/application/queries";
import { useCardSparklines } from "@/application/queries/catalog/useCardSparklines";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { MoverSparkRow } from "@/presentation/cards";
import { compactUsd, greeting, relativeTime } from "@/shared/format";
import { gradeColor, useThemedPalette } from "@/presentation/theme/tokens";
import type { RecentScanRow } from "@/infrastructure/repositories/homeRepository";

export default function CommandCenterScreen() {
  const p = useThemedPalette();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  // Gate on auth so this doesn't fire on cold boot BEFORE the stored token is
  // attached to the HTTP client — that race returned an empty summary ($0.00)
  // that only a pull-to-refresh fixed. Enabling on `isAuthenticated` makes it
  // wait for the token, then auto-fetch (the pattern the other hooks use).
  const summary = useQuery({
    queryKey: queryKeys.collection.summary(),
    queryFn: fetchCollectionSummary,
    enabled: isAuthenticated,
    // Same key as useFilteredCollection's summary — keep the values in sync.
    staleTime: 30_000,
  });
  const feed = useHomeFeed({ topMovers: 5, recentScans: 6 });
  const hardware = useScannerConnection();
  const movers = useTopMovers({ enrichLimit: 12, limit: 5 });
  // Discovery rails at the bottom mirror the web home page's carousels
  // (Trending now ▸ Most valuable right now ▸ Sealed products ▸ Steals
  // under $5). Sealed is the only one we gate on data, since its rail
  // renders nothing when empty (leaving a lone header otherwise).
  const sealed = useSealedSearch("");
  const hasSealed = (sealed.data?.length ?? 0) > 0;

  // Manual-only refresh flag — using TanStack's `isFetching` made the
  // RefreshControl spin on initial mount, which pushed the screen header
  // below the viewport on Android.
  const [pulling, setPulling] = useState(false);
  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await qc.invalidateQueries();
      movers.refetch();
    } finally {
      setPulling(false);
    }
  }, [qc, movers]);

  const recent = feed.data?.recentScans ?? [];

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <ScrollView
        // iOS floats a tab-bar pill over the content, so pad past it (bar
        // height + home-indicator inset) instead of the flat-bar gap.
        contentContainerStyle={{
          padding: 20,
          paddingBottom: Platform.OS === "ios" ? 116 : 48,
          gap: 24,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onRefresh}
            tintColor={p.accent.mint}
          />
        }
      >
        <Header />

        <TodaysDeltaHero />

        <PortfolioChart
          fallbackTotal={summary.data?.totalValueUsd ?? 0}
          costBasisUsd={summary.data?.totalCostUsd ?? null}
          showPsa10Overlay
          bleedX={20}
        />

        <View>
          <SectionHeader
            eyebrow="Markets"
            title="Top movers"
            trailing={
              <Pressable
                onPress={() => router.push(routes.vault())}
                hitSlop={10}
                className="flex-row items-center gap-1"
              >
                <Text className="text-xs font-medium text-ink-muted">All</Text>
                <ArrowUpRight size={14} color={p.ink.muted} />
              </Pressable>
            }
          />

          {/* Compact KPI strip — 3-up summary above the watchlist. We
              skeleton ONLY while React Query is actively fetching with no
              cached data yet. Once the request settles (success OR error)
              we render the strip with whatever we have — using "—" for
              missing values — so a 401/404/network blip can't pin the
              page on a forever-skeleton. */}
          <View className="mb-3 flex-row gap-3">
            {summary.isLoading && !summary.data ? (
              <>
                <KpiPill />
                <KpiPill />
                <KpiPill />
              </>
            ) : (
              <>
                <KpiPill
                  label="Value"
                  value={
                    summary.data
                      ? compactUsd(summary.data.totalValueUsd)
                      : "—"
                  }
                  accent={p.accent.mint}
                />
                {summary.data?.unrealizedPnlUsd != null &&
                summary.data?.unrealizedPnlPct != null ? (
                  <KpiPill
                    label="P/L"
                    value={`${
                      summary.data.unrealizedPnlUsd >= 0 ? "+" : ""
                    }${compactUsd(summary.data.unrealizedPnlUsd)} (${
                      summary.data.unrealizedPnlPct >= 0 ? "+" : ""
                    }${summary.data.unrealizedPnlPct.toFixed(1)}%)`}
                    accent={
                      summary.data.unrealizedPnlUsd >= 0
                        ? p.accent.mint
                        : p.accent.rose
                    }
                  />
                ) : (
                  <KpiPill
                    label="Accuracy"
                    value={
                      summary.data?.avgAccuracy != null
                        ? `${(summary.data.avgAccuracy * 100).toFixed(1)}%`
                        : "—"
                    }
                    accent={p.accent.blue}
                  />
                )}
                <KpiPill
                  label="Scans"
                  value={
                    hardware.data && hardware.data.scansRemaining != null
                      ? hardware.data.scansRemaining.toLocaleString()
                      : "—"
                  }
                  accent={p.accent.amber}
                />
              </>
            )}
          </View>

          {/* Hand the entire loading/error/empty/loaded decision to
              TopMoversSection — it already renders skeleton on
              `movers.isLoading`, ErrorState on `movers.isError`,
              and EmptyState when the vault is empty. The previous gate
              on the legacy `collection` query left this section stuck
              on skeleton whenever /v1/grades returned [] or errored. */}
          <TopMoversSection movers={movers} isAuthenticated={isAuthenticated} />
        </View>

        <SetProgressCarousel />

        <View>
          <SectionHeader
            eyebrow="Recent"
            title="Last graded"
            trailing={
              <Pressable
                onPress={() => router.push(routes.vault())}
                hitSlop={10}
                className="flex-row items-center gap-1"
              >
                <Text className="text-xs font-medium text-ink-muted">Vault</Text>
                <ArrowUpRight size={14} color={p.ink.muted} />
              </Pressable>
            }
          />
          {feed.isLoading ? (
            <RecentRailSkeleton />
          ) : recent.length === 0 ? (
            <EmptyState
              compact
              icon={Camera}
              title="No recent scans"
              message="Scan a card to start your vault."
              secondaryActionLabel="Scan a card"
              onSecondaryAction={() => router.push(routes.scanEntry())}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -20 }}
              contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}
            >
              {recent.map((c) => (
                <RecentChip key={c.gradeId} card={c} />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Discovery carousels — the same rails the web home page shows,
            in the same order: Trending now ▸ Most valuable right now ▸
            Sealed products ▸ Steals under $5. These give the home screen a
            "what's out there" heartbeat below the personal feed. The mixed
            rails interleave Pokémon · Magic · Yu-Gi-Oh! (with a value
            fallback) so they stay populated even when a trending upstream
            times out. Full discovery still lives in the Search tab. */}
        <View>
          <SectionHeader
            eyebrow="Live"
            title="Trending now"
            trailing={
              <Pressable
                onPress={() => router.push("/search")}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="See all discovery rails in Search"
                className="flex-row items-center gap-1"
              >
                <Text className="text-xs font-medium text-ink-muted">More</Text>
                <ArrowUpRight size={14} color={p.ink.muted} />
              </Pressable>
            }
          />
          <MixedTrendingRail sort="trending" limit={12} />
        </View>

        <View>
          <SectionHeader eyebrow="Market" title="Most valuable right now" />
          <MixedTrendingRail sort="value" limit={12} />
        </View>

        {hasSealed ? (
          <View>
            <SectionHeader
              eyebrow="Sealed"
              title="Sealed products"
              trailing={
                <Pressable
                  onPress={() => router.push(routes.sealed())}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="See all sealed products"
                  className="flex-row items-center gap-1"
                >
                  <Text className="text-xs font-medium text-ink-muted">More</Text>
                  <ArrowUpRight size={14} color={p.ink.muted} />
                </Pressable>
              }
            />
            <SealedRail products={sealed.data ?? []} />
          </View>
        ) : null}

        <View>
          <SectionHeader eyebrow="Under $5" title="Steals under $5" />
          <MixedTrendingRail sort="value" maxPrice={5} limit={12} />
        </View>

        {/* Hardware scanner status pushed below the personal feed —
            most users never own a Loupe scanner, so it's a tertiary
            utility, not the centerpiece of the home screen. Discovery
            content (Trending / Chase rares / Newest releases) used to
            live here too but moved to the Search tab where it belongs:
            home = "what's mine", search = "what's out there". */}
        <View>
          <SectionHeader
            eyebrow="Device"
            title="Scanner connection"
            trailing={
              <Pressable
                onPress={() => router.push("/scan/pair")}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Manage paired devices"
                className="flex-row items-center gap-1"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-xs font-medium text-ink-muted">Manage</Text>
                <ArrowUpRight size={14} color={p.ink.muted} />
              </Pressable>
            }
          />
          <HardwareStatusWidget />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  const p = useThemedPalette();
  const health = useApiHealth();
  const apiOk = health.isSuccess && (health.data?.status ?? "").toLowerCase().startsWith("ok");
  // Only flip to the rose "down" state once React Query has actually
  // observed a failed fetch — otherwise the idle/fetching window
  // (isLoading false, isSuccess false, isError false) renders as down.
  const apiDown = health.isError;
  const apiTint = apiOk
    ? p.accent.mint
    : apiDown
      ? p.accent.rose
      : p.ink.muted;
  const apiLabel = apiOk ? "API live" : apiDown ? "API down" : "API…";
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <LoupeMark size={26} />
          <Text className="text-base font-semibold tracking-tight text-ink">Loupe</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Loupe backend ${apiLabel}. Tap to retry.`}
            onPress={() => {
              health.refetch().catch((err) => {
                // Surface the underlying network error so we can tell a
                // genuine outage from a stale-bundle / wedged-simulator
                // false negative. ApiError instances include status+code.
                // eslint-disable-next-line no-console
                console.warn("[health] manual refetch failed:", err);
              });
            }}
            hitSlop={6}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: apiTint,
              backgroundColor: "transparent",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: apiTint,
              }}
            />
            <Text style={{ color: apiTint, fontSize: 10, fontWeight: "700", letterSpacing: 0.4 }}>
              {apiLabel}
            </Text>
          </Pressable>
          {/* LIVE sync chip intentionally hidden — diagnostic-only; will
              also remove the API pill before shipping to production. */}
          <Pressable
            onPress={() => router.push(routes.notifications())}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
            className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Bell size={16} color={p.ink.muted} />
          </Pressable>
          <Pressable
            onPress={() => router.push(routes.settings())}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Settings2 size={16} color={p.ink.muted} />
          </Pressable>
        </View>
      </View>
      <Text className="mt-5 text-xs uppercase tracking-[3px] text-ink-dim">
        {greeting()}, operator
      </Text>
    </View>
  );
}

function RecentChip({ card }: { card: RecentScanRow }) {
  const tint = gradeColor(card.grade ?? 0);
  const onPress = card.cardId
    ? () => router.push(routes.card(card.cardId as string))
    : undefined;
  return (
    <Pressable
      onPress={onPress}
      className="w-44 rounded-2xl border border-line bg-bg-elevated p-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] uppercase tracking-[2px] text-ink-dim">
          {card.scannedAt ? relativeTime(card.scannedAt) : "—"}
        </Text>
        <Text className="text-xs font-bold" style={{ color: tint }}>
          {card.grade != null ? card.grade.toFixed(1) : "—"}
        </Text>
      </View>
      <Text numberOfLines={1} className="mt-2 text-sm font-semibold text-ink">
        {card.cardName ?? "Unknown card"}
      </Text>
      <Text numberOfLines={1} className="mt-0.5 text-[11px] text-ink-muted">
        {card.cardSetName ?? ""}
      </Text>
    </Pressable>
  );
}

function RecentRailSkeleton() {
  return (
    <View className="flex-row gap-2.5">
      {[0, 1, 2].map((i) => (
        <View key={i} className="w-44 rounded-2xl border border-line bg-bg-elevated p-3">
          <Skeleton width={80} height={10} />
          <View className="h-3" />
          <Skeleton width="80%" height={14} />
          <View className="h-2" />
          <Skeleton width="60%" height={10} />
        </View>
      ))}
    </View>
  );
}

function SkeletonTile({ full = false }: { full?: boolean }) {
  return (
    <View
      className={`${full ? "w-full" : "flex-1"} rounded-2xl border border-line bg-bg-elevated p-4`}
    >
      <Skeleton width={80} height={10} />
      <View className="h-3" />
      <Skeleton width={120} height={22} />
      <View className="h-2" />
      <Skeleton width="60%" height={10} />
    </View>
  );
}

/**
 * Compact 3-up KPI pill used above the Top Movers list. Mirrors the
 * Robinhood "category chip strip" pattern — a tiny accent dot, a label
 * eyebrow, and a single bold value.
 */
function KpiPill({
  label,
  value,
  accent,
}: {
  label?: string;
  value?: string;
  accent?: string;
}) {
  if (!label || !value) {
    return (
      <View className="flex-1 rounded-xl border border-line bg-bg-elevated px-3 py-2.5">
        <Skeleton width={40} height={8} />
        <View className="h-2" />
        <Skeleton width={56} height={14} />
      </View>
    );
  }
  return (
    <View className="flex-1 rounded-xl border border-line bg-bg-elevated px-3 py-2.5">
      <View className="flex-row items-center gap-1.5">
        {accent ? (
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: accent,
            }}
          />
        ) : null}
        <Text className="text-[9px] font-semibold uppercase tracking-[2px] text-ink-dim">
          {label}
        </Text>
      </View>
      <Text
        className="mt-1 text-sm font-bold text-ink"
        style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.2 }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Real-data Top Movers — composes `useTopMovers` (vault + market enrichment)
 * with the Vault-style `MoverSparkRow` (art · sparkline · price pill). Renders
 * auth/loading/error/empty states inline so the section never collapses.
 */
function TopMoversSection({
  movers,
  isAuthenticated,
}: {
  movers: ReturnType<typeof useTopMovers>;
  isAuthenticated: boolean;
}) {
  // Real per-card sparklines, keyed by GradedCard.id (== mover.gradeId) — the
  // same `/v1/grades/sparklines` source the Vault rows use, so Command Center
  // and Vault draw identical lines. Hook runs before any early return.
  const { byCardId: sparkByGrade } = useCardSparklines({ enabled: isAuthenticated });
  if (!isAuthenticated) {
    return (
      <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        <EmptyState
          title="Sign in to see your movers"
          message="Connect your vault to track the biggest 1-year price swings on cards you actually own."
          secondaryActionLabel="Open settings"
          onSecondaryAction={() => router.push(routes.settings())}
          compact
        />
      </View>
    );
  }
  if (movers.isLoading) {
    return <SkeletonTile full />;
  }
  if (movers.isError) {
    return (
      <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        <ErrorState
          title="Movers unavailable"
          message="We couldn't reach the market service."
          onRetry={movers.refetch}
          compact
        />
      </View>
    );
  }
  if (movers.isEmpty) {
    return (
      <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        <EmptyState
          title="Your vault is empty"
          message="Scan a card to start tracking real movers on the cards you grade."
          secondaryActionLabel="Scan a card"
          onSecondaryAction={() => router.push(routes.scanPhone())}
          compact
        />
      </View>
    );
  }
  if (movers.rows.length === 0) {
    // User has graded cards but we couldn't enrich any with live market data
    // (e.g. locally-seeded cards with no upstream pricing). Be honest about
    // it instead of telling them their vault is empty.
    return (
      <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        <EmptyState
          title="Market data syncing"
          message="We're still pulling live prices for your graded cards. Check back shortly."
          secondaryActionLabel="View vault"
          onSecondaryAction={() => router.push(routes.vault())}
          compact
        />
      </View>
    );
  }
  return (
    <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
      {movers.rows.map((row, i) => (
        <MoverSparkRow
          key={row.card.id}
          card={row.card}
          price={row.price}
          trend={row.trend}
          spark={sparkByGrade.get(row.gradeId)}
          bordered={i > 0}
        />
      ))}
    </View>
  );
}
