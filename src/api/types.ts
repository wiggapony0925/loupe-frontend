/**
 * Shared API response types mirroring the loupe-backend unified shapes.
 * Keep narrow — only what hooks/screens consume.
 */

export type TcgKey =
  | "pokemon"
  | "magic"
  | "yugioh"
  | "onepiece"
  | "lorcana"
  | "sports";

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
}

export interface CardSearchResponse {
  results: CardSearchResult[];
  total: number;
  source: string;
  error?: string;
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

export interface MeResponse {
  id: string;
  email?: string;
  display_name?: string;
  created_at?: string;
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
