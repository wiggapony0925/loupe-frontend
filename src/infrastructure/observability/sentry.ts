/**
 * Sentry observability — graceful no-op when DSN is missing so dev
 * builds without credentials never crash.
 *
 * `initSentry()` is called once from `app/_layout.tsx`. The other helpers
 * are safe to call even before init (they short-circuit).
 */

import Constants from "expo-constants";

import type { NormalizedError } from "@/shared/errors";

type SentryModule = typeof import("@sentry/react-native");

let sentry: SentryModule | null = null;
let initialized = false;

function getDsn(): string | undefined {
  // EXPO_PUBLIC_* is inlined at bundle time; Constants.expoConfig?.extra is a fallback.
  const env = (process.env ?? {}) as Record<string, string | undefined>;
  const fromEnv = env.EXPO_PUBLIC_SENTRY_DSN;
  if (fromEnv) return fromEnv;
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const fromExtra = extra.sentryDsn;
  return typeof fromExtra === "string" && fromExtra ? fromExtra : undefined;
}

export function initSentry(): void {
  if (initialized) return;
  const dsn = getDsn();
  if (!dsn) return;
  try {
    // Lazy require so the no-DSN path never pays the import cost.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require("@sentry/react-native") as SentryModule;
    sentry.init({
      dsn,
      tracesSampleRate: __DEV__ ? 1.0 : 0.1,
      enableAutoSessionTracking: true,
      attachStacktrace: true,
    });
    initialized = true;
  } catch {
    sentry = null;
    initialized = false;
  }
}

/**
 * Capture an error already classified by `normalizeError`. No-ops if Sentry
 * isn't initialized (missing DSN or pre-init).
 */
export function captureNormalizedError(
  err: unknown,
  normalized: NormalizedError,
): void {
  if (!sentry) return;
  try {
    sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      tags: { code: normalized.code },
      extra: { technical: normalized.technical, message: normalized.message },
    });
  } catch {
    /* swallow — observability must never crash the app */
  }
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
  if (!sentry) return;
  try {
    sentry.captureMessage(message, level);
  } catch {
    /* swallow */
  }
}

/**
 * Capture an HTTP failure surfaced by the `apiFetch` wrapper. Skips
 * 401s (auth failures are user-recoverable noise) and aborts. Tags the
 * event with HTTP status / endpoint / request-id for fast triage in
 * Sentry's UI.
 */
export function captureApiError(
  err: unknown,
  context: {
    path: string;
    method: string;
    status?: number;
    code?: string;
    requestId?: string;
  },
): void {
  if (!sentry) return;
  // Don't pollute Sentry with auth-required signals — the UI already
  // handles them via the refresh flow / re-login prompt.
  if (context.status === 401) return;
  // AbortError is intentional cancellation (e.g. screen unmount).
  if (err instanceof Error && err.name === "AbortError") return;
  try {
    sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      tags: {
        source: "apiFetch",
        endpoint: context.path,
        method: context.method,
        http_status: context.status?.toString() ?? "unknown",
        error_code: context.code ?? "unknown",
      },
      extra: {
        requestId: context.requestId,
      },
    });
  } catch {
    /* swallow */
  }
}

