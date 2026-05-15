import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TrendingUp, Activity, Sparkles } from "lucide-react-native";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatTile } from "@/components/ui/StatTile";
import { GlassCard } from "@/components/ui/GlassCard";

/** Placeholder analytics surface — wired to real data in a follow-up sprint. */
export default function AnalyticsScreen() {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Performance
          </Text>
          <Text className="mt-1 text-3xl font-semibold text-ink">Analytics</Text>
        </View>

        <View className="gap-3">
          <View className="flex-row gap-3">
            <StatTile label="7d Scans" value="148" delta="+22%" icon={Activity} accent="blue" />
            <StatTile
              label="Gem Mint Rate"
              value="12.4%"
              delta="+1.1pp"
              icon={Sparkles}
              accent="mint"
            />
          </View>
          <StatTile
            label="Portfolio Δ"
            value="+$3,240"
            delta="vs last week"
            icon={TrendingUp}
            accent="mint"
          />
        </View>

        <View>
          <SectionHeader eyebrow="Trend" title="Grade distribution" />
          <GlassCard>
            <Text className="text-sm text-ink-muted">
              Live grade distribution chart will render here once the analytics service is wired up.
            </Text>
          </GlassCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
