import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { routes } from "@/shared/routes";
import {
  completeScanJob,
  createScanJob,
  getScanJob,
  streamScanProgress,
  uploadCaptures,
} from "@/infrastructure/repositories/scanRepository";
import { queryKeys } from "@/application/queries/queryKeys";
import { useScannerStore } from "@/application/stores/scannerStore";
import type {
  ScanJob as ScanJobWire,
  ScanProgressEvent,
} from "@/infrastructure/http";
import type { PhotometricCapture, ScanJob, ScanStatus } from "@/domain";

/** How long to wait for the progress socket before falling back to polling. */
const WS_READY_TIMEOUT_MS = 4000;

/** Wire `complete` is the terminal success state; the UI calls it `ready`. */
function mapStatus(status: ScanJobWire["status"]): ScanStatus {
  return status === "complete" ? "ready" : status;
}

/** Project a wire `ScanJobRead` onto the UI-friendly domain `ScanJob`. */
function jobFromWire(wire: ScanJobWire): ScanJob {
  return {
    jobId: wire.id,
    status: mapStatus(wire.status),
    progress: wire.status === "complete" ? 1 : 0,
    error: wire.error_message ?? undefined,
    createdAt: wire.created_at,
    updatedAt: wire.completed_at ?? wire.started_at ?? wire.created_at,
  };
}

/** Fold a live progress frame onto the current domain job. */
function applyEvent(prev: ScanJob, event: ScanProgressEvent): ScanJob {
  return {
    ...prev,
    status: mapStatus(event.status),
    progress: event.progress,
    error: event.message ?? prev.error,
    // The terminal frame carries the freshly-graded card id.
    reportId: event.result?.graded_card_id ?? prev.reportId,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Drives the full presigned scan lifecycle:
 *   1. POST /v1/scans                → presigned upload URLs
 *   2. Subscribe to /ws/scans        → live progress (before completing, so the
 *                                       inline-graded terminal event isn't missed)
 *   3. PUT each capture              → object storage
 *   4. POST /v1/scans/{id}/complete  → enqueues grading
 *   5. On `ready`, navigate to the report and refresh collection caches.
 */
export function useScanJob() {
  const qc = useQueryClient();
  const startScan = useScannerStore((s) => s.startScan);
  const finishScan = useScannerStore((s) => s.finishScan);

  const [job, setJob] = useState<ScanJob | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const settledRef = useRef(false);

  useEffect(() => () => cleanupRef.current?.(), []);

  // Polling fallback for environments where the WebSocket can't connect.
  // `GET /v1/scans/{id}` reports status but not the graded-card id, so a
  // poll-only completion lands the card in the vault without a report link.
  const startPolling = useCallback((jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const next = await getScanJob(jobId);
        setJob((prev) => ({
          ...(prev ?? jobFromWire(next)),
          ...jobFromWire(next),
          reportId: prev?.reportId,
        }));
        if (next.status === "complete" || next.status === "failed") {
          clearInterval(interval);
        }
      } catch {
        /* swallow — UI shows last known state */
      }
    }, 1500);
    const prevCleanup = cleanupRef.current;
    cleanupRef.current = () => {
      prevCleanup?.();
      clearInterval(interval);
    };
  }, []);

  const mutation = useMutation({
    mutationFn: async (
      input:
        | PhotometricCapture[]
        | { captures: PhotometricCapture[]; marketCardId?: string | null },
    ) => {
      const captures = Array.isArray(input) ? input : input.captures;
      const marketCardId = Array.isArray(input) ? null : input.marketCardId ?? null;
      startScan({ marketCardId });
      settledRef.current = false;

      // 1. Reserve the job + presigned upload slots.
      const { job: created, uploads } = await createScanJob(captures.length, {
        source: "phone",
      });
      setJob(jobFromWire(created));

      // 2. Subscribe *before* completing: grading runs inline on the backend,
      //    so the terminal `complete` frame (with graded_card_id) can fire
      //    during the complete() request below.
      cleanupRef.current?.();
      const stream = streamScanProgress(
        created.id,
        (event) =>
          setJob((prev) => applyEvent(prev ?? jobFromWire(created), event)),
        () => startPolling(created.id),
      );
      cleanupRef.current = stream.close;
      const connected = await Promise.race([
        stream.ready,
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), WS_READY_TIMEOUT_MS),
        ),
      ]);

      // 3. Upload captures to their presigned URLs.
      const uploadedAngles = await uploadCaptures(uploads, captures);

      // 4. Mark complete → enqueues/inlines grading.
      const completed = await completeScanJob(created.id, uploadedAngles);
      setJob((prev) => ({
        ...(prev ?? jobFromWire(completed)),
        ...jobFromWire(completed),
        // Preserve a graded-card id already delivered over the socket.
        reportId: prev?.reportId,
      }));

      if (!connected) startPolling(created.id);
      return created;
    },
  });

  // React to terminal states: navigate + refresh collection caches.
  useEffect(() => {
    if (!job || settledRef.current) return;
    if (job.status === "ready") {
      settledRef.current = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      qc.invalidateQueries({ queryKey: queryKeys.me.grades() });
      qc.invalidateQueries({ queryKey: queryKeys.collection.all });
      qc.invalidateQueries({ queryKey: queryKeys.cards.sparklines() });
      qc.invalidateQueries({ queryKey: queryKeys.portfolio.all });
      qc.invalidateQueries({ queryKey: queryKeys.sets.progress() });
      if (job.reportId) {
        finishScan(job.reportId);
        router.push(routes.scan(job.reportId));
      } else {
        // Graded card is in the vault; no forensic report link available.
        finishScan("");
      }
    } else if (job.status === "failed") {
      settledRef.current = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      finishScan(""); // reset isScanning
    }
  }, [job, qc, finishScan]);

  return {
    job,
    start: mutation.mutate,
    startAsync: mutation.mutateAsync,
    isUploading: mutation.isPending,
    error: mutation.error,
  };
}
