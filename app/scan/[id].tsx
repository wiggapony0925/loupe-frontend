/**
 * Scan detail — `/scan/[id]`
 *
 * The id is a `graded_card_id` (the scan flow's terminal WebSocket frame
 * hands it back when grading finishes). We fetch the persisted grade via
 * `GET /v1/grades/{id}` and render a forensic report from REAL data:
 * the headline grade, the four-axis subgrade breakdown / radar, and a
 * cross-house estimate. Nothing is fabricated — rows without stored
 * subgrades (manually entered holdings, third-party slabs) gracefully
 * fall back to the headline grade + value.
 */
import React, { useMemo } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Pencil, TrendingUp } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { ForensicScore } from "@/domain";
import { routes } from "@/shared/routes";
import { useGradedCard } from "@/application/queries/collection/useGradedCard";
import {
  HouseEquivalence,
  ScoreBreakdown,
  SubgradeRadar,
} from "@/presentation/features/report";
import { ErrorState } from "@/presentation/components/ErrorState";
import { SkeletonCardDetailPage } from "@/presentation/components/Skeletons";
import { useMoney } from "@/presentation/components/Price";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** Pull a 0..10 axis score out of the loosely-typed subgrades blob.
 *  The grading pipeline writes flat numbers (`{ centering: 8.5 }`); we
 *  also tolerate the richer `{ score }` object shape defensively. */
function axisScore(
  subgrades: Record<string, unknown> | null,
  key: string,
): number | null {
  if (!subgrades) return null;
  const v = subgrades[key];
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && typeof (v as { score?: unknown }).score === "number") {
    return (v as { score: number }).score;
  }
  return null;
}

/** Adapt the persisted grade (1..10) + subgrades (0..10) into the
 *  `ForensicScore` (0..1000 axes) the report components consume. Returns
 *  null when no per-axis data exists so the caller can hide the breakdown. */
function toForensicScore(
  grade: number,
  subgrades: Record<string, unknown> | null,
): ForensicScore | null {
  const centering = axisScore(subgrades, "centering");
  const corners = axisScore(subgrades, "corners");
  const edges = axisScore(subgrades, "edges");
  const surface = axisScore(subgrades, "surface");
  if (centering == null && corners == null && edges == null && surface == null) {
    return null;
  }
  const to1000 = (n: number | null) => Math.round((n ?? 0) * 100);
  return {
    surface: to1000(surface),
    edges: to1000(edges),
    corners: to1000(corners),
    centering: to1000(centering),
    composite: Math.round(grade * 100),
    grade,
  };
}


export default function ScanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useThemedPalette();
  const { format: money } = useMoney();
  const { data, isLoading, isError, refetch } = useGradedCard(id);

  const grade = data ? Number(data.grade) : 0;
  const score = useMemo(
    () => (data ? toForensicScore(grade, data.subgrades) : null),
    [data, grade],
  );

  const value = React.useMemo(() => {
    const n = data?.estimated_value_usd != null ? Number(data.estimated_value_usd) : null;
    return n != null && Number.isFinite(n) ? money(n, { compact: false }) : null;
  }, [data?.estimated_value_usd, money]);
  const meta = [data?.card_set_name, data?.card_year ? String(data.card_year) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
        >
          <ChevronLeft size={18} color={p.ink.default} />
        </Pressable>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Scan report
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 64 }}>
          <SkeletonCardDetailPage />
        </ScrollView>
      ) : isError || !data ? (
        <View className="flex-1 px-5 pt-12">
          <ErrorState
            title="Couldn't load this report"
            message="We couldn't reach the grade for this scan. Check your connection and try again."
            onRetry={() => refetch()}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 96, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero — capture + headline grade. */}
          <View className="flex-row gap-4">
            <View
              className="overflow-hidden rounded-2xl border border-line bg-bg-elevated"
              style={{ width: 116, height: 162 }}
            >
              {data.card_image_url ? (
                <Image
                  source={{ uri: data.card_image_url }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : null}
            </View>
            <View className="flex-1 justify-between py-1">
              <View>
                <Text numberOfLines={2} className="text-[18px] font-bold leading-6 text-ink">
                  {data.card_name ?? "Graded card"}
                </Text>
                {meta ? (
                  <Text className="mt-1 text-[12px] text-ink-muted">{meta}</Text>
                ) : null}
              </View>

              <View className="flex-row items-center gap-2">
                <View
                  className="rounded-xl px-3 py-2"
                  style={{
                    backgroundColor: withAlpha(p.accent.mint, 0.12),
                    borderWidth: 1,
                    borderColor: withAlpha(p.accent.mint, 0.35),
                  }}
                >
                  <Text className="text-[9px] uppercase tracking-[2px] text-ink-dim">
                    {data.house}
                  </Text>
                  <Text
                    className="text-[22px] font-bold"
                    style={{ color: p.accent.mint }}
                  >
                    {grade.toFixed(1)}
                  </Text>
                </View>
                {value ? (
                  <View className="rounded-xl border border-line bg-bg-elevated px-3 py-2">
                    <Text className="text-[9px] uppercase tracking-[2px] text-ink-dim">
                      Est. value
                    </Text>
                    <Text className="text-[15px] font-semibold text-ink">{value}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Forensic breakdown — only when per-axis subgrades exist. */}
          {score ? (
            <>
              <ScoreBreakdown score={score} />
              <View className="items-center rounded-2xl border border-line bg-bg-elevated py-4">
                <Text className="mb-2 text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                  Subgrade radar
                </Text>
                <SubgradeRadar score={score} />
              </View>
              <HouseEquivalence score={score} />
            </>
          ) : (
            <View className="rounded-2xl border border-line bg-bg-elevated p-4">
              <Text className="text-[13px] leading-5 text-ink-muted">
                This holding has a headline grade but no per-axis forensic
                breakdown. Re-scan the card with the Loupe pipeline to generate
                a full surface / edges / corners / centering report.
              </Text>
            </View>
          )}

          {data.notes ? (
            <View className="rounded-2xl border border-line bg-bg-elevated p-4">
              <Text className="mb-1 text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                Notes
              </Text>
              <Text className="text-[13px] leading-5 text-ink">{data.notes}</Text>
            </View>
          ) : null}

          {/* Actions. */}
          <View className="mt-1 gap-2">
            <Pressable
              onPress={() => router.push(routes.card(data.card_id))}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                height: 52,
                borderRadius: 16,
                backgroundColor: p.accent.mint,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <TrendingUp size={18} color={p.bg.base} />
              <Text style={{ color: p.bg.base, fontSize: 15, fontWeight: "800" }}>
                View market
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(routes.gradeEdit(data.id))}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                height: 48,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: p.line.default,
                backgroundColor: p.bg.elevated,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Pencil size={16} color={p.ink.default} />
              <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "700" }}>
                Edit holding
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
