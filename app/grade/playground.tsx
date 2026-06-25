/**
 * `/grade/playground` — Loupe Grade playground (native).
 *
 * The mobile counterpart to the web `/grade` "Loupe Playground". Reuses the
 * SAME pure-TS rubric engine via `@loupe/grade` (vendored), so the estimate
 * matches the web exactly. v1 is manual: tap the four sub-grade scales and we
 * blend them like a real grader, with a path into the camera "Studio" capture
 * for a photo-measured read.
 */
import React, { useMemo, useState } from "react";
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Camera, ChevronLeft, Crosshair, RotateCcw } from "lucide-react-native";
import { loupeGrade, type SubGrades } from "@loupe/grade";
import { routes } from "@/shared/routes";
import {
  DEFAULT_SUBS,
  useGradePlaygroundStore,
} from "@/application/stores/gradePlaygroundStore";
import { gradeColor, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const SUB_META: { key: keyof SubGrades; label: string; hint: string }[] = [
  { key: "centering", label: "Centering", hint: "How even the print borders are" },
  { key: "corners", label: "Corners", hint: "Sharpness — no whitening or soft tips" },
  { key: "edges", label: "Edges", hint: "Clean, no nicks or chipping" },
  { key: "surface", label: "Surface", hint: "No scratches, print lines, or dents" },
];

export default function GradePlaygroundScreen() {
  const p = useThemedPalette();
  // Lifted into a store so the camera "measure centering" screen can write the
  // measured value back without route-param gymnastics.
  const subs = useGradePlaygroundStore((s) => s.subs);
  const setSub = useGradePlaygroundStore((s) => s.setSub);
  const reset = useGradePlaygroundStore((s) => s.reset);
  const result = useMemo(() => loupeGrade(subs), [subs]);
  const tint = gradeColor(result.estimate);
  const dirty =
    subs.centering !== DEFAULT_SUBS.centering ||
    subs.corners !== DEFAULT_SUBS.corners ||
    subs.edges !== DEFAULT_SUBS.edges ||
    subs.surface !== DEFAULT_SUBS.surface;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: p.bg.base }}>
      {/* Header */}
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
          Loupe Playground
        </Text>
        {dirty ? (
          <Pressable
            onPress={() => reset()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Reset sub-grades"
            className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
          >
            <RotateCcw size={15} color={p.ink.muted} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 64, gap: 22 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text className="text-[28px] font-bold tracking-tight text-ink">
            Estimate the grade
          </Text>
          <Text className="mt-1 text-[13px] leading-5 text-ink-muted">
            Score the four things graders look at. We blend them the way PSA
            does — weighted to centering and corners, and capped so one weak
            area can&apos;t hide behind strong ones.
          </Text>
        </View>

        {/* Result card */}
        <View
          style={{
            borderRadius: 20,
            padding: 20,
            backgroundColor: withAlpha(tint, 0.1),
            borderWidth: 1,
            borderColor: withAlpha(tint, 0.3),
            alignItems: "center",
            gap: 6,
          }}
        >
          <Text style={{ color: p.ink.dim, fontSize: 11, fontWeight: "800", letterSpacing: 2 }}>
            LOUPE ESTIMATE
          </Text>
          <Text style={{ color: tint, fontSize: 56, fontWeight: "900", letterSpacing: -2, lineHeight: 62 }}>
            {result.estimate.toFixed(1)}
          </Text>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: withAlpha(tint, 0.16),
            }}
          >
            <Text style={{ color: tint, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 }}>
              {result.band}
            </Text>
          </View>
          <Text style={{ color: p.ink.muted, fontSize: 13, textAlign: "center", marginTop: 4, lineHeight: 18 }}>
            {result.verdict}
          </Text>
        </View>

        {/* Sub-grade scales */}
        <View style={{ gap: 18 }}>
          {SUB_META.map(({ key, label, hint }) => (
            <SubGradeScale
              key={key}
              label={label}
              hint={hint}
              value={subs[key]}
              palette={p}
              onChange={(v) => setSub(key, v)}
            />
          ))}
        </View>

        {/* Measure centering from a photo — taps the print border, runs the
            shared measureCentering(), and writes the result back here. */}
        <Pressable
          onPress={() => router.push(routes.gradeMeasure())}
          accessibilityRole="button"
          accessibilityLabel="Measure centering from a photo"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: p.accent.mint,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Crosshair size={18} color="#06140d" />
          <Text style={{ color: "#06140d", fontWeight: "800", fontSize: 14 }}>
            Measure centering from a photo
          </Text>
        </Pressable>

        {/* Secondary: the full photometric Studio capture (server grade). */}
        <Pressable
          onPress={() => router.push(routes.scanPhone("studio"))}
          accessibilityRole="button"
          accessibilityLabel="Open the Studio photometric capture"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: withAlpha(p.accent.mint, 0.4),
            backgroundColor: withAlpha(p.accent.mint, 0.1),
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Camera size={18} color={p.accent.mint} />
          <Text style={{ color: p.accent.mint, fontWeight: "800", fontSize: 14 }}>
            Full Studio capture (all four sub-grades)
          </Text>
        </Pressable>

        <Text style={{ color: p.ink.dim, fontSize: 11, lineHeight: 16, textAlign: "center" }}>
          A pre-screen estimate, not an official grade — every number here is
          explainable, no black box.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * A 1–10 sub-grade control: tap (or drag) anywhere on the track to set the
 * value. Pure JS — no native slider dependency, so it ships over the air.
 */
function SubGradeScale({
  label,
  hint,
  value,
  palette,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  palette: ReturnType<typeof useThemedPalette>;
  onChange: (v: number) => void;
}) {
  const p = palette;
  const [width, setWidth] = useState(0);
  const tint = gradeColor(value);

  const setFromX = (x: number) => {
    if (width <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / width));
    const next = Math.max(1, Math.min(10, Math.round(ratio * 9) + 1));
    if (next !== value) onChange(next);
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.ink.default, fontSize: 15, fontWeight: "700" }}>{label}</Text>
          <Text style={{ color: p.ink.dim, fontSize: 11, marginTop: 1 }}>{hint}</Text>
        </View>
        <Text style={{ color: tint, fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
          {value}
        </Text>
      </View>

      {/* Tappable / draggable track of 10 segments. */}
      <Pressable
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onPress={(e: GestureResponderEvent) => setFromX(e.nativeEvent.locationX)}
        onResponderMove={(e: GestureResponderEvent) => setFromX(e.nativeEvent.locationX)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        accessibilityRole="adjustable"
        accessibilityLabel={`${label}: ${value} out of 10`}
        accessibilityValue={{ min: 1, max: 10, now: value }}
        style={{ flexDirection: "row", gap: 4, height: 30, alignItems: "center" }}
      >
        {Array.from({ length: 10 }).map((_, i) => {
          const on = i < value;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: on ? 14 : 8,
                borderRadius: 4,
                backgroundColor: on ? tint : withAlpha(p.ink.dim, 0.18),
              }}
            />
          );
        })}
      </Pressable>
    </View>
  );
}
