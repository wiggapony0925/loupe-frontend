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
import { routes } from "@/lib/routes";
import type { GradedCard } from "@/api/types";
import { useMyGrades } from "@/hooks/api/useMyGrades";
import { useAuth } from "@/providers/AuthProvider";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { gradeColor, useThemedPalette, withAlpha } from "@/theme/tokens";

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
  const raw = (grade as unknown as { grade: number | string | null }).grade;
  const numeric = typeof raw === "number" ? raw : Number(raw);
  const gradeValue = Number.isFinite(numeric) ? numeric : 0;
  const color = gradeColor(gradeValue);
  // Backend uses `house` and `graded_at`; legacy TS type uses `grader` and `scanned_at`.
  const anyGrade = grade as unknown as {
    house?: string;
    grader?: string;
    graded_at?: string;
    scanned_at?: string;
    cert_number?: string | null;
  };
  const houseLabel = (anyGrade.house ?? anyGrade.grader ?? "").toString();
  const when = anyGrade.graded_at ?? anyGrade.scanned_at ?? null;
  return (
    <Pressable
      onPress={() => router.push(routes.card(grade.card_id))}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className={`flex-row items-center gap-3 px-4 py-3 ${bordered ? "border-t border-line/60" : ""}`}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(color, 0.16),
          borderWidth: 1,
          borderColor: withAlpha(color, 0.5),
        }}
      >
        <Text style={{ color, fontSize: 16, fontWeight: "800" }}>
          {gradeValue.toFixed(gradeValue % 1 === 0 ? 0 : 1)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} className="text-sm font-semibold text-ink">
          {grade.card_id}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 text-[11px] text-ink-muted">
          {houseLabel.toUpperCase()}
          {anyGrade.cert_number ? ` · #${anyGrade.cert_number}` : ""}
          {when ? ` · ${new Date(when).toLocaleDateString()}` : ""}
        </Text>
      </View>
      <Text
        style={{
          color: p.ink.dim,
          fontSize: 10,
          fontWeight: "800",
          letterSpacing: 0.8,
        }}
      >
        DETAIL →
      </Text>
    </Pressable>
  );
}
