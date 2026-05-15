import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { ScanLine } from "lucide-react-native";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useScannerStore } from "@/store/scannerStore";
import { useScanJob } from "@/features/scanner/useScanJob";
import { SCANNER_STAGE_LABEL, useScanner } from "@/features/scanner/useScanner";
import { palette } from "@/theme/tokens";
import type { ScanStatus } from "@/types/domain";

/**
 * Hero CTA on the Command Center. Drives the full pipeline:
 *   1. Native bridge fires 4 photometric lights → captures frames
 *   2. On-device quality gate (Vision / ML Kit) verifies each frame
 *   3. Multipart upload to FastAPI, Celery job streamed via WebSocket
 *   4. On `ready`, navigates to the Forensic Report
 *
 * Falls back to a JS mock for the bridge in Expo Go (no dev build yet).
 */
const STATUS_LABEL: Record<ScanStatus, string> = {
  uploading: "Uploading captures…",
  queued: "Queued for analysis…",
  processing: "Detecting DINGS · grading surface…",
  ready: "Report ready",
  failed: "Scan failed — try again",
};

export function InitiateScanButton() {
  const isScanning = useScannerStore((s) => s.isScanning);
  const { job, start, isUploading } = useScanJob();
  const scanner = useScanner();
  const sweep = useRef(new Animated.Value(0)).current;

  const captureBusy =
    scanner.stage !== "idle" &&
    scanner.stage !== "done" &&
    scanner.stage !== "error" &&
    scanner.stage !== "rejected";
  const busy = isScanning || isUploading || captureBusy;

  const status: ScanStatus | undefined = job?.status;
  const message = job
    ? status
      ? STATUS_LABEL[status]
      : STATUS_LABEL.uploading
    : captureBusy
      ? SCANNER_STAGE_LABEL[scanner.stage]
      : scanner.errorMessage
        ? scanner.errorMessage
        : "Ready to grade";

  // Lights-fired progress bar (0..1) before the upload phase takes over.
  const captureProgress = scanner.progress
    ? (scanner.progress.lightIndex + 1) / scanner.progress.totalLights
    : 0;
  const progressValue = job?.progress ?? captureProgress;

  useEffect(() => {
    if (!busy) {
      sweep.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [busy, sweep]);

  const sweepTranslate = sweep.interpolate({ inputRange: [0, 1], outputRange: [-120, 120] });
  const sweepOpacity = sweep.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });

  const handlePress = async () => {
    try {
      const captures = await scanner.captureWithQualityGate();
      start(captures);
    } catch {
      // useScanner already surfaced the error in `scanner.errorMessage`.
    }
  };

  return (
    <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
      {busy ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 120,
            backgroundColor: palette.accent.mint,
            transform: [{ translateX: sweepTranslate }],
            opacity: sweepOpacity,
          }}
        />
      ) : null}

      <View className="px-5 pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Forensic Capture
          </Text>
          <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-ink-dim">
            {scanner.source === "native" ? "Native bridge" : "JS mock"}
          </Text>
        </View>
        <Text className="mt-1 text-base font-medium text-ink">{message}</Text>
        {(job && status !== "ready" && status !== "failed") || captureBusy ? (
          <View className="mt-3 h-1 overflow-hidden rounded-full bg-line">
            <View
              style={{
                width: `${Math.round(progressValue * 100)}%`,
                height: "100%",
                backgroundColor: palette.accent.mint,
              }}
            />
          </View>
        ) : null}
      </View>

      <View className="p-4 pt-3">
        <PrimaryButton
          label={busy ? "Scanning…" : "Initiate Forensic Scan"}
          icon={ScanLine}
          onPress={handlePress}
          loading={busy}
          variant="mint"
        />
      </View>
    </View>
  );
}
