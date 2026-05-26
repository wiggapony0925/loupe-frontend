/**
 * Envelope-aware fetch wrapper for loupe-backend `/v1`.
 *
 * Base URL resolution (in order):
 *   1. `EXPO_PUBLIC_API_URL` env var (bundle time) — set via `.env` locally
 *      and via `eas env:create production` for EAS builds.
 *   2. Hard-coded `PRODUCTION_API_BASE` constant below — guarantees that
 *      release builds (`__DEV__ === false`) always have a working URL even
 *      if the env var was lost during the build pipeline. This is what
 *      prevents `TypeError: Network request failed` from misconfigurations.
 *   3. `http://localhost:8000` — only in dev builds (`__DEV__`) when no
 *      env var is set (Metro dev server on a simulator).
 *
 * Optional fallback retries are disabled by default. To enable, set both:
 *   EXPO_PUBLIC_ENABLE_API_FALLBACK=true
 *   EXPO_PUBLIC_API_URL_FALLBACK=http://localhost:8000
 *
 * All `/v1/*` responses ship the universal envelope
 *   { data, meta, pagination, error }
 * (see loupe-backend/CONTRACT.md §2). `apiFetch` auto-unwraps to `data`;
 * `apiFetchEnvelope` returns the full envelope when you need `meta` /
 * `pagination`. On non-2xx the envelope's `error` block is parsed into a
 * typed {@link ApiError}.
 */

import type { Envelope, ErrorDetail } from "./envelope";

const env = (process.env ?? {}) as Record<string, string | undefined>;

/**
 * The canonical Cloud Run URL for the production backend. Baked into the
 * bundle so release builds work even if the EAS env var is missing.
 * Update this constant if the Cloud Run service URL ever changes.
 */
const PRODUCTION_API_BASE = "https://loupe-api-714615078104.us-central1.run.app";

function resolveApiBase(): string {
  const fromEnv = env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv;
  // No env var. In a release/TestFlight build, always use the hard-coded
  // production URL — never silently fall back to localhost (which is the
  // failure mode that caused the original `Network request failed` cascade
  // on TestFlight: build had no env var, defaulted to localhost, device
  // had nothing listening on 8000).
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    return "http://localhost:8000";
  }
  return PRODUCTION_API_BASE;
}

const PRIMARY_API_BASE: string = resolveApiBase();
const ENABLE_API_FALLBACK: boolean =
  (env.EXPO_PUBLIC_ENABLE_API_FALLBACK ?? "false").toLowerCase() === "true";
const FALLBACK_API_BASE: string =
  ENABLE_API_FALLBACK && env.EXPO_PUBLIC_API_URL_FALLBACK
    ? env.EXPO_PUBLIC_API_URL_FALLBACK
    : "";

// Loud startup log so any TestFlight build can be diagnosed by reading the
// device console: connect device to Mac, open Console.app, filter on
// `[apiFetch]`. Shows up exactly once per app launch.
// eslint-disable-next-line no-console
console.log(
  "[apiFetch] init base=",
  PRIMARY_API_BASE,
  "envProvided=",
  Boolean(env.EXPO_PUBLIC_API_URL),
  "dev=",
  typeof __DEV__ !== "undefined" && __DEV__,
);

// Mutable so we can sticky-switch after a successful fallback.
let activeApiBase: string = PRIMARY_API_BASE;

/** Current base URL in use (may switch at runtime if primary becomes unreachable). */
export function getApiBaseUrl(): string {
  return activeApiBase;
}

/** Back-compat export — points to the *initial* configured base. */
export const apiBaseUrl: string = PRIMARY_API_BASE;

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

/**
 * Called by `apiFetchEnvelope` on a 401 from an authenticated request.
 * Should attempt to mint a new access token (e.g. via the refresh-token
 * endpoint), call {@link setAuthToken} with the new value, and resolve
 * to the new token. Resolve to `null` to indicate refresh failed — the
 * original 401 will then propagate to the caller.
 *
 * Registered by `AuthProvider`; not coupled to it from this module so
 * the client stays UI-free.
 */
export type RefreshHandler = () => Promise<string | null>;

let refreshHandler: RefreshHandler | null = null;
let inflightRefresh: Promise<string | null> | null = null;

export function setRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler;
}

/**
 * Trigger the registered {@link RefreshHandler}, deduping concurrent
 * callers so we only hit `/auth/refresh` once even when many requests
 * race to 401. Resolves to the new access token, or `null` when no
 * handler is registered / refresh failed.
 *
 * Exported so other low-level HTTP wrappers (e.g. `apiClient.ts`) can
 * share the same single-flight refresh state.
 */
