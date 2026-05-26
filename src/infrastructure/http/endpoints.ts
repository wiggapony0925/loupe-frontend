/**
 * Single source of truth for loupe-backend HTTP paths.
 * Mirrors routes defined in github.com/wiggapony0925/loupe-backend.
 *
 * Versioned API surface is mounted under `/v1`; system endpoints
 * (`/health`, `/version`, `/metrics`) sit at the root.
 */

const V1 = "/v1";

export const ENDPOINTS = {
  system: {
    health: "/health",
    version: "/version",
  },
  auth: {
    register: `${V1}/auth/register`,
    login: `${V1}/auth/login`,
    devLogin: `${V1}/auth/dev-login`,
    apple: `${V1}/auth/apple`,
    google: `${V1}/auth/google`,
    refresh: `${V1}/auth/refresh`,
    logout: `${V1}/auth/logout`,
  },
  me: {
    root: `${V1}/me`,
    settings: `${V1}/me/settings`,
    grades: `${V1}/grades`,
  },
  scanners: {
    list: `${V1}/scanners`,
    item: (id: string) => `${V1}/scanners/${id}`,
    heartbeat: (id: string) => `${V1}/scanners/${id}/heartbeat`,
  },
  scans: {
    list: `${V1}/scans`,
    item: (id: string) => `${V1}/scans/${id}`,
    complete: (id: string) => `${V1}/scans/${id}/complete`,
  },
  cards: {
    search: `${V1}/cards/search`,
    trending: `${V1}/cards/trending`,
    item: (id: string) => `${V1}/cards/${id}`,
    prices: (id: string) => `${V1}/cards/${id}/prices`,
    market: (id: string) => `${V1}/cards/${id}/market`,
    listings: (id: string) => `${V1}/cards/${id}/listings`,
    comps: (id: string) => `${V1}/cards/${id}/comps`,
    gradeSummary: (id: string) => `${V1}/cards/${id}/grade-summary`,
    marketplacePrices: (id: string) => `${V1}/cards/${id}/marketplace-prices`,
    canonical: (id: string) => `${V1}/cards/${id}/canonical`,
    resolve: `${V1}/cards/resolve`,
  },
  sets: {
    list: `${V1}/sets`,
    progress: `${V1}/sets/progress`,
  },
  grades: {
    mine: `${V1}/grades`,
    item: (id: string) => `${V1}/grades/${id}`,
    summary: `${V1}/grades/summary`,
    history: `${V1}/grades/history`,
    sparklines: `${V1}/grades/sparklines`,
  },
  collections: {
    list: `${V1}/collections`,
    item: (id: string) => `${V1}/collections/${id}`,
  },
  providers: {
    status: `${V1}/providers/status`,
  },
  alerts: {
    list: `${V1}/alerts`,
    create: `${V1}/alerts`,
    item: (id: string) => `${V1}/alerts/${id}`,
  },
  reports: {
    list: `${V1}/reports`,
    upcoming: `${V1}/reports/upcoming`,
    create: `${V1}/reports`,
    item: (id: string) => `${V1}/reports/${id}`,
    download: (id: string) => `${V1}/reports/${id}/download`,
    file: (id: string) => `${V1}/reports/${id}/file`,
  },
  market: {
    indexHistory: (indexId: string) =>
      `${V1}/market/indices/${indexId}/history`,
  },
  ws: {
    scans: "/ws/scans",
  },
  appConfig: {
    get: `${V1}/app/config`,
  },
  home: {
    feed: `${V1}/home/feed`,
  },
  analytics: {
    overview: `${V1}/analytics/overview`,
  },
  sealed: {
    search: `${V1}/sealed/search`,
    item: (id: string) => `${V1}/sealed/${id}`,
  },
  sealedHoldings: {
    mine: `${V1}/sealed-holdings`,
    create: `${V1}/sealed-holdings`,
    item: (id: string) => `${V1}/sealed-holdings/${id}`,
  },
} as const;
