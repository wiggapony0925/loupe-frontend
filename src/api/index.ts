/**
 * `@/api` — single import surface for everything backend-related.
 *
 *   import {
 *     useApi,            // context hook (endpoints, apiFetch, queryClient, …)
 *     ENDPOINTS,         // URL registry
 *     useAnalyticsOverview, useHomeFeed, useCard, …  // TanStack Query hooks
 *     fetchHomeFeed, fetchAnalyticsOverview, …       // repo functions
 *     AnalyticsOverviewSchema,                       // zod validators
 *     ApiError,                                      // typed errors
 *   } from "@/api";
 *
 * UI code should never reach into `@/infrastructure/...` or
 * `@/application/queries/...` directly — import from `@/api` instead.
 */

// ── React context + provider ────────────────────────────────────────────────
export { ApiProvider, useApi } from "./ApiProvider";
export type { ApiContextValue } from "./ApiProvider";

// ── HTTP layer (registry, client, schemas, envelope, atoms) ─────────────────
export { ENDPOINTS } from "@/infrastructure/http/endpoints";
export {
  ApiError,
  apiFetch,
  apiFetchEnvelope,
  apiUrl,
  apiBaseUrl,
  getApiBaseUrl,
  setAuthToken,
  getAuthToken,
  setRefreshHandler,
  refreshAccessToken,
} from "@/infrastructure/http/client";
export type {
  ApiFetchInit,
  QueryValue,
  RefreshHandler,
  WireSchema,
} from "@/infrastructure/http/client";
export type {
  Envelope,
  ApiSuccess,
  ErrorDetail,
  Meta,
  Pagination,
} from "@/infrastructure/http/envelope";
export * from "@/infrastructure/http/schemas";

// ── TanStack Query plumbing ─────────────────────────────────────────────────
export { queryClient } from "@/application/queries/queryClient";
export { queryKeys } from "@/application/queries/queryKeys";

// ── Repositories (data access by domain) ────────────────────────────────────
export * as authRepository from "@/infrastructure/repositories/authRepository";
export * as analyticsRepository from "@/infrastructure/repositories/analyticsRepository";
export * as homeRepository from "@/infrastructure/repositories/homeRepository";
export * as marketRepository from "@/infrastructure/repositories/marketRepository";
export * as forensicRepository from "@/infrastructure/repositories/forensicRepository";
export * as scanRepository from "@/infrastructure/repositories/scanRepository";

// ── Query hooks (one per endpoint) ──────────────────────────────────────────
export * from "@/application/queries";
