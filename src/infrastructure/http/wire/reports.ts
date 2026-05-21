/**
 * Reports wire types — backs `/v1/reports`.
 *
 * Each `UserReportWire` represents one generated PDF statement attached
 * to a user. The PDF binary lives in object storage; this row is the
 * registry that powers list + download. `download_url` is a short-lived
 * presigned URL (null on backends that don't support presigning — fall
 * back to the streaming `/file` endpoint).
 */

import type { ID, ISODate } from "../atoms";

export type ReportPeriod = "monthly" | "yearly";
export type ReportStatus = "pending" | "ready" | "failed";

export interface UserReportWire {
  id: ID;
  period: ReportPeriod;
  period_start: ISODate; // YYYY-MM-DD
  period_end: ISODate;
  status: ReportStatus;
  title: string;
  file_size_bytes: number | null;
  error_message: string | null;
  generated_at: ISODate | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface ReportGenerateWire {
  period: ReportPeriod;
  year: number;
  month?: number; // required when period === "monthly"
}

export interface ReportDownloadWire {
  download_url: string | null;
  expires_in_seconds: number;
}

/**
 * Upcoming-statement payload — returned by `GET /v1/reports/upcoming`.
 *
 * Drives the Amex-style "Your next statement closes on Jun 1" hero.
 * The client never triggers generation; statements materialise on the
 * server when `closes_at` passes.
 */
export interface UpcomingReportWire {
  period: ReportPeriod;
  period_start: ISODate;
  period_end: ISODate;
  closes_at: string; // ISO datetime in UTC
  label: string;
}
