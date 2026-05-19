/**
 * Error normalization — map raw fetch/network/ApiError into a single
 * `NormalizedError` shape that UI components can render predictably.
 *
 * Pairs with `ErrorState`/`QueryBoundary`/`RetryButton`. Also calls into
 * Sentry for the unrecoverable classes (server / unknown).
 */

import { ApiError } from "@/infrastructure/http/client";
import { captureNormalizedError } from "@/infrastructure/observability/sentry";

export type AppErrorCode =
  | "offline"
  | "timeout"
  | "server"
  | "client"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "parse"
  | "unknown";

export interface NormalizedError {
  code: AppErrorCode;
  message: string;
  technical?: string;
  retryable: boolean;
  retryAfterMs?: number;
}

const FRIENDLY: Record<AppErrorCode, string> = {
  offline: "You appear to be offline.",
  timeout: "The request took too long. Try again.",
  server: "Our servers are having a moment.",
  client: "We couldn't complete that request.",
  unauthorized: "Please sign in to continue.",
  forbidden: "You don't have access to this.",
  not_found: "We couldn't find that.",
  rate_limited: "Too many requests — give it a sec.",
  parse: "We received an unexpected response.",
  unknown: "Something went wrong.",
};

function isAbortError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: string; message?: string };
  return e.name === "AbortError" || /abort/i.test(e.message ?? "");
}

function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { message?: string; name?: string };
  const m = (e.message ?? "").toLowerCase();
  return (
    e.name === "TypeError" &&
    (m.includes("network") ||
      m.includes("failed to fetch") ||
      m.includes("load failed"))
  );
}

export function isOffline(err: unknown): boolean {
  return isNetworkError(err);
}

function fromStatus(status: number): AppErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  if (status >= 400) return "client";
  return "unknown";
}

export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof ApiError) {
    const code = fromStatus(err.status);
    const normalized: NormalizedError = {
      code,
      message: FRIENDLY[code],
      technical: `${err.code}: ${err.message}`,
      retryable: code === "server" || code === "timeout" || code === "rate_limited",
    };
    if (code === "server" || code === "unknown") {
      captureNormalizedError(err, normalized);
    }
    return normalized;
  }

  if (isAbortError(err)) {
    return { code: "timeout", message: FRIENDLY.timeout, retryable: true };
  }

  if (isNetworkError(err)) {
    return { code: "offline", message: FRIENDLY.offline, retryable: true };
  }

  if (err instanceof SyntaxError) {
    return {
      code: "parse",
      message: FRIENDLY.parse,
      technical: err.message,
      retryable: true,
    };
  }

  const message = err instanceof Error ? err.message : String(err ?? "");
  const normalized: NormalizedError = {
    code: "unknown",
    message: FRIENDLY.unknown,
    technical: message || undefined,
    retryable: true,
  };
  captureNormalizedError(err, normalized);
  return normalized;
}
