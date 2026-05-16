import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { getScanJob, streamScanJob, uploadScan } from "@/api/scanJobs";
import { queryKeys } from "@/hooks/api/queryKeys";
import { useScannerStore } from "@/store/scannerStore";
import type { PhotometricCapture, ScanJob } from "@/types/domain";

/**
 * Drives the full scan lifecycle:
 *   1. POST /scanner/upload (multipart)
 *   2. Subscribe to /ws/scanner/jobs/:id for Celery progress
 *   3. On `ready`, navigate to the Forensic Report and refresh collection.
 */
export function useScanJob() {
  const qc = useQueryClient();
  const startScan = useScannerStore((s) => s.startScan);
  const finishScan = useScannerStore((s) => s.finishScan);

  const [job, setJob] = useState<ScanJob | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const mutation = useMutation({
    mutationFn: async (input: PhotometricCapture[] | { captures: PhotometricCapture[]; marketCardId?: string | null }) => {
      const captures = Array.isArray(input) ? input : input.captures;
      const marketCardId = Array.isArray(input) ? null : input.marketCardId ?? null;
      startScan({ marketCardId });

      const initial = await uploadScan(captures);
      setJob(initial);

      // Live updates via WebSocket; fall back to polling on socket failure.
      cleanupRef.current?.();
      cleanupRef.current = streamScanJob(
        initial.jobId,
        (next) => setJob(next),
        () => startPolling(initial.jobId, setJob, cleanupRef),
      );
      return initial;
    },
  });

  // React to terminal states: navigate + refresh collection caches.
  useEffect(() => {
    if (!job) return;
    if (job.status === "ready" && job.reportId) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      finishScan(job.reportId);
      qc.invalidateQueries({ queryKey: queryKeys.collection.all });
      qc.invalidateQueries({ queryKey: ["collection-summary"] });
      router.push(`/scan/${job.reportId}`);
    } else if (job.status === "failed") {
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

function startPolling(
  jobId: string,
  setJob: (j: ScanJob) => void,
  cleanupRef: React.MutableRefObject<(() => void) | null>,
) {
  const interval = setInterval(async () => {
    try {
      const next = await getScanJob(jobId);
      setJob(next);
      if (next.status === "ready" || next.status === "failed") {
        clearInterval(interval);
      }
    } catch {
      /* swallow — UI shows last known state */
    }
  }, 1500);
  cleanupRef.current = () => clearInterval(interval);
}
