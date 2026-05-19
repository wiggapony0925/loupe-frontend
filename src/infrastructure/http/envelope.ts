/**
 * Universal API envelope — every `/v1/*` response is wrapped in this shape.
 * Mirrors `loupe-backend/CONTRACT.md`.
 */

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

/** Narrowed envelope variant for the happy path. */
export interface ApiSuccess<T> extends Envelope<T> {
  data: T;
  error: null;
}
