import { apiBaseUrl, apiFetch, getAuthToken } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type {
  PresignedUpload,
  ScanJob as ScanJobWire,
  ScanJobAngle,
  ScanJobCreateResponse,
  ScanProgressEvent,
} from "@/infrastructure/http";
import type { PhotometricCapture } from "@/domain";

/**
 * Scan ingest repository — drives the presigned upload flow documented in
 * `app/routers/collection/scans.py`:
 *
 *   1. POST /v1/scans                → job + presigned PUT URLs (one per angle)
 *   2. PUT each capture to its URL   → object storage
 *   3. POST /v1/scans/{id}/complete  → enqueues the grading worker
 *   4. /ws/scans?token=…             → live ScanProgressEvent frames
 */

/** Backend angle order. The studio flow's 4 photometric frames map here positionally. */
export const SCAN_ANGLES: readonly ScanJobAngle[] = ["front", "back", "top", "bottom"];

/**
 * Create a scan job and obtain presigned upload URLs. `angleCount` is clamped
 * to the four supported angles; phone captures supply up to four frames.
 */
export function createScanJob(
  angleCount: number,
  opts?: { scannerId?: string | null; source?: "phone" | "scanner" },
): Promise<ScanJobCreateResponse> {
  const count = Math.max(1, Math.min(angleCount, SCAN_ANGLES.length));
  return apiFetch<ScanJobCreateResponse>(ENDPOINTS.scans.list, {
    method: "POST",
    json: {
      scanner_id: opts?.scannerId ?? null,
      source: opts?.source ?? "phone",
      angles: SCAN_ANGLES.slice(0, count),
    },
  });
}

/**
 * Upload a single capture to its presigned URL. The URL is absolute (object
 * storage), so we bypass `apiFetch` (no auth header, no envelope parsing) and
 * PUT the raw image bytes.
 */
export async function uploadCapture(
  upload: PresignedUpload,
  capture: PhotometricCapture,
): Promise<void> {
  const fileResponse = await fetch(capture.uri);
  const blob = await fileResponse.blob();
  const res = await fetch(upload.upload_url, {
    method: "PUT",
    headers: { "Content-Type": capture.mimeType ?? "image/jpeg" },
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`Upload failed for ${upload.angle} (HTTP ${res.status})`);
  }
}

/**
 * Upload every capture to its matching presigned slot. Captures are matched to
 * uploads positionally (capture[i] → uploads[i]); both are ordered by
 * {@link SCAN_ANGLES}. Uploads run concurrently. Returns the angles uploaded.
 */
export async function uploadCaptures(
  uploads: PresignedUpload[],
  captures: PhotometricCapture[],
): Promise<ScanJobAngle[]> {
  const ordered = [...captures].sort((a, b) => a.lightIndex - b.lightIndex);
  const pairs = uploads.map((upload, i) => ({ upload, capture: ordered[i] }));
  await Promise.all(
    pairs
      .filter(
        (p): p is { upload: PresignedUpload; capture: PhotometricCapture } =>
          p.capture !== undefined,
      )
      .map((p) => uploadCapture(p.upload, p.capture)),
  );
  return uploads.map((u) => u.angle);
}

/** Mark uploads complete; the backend enqueues (or inlines) the grading worker. */
export function completeScanJob(
  jobId: string,
  uploadedAngles: ScanJobAngle[],
): Promise<ScanJobWire> {
  return apiFetch<ScanJobWire>(ENDPOINTS.scans.complete(jobId), {
    method: "POST",
    json: { uploaded_angles: uploadedAngles },
  });
}

/** Polling fallback for environments without a working WebSocket. */
export function getScanJob(jobId: string): Promise<ScanJobWire> {
  return apiFetch<ScanJobWire>(ENDPOINTS.scans.item(jobId));
}

/**
 * Subscribe to the per-user `/ws/scans` channel and forward only the frames
 * belonging to `jobId`. Returns a handle whose `ready` promise resolves once
 * the socket is open (or `false` if it could not connect), so callers can
 * subscribe *before* triggering work that publishes terminal events.
 */
export function streamScanProgress(
  jobId: string,
  onEvent: (event: ScanProgressEvent) => void,
  onError?: () => void,
): { ready: Promise<boolean>; close: () => void } {
  const token = getAuthToken();
  const base = apiBaseUrl.replace(/^http/i, "ws");
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  let socket: WebSocket | null = null;

  const ready = new Promise<boolean>((resolve) => {
    try {
      socket = new WebSocket(`${base}${ENDPOINTS.ws.scans}${qs}`);
    } catch {
      resolve(false);
      onError?.();
      return;
    }
    socket.onopen = () => resolve(true);
    socket.onerror = () => {
      resolve(false);
      onError?.();
    };
    socket.onmessage = (evt) => {
      try {
        const frame = JSON.parse(evt.data) as ScanProgressEvent;
        if (frame.job_id === jobId) onEvent(frame);
      } catch {
        /* ignore malformed frames */
      }
    };
  });

  return {
    ready,
    close: () => {
      if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING)
      ) {
        socket.close();
      }
    },
  };
}
