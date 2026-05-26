/**
 * `/scan/identify` — live card identification (PriceCharting-style).
 *
 * Mounts the streaming OCR viewfinder. When the user picks a candidate
 * we deep-link into `gradeNew` with the resolved catalog metadata so
 * they can save the card to their vault, matching the rest of the
 * scan flows' "snap → confirm → save" pattern.
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
        // Drop the user into the existing add-to-vault form with the
        // resolved catalog id pre-filled. They can adjust grade/cost
        // basis from there.
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
