import { apiFetch, getAuthToken } from "@/infrastructure/http/client";
import { config } from "@/shared/config";
import type { PhotometricCapture, ScanJob } from "@/domain";

/**
 * POST /scanner/upload — multipart form data with the four photometric
 * captures. Backend persists to S3 and queues a Celery job, returning 202
 * with the initial ScanJob record.
 */
export async function uploadScan(captures: PhotometricCapture[]): Promise<ScanJob> {
  const form = new FormData();
  captures.forEach((c) => {
    form.append("captures", {
      // React Native's FormData accepts this shape for file blobs.
      uri: c.uri,
      name: `light_${c.lightIndex}.jpg`,
      type: c.mimeType ?? "image/jpeg",
    } as unknown as Blob);
    form.append("light_indices", String(c.lightIndex));
  });

  return apiFetch<ScanJob>("/scanner/upload", { method: "POST", body: form });
}

export function getScanJob(jobId: string): Promise<ScanJob> {
  return apiFetch<ScanJob>(`/scanner/jobs/${jobId}`);
}

/**
 * Subscribe to live job updates over WebSocket. The backend pushes a JSON
 * `ScanJob` payload on every state transition (queued → processing → ready).
 * Returns a cleanup function that closes the socket.
 */
export function streamScanJob(
  jobId: string,
  onUpdate: (job: ScanJob) => void,
  onError?: (err: Event) => void,
): () => void {
  const token = getAuthToken();
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  const ws = new WebSocket(`${config.wsUrl}/ws/scanner/jobs/${jobId}${qs}`);

  ws.onmessage = (evt) => {
    try {
      const job = JSON.parse(evt.data) as ScanJob;
      onUpdate(job);
    } catch {
      /* ignore malformed frames */
    }
  };
  if (onError) ws.onerror = onError;

  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}
