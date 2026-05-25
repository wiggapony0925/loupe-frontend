/**
 * LoupeAPI — namespaced view of the entire `@/api` surface.
 *
 * Lets callers use a single dotted entry point:
 *
 *   import { LoupeAPI } from "@/api";
 *
 *   const overview = LoupeAPI.useAnalyticsOverview();
 *   const url      = LoupeAPI.endpoints.cards.item(id);
 *   const card     = await LoupeAPI.apiFetch(LoupeAPI.endpoints.cards.item(id));
 *   LoupeAPI.queryClient.invalidateQueries({ queryKey: LoupeAPI.queryKeys.analytics.all });
 *
 * Functionally identical to the named exports in `./index.ts` — pick
 * whichever style you prefer at the call site. The shape mirrors how a
 * future standalone `@loupe/api` package would be consumed, so migrating
 * later (if/when a second consumer appears) is a find-and-replace, not a
 * rewrite.
 */

import { ApiProvider, useApi } from "./ApiProvider";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import {
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
import * as schemas from "@/infrastructure/http/schemas";
import { queryClient } from "@/application/queries/queryClient";
import { queryKeys } from "@/application/queries/queryKeys";

import * as authRepository from "@/infrastructure/repositories/authRepository";
import * as analyticsRepository from "@/infrastructure/repositories/analyticsRepository";
import * as homeRepository from "@/infrastructure/repositories/homeRepository";
import * as marketRepository from "@/infrastructure/repositories/marketRepository";
import * as forensicRepository from "@/infrastructure/repositories/forensicRepository";
import * as scanRepository from "@/infrastructure/repositories/scanRepository";

import * as queries from "@/application/queries";

export const LoupeAPI = {
  // React context
  ApiProvider,
  useApi,

  // URL registry (alias both names for ergonomics)
  endpoints: ENDPOINTS,
  ENDPOINTS,

  // HTTP client
  apiFetch,
  apiFetchEnvelope,
  apiUrl,
  apiBaseUrl,
  getApiBaseUrl,
  setAuthToken,
  getAuthToken,
  setRefreshHandler,
  refreshAccessToken,
  ApiError,

  // TanStack Query plumbing
  queryClient,
  queryKeys,

  // Zod schemas (LoupeAPI.schemas.AnalyticsOverviewSchema)
  schemas,

  // Repositories (LoupeAPI.repos.analytics.fetchAnalyticsOverview())
  repos: {
    auth: authRepository,
    analytics: analyticsRepository,
    home: homeRepository,
    market: marketRepository,
    forensic: forensicRepository,
    scan: scanRepository,
  },

  // Query hooks spread at the top level so calls read naturally:
  //   LoupeAPI.useAnalyticsOverview()
  //   LoupeAPI.useCard(id)
  ...queries,
} as const;

export type LoupeAPIType = typeof LoupeAPI;
