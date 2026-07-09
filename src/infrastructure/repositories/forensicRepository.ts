/**
 * Forensic / vault API — all real, no mocks.
 *
 * Talks exclusively to the FastAPI backend. Functions adapt the wire
 * shapes (snake_case, ISO datetimes, Decimal strings) into the camelCase
 * domain types the UI consumes. If a field isn't available from the
 * backend we surface `null` — we never fabricate values.
 */
import type { CollectionCard, HardwareStatus, PricePoint } from "@/domain";
import { apiFetch } from "@/infrastructure/http/client";
import {
  AppConfigSchema,
  GradedCardListSchema,
  PortfolioSummarySchema,
} from "@/infrastructure/http/schemas";
import type { PortfolioSummaryWire } from "@/infrastructure/http";

/* ─── Wire shapes (mirror loupe-backend/app/schemas) ─────────────────── */

interface GradedCardWire {
  id: string;
  user_id: string;
  card_id: string;
  scan_job_id: string | null;
  grade: string; // Decimal as string
  house: string;
  /** `nm | lp | mp | hp | dmg`; non-null only for raw/ungraded rows. */
  condition: string | null;
  subgrades: Record<string, unknown> | null;
  estimated_value_usd: string | null;
  fingerprint_hash: string | null;
  notes: string | null;
  tags?: string[] | null;
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
    cardId: g.card_id,
    title: g.card_name ?? "Unknown card",
    set: (g.card_set_name ?? "Unknown set") as CollectionCard["set"],
    year: g.card_year ?? 0,
    grade: Number(g.grade),
    house: g.house,
    condition: (g.condition ?? null) as CollectionCard["condition"],
    estimatedValueUsd: g.estimated_value_usd ? Number(g.estimated_value_usd) : 0,
    thumbnailUri: g.card_image_url ?? "",
    scannedAt: g.graded_at,
    tags: g.tags ?? [],
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
  const wire = await apiFetch<ScannerWire | null>("/v1/scanners/status");
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
  const wire = await apiFetch<ScannerWire>("/v1/scanners", {
    method: "POST",
    json: {
      device_id: input.deviceId,
      name: input.name ?? null,
      firmware_version: input.firmwareVersion ?? null,
      transport: input.transport ?? "ble",
    },
  });
  return toHardwareStatus(wire);
}

export interface CollectionQueryParams {
  /** Free-text search across card + set name. */
  q?: string;
  /** Exact set-name filter (matches `card_set_name` from the backend). */
  set?: string;
  /** Grading-house slug(s) (`loupe`, `psa`, `bgs`, …) — repeated for multi. */
  houses?: string[];
  /** Minimum grade (inclusive). */
  minGrade?: number;
  /** Maximum grade (inclusive). */
  maxGrade?: number;
  /** Minimum estimated value USD (inclusive). */
  minValue?: number;
  /** Maximum estimated value USD (inclusive). */
  maxValue?: number;
  /** User tags — ANY match, repeated per tag. */
  tags?: string[];
  /** `recent` | `oldest` | `value_desc` | `value_asc` | `grade_desc` | `grade_asc`. */
  sort?: string;
  /** Page offset (rows to skip). */
  cursor?: number;
  /** Page size (rows). Backend caps at 1000. */
  limit?: number;
}

export async function fetchCollection(params?: CollectionQueryParams): Promise<CollectionCard[]> {
  // Serialize only the keys the caller actually supplied so we don't
  // push `set=undefined` over the wire — keeps the URL tidy and the
  // query-key stable across React renders.
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.set) search.set("set", params.set);
  for (const h of params?.houses ?? []) search.append("house", h);
  for (const t of params?.tags ?? []) search.append("tags", t);
  if (params?.minGrade !== undefined && params.minGrade > 0)
    search.set("min_grade", String(params.minGrade));
  if (params?.maxGrade !== undefined && params.maxGrade < 10)
    search.set("max_grade", String(params.maxGrade));
  if (params?.minValue !== undefined) search.set("min_value", String(params.minValue));
  if (params?.maxValue !== undefined) search.set("max_value", String(params.maxValue));
  if (params?.sort) search.set("sort", params.sort);
  if (params?.cursor !== undefined && params.cursor > 0)
    search.set("cursor", String(params.cursor));
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString();
  const url = qs ? `/v1/grades?${qs}` : "/v1/grades";
  const wire = await apiFetch<GradedCardWire[]>(url, {
    schema: GradedCardListSchema,
  });
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
  /**
   * Cost-basis aggregates. `null` until the user records a purchase
   * price on at least one card; UI must hide P/L chip in that case
   * rather than show "+$0.00 (+0%)".
   */
  totalCostUsd: number | null;
  costBasisCardCount: number;
  unrealizedPnlUsd: number | null;
  unrealizedPnlPct: number | null;
  /**
   * Vault aggregates moved to the server so the Vault header renders
   * without downloading the full collection. Optional because older
   * backend deployments may not return them — callers must fall back
   * to client-side computation when these are missing.
   */
  uniqueCardCount?: number;
  loupeGradedCount?: number;
  availableSets?: string[];
  /** Distinct user tags across the vault — powers the filter sheet + tag editor. */
  availableTags?: string[];
}

export async function fetchCollectionSummary(
  collectionId?: string | null,
): Promise<CollectionSummary> {
  return apiFetch<PortfolioSummaryWire>("/v1/grades/summary", {
    schema: PortfolioSummarySchema,
    // Scope the top-line totals to the active collection when one is set —
    // the backend sums only that collection's holdings. Omit for "All".
    query: collectionId ? { collection_id: collectionId } : undefined,
  });
}

/**
 * Soft-delete a graded card from the user's vault. Backend returns 204
 * with an empty body; we resolve to void on success and let `apiFetch`'s
 * standard error handling bubble up otherwise.
 *
 * `gradeId` is the row id of the `graded_cards` entry (not the canonical
 * card id) — i.e. `CollectionCard.id`, not `CollectionCard.cardId`.
 */
export async function deleteGradedCard(gradeId: string): Promise<void> {
  await apiFetch<void>(`/v1/grades/${gradeId}`, { method: "DELETE" });
}

/* ─── Portfolio history & sparklines ─────────────────────────────────── */

export type PortfolioRange = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

export interface PortfolioHistory {
  range: PortfolioRange;
  points: PricePoint[];
  deltaUsd: number;
  deltaPct: number;
}

export async function fetchPortfolioHistory(range: PortfolioRange): Promise<PortfolioHistory> {
  const wire = await apiFetch<PortfolioHistoryWire>(
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
  return apiFetch<CardSparklineWire[]>("/v1/grades/sparklines");
}

/* ─── remote app config (feature flags / min version / SDUI) ─────────── */

export interface AppConfig {
  minSupportedVersion: string;
  forceUpdate: boolean;
  flags: Record<string, boolean>;
  homeRails: string[];
}

/**
 * Fetches the live remote config from the backend. Cheap GET, intended
 * to be cached aggressively (TanStack staleTime ~5 min) and persisted
 * across launches so the app boots offline-tolerant.
 */
export async function fetchAppConfig(clientVersion?: string): Promise<AppConfig> {
  const qs = clientVersion ? `?clientVersion=${encodeURIComponent(clientVersion)}` : "";
  return apiFetch<AppConfig>(`/v1/app/config${qs}`, { schema: AppConfigSchema });
}
