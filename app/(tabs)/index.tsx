import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/application/queries/queryKeys";
import { router } from "expo-router";
import { routes } from "@/shared/routes";
import {
  ArrowUpRight,
  Bell,
  Camera,
  Settings2,
  Smartphone,
  Zap,
} from "lucide-react-native";
import { fetchCollection, fetchCollectionSummary } from "@/infrastructure/repositories/forensicRepository";
import { HardwareStatusWidget, InitiateScanButton, useScannerConnection } from "@/presentation/features/scanner";
import { PortfolioChart } from "@/presentation/features/analytics";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { Skeleton } from "@/presentation/components/Skeleton";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { EmptyState } from "@/presentation/components/EmptyState";
import { ErrorState } from "@/presentation/components/ErrorState";
import { HotRightNowRail } from "@/presentation/features/search/HotRightNowRail";
import { LoupeMark } from "@/presentation/brand/LoupeMark";
import { useApiHealth, useTopMovers } from "@/application/queries";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { MoversCardRow } from "@/presentation/cards";
import { compactUsd, greeting, relativeTime } from "@/shared/format";
import { gradeColor, palette, useThemedPalette } from "@/presentation/theme/tokens";
import type { CollectionCard } from "@/domain";

export default function CommandCenterScreen() {
  useThemedPalette();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const summary = useQuery({ queryKey: ["collection-summary"], queryFn: fetchCollectionSummary });
  const collection = useQuery({ queryKey: queryKeys.collection.list(), queryFn: fetchCollection });
  const hardware = useScannerConnection();
  const movers = useTopMovers({ enrichLimit: 12, limit: 5 });

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

  const recent = (collection.data ?? [])
    .slice()
    .sort((a, b) => +new Date(b.scannedAt) - +new Date(a.scannedAt))
    .slice(0, 6);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onRefresh}
            tintColor={palette.accent.mint}
          />
        }
      >
        <Header />

        <PortfolioChart fallbackTotal={summary.data?.totalValueUsd ?? 0} />

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
                <ArrowUpRight size={14} color={palette.ink.muted} />
              </Pressable>
            }
          />

          {/* Compact KPI strip — 3-up summary above the watchlist */}
          <View className="mb-3 flex-row gap-3">
            {summary.isLoading || !summary.data ? (
              <>
                <KpiPill />
                <KpiPill />
                <KpiPill />
              </>
            ) : (
              <>
                <KpiPill
                  label="Value"
                  value={compactUsd(summary.data.totalValueUsd)}
                  accent={palette.accent.mint}
                />
                <KpiPill
                  label="Accuracy"
                  value={
                    summary.data.avgAccuracy != null
                      ? `${(summary.data.avgAccuracy * 100).toFixed(1)}%`
                      : "—"
                  }
                  accent={palette.accent.blue}
                />
                <KpiPill
                  label="Scans"
                  value={
                    hardware.data && hardware.data.scansRemaining != null
                      ? hardware.data.scansRemaining.toLocaleString()
                      : "—"
                  }
                  accent={palette.accent.amber}
                />
              </>
            )}
          </View>

          {collection.isLoading || !collection.data ? (
            <SkeletonTile full />
          ) : (
            <TopMoversSection movers={movers} isAuthenticated={isAuthenticated} />
          )}
        </View>

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
                <ArrowUpRight size={14} color={palette.ink.muted} />
              </Pressable>
            }
          />
          <HardwareStatusWidget />
        </View>

        <View>
          <SectionHeader eyebrow="Live catalog" title="Hot right now" />
          <HotRightNowRail />
        </View>

        <View>
          <SectionHeader eyebrow="Capture" title="Initiate forensic scan" />
          <InitiateScanButton />
          <PhoneCaptureCard />
        </View>

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
                <ArrowUpRight size={14} color={palette.ink.muted} />
              </Pressable>
            }
          />
          {collection.isLoading ? (
            <RecentRailSkeleton />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingRight: 4 }}
            >
              {recent.map((c) => (
                <RecentChip key={c.id} card={c} />
              ))}
            </ScrollView>
          )}
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
      <Text className="mt-1 text-3xl font-semibold tracking-tight text-ink">Command Center</Text>
    </View>
  );
}

