/**
 * /grade/[id] — edit an existing holding.
 *
 * Loads the grade from `/v1/me/grades` (the same cache the Vault list
 * uses), pre-fills the form, and PATCHes on submit.
 */
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useMyGrades } from "@/application/queries/useMyGrades";
import { GradeForm } from "@/presentation/features/grade/GradeForm";
import type { GradedCard } from "@/infrastructure/http";
import { palette } from "@/presentation/theme/tokens";

export default function EditGradeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useMyGrades<GradedCard[]>();
  const row = (q.data ?? []).find((g) => g.id === id);

  if (q.isLoading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={palette.accent.mint} />
      </SafeAreaView>
    );
  }

  if (!row) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 items-center justify-center bg-bg">
        <View style={{ padding: 24, alignItems: "center", gap: 8 }}>
          <Text className="text-base font-semibold text-ink">Holding not found</Text>
          <Text className="text-center text-[12px] text-ink-muted">
            It may have been deleted. Pull-to-refresh the vault.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <GradeForm
        mode="edit"
        gradeId={row.id}
        card={{
          cardId: row.card_id,
          name: row.card_name,
          imageUrl: row.card_image_url,
          setName: row.card_set_name,
          year: row.card_year,
        }}
        initial={{
          grade: Number(row.grade),
          house: row.house,
          purchasePriceUsd:
            row.purchase_price_usd != null ? Number(row.purchase_price_usd) : null,
          purchaseDate: row.purchase_date,
          estimatedValueUsd:
            row.estimated_value_usd != null ? Number(row.estimated_value_usd) : null,
          notes: row.notes,
        }}
      />
    </SafeAreaView>
  );
}