export async function refreshAccessToken(): Promise<string | null> {
  return runRefresh();
}

async function runRefresh(): Promise<string | null> {
  if (!refreshHandler) return null;
  // Serialize concurrent 401s so we only hit /auth/refresh once.
  if (!inflightRefresh) {
    inflightRefresh = refreshHandler().finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

export function apiUrl(path: string, base: string = activeApiBase): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export type QueryValue = string | number | boolean | undefined;

/**
 * Minimal subset of the zod `ZodType` shape so this module stays
 * zod-version-agnostic and we don't pay an extra dependency cost at
 * import time. Any object exposing `.safeParse()` satisfies this.
 */
export interface WireSchema<T> {
  safeParse(input: unknown):
    | { success: true; data: T }
    | { success: false; error: unknown };
}

export interface ApiFetchInit extends Omit<RequestInit, "body"> {
  body?: BodyInit | null;
  json?: unknown;
  query?: Record<string, QueryValue>;
  skipAuth?: boolean;
  /**
   * Optional runtime schema (e.g. a zod schema) applied to `envelope.data`
   * before the value is returned. On a validation failure we capture the
   * zod issue list to Sentry and throw an `ApiError` with
   * `code: "schema.invalid"`. Recommended for every endpoint long-term.
   */
  schema?: WireSchema<unknown>;
  /** Internal — set by the 401-retry path to prevent infinite refresh loops. */
  _retriedAfterRefresh?: boolean;
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
  const { json, query, skipAuth, headers, body, _retriedAfterRefresh, ...rest } =
    init;
  const qs = buildQuery(query);

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

  // Try the active base first; on a transport-level failure (e.g. iOS sim can't
  // reach Cloud Run because of CGNAT / Private Relay / VPN routing) retry once
  // against the fallback base, then sticky-switch for subsequent requests.
  const bases: string[] = [activeApiBase];
  if (FALLBACK_API_BASE && FALLBACK_API_BASE !== activeApiBase) {
    bases.push(FALLBACK_API_BASE);
  }

  let res: Response | null = null;
  let lastErr: unknown = null;
  let usedBase = activeApiBase;
  for (const base of bases) {
    const url = apiUrl(path, base) + qs;
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[apiFetch]", rest.method ?? "GET", url, "(base:", base, ")");
    }
    try {
      res = await fetch(url, { ...rest, headers: finalHeaders, body: finalBody });
      usedBase = base;
      break;
    } catch (e) {
      lastErr = e;
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log("[apiFetch] FETCH THREW:", String(e), "url=", url);
      }
      // Only fall through to the next base on a true network failure.
      // (Aborts and other RequestInit-level errors also surface as TypeError,
      // so we just try the next base unconditionally if one exists.)
    }
  }
  if (!res) {
    throw lastErr ?? new Error("apiFetch: no response and no error captured");
  }
  if (usedBase !== activeApiBase) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[apiFetch] switching active base ->", usedBase);
    }
    activeApiBase = usedBase;
  }
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
    // Authenticated request returned 401 — try a one-shot refresh + retry
    // before surfacing the error. Skips this dance when the caller opted
    // out of auth, when we have nothing to refresh, or when we've
    // already retried once for this request.
    if (
      res.status === 401 &&
      !skipAuth &&
      !_retriedAfterRefresh &&
      refreshHandler
    ) {
      const fresh = await runRefresh();
      if (fresh) {
        return apiFetchEnvelope<T>(path, {
          ...init,
          _retriedAfterRefresh: true,
        });
      }
    }
    const fb: ErrorDetail = {
      code: `http.${res.status}`,
      message: `${res.status} ${res.statusText || "error"} (${path})`,
      status: res.status,
      field: null,
      details: parsed,
    };
    const err: ErrorDetail = isEnvelope(parsed) && parsed.error ? parsed.error : fb;
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
 * `envelope.data`. Throws {@link ApiError} on non-2xx. When `init.schema`
 * is provided, the unwrapped payload is validated and a validation
 * failure is surfaced as `ApiError` with `code: "schema.invalid"`.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: ApiFetchInit = {},
): Promise<T> {
  const envelope = await apiFetchEnvelope<T>(path, init);
  const raw = envelope.data;
  if (init.schema) {
    const result = init.schema.safeParse(raw);
    if (!result.success) {
      throw new ApiError(path, {
        code: "schema.invalid",
        message: "Response failed runtime validation",
        status: 200,
        details: result.error,
      });
    }
    return result.data as T;
  }
  return raw as T;
}
