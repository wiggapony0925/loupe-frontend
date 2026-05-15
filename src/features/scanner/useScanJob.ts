import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { getScanJob, streamScanJob, uploadScan } from "@/api/scanJobs";
import { config } from "@/lib/config";
import { useScannerStore } from "@/store/scannerStore";
import type { PhotometricCapture, ScanJob } from "@/types/domain";

/**
 * Drives the full scan lifecycle:
 *   1. POST /scanner/upload (multipart)
 *   2. Subscribe to /ws/scanner/jobs/:id for Celery progress
 *   3. On `ready`, navigate to the Forensic Report and refresh collection.
 *
 * In mock mode (no backend yet), the hook fakes the same lifecycle so the
 * UI is fully exercisable without the FastAPI server.
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
      if (config.useMocks) return mockLifecycle(setJob);

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
      qc.invalidateQueries({ queryKey: ["collection"] });
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

/** Drives the same state machine without a backend. */
async function mockLifecycle(setJob: (j: ScanJob) => void): Promise<ScanJob> {
  const now = () => new Date().toISOString();
  const jobId = `mock_${Date.now()}`;
  const base = { jobId, createdAt: now(), updatedAt: now() };

  setJob({ ...base, status: "uploading", progress: 0.15 });
  await wait(450);
  setJob({ ...base, status: "queued", progress: 0.3, updatedAt: now() });
  await wait(500);
  setJob({ ...base, status: "processing", progress: 0.65, updatedAt: now() });
  await wait(700);
  const final: ScanJob = {
    ...base,
    status: "ready",
    progress: 1,
    reportId: "card_001",
    updatedAt: now(),
  };
  setJob(final);
  return final;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
