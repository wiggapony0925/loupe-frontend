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
import { router, useLocalSearchParams } from "expo-router";
import { LiveIdentifyFlow } from "@/presentation/features/identify";
import type { IdentifyTcgHint } from "@/infrastructure/repositories/identifyRepository";
import { routes } from "@/shared/routes";

const ALLOWED: ReadonlyArray<NonNullable<IdentifyTcgHint>> = [
  "pokemon",
  "magic",
  "yugioh",
];

export default function IdentifyScanScreen() {
  const { tcg } = useLocalSearchParams<{ tcg?: string }>();
  const initialTcg: IdentifyTcgHint =
    typeof tcg === "string" && (ALLOWED as readonly string[]).includes(tcg)
      ? (tcg as NonNullable<IdentifyTcgHint>)
      : null;

  return (
    <LiveIdentifyFlow
      initialTcg={initialTcg}
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/");
      }}
      onConfirm={(candidate) => {
        const cardId = candidate.card_id ?? null;
        if (cardId) {
          router.replace(routes.card(cardId));
          return;
        }
        // Fallback: unresolved → straight to add-to-vault with whatever
        // identity hints we have.
        router.replace(
          routes.gradeNew({
            upstreamId: candidate.upstream_id ?? undefined,
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
    />
  );
}

