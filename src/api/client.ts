/**
 * Tiny, dependency-free fetch wrapper for the Loupe backend
 * (https://github.com/wiggapony0925/loupe-backend).
 *
 * Reads `EXPO_PUBLIC_API_URL` at bundle time, defaults to localhost:8000.
 */

const env = (process.env ?? {}) as Record<string, string | undefined>;

export const apiBaseUrl: string =
  env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  detail?: unknown;
  path: string;

  constructor(status: number, path: string, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
    this.detail = detail;
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

export async function apiFetch<T = unknown>(
  path: string,
  init: ApiFetchInit = {},
): Promise<T> {
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

  const res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: finalBody,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail: unknown = text || undefined;
    try {
      detail = text ? JSON.parse(text) : undefined;
    } catch {
      /* keep raw text */
    }
    const message = `${res.status} ${res.statusText} (${path})`;
    if (res.status >= 500) {
      // eslint-disable-next-line no-console
      console.warn(`[apiFetch] ${message}`, detail);
    }
    throw new ApiError(res.status, path, message, detail);
  }

  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}
