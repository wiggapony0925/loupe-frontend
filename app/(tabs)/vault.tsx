import React, { useCallback, useMemo } from "react";
import { FlatList, RefreshControl, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { routes } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { Layers } from "lucide-react-native";
import { CardThumbnail } from "@/features/collection/CardThumbnail";
import { FilterBar } from "@/features/collection/FilterBar";
import { LiveGradesSection } from "@/features/collection/LiveGradesSection";
import { useFilteredCollection } from "@/features/collection/useFilteredCollection";
import { Skeleton } from "@/components/ui/Skeleton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { COPY } from "@/lib/copy";
import { compactUsd } from "@/lib/format";
import { queryKeys } from "@/hooks/api/queryKeys";
import { palette, useThemedPalette } from "@/theme/tokens";
import { Text } from "react-native";

export default function VaultScreen() {
  useThemedPalette();
  const router = useRouter();
  const qc = useQueryClient();
  const { cards, isLoading, isFetching } = useFilteredCollection();
  // Adaptive column count: phones get 2 columns, tablets/landscape get 3-4.
  // 180dp tile target keeps card art legible without going single-column on
  // narrow phones.
  const { width: screenWidth } = useWindowDimensions();
  const numColumns = Math.max(2, Math.min(4, Math.floor(screenWidth / 180)));

  const stats = useMemo(() => {
    const value = cards.reduce((s, c) => s + c.estimatedValueUsd, 0);
    const avgGrade = cards.length > 0 ? cards.reduce((s, c) => s + c.grade, 0) / cards.length : 0;
    return { value, avgGrade, count: cards.length };
  }, [cards]);

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.collection.all });
  }, [qc]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <FlatList
        data={isLoading ? [] : cards}
        keyExtractor={(c) => c.id}
        numColumns={numColumns}
        key={numColumns}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={onRefresh}
            tintColor={palette.accent.mint}
          />
        }
        ListHeaderComponent={
          <View className="gap-5 pb-4">
            <SectionHeader eyebrow="Collection" title="The Vault" />
            <LiveGradesSection />
            <View className="flex-row gap-2">
              <PillStat label="Holdings" value={stats.count.toString()} />
              <PillStat label="Value" value={compactUsd(stats.value)} />
              <PillStat
                label="Avg Grade"
                value={stats.avgGrade ? stats.avgGrade.toFixed(1) : "—"}
              />
            </View>
            <FilterBar />
          </View>
        }
        renderItem={({ item }) => <CardThumbnail card={item} />}
        ListEmptyComponent={
          isLoading ? (
            <View className="flex-row gap-3">
              {[0, 1].map((i) => (
                <View
                  key={i}
                  className="flex-1 overflow-hidden rounded-2xl border border-line bg-bg-elevated"
                >
                  <Skeleton width="100%" height={220} radius={0} />
                  <View className="gap-2 p-3">
                    <Skeleton width={80} height={10} />
                    <Skeleton width="80%" height={14} />
                    <Skeleton width="50%" height={10} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ paddingTop: 16 }}>
              <EmptyState
                title={COPY.vaultFiltersEmpty.title}
                message={COPY.vaultFiltersEmpty.message}
                icon={Layers}
                secondaryActionLabel="Scan a card"
                onSecondaryAction={() => router.push(routes.scanPhone())}
              />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function PillStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-xl border border-line bg-bg-elevated px-3 py-2.5">
      <Text className="text-[9px] uppercase tracking-[2px] text-ink-dim">{label}</Text>
      <Text className="mt-1 text-base font-semibold text-ink">{value}</Text>
    </View>
  );
}
