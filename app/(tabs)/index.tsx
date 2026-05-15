import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ArrowUpRight,
  Camera,
  DollarSign,
  Database,
  Settings2,
  Smartphone,
  Target,
  Zap,
} from "lucide-react-native";
import { fetchCollection, fetchCollectionSummary } from "@/api/forensicApi";
import { HardwareStatusWidget, InitiateScanButton, useScannerConnection } from "@/features/scanner";
import { PortfolioChart } from "@/features/analytics";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LiveSyncChip } from "@/components/ui/LiveSyncChip";
import { LoupeMark } from "@/components/brand/LoupeMark";
import { compactUsd, greeting, relativeTime } from "@/lib/format";
import { gradeColor, palette, useThemedPalette } from "@/theme/tokens";
import type { CollectionCard } from "@/types/domain";

export default function CommandCenterScreen() {
  useThemedPalette();
  const qc = useQueryClient();
  const summary = useQuery({ queryKey: ["collection-summary"], queryFn: fetchCollectionSummary });
  const collection = useQuery({ queryKey: ["collection"], queryFn: fetchCollection });
  const hardware = useScannerConnection();

  const refreshing = summary.isFetching || collection.isFetching || hardware.isFetching;

  const onRefresh = useCallback(() => {
    qc.invalidateQueries();
  }, [qc]);

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
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.accent.mint}
          />
        }
      >
        <Header
          online={hardware.data?.transport !== "offline"}
          lastSyncIso={
            hardware.dataUpdatedAt ? new Date(hardware.dataUpdatedAt).toISOString() : undefined
          }
        />

        <PortfolioChart fallbackTotal={summary.data?.totalValueUsd ?? 0} />

        <View>
          <SectionHeader eyebrow="Vault" title="Today's metrics" />
          <View className="flex-row gap-3">
            {summary.isLoading || !summary.data ? (
              <>
                <SkeletonTile />
                <SkeletonTile />
              </>
            ) : (
              <>
                <StatTile
                  label="Collection Value"
                  value={compactUsd(summary.data.totalValueUsd)}
                  delta={`${summary.data.cardCount} graded assets`}
                  icon={DollarSign}
                  accent="mint"
                />
                <StatTile
                  label="Grade Accuracy"
                  value={`${(summary.data.avgAccuracy * 100).toFixed(1)}%`}
                  delta="vs PSA reference"
                  icon={Target}
                  accent="blue"
                />
              </>
            )}
          </View>
          <View className="mt-3">
            {hardware.isLoading || !hardware.data ? (
              <SkeletonTile full />
            ) : (
              <StatTile
                label="Scans Remaining"
                value={hardware.data.scansRemaining.toLocaleString()}
                delta={`Sensor ${hardware.data.temperatureC.toFixed(1)}°C · nominal`}
                icon={Database}
                accent="amber"
              />
            )}
          </View>
        </View>

        <View>
          <SectionHeader eyebrow="Device" title="Scanner connection" />
          <HardwareStatusWidget />
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
                onPress={() => router.push("/vault")}
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

function Header({ online, lastSyncIso }: { online: boolean; lastSyncIso?: string }) {
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <LoupeMark size={26} />
          <Text className="text-base font-semibold tracking-tight text-ink">Loupe</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <LiveSyncChip online={online} lastSyncIso={lastSyncIso} />
          <Pressable
            onPress={() => router.push("/settings")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Settings2 size={16} color={palette.ink.muted} />
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
      onPress={() => router.push(`/scan/${card.id}`)}
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
          onPress={() => router.push(`/scan/phone?mode=${mode}`)}
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
