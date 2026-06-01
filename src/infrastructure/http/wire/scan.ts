/**
 * Scan-job wire types — `/v1/scans/*` and `/ws/scans`.
 *
 * Mirrors `app/schemas/scan.py` on the backend. The ingest flow is:
 *   1. POST /v1/scans                 → ScanJobCreateResponse (job + presigned URLs)
 *   2. PUT each capture to its presigned `upload_url`
 *   3. POST /v1/scans/{id}/complete   → ScanJobRead (enqueues grading)
 *   4. /ws/scans?token=…              → ScanProgressEvent frames until terminal
 *
 * NOTE: The domain `ScanJob` (`@/domain/scan`) is a UI-friendly projection.
 * These are the raw wire shapes; `scanRepository` translates between them.
 */

import type { ID, ISODate, ScanSource, ScanStatus } from "../atoms";

/** The four card faces the backend accepts. */
export type ScanJobAngle = "front" | "back" | "top" | "bottom";

/** Mirrors `ScanJobRead` in `app/schemas/scan.py`. */
export interface ScanJob {
  id: ID;
  user_id: ID;
  scanner_id: ID | null;
  status: ScanStatus;
  source: ScanSource;
  images_s3_keys: Record<string, string> | null;
  error_message: string | null;
  created_at: ISODate;
  started_at: ISODate | null;
  completed_at: ISODate | null;
}

/** Mirrors `PresignedUpload` — one presigned PUT URL per angle. */
export interface PresignedUpload {
  angle: ScanJobAngle;
  upload_url: string;
  s3_key: string;
  expires_in: number;
}

/** Body for `POST /v1/scans`. */
export interface ScanJobCreate {
  scanner_id?: ID | null;
  source: ScanSource;
  angles?: ScanJobAngle[];
}

/** Response from `POST /v1/scans`. */
export interface ScanJobCreateResponse {
  job: ScanJob;
  uploads: PresignedUpload[];
}

/** Body for `POST /v1/scans/{id}/complete`. */
export interface ScanJobCompleteRequest {
  uploaded_angles: ScanJobAngle[];
}

/** Result payload carried by the terminal `complete` progress event. */
export interface ScanProgressResult {
  graded_card_id: ID;
  grade?: number;
  subgrades?: Record<string, number> | null;
  fingerprint?: string;
}

/** A WebSocket frame pushed on `/ws/scans` for live scan progress. */
export interface ScanProgressEvent {
  type: "scan_progress";
  job_id: ID;
  status: ScanStatus;
  /** 0..1 completion fraction. */
  progress: number;
  message?: string | null;
  result?: ScanProgressResult | null;
}
