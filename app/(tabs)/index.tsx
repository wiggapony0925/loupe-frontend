import React, { useCallback } from "react";
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
  type LucideIcon,
} from "lucide-react-native";
import { fetchCollection, fetchCollectionSummary } from "@/api/forensicApi";
import { HardwareStatusWidget, InitiateScanButton, useScannerConnection } from "@/features/scanner";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LiveSyncChip } from "@/components/ui/LiveSyncChip";
import { LoupeMark } from "@/components/brand/LoupeMark";
import { compactUsd, greeting, relativeTime } from "@/lib/format";
import { gradeColor, palette } from "@/theme/tokens";
import type { CollectionCard } from "@/types/domain";

export default function CommandCenterScreen() {
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

        <HardwareStatusWidget />

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
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
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
 * Two presets: Studio (4-shot, near-scanner accuracy) and Quick (2-shot triage).
 */
function PhoneCaptureCard() {
  return (
    <View className="mt-3 overflow-hidden rounded-2xl border border-line bg-bg-elevated">
      <View className="flex-row items-center gap-2 px-5 pt-4">
        <Smartphone size={14} color={palette.ink.muted} />
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          No scanner? Use your phone
        </Text>
      </View>
      <Text className="px-5 pt-1 text-sm text-ink-muted">
        Guided capture flow grades within ±0.5 of certified.
      </Text>
      <View className="flex-row gap-2 p-4 pt-3">
        <PhoneModeChip
          icon={Camera}
          label="Studio"
          subtitle="4 shots · best accuracy"
          tint={palette.accent.mint}
          onPress={() => router.push("/scan/phone?mode=studio")}
        />
        <PhoneModeChip
          icon={Zap}
          label="Quick"
          subtitle="2 shots · fast triage"
          tint={palette.accent.blue}
          onPress={() => router.push("/scan/phone?mode=quick")}
        />
      </View>
    </View>
  );
}

function PhoneModeChip({
  icon: Icon,
  label,
  subtitle,
  tint,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  subtitle: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-xl border border-line bg-bg p-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={`${label} phone capture`}
    >
      <View className="flex-row items-center gap-2">
        <View
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: `${tint}22` }}
        >
          <Icon size={14} color={tint} />
        </View>
        <Text className="text-sm font-semibold text-ink">{label}</Text>
      </View>
      <Text className="mt-1.5 text-[11px] text-ink-dim">{subtitle}</Text>
    </Pressable>
  );
}
