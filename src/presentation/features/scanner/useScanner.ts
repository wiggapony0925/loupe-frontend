/**
 * High-level hook that drives the hardware: connects to the scanner,
 * captures all 4 photometric frames, and runs an on-device quality gate
 * with automatic retry of any bad frame before handing the captures off
 * for upload.
 *
 * Production/TestFlight uses the native scanner bridge. Development can
 * opt into a local bridge stub through config when Expo Go needs to boot.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  scannerBridge,
  type CaptureProgressPayload,
  type CapturedFrame,
  type ImageQualityReport,
  type ScannerInfo,
  type ScannerBridgeSource,
  type ScannerStateChangePayload,
} from "@/infrastructure/native";
import type { PhotometricCapture } from "@/domain";

const MAX_RETRIES_PER_FRAME = 2;
const BLUR_REJECT_THRESHOLD = 0.35;
const GLARE_REJECT_THRESHOLD = 0.5;

export type ScannerStage =
  | "idle"
  | "connecting"
  | "capturing"
  | "verifying"
  | "retrying"
  | "rejected"
  | "done"
  | "error";

export interface ScannerHookState {
  stage: ScannerStage;
  info: ScannerInfo | null;
  progress: CaptureProgressPayload | null;
  lastQuality: ImageQualityReport | null;
  errorMessage: string | null;
  source: ScannerBridgeSource;
}

const initialState: ScannerHookState = {
  stage: "idle",
  info: null,
  progress: null,
  lastQuality: null,
  errorMessage: null,
  source: scannerBridge.source,
};

export function useScanner() {
  const [state, setState] = useState<ScannerHookState>(initialState);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const offState = scannerBridge.onStateChange((e: ScannerStateChangePayload) => {
      if (!mounted.current) return;
      setState((s) => ({
        ...s,
        info: e.info ?? s.info,
        errorMessage: e.errorMessage ?? null,
      }));
    });
    const offProgress = scannerBridge.onCaptureProgress((p) => {
      if (!mounted.current) return;
      setState((s) => ({ ...s, progress: p }));
    });
    return () => {
      mounted.current = false;
      offState();
      offProgress();
    };
  }, []);

  const connect = useCallback(async (deviceId = "default") => {
    setState((s) => ({ ...s, stage: "connecting", errorMessage: null }));
    try {
      const info = await scannerBridge.connect(deviceId);
      setState((s) => ({ ...s, info, stage: "idle" }));
      return info;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connect failed";
      setState((s) => ({ ...s, stage: "error", errorMessage: message }));
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await scannerBridge.disconnect();
    setState((s) => ({ ...s, info: null, stage: "idle" }));
  }, []);

  /**
   * Capture all 4 photometric frames, gating each one through the
   * on-device quality check. Up to MAX_RETRIES_PER_FRAME re-captures
   * for any frame failing blur / glare / alignment.
   *
   * Returns frames ready for upload, or throws if a frame can't pass.
   */
  const captureWithQualityGate = useCallback(async (): Promise<PhotometricCapture[]> => {
    setState((s) => ({
      ...s,
      stage: "capturing",
      errorMessage: null,
      progress: null,
      lastQuality: null,
    }));

    try {
      const passed: CapturedFrame[] = [];

      for (const lightIndex of scannerBridge.supportedLightIndices) {
        let attempt = 0;
        let frame: CapturedFrame | null = null;
        let report: ImageQualityReport | null = null;

        while (attempt <= MAX_RETRIES_PER_FRAME) {
          setState((s) => ({
            ...s,
            stage: attempt === 0 ? "capturing" : "retrying",
            progress: {
              lightIndex,
              totalLights: scannerBridge.lightCount,
              phase: "arming",
            },
          }));
          frame = await scannerBridge.captureFrame(lightIndex);
          setState((s) => ({ ...s, stage: "verifying" }));
          report = await scannerBridge.checkImageQuality(frame.uri);
          setState((s) => ({ ...s, lastQuality: report }));

          const ok =
            report.blurScore < BLUR_REJECT_THRESHOLD &&
            report.glareScore < GLARE_REJECT_THRESHOLD &&
            report.alignmentOk &&
            report.aspectOk;

          if (ok) {
            scannerBridge.haptic("tick");
            break;
          }
          attempt += 1;
          scannerBridge.haptic("warning");
        }

        if (!frame || attempt > MAX_RETRIES_PER_FRAME) {
          setState((s) => ({
            ...s,
            stage: "rejected",
            errorMessage: `Light ${lightIndex} failed quality after ${MAX_RETRIES_PER_FRAME + 1} attempts`,
          }));
          scannerBridge.haptic("failure");
          throw new Error(`Capture rejected on light ${lightIndex}`);
        }

        passed.push(frame);
      }

      setState((s) => ({ ...s, stage: "done", progress: null }));
      scannerBridge.haptic("success");

      return passed.map<PhotometricCapture>((f) => ({
        uri: f.uri,
        lightIndex: f.lightIndex as 0 | 1 | 2 | 3,
        mimeType: "image/jpeg",
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Capture failed";
      setState((s) => ({
        ...s,
        stage: s.stage === "rejected" ? "rejected" : "error",
        errorMessage: message,
      }));
      throw err;
    }
  }, []);

  const reset = useCallback(() => setState(initialState), []);

  return {
    ...state,
    connect,
    disconnect,
    captureWithQualityGate,
    reset,
  };
}

export const SCANNER_STAGE_LABEL: Record<ScannerStage, string> = {
  idle: "Ready to capture",
  connecting: "Connecting to scanner…",
  capturing: "Firing photometric lights…",
  verifying: "Checking image quality…",
  retrying: "Quality low — retrying…",
  rejected: "Capture rejected",
  done: "Captures ready",
  error: "Scanner error",
};
