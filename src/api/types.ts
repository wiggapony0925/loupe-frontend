/**
 * Loupe API wire types — frozen `v1` shapes mirroring loupe-backend/CONTRACT.md.
 *
 * Keys are `snake_case` (matches the wire). Do not edit these by hand
 * without updating CONTRACT.md in lock-step.
 */

// ─── Universal envelope ────────────────────────────────────────────────

export interface Meta {
  request_id: string;
  timestamp: string;
  version: string;
  duration_ms: number | null;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  next_cursor: string | null;
  prev_cursor: string | null;
}

export interface ErrorDetail {
  code: string;
  message: string;
  status: number;
  field: string | null;
  details: unknown | null;
}

export interface Envelope<T = unknown> {
  data: T | null;
  meta: Meta;
  pagination: Pagination | null;
  error: ErrorDetail | null;
}

export interface ApiSuccess<T> extends Envelope<T> {
  data: T;
  error: null;
}

// ─── Common atoms ──────────────────────────────────────────────────────

export type ID = string;
export type ISODate = string;
export type Currency = string;
export type Tcg = "pokemon" | "magic" | "yugioh" | "onepiece" | "lorcana" | "sports";
export type ScanAngle = "front" | "back" | "top" | "bottom" | "left" | "right";
export type GradeHouse = "psa" | "cgc" | "bgs" | "sgc" | "tag" | "loupe";
export type ScannerTransport = "ble" | "wifi" | "offline";
export type ScanSource = "scanner" | "phone";
export type ScanStatus = "queued" | "uploading" | "processing" | "complete" | "failed";
/** Decimal money/grade serialized by Pydantic as a string. Coerce with `Number(x)` at the call site. */
export type DecimalString = string;

export interface Money {
  amount: number;
  currency: Currency;
}

export interface ImageAsset {
  url: string;
  width: number | null;
  height: number | null;
  alt?: string | null;
}

export interface ImageSet {
  small: ImageAsset | null;
  normal: ImageAsset | null;
  large: ImageAsset | null;
  art_crop?: ImageAsset | null;
}

// ─── 17 frozen entities ────────────────────────────────────────────────

// Mirrors UserRead in app/schemas/user.py.
export interface User {
  id: ID;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: ISODate;
}

// Mirrors UserSettingsRead in app/schemas/user.py.
export interface UserSettings {
  currency: Currency;
  theme: "system" | "light" | "dark";
  live_sync_enabled: boolean;
  push_notifications_enabled: boolean;
  updated_at: ISODate | null;
}

// Mirrors ScannerRead in app/schemas/scanner.py.
export interface Scanner {
  id: ID;
  device_id: string;
  name: string | null;
  firmware_version: string | null;
  transport: ScannerTransport;
  is_active: boolean;
  last_seen_at: ISODate | null;
  created_at: ISODate;
}

export interface CardSet {
  id: ID;
  tcg: Tcg;
  code: string;
  name: string;
  release_date: ISODate | null;
  card_count: number | null;
  logo_url: string | null;
  source: string;
}

export interface Card {
  id: ID;
  tcg: Tcg;
  name: string;
  number: string | null;
  rarity: string | null;
  set_id: ID | null;
  set_name: string | null;
  set_code: string | null;
  image_url: string | null;
  images: ImageSet | null;
  year: number | null;
  source: string;
}

export interface PricingSummary {
  card_id: ID;
  currency: Currency;
  low: number | null;
  mid: number | null;
  high: number | null;
  market: number | null;
  updated_at: ISODate | null;
  source: string | null;
}

export interface PricePoint {
  ts: ISODate;
  price: number;
  currency: Currency;
  source: string;
}

export interface PriceHistory {
  card_id: ID;
  currency: Currency;
  points: PricePoint[];
  granularity: "daily" | "weekly" | "monthly";
}

export interface SubgradeDetail {
  score: number;
  confidence: number | null;
  notes: string | null;
}