function RecentChip({ card }: { card: CollectionCard }) {
  const tint = gradeColor(card.grade);
  return (
    <Pressable
      onPress={() => router.push(routes.scan(card.id))}
      className="w-44 rounded-2xl border border-line bg-bg-elevated p-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] uppercase tracking-[2px] text-ink-dim">
          {relativeTime(card.scannedAt)}
        </Text>
        <Text className="text-xs font-bold" style={{ color: tint }}>
          {card.grade.toFixed(1)}
        </Text>
      </View>
      <Text numberOfLines={1} className="mt-2 text-sm font-semibold text-ink">
        {card.title}
      </Text>
      <Text numberOfLines={1} className="mt-0.5 text-[11px] text-ink-muted">
        {card.set}
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
      <Text className="mt-1 text-sm font-bold text-ink">{value}</Text>
    </View>
  );
}

/**
 * Secondary capture path — grade a card with just the phone camera.
 * Mirrors the InitiateScanButton card shell, with a segmented mode toggle
 * (Studio = 4-shot, Quick = 2-shot) and a single hero CTA.
 */
function PhoneCaptureCard() {
  const [mode, setMode] = useState<"studio" | "quick">("studio");
  const isStudio = mode === "studio";

  return (
    <View className="mt-3 overflow-hidden rounded-2xl border border-line bg-bg-elevated">
      <View className="px-5 pt-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <Smartphone size={11} color={palette.ink.dim} />
            <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
              Phone Camera
            </Text>
          </View>
          <View className="flex-row items-center gap-1 rounded-full border border-line bg-bg p-0.5">
            <ModeSegment
              label="Studio"
              active={isStudio}
              tint={palette.accent.mint}
              onPress={() => setMode("studio")}
            />
            <ModeSegment
              label="Quick"
              active={!isStudio}
              tint={palette.accent.blue}
              onPress={() => setMode("quick")}
            />
          </View>
        </View>
        <Text className="mt-1 text-base font-medium text-ink">
          {isStudio ? "Guided 4-shot capture" : "Fast 2-shot triage"}
        </Text>
        <Text className="mt-0.5 text-xs text-ink-muted">
          {isStudio
            ? "Photometric tilt grades within ±0.5 of certified."
            : "Front + back snap, ±1.0 estimate in seconds."}
        </Text>
      </View>

      <View className="p-4 pt-3">
        <PrimaryButton
          label={isStudio ? "Open Studio Capture" : "Open Quick Capture"}
          icon={isStudio ? Camera : Zap}
          onPress={() => router.push(routes.scanPhone(mode))}
          variant={isStudio ? "mint" : "blue"}
          accessibilityLabel={`Start ${mode} phone capture`}
        />
      </View>
    </View>
  );
}

function ModeSegment({
  label,
  active,
  tint,
  onPress,
}: {
  label: string;
  active: boolean;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} mode`}
      className="rounded-full px-2.5 py-1"
      style={{ backgroundColor: active ? `${tint}22` : "transparent" }}
    >
      <Text
        className="text-[10px] font-semibold uppercase tracking-[2px]"
        style={{ color: active ? tint : palette.ink.dim }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Real-data Top Movers — composes `useTopMovers` (vault + market enrichment)
 * with the reusable `MoversCardRow` primitive. Renders auth/loading/error/
 * empty states inline so the section never collapses into a blank container.
 */
function TopMoversSection({
  movers,
  isAuthenticated,
}: {
  movers: ReturnType<typeof useTopMovers>;
  isAuthenticated: boolean;
}) {
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
        <MoversCardRow
          key={row.card.id}
          card={row.card}
          price={row.price}
          trend={row.trend}
          bordered={i > 0}
        />
      ))}
    </View>
  );
}
