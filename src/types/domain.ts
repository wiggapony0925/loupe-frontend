/** Domain types shared across features. */

export type ConnectionTransport = "ble" | "wifi" | "offline";

export interface HardwareStatus {
  transport: ConnectionTransport;
  deviceName: string;
  firmware: string;
  /** ISO timestamp of the scanner's last heartbeat. `null` if never seen. */
  lastSeenAt: string | null;
  /** 0..1 — `null` when the backend doesn't have live telemetry. */
  signalStrength: number | null;
  /** Remaining scans on the device's plan. `null` when unknown. */
  scansRemaining: number | null;
  /** Live sensor temperature in °C. `null` when unknown. */
  temperatureC: number | null;
}

export type CardSet =
  | "Pokemon Base Set"
  | "2026 World Cup Goals"
  | "Topps Chrome 2025"
  | "Magic Alpha";

export interface CollectionCard {
  id: string;
  title: string;
  set: CardSet;
  year: number;
  grade: number; // 1..10
  estimatedValueUsd: number;
  thumbnailUri: string;
  scannedAt: string; // ISO
}

export interface ForensicScore {
  surface: number; // 0..1000
  edges: number;
  corners: number;
  centering: number;
  composite: number;
  grade: number; // 1..10
}

export interface HeatmapDing {
  id: string;
  category: "surface" | "edges" | "corners" | "centering";
  /** Normalized 0..1 coordinates relative to the captured image. */
  x: number;
  y: number;
  radius: number; // 0..1
  severity: number; // 0..1
}

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

/** Detected card metadata extracted from the front-face capture. */
export interface OcrSuggestion {
  title?: string;
  set?: string;
  year?: number;
  /** 0..1 — model confidence, drives "verify before saving" UX. */
  confidence: number;
  /** Raw recognized text lines, ordered top → bottom. */
  rawLines: string[];
}

/** Single sold-listing data point for the price-history sparkline. */
export interface PricePoint {
  date: string; // ISO yyyy-mm-dd
  priceUsd: number;
  /** Optional source label (e.g. "eBay", "PWCC", "Goldin"). */
  venue?: string;
}

/**
 * Lifecycle of an async scan job. The FastAPI endpoint returns 202 + a job
 * record; a Celery worker advances it through `processing` and eventually
 * `ready` (with a `reportId`) or `failed`.
 */
export type ScanStatus = "queued" | "uploading" | "processing" | "ready" | "failed";

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

/** Photometric capture payload sent to /scanner/upload. */
export interface PhotometricCapture {
  /** Local file URI (e.g. file://… from the camera/scanner). */
  uri: string;
  /** Light position index 0..3 — matches the firmware's capture sequence. */
  lightIndex: 0 | 1 | 2 | 3;
  mimeType?: string;
  /**
   * Where the frame came from. Used by the backend to weight confidence:
   *   - `scanner`       → calibrated 4-LED rig, full confidence
   *   - `phone-studio`  → guided 4-shot phone capture (ambient/flash/tilt/back)
   *   - `phone-quick`   → 2-shot phone triage (front + back ambient)
   */
  source?: CaptureSource;
}

export type CaptureSource = "scanner" | "phone-studio" | "phone-quick";

/** Maps a phone-capture step to the `lightIndex` slot the backend expects. */
export interface PhoneCaptureStep {
  index: 0 | 1 | 2 | 3;
  side: "front" | "back";
  flash: boolean;
  tilt: "flat" | "top" | "bottom";
  /** Short instruction shown over the camera preview. */
  instruction: string;
  /** One-word badge shown above the shutter (e.g. "Ambient", "Flash"). */
  label: string;
}