export interface Subgrades {
  centering: SubgradeDetail | null;
  corners: SubgradeDetail | null;
  edges: SubgradeDetail | null;
  surface: SubgradeDetail | null;
}

// Mirrors GradedCardRead in app/schemas/grade.py.
// NOTE: `grade` and `estimated_value_usd` are Pydantic Decimals → JSON strings.
// Coerce with `Number(grade.grade)` before doing arithmetic / .toFixed().
export interface GradedCard {
  id: ID;
  user_id: ID;
  card_id: ID;
  scan_job_id: ID | null;
  grade: DecimalString;
  house: GradeHouse;
  subgrades: Record<string, unknown> | null;
  estimated_value_usd: DecimalString | null;
  fingerprint_hash: string | null;
  notes: string | null;
  graded_at: ISODate;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface FingerprintSummary {
  card_id: ID;
  hash: string;
  algorithm: "phash" | "dhash" | "ahash";
  similarity: number | null;
  matched_card_id: ID | null;
}

// Mirrors ScanJobRead in app/schemas/scan.py.
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

// Mirrors CollectionRead in app/schemas/collection.py.
export interface Collection {
  id: ID;
  user_id: ID;
  name: string;
  description: string | null;
  color: string | null;
  is_public: boolean;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface CollectionItem {
  id: ID;
  collection_id: ID;
  graded_card_id: ID;
  note: string | null;
  added_at: ISODate;
}

export interface ApiKey {
  id: ID;
  user_id: ID;
  label: string;
  prefix: string;
  last_used_at: ISODate | null;
  expires_at: ISODate | null;
  created_at: ISODate;
  revoked_at: ISODate | null;
}

export interface AuditLogEntry {
  id: ID;
  user_id: ID | null;
  action: string;
  target_type: string | null;
  target_id: ID | null;
  ip_address: string | null;
  user_agent: string | null;
  occurred_at: ISODate;
  metadata: Record<string, unknown> | null;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
  user: User;
}

// ─── WebSocket envelope ────────────────────────────────────────────────

export interface WsFrame<T = unknown> {
  type: string;
  ts: ISODate;
  request_id: string;
  data: T;
}

export interface WsHello {
  user_id: ID;
}

export interface WsScanProgress {
  scan_id: ID;
  status: ScanJob["status"];
  progress: number;
  angle?: ScanAngle;
}

export interface WsScanFailed {
  scan_id: ID;
  reason: string;
  code: string;
}

// ─── Legacy/composite response shapes (still emitted by some endpoints) ─

/** Alias kept for back-compat with existing screens. Prefer `Tcg`. */
export type TcgKey = Tcg;

export interface CardSearchResult {
  id: string;
  name: string;
  tcg: TcgKey;
  set_name?: string;
  set_code?: string;
  number?: string;
  rarity?: string;
  image_url?: string;
  year?: number;
  source: string;

