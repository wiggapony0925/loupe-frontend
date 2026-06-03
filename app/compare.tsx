/**
 * Side-by-side comparison of two Forensic Reports.
 *
 * Route: /compare?a=card_001&b=card_002
 *
 * Pulls each report through the existing `fetchReport` query (cached by id)
 * and renders a parallel column layout: thumbnail, grade, sub-scores,
 * deltas. Designed to help collectors decide which copy to keep / sell.
 */
import React from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react-native";
import { fetchReport } from "@/infrastructure/repositories/forensicRepository";
import { queryKeys } from "@/application/queries/queryKeys";
import { gradeColor, useThemedPalette } from "@/presentation/theme/tokens";
import { compactUsd } from "@/shared/format";
import { SkeletonComparePage } from "@/presentation/components/Skeletons";
import type { ForensicReport, ForensicScore } from "@/domain";

export default function CompareScreen() {
  const p = useThemedPalette();
  const { a, b } = useLocalSearchParams<{ a?: string; b?: string }>();
  const ra = useQuery({ queryKey: queryKeys.reports.item(a ?? ""), queryFn: () => fetchReport(a!), enabled: !!a });
  const rb = useQuery({ queryKey: queryKeys.reports.item(b ?? ""), queryFn: () => fetchReport(b!), enabled: !!b });

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
        >
          <ChevronLeft size={18} color={p.ink.default} />
        </Pressable>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Compare grades
        </Text>
        <View className="w-9" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}>
        {ra.isError || rb.isError ? (
          <View className="rounded-2xl border border-line bg-bg-elevated p-5">
            <Text className="text-base font-semibold text-ink">Couldn't load report</Text>
            <Text className="mt-1 text-[12px] text-ink-muted">
              One or both reports failed to fetch. Pull to retry from the previous screen.
            </Text>
            <Pressable
              onPress={() => {
                ra.refetch();
                rb.refetch();
              }}
              hitSlop={8}
              className="mt-3 self-start rounded-full border border-line px-3 py-1.5"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-[12px] font-semibold text-ink">Retry</Text>
            </Pressable>
          </View>
        ) : ra.isLoading || rb.isLoading ? (
          <SkeletonComparePage />
        ) : !ra.data || !rb.data ? (
          <View className="rounded-2xl border border-line bg-bg-elevated p-5">
            <Text className="text-base font-semibold text-ink">
              Report unavailable
            </Text>
            <Text className="mt-1 text-[12px] text-ink-muted">
              One or both reports returned no data. They may have been deleted
              or not yet generated.
            </Text>
          </View>
        ) : (
          <>
            <View className="flex-row gap-3">
              <ReportColumn report={ra.data} />
              <ReportColumn report={rb.data} />
            </View>
            <DeltaRow left={ra.data.score} right={rb.data.score} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReportColumn({ report }: { report: ForensicReport }) {
  const tint = gradeColor(report.score.grade);
  return (
    <View className="flex-1 gap-3 rounded-2xl border border-line bg-bg-elevated p-3">
      <Image
        source={{ uri: report.frontCaptureUri }}
        style={{ width: "100%", aspectRatio: 2.5 / 3.5, borderRadius: 12 }}
        resizeMode="cover"
      />
      <View>
        <Text numberOfLines={2} className="text-sm font-semibold text-ink">
          {report.card.title}
        </Text>
        <Text className="mt-0.5 text-[11px] text-ink-muted">{report.card.set}</Text>
      </View>
      <View className="flex-row items-baseline gap-2">
        <Text className="text-3xl font-semibold" style={{ color: tint }}>
          {report.score.grade.toFixed(1)}
        </Text>
        <Text className="text-xs text-ink-dim">{compactUsd(report.card.estimatedValueUsd)}</Text>
      </View>
      <View className="gap-1">
        <ScoreRow label="Surface" value={report.score.surface} />
        <ScoreRow label="Edges" value={report.score.edges} />
        <ScoreRow label="Corners" value={report.score.corners} />
        <ScoreRow label="Centering" value={report.score.centering} />
      </View>
    </View>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-[11px] text-ink-dim">{label}</Text>
      <Text className="text-[11px] font-semibold text-ink">{value}</Text>
    </View>
  );
}

function DeltaRow({ left, right }: { left: ForensicScore; right: ForensicScore }) {
  const p = useThemedPalette();
  const rows: { label: string; key: keyof ForensicScore }[] = [
    { label: "Composite", key: "composite" },
    { label: "Surface", key: "surface" },
    { label: "Edges", key: "edges" },
    { label: "Corners", key: "corners" },
    { label: "Centering", key: "centering" },
  ];
  return (
    <View className="rounded-2xl border border-line bg-bg-elevated p-4">
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        Δ Right vs Left
      </Text>
      <View className="mt-3 gap-2">
        {rows.map(({ label, key }) => {
          const delta = right[key] - left[key];
          const tint =
            delta === 0 ? p.ink.muted : delta > 0 ? p.accent.mint : p.accent.rose;
          return (
            <View key={key} className="flex-row items-center justify-between">
              <Text className="text-sm text-ink">{label}</Text>
              <Text className="text-sm font-semibold" style={{ color: tint }}>
                {delta > 0 ? "+" : ""}
                {delta.toFixed(key === "composite" ? 0 : 0)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
