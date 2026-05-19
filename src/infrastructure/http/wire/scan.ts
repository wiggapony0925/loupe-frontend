/**
 * Scan-job wire types — `/scanner/upload`, `/v1/scans/*`.
 *
 * NOTE: The domain `ScanJob` (`@/domain/scan`) is a UI-friendly projection.
 * This is the raw wire shape.
 */

import type { ID, ISODate, ScanSource, ScanStatus } from "../atoms";

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

/** Legacy event shape emitted by the scan-progress endpoint. */
export interface ScanProgressEvent {
  scan_id: string;
  status: "queued" | "processing" | "complete" | "failed";
  progress: number;
  message?: string;
}
