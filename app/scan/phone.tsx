/**
 * Phone-camera capture route.
 *
 * Two distinct flows, picked by `?mode=`:
 *
 *   • `studio` (default) — 4-shot photometric capture, hands off to
 *     `useScanJob` so the backend produces a `ForensicReport`. The hook
 *     navigates to the report and invalidates collection caches.
 *
 *   • `quick` — 2-shot front/back triage. We OCR the front frame, then
 *     route the user into the existing `gradeNew` catalog-match form
 *     with the detected title prefilled (Collectr-style: "snap → match
 *     → add as a raw holding"). No forensic grading runs; the card is
 *     added as a raw vault entry once the user confirms the catalog
 *     match in the form.
 */
import React, { useCallback, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  CaptureReviewScreen,
  PhoneCaptureFlow,
  type PhoneCaptureMode,
} from "@/presentation/features/phoneCapture";
import { useScanJob } from "@/presentation/features/scanner/useScanJob";
import { routes } from "@/shared/routes";
import type { OcrSuggestion, PhotometricCapture } from "@/domain";

export default function PhoneScanScreen() {
  const params = useLocalSearchParams<{ mode?: string; marketCardId?: string }>();
  const mode: PhoneCaptureMode = params.mode === "quick" ? "quick" : "studio";
  const marketCardId = params.marketCardId ?? null;
  const { start } = useScanJob();
  const [pending, setPending] = useState<PhotometricCapture[] | null>(null);

  const handleCaptured = useCallback((captures: PhotometricCapture[]) => {
    setPending(captures);
  }, []);

  const handleConfirm = useCallback(
    (captures: PhotometricCapture[], ocr: OcrSuggestion | null) => {
      if (mode === "quick") {
        // Quick mode = "find this card and add it as a raw holding".
        // The gradeNew form does catalog search by `cardName` and lets
        // the user pick the exact printing before saving. The captured
        // frames themselves aren't uploaded — Quick mode is OCR + add,
        // not forensic grading.
        const cardName = ocr?.title?.trim();
        const front = captures.find((c) => c.lightIndex === 0)?.uri;
        router.replace(
          routes.gradeNew({
            cardName: cardName || undefined,
            cardImage: front || undefined,
          }),
        );
        return;
      }

      // Studio mode = full forensic grade. The marketCardId is forwarded
      // so the resulting report can be cross-linked to a market entry
      // the user was viewing (price-vs-grade comparison).
      start({ captures, marketCardId });
      if (router.canGoBack()) router.back();
    },
    [mode, start, marketCardId],
  );

  const handleRetake = useCallback(() => setPending(null), []);

  const handleCancel = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);

  if (pending) {
    return (
      <CaptureReviewScreen
        captures={pending}
        mode={mode}
        onConfirm={handleConfirm}
        onRetake={handleRetake}
      />
    );
  }
  return <PhoneCaptureFlow mode={mode} onComplete={handleCaptured} onCancel={handleCancel} />;
}
