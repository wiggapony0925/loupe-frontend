import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, FileDown, GitCompareArrows } from "lucide-react-native";
import { fetchCollection, fetchReport } from "@/api/forensicApi";
import {
  CaptureSourceBadge,
  ForensicReportHeader,
  HeatmapOverlay,
  PriceHistoryChart,
  ScoreBreakdown,
  SplitCaptureView,
  exportReportPdf,
} from "@/features/report";
import { Skeleton } from "@/components/ui/Skeleton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { palette } from "@/theme/tokens";

export default function ScanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: report, isLoading } = useQuery({
    queryKey: ["report", id],
    queryFn: () => fetchReport(id!),
    enabled: !!id,
  });
  const collection = useQuery({ queryKey: ["collection"], queryFn: fetchCollection });
  const [exporting, setExporting] = useState(false);

  const onExport = async () => {
    if (!report || exporting) return;
    setExporting(true);
    try {
      await exportReportPdf(report);
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setExporting(false);
    }
  };

  const onCompare = () => {
    if (!report || !collection.data) return;
    const others = collection.data.filter((c) => c.id !== report.card.id);
    if (others.length === 0) {
      Alert.alert("Nothing to compare", "Grade another card first.");
      return;
    }
    // Pick the most-recent other card as the comparison target. A future
    // pass can present a picker.
    const target = others[0]!;
    router.push(`/compare?a=${report.card.id}&b=${target.id}`);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
        >
          <ChevronLeft size={18} color={palette.ink.default} />
        </Pressable>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Forensic Report
        </Text>
        <View className="flex-row gap-1.5">
          <Pressable
            onPress={onCompare}
            hitSlop={10}
            accessibilityLabel="Compare grades"
            className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
          >
            <GitCompareArrows size={16} color={palette.ink.default} />
          </Pressable>
          <Pressable
            onPress={onExport}
            hitSlop={10}
            accessibilityLabel="Export PDF"
            disabled={exporting}
            style={{ opacity: exporting ? 0.5 : 1 }}
            className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
          >
            <FileDown size={16} color={palette.ink.default} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading || !report ? (
          <ReportSkeleton />
        ) : (
          <>
            <ForensicReportHeader report={report} />
            <CaptureSourceBadge source={report.source} />

            <View>
              <SectionHeader
                eyebrow="Capture"
                title="Front / Back"
                trailing={<Badge label="AI Verified" tone="mint" />}
              />
              <SplitCaptureView
                frontUri={report.frontCaptureUri}
                backUri={report.backCaptureUri}
                renderOverlay={() => <HeatmapOverlay dings={report.dings} />}
              />
            </View>

            <View>
              <SectionHeader eyebrow="Heatmap Legend" title="DINGS" />
              <View className="flex-row flex-wrap gap-2">
                <Legend label="Surface" color={palette.accent.amber} />
                <Legend label="Edges" color={palette.accent.blue} />
                <Legend label="Corners" color={palette.accent.rose} />
                <Legend label="Centering" color={palette.accent.mint} />
              </View>
            </View>

            <ScoreBreakdown score={report.score} />

            {report.priceHistory && report.priceHistory.length > 1 ? (
              <View>
                <SectionHeader eyebrow="Market" title="Price history" />
                <PriceHistoryChart points={report.priceHistory} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Legend({ label, color }: { label: string; color: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-full border border-line bg-bg-elevated px-3 py-1.5">
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text className="text-xs text-ink-muted">{label}</Text>
    </View>
  );
}

function ReportSkeleton() {
  return (
    <View className="gap-5">
      <Skeleton width={120} height={18} radius={4} />
      <Skeleton width="80%" height={28} />
      <View className="flex-row gap-3">
        <Skeleton width="48%" height={260} radius={16} />
        <Skeleton width="48%" height={260} radius={16} />
      </View>
      <Skeleton width="100%" height={220} radius={16} />
    </View>
  );
}
