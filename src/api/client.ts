/**
 * Envelope-aware fetch wrapper for loupe-backend `/v1`.
 *
 * Reads `EXPO_PUBLIC_API_URL` at bundle time, defaults to localhost:8000.
 *
 * All `/v1/*` responses ship the universal envelope
 *   { data, meta, pagination, error }
 * (see loupe-backend/CONTRACT.md §2). `apiFetch` auto-unwraps to `data`;
 * `apiFetchEnvelope` returns the full envelope when you need `meta` /
 * `pagination`. On non-2xx the envelope's `error` block is parsed into a
 * typed {@link ApiError}.
 */

import type { Envelope, ErrorDetail } from "./types";

const env = (process.env ?? {}) as Record<string, string | undefined>;

export const apiBaseUrl: string = env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  code: string;
  status: number;
  field?: string;
  details?: unknown;
  requestId?: string;
  path: string;

  constructor(
    path: string,
    opts: {
      code: string;
      message: string;
      status: number;
      field?: string;
      details?: unknown;
      requestId?: string;
    },
  ) {
    super(opts.message);
    this.name = "ApiError";
    this.path = path;
    this.code = opts.code;
    this.status = opts.status;
    this.field = opts.field;
    this.details = opts.details;
    this.requestId = opts.requestId;
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export type QueryValue = string | number | boolean | undefined;

export interface ApiFetchInit extends Omit<RequestInit, "body"> {
  body?: BodyInit | null;
  json?: unknown;
  query?: Record<string, QueryValue>;
  skipAuth?: boolean;
}

function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

function isEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return "meta" in v && ("data" in v || "error" in v);
}

/**
 * Issue a request and return the full `Envelope<T>`. Use this when you
 * need `meta` / `pagination`; otherwise prefer {@link apiFetch}.
 */
export async function apiFetchEnvelope<T = unknown>(
  path: string,
  init: ApiFetchInit = {},
): Promise<Envelope<T>> {
  const { json, query, skipAuth, headers, body, ...rest } = init;
  const url = apiUrl(path) + buildQuery(query);

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...((headers as Record<string, string>) ?? {}),
  };

  let finalBody: BodyInit | null | undefined = body;
  if (json !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    finalBody = JSON.stringify(json);
  }
  if (!skipAuth && authToken) {
    finalHeaders.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(url, { ...rest, headers: finalHeaders, body: finalBody });
  const requestIdHeader = res.headers.get("x-request-id") ?? undefined;

  if (res.status === 204) {
    return {
      data: null,
      meta: {
        request_id: requestIdHeader ?? "",
        timestamp: new Date().toISOString(),
        version: "v1",
        duration_ms: null,
      },
      pagination: null,
      error: null,
    };
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const rawText = await res.text().catch(() => "");
  let parsed: unknown = rawText;
  if (isJson && rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      /* keep raw text */
    }
  }

  if (!res.ok) {
    const fallback: ErrorDetail = {
      code: `http.${res.status}`,
      message: `${res.status} ${res.statusText || "error"} (${path})`,
      status: res.status,
      field: null,
      details: parsed,
    };
    const err: ErrorDetail = isEnvelope(parsed) && parsed.error ? parsed.error : fallback;
    throw new ApiError(path, {
      code: err.code,
      message: err.message,
      status: err.status ?? res.status,
      field: err.field ?? undefined,
      details: err.details,
      requestId:
        (isEnvelope(parsed) ? parsed.meta?.request_id : undefined) ?? requestIdHeader,
    });
  }

  if (isEnvelope(parsed)) {
    return parsed as Envelope<T>;
  }
  // Endpoint did not envelope (system endpoints, signed URLs). Synthesize.
  return {
    data: parsed as T,
    meta: {
      request_id: requestIdHeader ?? "",
      timestamp: new Date().toISOString(),
      version: "v1",
      duration_ms: null,
    },
    pagination: null,
    error: null,
  };
}

/**
 * Convenience wrapper around {@link apiFetchEnvelope} that unwraps to
 * `envelope.data`. Throws {@link ApiError} on non-2xx.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: ApiFetchInit = {},
): Promise<T> {
  const envelope = await apiFetchEnvelope<T>(path, init);
  return envelope.data as T;
}
