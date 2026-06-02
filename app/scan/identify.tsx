/**
 * `/scan/identify` — live card identification (PriceCharting-style).
 *
 * Mounts the streaming OCR viewfinder. When the user picks a candidate
 * we deep-link into the unified `/card/{id}` detail page (price by
 * grade, lowest live price per marketplace, recent sold comps). From
 * there an "Add to vault" CTA bridges to `gradeNew`. If we couldn't
 * resolve a catalog id we fall back to the legacy gradeNew flow so the
 * user still has a way to save what they captured.
 */
import React from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LiveIdentifyFlow } from "@/presentation/features/identify";
import type {
  IdentifyCandidate,
  IdentifyTcgHint,
} from "@/infrastructure/repositories/identifyRepository";
import { useCreateGrade } from "@/application/queries/collection/useGradeMutations";
import { routes } from "@/shared/routes";

const ALLOWED: readonly NonNullable<IdentifyTcgHint>[] = [
  "pokemon",
  "magic",
  "yugioh",
];

/**
 * Default grade for a batch-added card. The batch path logs cards as
 * RAW (house `"loupe"` + a condition), so the numeric grade is not the
 * surfaced signal — but the schema still requires one. Near Mint ≈ 9 on
 * the standard 1–10 raw scale, which matches the `"nm"` condition we
 * stamp, so the two stay consistent. The user can refine any card later.
 */
const BATCH_RAW_GRADE = 9;

export default function IdentifyScanScreen() {
  const { tcg } = useLocalSearchParams<{ tcg?: string }>();
  const createGrade = useCreateGrade();
  const initialTcg: IdentifyTcgHint =
    typeof tcg === "string" && (ALLOWED as readonly string[]).includes(tcg)
      ? (tcg as NonNullable<IdentifyTcgHint>)
      : null;

  const handleAddBatch = React.useCallback(
    async (candidates: IdentifyCandidate[]) => {
      // Only cards we could resolve to a catalog id can be saved; skip
      // any that came back without one (rare — phash/text both missed).
      const saveable = candidates.filter(
        (c) => c.card_id != null || c.upstream_id != null,
      );
      const results = await Promise.allSettled(
        saveable.map((c) =>
          createGrade.mutateAsync({
            cardId: c.card_id ?? undefined,
            upstreamId: c.upstream_id ?? undefined,
            grade: BATCH_RAW_GRADE,
            house: "loupe",
            condition: "nm",
          }),
        ),
      );
      const added = results.filter((r) => r.status === "fulfilled").length;
      const failed = candidates.length - added;

      router.replace(routes.vault());
      if (failed > 0) {
        Alert.alert(
          "Stack added",
          `${added} card${added === 1 ? "" : "s"} added to your vault as RAW (Near Mint). ${failed} couldn't be saved — try those again.`,
        );
      }
    },
    [createGrade],
  );

  return (
    <LiveIdentifyFlow
      initialTcg={initialTcg}
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/");
      }}
      onConfirm={(candidate) => {
        // Open the rich card-detail page (price-by-grade, comps, the
        // interactive scrub chart) on tap. The detail route resolves both
        // a local `card_id` and a composite `upstream_id`
        // (e.g. `pokemontcg:base1-4`), so a freshly-scanned card that only
        // came back with an upstream id still lands on the full page
        // instead of dropping into add-to-vault. "Add to collection" lives
        // there as a primary CTA.
        const detailId = candidate.card_id ?? candidate.upstream_id ?? null;
        if (detailId) {
          router.replace(routes.card(detailId));
          return;
        }
        // Truly unresolved → straight to add-to-vault with whatever
        // identity hints we have.
        router.replace(
          routes.gradeNew({
            cardName: candidate.name,
            cardImage: candidate.image_url ?? undefined,
            cardSet: candidate.set_name ?? undefined,
          }),
        );
      }}
      onAddToVault={(candidate) => {
        router.replace(
          routes.gradeNew({
            cardId: candidate.card_id ?? undefined,
            upstreamId: candidate.upstream_id ?? undefined,
            cardName: candidate.name,
            cardImage: candidate.image_url ?? undefined,
            cardSet: candidate.set_name ?? undefined,
          }),
        );
      }}
      onAddBatch={handleAddBatch}
      onManualSearch={() => router.replace("/search")}
    />
  );
}

