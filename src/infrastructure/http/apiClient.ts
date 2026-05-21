import { config } from "@/shared/config";
import { auth } from "@/infrastructure/storage/tokenStorage";
// Single source of truth for the JWT lives in `@/infrastructure/http/client`
// (set by AuthProvider). Older code paths still call `auth.setToken` from
// the token storage, so we fall back to it if the canonical store is empty.
// `refreshAccessToken` is the shared single-flight refresh hook so this
// wrapper picks up the same rotation behaviour as `apiFetchEnvelope`.
import {
  getAuthToken,
  refreshAccessToken,
} from "@/infrastructure/http/client";

/**
 * Envelope shape mirrors loupe-backend/CONTRACT.md §2. Inlined here so
 * this module stays self-contained for callers that hit both the API
 * and signed-URL hosts (forensicApi, scanJobs, marketApi).
 */
interface EnvelopeShape<T = unknown> {
  data: T | null;
  meta: {
    request_id: string;
    timestamp: string;
    version: string;
    duration_ms: number | null;
  };
  pagination: unknown | null;
  error: {
    code: string;
    message: string;
    status: number;
    field: string | null;
    details: unknown | null;
  } | null;
}

function isEnvelope(value: unknown): value is EnvelopeShape {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return "meta" in v && ("data" in v || "error" in v);
}

export class ApiError extends Error {
  code: string;
  requestId?: string;
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
    code: string = `http.${status}`,
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.requestId = requestId;
  }
}

type RequestOptions = Omit<RequestInit, "body" | "headers"> & {
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
  /** Override base URL (e.g. signed S3 URLs). Defaults to config.apiUrl. */
  baseUrl?: string;
  /** Internal: prevents infinite refresh loops on the 401-retry path. */
  _retriedAfterRefresh?: boolean;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const {
    json,
    headers = {},
    baseUrl = config.apiUrl,
    _retriedAfterRefresh,
    ...rest
  } = opts;

  const token = getAuthToken() ?? auth.getToken();
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  let body = opts.body;
  if (json !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: finalHeaders,
    body,
  });

  const requestIdHeader = res.headers.get("x-request-id") ?? undefined;
  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    // Mirror `apiFetchEnvelope`: one-shot refresh + retry on 401 for
    // authenticated requests. Only attempts refresh when we actually
    // sent a bearer token and haven't already retried this request.
    if (res.status === 401 && token && !_retriedAfterRefresh) {
      const fresh = await refreshAccessToken();
      if (fresh) {
        return request<T>(path, { ...opts, _retriedAfterRefresh: true });
      }
    }
    const text = await res.text().catch(() => "");
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw text */
    }
    if (isEnvelope(parsed) && parsed.error) {
      const e = parsed.error;
      throw new ApiError(
        e.status ?? res.status,
        e.message,
        e.details ?? parsed,
        e.code,
        parsed.meta?.request_id ?? requestIdHeader,
      );
    }
    throw new ApiError(
      res.status,
      `${res.status} ${res.statusText}`,
      parsed,
      `http.${res.status}`,
      requestIdHeader,
    );
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  if (isJson) {
    const parsed: unknown = await res.json();
    if (isEnvelope(parsed)) return parsed.data as T;
    return parsed as T;
  }
  return (await res.text()) as unknown as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: "POST" }),
  patch: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: "PATCH" }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
