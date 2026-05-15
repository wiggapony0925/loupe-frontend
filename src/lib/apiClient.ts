import { config } from "./config";
import { auth } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body" | "headers"> & {
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
  /** Override base URL (e.g. signed S3 URLs). Defaults to config.apiUrl. */
  baseUrl?: string;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { json, headers = {}, baseUrl = config.apiUrl, ...rest } = opts;

  const token = auth.getToken();
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

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw text */
    }
    throw new ApiError(res.status, `${res.status} ${res.statusText}`, parsed);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: "POST" }),
  patch: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: "PATCH" }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
