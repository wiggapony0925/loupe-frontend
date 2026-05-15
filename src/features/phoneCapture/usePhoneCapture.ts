/**
 * Hook that drives the phone-camera capture pipeline.
 *
 * Wraps expo-camera + expo-image-manipulator:
 *   - manages permissions
 *   - exposes a `capture(step)` that takes a photo with the right flash mode,
 *     downscales/crops it, and runs a light quality gate
 *   - accumulates the per-step PhotometricCapture[] so the existing scan
 *     pipeline can upload them unchanged
 */
import { useCallback, useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import type { CaptureSource, PhoneCaptureStep, PhotometricCapture } from "@/types/domain";
import { stepsForMode, type PhoneCaptureMode } from "./captureSteps";
import { checkCaptureQuality, cropToCardOverlay, type QualityCheck } from "./imageOps";

const MAX_LONG_EDGE = 2048;
const JPEG_QUALITY = 0.92;

export interface PhoneCaptureHookState {
  mode: PhoneCaptureMode;
  steps: PhoneCaptureStep[];
  currentIndex: number;
  captures: PhotometricCapture[];
  busy: boolean;
  error: string | null;
  done: boolean;
  /** Last quality-gate result — surfaced to the UI as a chip. */
  lastQuality: QualityCheck | null;
}

export function usePhoneCapture(mode: PhoneCaptureMode) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const steps = stepsForMode(mode);

  const [state, setState] = useState<PhoneCaptureHookState>({
    mode,
    steps,
    currentIndex: 0,
    captures: [],
    busy: false,
    error: null,
    done: false,
    lastQuality: null,
  });

  const source: CaptureSource = mode === "studio" ? "phone-studio" : "phone-quick";

  const capture = useCallback(async () => {
    const step = steps[state.currentIndex];
    if (!step || state.busy || state.done) return;
    const camera = cameraRef.current;
    if (!camera) {
      setState((s) => ({ ...s, error: "Camera not ready" }));
      return;
    }

    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const photo = await camera.takePictureAsync({
        quality: 1,
        skipProcessing: false,
        exif: false,
      });
      if (!photo) throw new Error("Capture returned no photo");

      // 1) Auto-crop to the card-shaped overlay so we discard background.
      const cropped = await cropToCardOverlay(photo.uri, photo.width, photo.height);

      // 2) Downscale to keep upload payload reasonable while preserving
      //    enough detail for surface/edge analysis.
      const longEdge = Math.max(cropped.width, cropped.height);
      const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
      const processed =
        scale < 1
          ? await manipulateAsync(
              cropped.uri,
              [{ resize: { width: Math.round(cropped.width * scale) } }],
              { compress: JPEG_QUALITY, format: SaveFormat.JPEG },
            )
          : cropped;

      // 3) On-device quality gate. Reject blurry / glared frames before
      //    they ever leave the phone.
      const quality = await checkCaptureQuality(processed.uri);
      if (!quality.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setState((s) => ({
          ...s,
          busy: false,
          lastQuality: quality,
          error: quality.reason ?? "Capture rejected — retake",
        }));
        return;
      }

      const next: PhotometricCapture = {
        uri: processed.uri,
        lightIndex: step.index,
        mimeType: "image/jpeg",
        source,
      };

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      setState((s) => {
        const captures = [...s.captures, next];
        const nextIndex = s.currentIndex + 1;
        const done = nextIndex >= steps.length;
        if (done) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        return {
          ...s,
          captures,
          currentIndex: nextIndex,
          busy: false,
          done,
          lastQuality: quality,
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Capture failed";
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setState((s) => ({ ...s, busy: false, error: message }));
    }
  }, [state.currentIndex, state.busy, state.done, steps, source]);

  const reset = useCallback(() => {
    setState({
      mode,
      steps,
      currentIndex: 0,
      captures: [],
      busy: false,
      error: null,
      done: false,
      lastQuality: null,
    });
  }, [mode, steps]);

  const retake = useCallback(() => {
    setState((s) =>
      s.captures.length === 0
        ? s
        : {
            ...s,
            captures: s.captures.slice(0, -1),
            currentIndex: Math.max(0, s.currentIndex - 1),
            done: false,
            error: null,
          },
    );
  }, []);

  return {
    ...state,
    permission,
    requestPermission,
    cameraRef,
    capture,
    reset,
    retake,
    currentStep: steps[state.currentIndex] ?? null,
  };
}

export type PhoneCaptureHook = ReturnType<typeof usePhoneCapture>;
