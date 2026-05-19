/**
 * Forensic / vault API — all real, no mocks.
 *
 * Talks exclusively to the FastAPI backend. Functions adapt the wire
 * shapes (snake_case, ISO datetimes, Decimal strings) into the camelCase
 * domain types the UI consumes. If a field isn't available from the
 * backend we surface `null` — we never fabricate values.
 */
import type {
  CollectionCard,
  ForensicReport,
  HardwareStatus,
  PricePoint,
} from "@/domain";
import { ApiError, api } from "@/infrastructure/http/apiClient";

/* ─── Wire shapes (mirror loupe-backend/app/schemas) ─────────────────── */

interface GradedCardWire {
  id: string;
  user_id: string;
  card_id: string;
  scan_job_id: string | null;
  grade: string; // Decimal as string
  house: string;
  subgrades: Record<string, unknown> | null;
  estimated_value_usd: string | null;
  fingerprint_hash: string | null;
  notes: string | null;
  graded_at: string;
  created_at: string;
  updated_at: string;
  card_name: string | null;
  card_image_url: string | null;
  card_number: string | null;
  card_set_name: string | null;
  card_year: number | null;
  card_tcg: string | null;
}

interface ScannerWire {
  id: string;
  device_id: string;
  name: string | null;
  firmware_version: string | null;
  transport: string; // "wifi" | "ble" | "wired" | ...
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

interface PortfolioSummaryWire {
  totalValueUsd: number;
  cardCount: number;
  avgGrade: number | null;
  avgAccuracy: number | null;
}

interface PortfolioHistoryWire {
  range: PortfolioRange;
  points: { date: string; priceUsd: number }[];
  deltaUsd: number;
  deltaPct: number;
}

interface CardSparklineWire {
  cardId: string;
  points: number[];
  deltaPct: number;
}

/* ─── Adapters ───────────────────────────────────────────────────────── */

function toCollectionCard(g: GradedCardWire): CollectionCard {
  // CollectionCard.set is currently a tight literal union; we widen at the
  // boundary because the backend can return arbitrary set names.
  return {
    id: g.id,
    title: g.card_name ?? "Unknown card",
    set: (g.card_set_name ?? "Unknown set") as CollectionCard["set"],
    year: g.card_year ?? 0,
    grade: Number(g.grade),
    estimatedValueUsd: g.estimated_value_usd ? Number(g.estimated_value_usd) : 0,
    thumbnailUri: g.card_image_url ?? "",
    scannedAt: g.graded_at,
  };
}

function toHardwareStatus(s: ScannerWire): HardwareStatus {
  const transport: HardwareStatus["transport"] =
    s.transport === "ble" || s.transport === "wifi" ? s.transport : "offline";
  return {
    transport,
    deviceName: s.name ?? s.device_id,
    firmware: s.firmware_version ?? "—",
    lastSeenAt: s.last_seen_at,
    // The backend doesn't expose live telemetry yet — surface as null so
    // the UI knows to render "—" rather than fabricate a value.
    signalStrength: null,
    scansRemaining: null,
    temperatureC: null,
  };
}

/* ─── Endpoints ──────────────────────────────────────────────────────── */

export async function fetchHardwareStatus(): Promise<HardwareStatus | null> {
  const wire = await api.get<ScannerWire | null>("/v1/scanners/status");
  return wire ? toHardwareStatus(wire) : null;
}

export interface PairScannerInput {
  deviceId: string;
  name?: string | null;
  firmwareVersion?: string | null;
  transport?: "ble" | "wifi";
}

/**
 * Registers a freshly-discovered scanner against the signed-in user's
 * account. The native bridge returns the device id + firmware after a
 * successful BLE handshake; we mirror that into the backend so
 * `/v1/scanners/status` will start returning it.
 */
export async function pairScanner(input: PairScannerInput): Promise<HardwareStatus> {
  const wire = await api.post<ScannerWire>("/v1/scanners", {
    json: {
      device_id: input.deviceId,
      name: input.name ?? null,
      firmware_version: input.firmwareVersion ?? null,
      transport: input.transport ?? "ble",
    },
  });
  return toHardwareStatus(wire);
}

export async function fetchCollection(): Promise<CollectionCard[]> {
  const wire = await api.get<GradedCardWire[]>("/v1/grades");
  return wire.map(toCollectionCard);
}

export interface CollectionSummary {
  totalValueUsd: number;
  cardCount: number;
  /** Average grade across the user's vault. `null` when the vault is empty. */
  avgGrade: number | null;
  /**
   * Backend cannot yet compute scan accuracy (would require ground-truth
   * comparisons). Always `null` for now — UI should hide or render "—".
   */
  avgAccuracy: number | null;
}

export async function fetchCollectionSummary(): Promise<CollectionSummary> {
  return api.get<PortfolioSummaryWire>("/v1/grades/summary");
}

export async function fetchReport(_id: string): Promise<ForensicReport> {
  // Backend has not yet shipped a forensic report endpoint. Refuse to
  // fabricate one — surface a clear error so the UI can render an empty
  // state rather than fake confidence numbers.
  throw new ApiError(
    501,
    "Forensic reports are not yet available from the backend.",
    null,
    "report.unavailable",
  );
}

/* ─── Portfolio history & sparklines ─────────────────────────────────── */

export type PortfolioRange = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

export interface PortfolioHistory {
  range: PortfolioRange;
  points: PricePoint[];
  deltaUsd: number;
  deltaPct: number;
}

export async function fetchPortfolioHistory(
  range: PortfolioRange,
): Promise<PortfolioHistory> {
  const wire = await api.get<PortfolioHistoryWire>(
    `/v1/grades/history?range=${encodeURIComponent(range)}`,
  );
  return {
    range: wire.range,
    points: wire.points.map((p) => ({ date: p.date, priceUsd: p.priceUsd })),
    deltaUsd: wire.deltaUsd,
    deltaPct: wire.deltaPct,
  };
}

export interface CardSparkline {
  cardId: string;
  /** Last N price samples for the card. May be empty if no history yet. */
  points: number[];
  /** Pct change between the first and last points (0 when flat/empty). */
  deltaPct: number;
}

export async function fetchCardSparklines(): Promise<CardSparkline[]> {
  return api.get<CardSparklineWire[]>("/v1/grades/sparklines");
}
