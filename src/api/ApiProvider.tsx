/**
 * ApiProvider — single, shallow React context that exposes every cross-cutting
 * handle needed to talk to loupe-backend.
 *
 * The HTTP/repository/query layers are still the source of truth (one wrapper
 * in `infrastructure/http/client.ts`, one URL registry in `endpoints.ts`, one
 * repo per domain, one hook per endpoint via TanStack Query). This provider
 * just gives the UI a single, discoverable place to grab those handles
 * without reaching into `src/infrastructure/...`.
 *
 *   const { endpoints, apiFetch, queryClient, apiUrl } = useApi();
 *
 * Future cross-cutting concerns (global request counter, toast bus, request
 * interceptors) can hang off this context without touching the wrapper.
 */
import React, { createContext, useContext, useMemo } from "react";
import { QueryClient, useQueryClient } from "@tanstack/react-query";

import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import {
  ApiError,
  apiFetch,
  apiFetchEnvelope,
  apiUrl,
  getApiBaseUrl,
  getAuthToken,
  setAuthToken,
} from "@/infrastructure/http/client";

export interface ApiContextValue {
  /** Centralized URL registry — every backend path lives here. */
  readonly endpoints: typeof ENDPOINTS;
  /** Envelope-unwrapping fetch (auto auth + 401 refresh + schema validation). */
  readonly apiFetch: typeof apiFetch;
  /** Same as apiFetch but returns full `{ data, meta, pagination }` envelope. */
  readonly apiFetchEnvelope: typeof apiFetchEnvelope;
  /** Resolve a path against the active base URL. */
  readonly apiUrl: typeof apiUrl;
  /** Current base URL (may sticky-switch on transport failure). */
  readonly getApiBaseUrl: typeof getApiBaseUrl;
  /** Read/replace the in-memory bearer token. AuthProvider already manages this. */
  readonly setAuthToken: typeof setAuthToken;
  readonly getAuthToken: typeof getAuthToken;
  /** TanStack QueryClient (cache + invalidation). */
  readonly queryClient: QueryClient;
  /** Typed error class for instanceof checks. */
  readonly ApiError: typeof ApiError;
}

const ApiContext = createContext<ApiContextValue | null>(null);

interface Props {
  children: React.ReactNode;
}

/**
 * Mount inside <QueryClientProvider>. AppProviders already does this.
 */
export function ApiProvider({ children }: Props) {
  const queryClient = useQueryClient();
  const value = useMemo<ApiContextValue>(
    () => ({
      endpoints: ENDPOINTS,
      apiFetch,
      apiFetchEnvelope,
      apiUrl,
      getApiBaseUrl,
      setAuthToken,
      getAuthToken,
      queryClient,
      ApiError,
    }),
    [queryClient],
  );

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

/**
 * Access every API handle from one place.
 *
 *   const { endpoints, apiFetch, queryClient } = useApi();
 *   const card = await apiFetch(endpoints.cards.item(id));
 */
export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) {
    throw new Error("useApi() must be used inside <ApiProvider>");
  }
  return ctx;
}
