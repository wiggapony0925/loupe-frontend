/**
 * LiveGradesSection — top-of-screen live data rail backed by
 * `GET /v1/me/grades`. Renders a compact list of the operator's most
 * recent graded scans with grader + grade pill + tap-through to the
 * card detail page. When unauthenticated, renders a sign-in CTA.
 *
 * Used by both the Vault and Analytics screens so the wiring lives in
 * one place.
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { routes } from "@/shared/routes";
import type { GradedCard } from "@/infrastructure/http";
import { useMyGrades } from "@/application/queries/useMyGrades";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { QueryState } from "@/presentation/components/QueryState";
import { Skeleton } from "@/presentation/components/Skeleton";
import { CardImage } from "@/presentation/components/CardImage";
import { compactUsd } from "@/shared/format";
import { gradeColor, palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

interface LiveGradesSectionProps {
  title?: string;
  eyebrow?: string;
  limit?: number;
}

export function LiveGradesSection({
  title = "Your graded scans",
  eyebrow = "Live · /me/grades",
  limit = 5,
}: LiveGradesSectionProps) {
  const { isAuthenticated } = useAuth();
  const q = useMyGrades<GradedCard[]>();

  if (!isAuthenticated) {
    return (
      <View>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          {eyebrow}
        </Text>
        <Text className="mt-1 text-xl font-semibold tracking-tight text-ink">
          {title}
        </Text>
        <View className="mt-2 items-center rounded-2xl border border-line bg-bg-elevated px-4 py-6">
          <Text className="text-sm font-semibold text-ink">
            Sign in to sync your vault
          </Text>
          <Text className="mt-1 text-center text-[11px] text-ink-muted">
            Your scans, grades and price history live in your Loupe account.
          </Text>
        </View>
      </View>
    );
  }

  const grades = (q.data ?? []).slice(0, limit);
  const isEmpty = !q.isLoading && !q.isError && grades.length === 0;

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            {eyebrow}
          </Text>
          <Text className="mt-1 text-xl font-semibold tracking-tight text-ink">
            {title}
          </Text>
        </View>
        {q.data ? (
          <Text className="text-[10px] text-ink-dim">
            {q.data.length} total
          </Text>
        ) : null}
      </View>
      <View className="mt-3">
        <QueryState
          isLoading={q.isLoading}
          isError={q.isError}
          isEmpty={isEmpty}
          loadingFallback={
            <View style={{ gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} width="100%" height={56} radius={12} />
              ))}
            </View>
          }
          emptyTitle="Your vault is empty"
          emptyMessage="Scan a card to start building your collection."
          errorMessage="Couldn't load your grades"
          onRetry={() => void q.refetch()}
        >
          <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
            {grades.map((g, i) => (
              <GradeRow key={g.id} grade={g} bordered={i > 0} />
            ))}
          </View>
        </QueryState>
      </View>
    </View>
  );
}

function GradeRow({ grade, bordered }: { grade: GradedCard; bordered: boolean }) {
  const p = useThemedPalette();
  // Backend serializes Decimal as string; coerce defensively.
  const rawGrade = (grade as unknown as { grade: number | string | null }).grade;
  const numericGrade = typeof rawGrade === "number" ? rawGrade : Number(rawGrade);
  const gradeValue = Number.isFinite(numericGrade) ? numericGrade : 0;
  const color = gradeColor(gradeValue);
  // Backend uses `house`; legacy TS type uses `grader`.
  const anyGrade = grade as unknown as {
    house?: string;
    grader?: string;
  };
  const houseLabel = (anyGrade.house ?? anyGrade.grader ?? "").toString();

  const rawValue = (grade as unknown as { estimated_value_usd: string | number | null })
    .estimated_value_usd;
  const numericValue = rawValue === null || rawValue === undefined ? null : Number(rawValue);
  const valueText =
    numericValue !== null && Number.isFinite(numericValue) ? compactUsd(numericValue) : null;

  const subtitle = [
    houseLabel ? houseLabel.toUpperCase() : null,
    grade.card_set_name,
    grade.card_number ? `#${grade.card_number}` : null,
    grade.card_year,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={() => router.push(routes.card(grade.card_id))}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className={`flex-row items-center gap-3 px-4 py-3 ${bordered ? "border-t border-line/60" : ""}`}
    >
      <View
        className="overflow-hidden rounded-lg"
        style={{ width: 44, height: 60, backgroundColor: palette.bg.sunken }}
      >
        <CardImage
          uri={grade.card_image_url ?? undefined}
          width={44}
          height={60}
          rounded={8}
          priority="low"
          recyclingKey={grade.card_id}
          alt={grade.card_name ?? "Graded card"}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} className="text-sm font-semibold text-ink">
          {grade.card_name ?? "Unknown card"}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 text-[11px] text-ink-muted">
          {subtitle || "—"}
        </Text>
        {grade.card_tcg ? (
          <View className="mt-1 flex-row items-center gap-1.5">
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: withAlpha(p.accent.mint, 0.14),
              }}
            >
              <Text
                style={{
                  color: p.accent.mint,
                  fontSize: 9,
                  fontWeight: "800",
                  letterSpacing: 0.8,
                }}
              >
                {grade.card_tcg.toUpperCase()}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            backgroundColor: withAlpha(color, 0.16),
            borderWidth: 1,
            borderColor: withAlpha(color, 0.5),
            minWidth: 40,
            alignItems: "center",
          }}
        >
          <Text style={{ color, fontSize: 13, fontWeight: "800" }}>
            {gradeValue.toFixed(gradeValue % 1 === 0 ? 0 : 1)}
          </Text>
        </View>
        {valueText ? (
          <Text className="text-[12px] font-semibold text-ink">{valueText}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
