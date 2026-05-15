/**
 * Phone-camera capture route.
 *
 *   1. Run the guided `PhoneCaptureFlow`
 *   2. Show `CaptureReviewScreen` so the user can confirm OCR'd title
 *   3. Hand the resulting `PhotometricCapture[]` to `useScanJob().start(...)` —
 *      same pipeline used by the hardware scanner. The hook navigates to the
 *      Forensic Report on success.
 */
import React, { useCallback, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  CaptureReviewScreen,
  PhoneCaptureFlow,
  type PhoneCaptureMode,
} from "@/features/phoneCapture";
import { useScanJob } from "@/features/scanner/useScanJob";
import type { OcrSuggestion, PhotometricCapture } from "@/types/domain";

export default function PhoneScanScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: PhoneCaptureMode = params.mode === "quick" ? "quick" : "studio";
  const { start } = useScanJob();
  const [pending, setPending] = useState<PhotometricCapture[] | null>(null);

  const handleCaptured = useCallback((captures: PhotometricCapture[]) => {
    setPending(captures);
  }, []);

  const handleConfirm = useCallback(
    (captures: PhotometricCapture[], _ocr: OcrSuggestion | null) => {
      // OCR metadata isn't part of PhotometricCapture[]; the backend will
      // re-derive title from the upload. We keep the OCR suggestion in the
      // local scanner store on a follow-up pass — for now it's UX-only.
      start(captures);
      if (router.canGoBack()) router.back();
    },
    [start],
  );

  const handleRetake = useCallback(() => setPending(null), []);

  const handleCancel = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);

  if (pending) {
    return (
      <CaptureReviewScreen captures={pending} onConfirm={handleConfirm} onRetake={handleRetake} />
    );
  }
  return <PhoneCaptureFlow mode={mode} onComplete={handleCaptured} onCancel={handleCancel} />;
}