  /* ── Rich fields emitted by the multi-provider catalog service ── */
  images?: ImageSet | null;
  attributes?: Record<string, unknown>;
  pricing_summary?: PricingSummaryWire | null;
  set?: RichCardSet | null;
  tags?: string[];
  metadata?: { source: string; last_synced_at: string; confidence: number };
}

/** Wire shape of `pricing_summary`: bands are `Money` objects, not plain numbers. */
export interface PricingSummaryWire {
  card_id: string;
  currency: Currency;
  market: Money | null;
  low: Money | null;
  mid: Money | null;
  high: Money | null;
  as_of: string | null;
  sample_size: number | null;
  sources: string[] | null;
}

/** Wire shape of the inline `set` block on rich card responses. */
export interface RichCardSet {
  id: string | null;
  code: string | null;
  name: string | null;
  series: string | null;
  release_date: string | null;
  printed_total: number | null;
  total_cards: number | null;
  logo: ImageAsset | null;
  symbol: ImageAsset | null;
}

/** Wire shape of `/v1/cards/{id}/prices` response. */
export interface PriceHistoryWire {
  card_id: string;
  currency: Currency;
  points: PricePoint[];
  granularity: "daily" | "weekly" | "monthly";
  range: string;
  house?: string;
  grade?: string;
  summary: {
    min: number | null;
    max: number | null;
    avg: number | null;
    current: number | null;
    change_pct: number | null;
    n_points: number;
  };
}

export interface CardSearchResponse {
  results: CardSearchResult[];
  total: number;
  source: string;
  error?: string;
}

export interface TrendingResponseWire {
  cards: CardSearchResult[];
  updated_at: string;
  source: "live" | "cached" | "fallback";
}

export interface CardSetSummary {
  id: string;
  code?: string;
  name?: string;
  tcg: TcgKey;
  release_date?: string;
  total_cards?: number;
  image_url?: string;
  source: string;
}

export interface CardSetListResponse {
  results: CardSetSummary[];
  total: number;
  source: string;
  error?: string;
}

// Mirrors UserRead returned by GET /v1/me.
export interface MeResponse {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface HealthResponse {
  status: string;
  uptime_seconds?: number;
  version?: string;
}

export interface ScanProgressEvent {
  scan_id: string;
  status: "queued" | "processing" | "complete" | "failed";
  progress: number;
  message?: string;
}

// ─── Market snapshot wire shapes (GET /v1/cards/{id}/market) ───────────

export type HouseId = "psa" | "cgc" | "bgs" | "sgc" | "tag";

export interface MarketSummaryWire {
  raw: Money | null;
  graded_avg: Money | null;
  pop_top: Money | null;
  pop_total: number;
  change_pct_1y: number;
  last_sale_at: string | null;
  primary_house: HouseId | string;
}

export interface HouseGradeRowWire {
  house: HouseId | string;
  grade: number;
  grade_label: string;
  population: number;
  market: Money;
  change_pct: number;
  last_sale_at: string | null;
  listing_url: string | null;
  source?: "real" | "synthesized";
}

export interface HouseBlockWire {
  house: HouseId | string;
  pop_total: number;
  grades: HouseGradeRowWire[];
}

export interface MarketSnapshotWire {
  summary: MarketSummaryWire;
  history: Record<string, PriceHistoryWire>;
  houses: HouseBlockWire[];
  tiers_total: number;
}

export interface MarketResponseWire {
  card_id: string;
  snapshot: MarketSnapshotWire;
}

// ---------------------------------------------------------------------------
// Live listings (`GET /v1/cards/{id}/listings`)
// ---------------------------------------------------------------------------

export interface GradeWire {
  company: string;
  value: number;
}

// Mirrors ListingWire in app/schemas/listings.py.
export interface ListingWire {
  source: string;
  title: string;
  price: Money;
  url: string;
  condition: string | null;
  image_url: string | null;
  is_auction: boolean;
  time_left_seconds: number | null;
}

export interface ListingsResponseWire {
  card_id: string;
  query: string;
  listings: ListingWire[];
}

// ---------------------------------------------------------------------------
// Sold comps (`GET /v1/cards/{id}/comps`)
// ---------------------------------------------------------------------------

// Mirrors SoldCompWire in app/schemas/comps.py.
export interface SoldCompWire {
  source: string;
  title: string;
  price: Money;
  sold_at: string;
  condition: string | null;
  grade: string | null;
  house: string | null;
  url: string | null;
  image_url: string | null;
}

// Mirrors CompsFilters in app/schemas/comps.py.
export interface CompsFiltersWire {
  grade: string | null;
  house: string | null;
}

export interface CompsResponseWire {
  card_id: string;
  query: string;
  days: number;
  filters: CompsFiltersWire;
  comps: SoldCompWire[];
}

// ---------------------------------------------------------------------------
// Provider status (`GET /v1/providers/status`)
// ---------------------------------------------------------------------------

export interface ProviderStatusWire {
  id: string;
  configured: boolean;
  capabilities: Record<string, boolean>;
}

export interface ProvidersStatusResponseWire {
  providers: ProviderStatusWire[];
}
