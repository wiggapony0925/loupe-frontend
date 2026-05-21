/**
 * /grade/new — manually add a card to the vault without scanning.
 *
 * Accepts query params from `routes.gradeNew({ cardId, upstreamId,
 * cardName, cardImage, cardSet, cardYear })`. The card identity is
 * shown read-only at the top of the form; the user picks the card
 * upstream (e.g. from search results or card detail).
 */
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { GradeForm } from "@/presentation/features/grade/GradeForm";

export default function NewGradeScreen() {
  const params = useLocalSearchParams<{
    cardId?: string;
    upstreamId?: string;
    cardName?: string;
    cardImage?: string;
    cardSet?: string;
    cardYear?: string;
  }>();

  const year = params.cardYear ? Number(params.cardYear) : null;
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <GradeForm
        mode="create"
        card={{
          cardId: params.cardId ?? null,
          upstreamId: params.upstreamId ?? null,
          name: params.cardName ?? null,
          imageUrl: params.cardImage ?? null,
          setName: params.cardSet ?? null,
          year: Number.isFinite(year as number) ? (year as number) : null,
        }}
      />
    </SafeAreaView>
  );
}
