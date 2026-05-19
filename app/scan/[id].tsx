/**
 * Scan detail — `/scan/[id]`
 *
 * The forensic-report aesthetic from this screen has been merged into
 * the unified `/card/[id]` market screen. This stub keeps the route
 * alive (so existing in-app links don't 404) and renders the page
 * skeleton with a "coming soon" caption while the next pass wires
 * scan-specific forensic widgets back in on top of the new layout.
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SkeletonCardDetailPage } from "@/presentation/components/Skeletons";
import { palette } from "@/presentation/theme/tokens";

export default function ScanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

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
          Scan
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 64, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-[11px] text-ink-muted">
          Scan result preview — coming soon
          {id ? `  ·  ${id}` : ""}
        </Text>
        <SkeletonCardDetailPage />
      </ScrollView>
    </SafeAreaView>
  );
}
