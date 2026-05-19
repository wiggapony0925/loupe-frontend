/**
 * Scan aggregate — async scan jobs and the forensic reports they produce.
 *
 * Lifecycle:
 *   POST /scanner/upload          → ScanJob { status: "queued" }
 *   Celery worker progresses      → ScanJob { status: "processing", progress }
 *   On completion                 → ScanJob { status: "ready", reportId }
 *                                   ForensicReport { id: reportId, ... }
 */

import type { CollectionCard } from "@/domain/collection";
import type { CaptureSource, OcrSuggestion } from "@/domain/capture";
import type { PricePoint } from "@/domain/market";

/** Per-axis subgrade (PSA-style 0..1000 scale) plus composite + final grade. */
export interface ForensicScore {
  surface: number;
  edges: number;
  corners: number;
  centering: number;
  composite: number;
  /** Final 1..10 grade. */
  grade: number;
}

/** A single defect annotation overlaid on the captured image. */
export interface HeatmapDing {
  id: string;
  category: "surface" | "edges" | "corners" | "centering";
  /** Normalized 0..1 coordinates relative to the captured image. */
  x: number;
  y: number;
  radius: number; // 0..1
  severity: number; // 0..1
}

/** Fully-realized output of a scan job — UI's source of truth for a graded card. */
export interface ForensicReport {
  id: string;
  card: CollectionCard;
  frontCaptureUri: string;
  backCaptureUri: string;
  score: ForensicScore;
  dings: HeatmapDing[];
  capturedAt: string;
  /**
   * How the source frames were captured. Drives the confidence chip + grade
   * tolerance disclaimer on the report. Defaults to "scanner" when omitted
   * for backward compatibility with existing reports.
   */
  source?: CaptureSource;
  /** Auto-detected text from the front capture (best-effort). */
  ocr?: OcrSuggestion;
  /** Recent sold-comp prices for the same card. Sorted oldest → newest. */
  priceHistory?: PricePoint[];
}

/** Lifecycle state of an async scan job. */
export type ScanStatus = "queued" | "uploading" | "processing" | "ready" | "failed";

/**
 * Async scan job tracked client-side. The FastAPI endpoint returns 202 + a job
 * record; a Celery worker advances it through `processing` and eventually
 * `ready` (with a `reportId`) or `failed`.
 */
export interface ScanJob {
  jobId: string;
  status: ScanStatus;
  /** 0..1 — surfaced to the UI for progress affordances. */
  progress: number;
  /** Populated when status === "ready". */
  reportId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
