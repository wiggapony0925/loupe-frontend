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
  /** Public global announcement banner (no auth) — set in the dev dashboard. */
  announcement: `${V1}/announcement`,
  auth: {
    register: `${V1}/auth/register`,
    login: `${V1}/auth/login`,
    devLogin: `${V1}/auth/dev-login`,
    apple: `${V1}/auth/apple`,
    google: `${V1}/auth/google`,
    refresh: `${V1}/auth/refresh`,
    logoutAll: `${V1}/auth/logout-all`,
    changePassword: `${V1}/auth/change-password`,
    forgotPassword: `${V1}/auth/forgot-password`,
  },
  publicCatalog: {
    /** Batch price sparklines for catalog ids (`?ids=a,b,c`) — one call
     *  prices a whole scan cart; the last point of each series is the
     *  card's current market price. Public, no auth. */
    sparklines: `${V1}/public/sparklines`,
  },
  me: {
    root: `${V1}/me`,
    settings: `${V1}/me/settings`,
    grades: `${V1}/grades`,
    recents: `${V1}/me/recents`,
    pushTokens: `${V1}/me/push-tokens`,
    pushToken: (token: string) => `${V1}/me/push-tokens/${encodeURIComponent(token)}`,
    /** Loupe Pro — computed entitlements + Stripe billing. */
    entitlements: `${V1}/me/entitlements`,
    billingConfig: `${V1}/me/billing/config`,
    billingCheckout: `${V1}/me/billing/checkout`,
    billingPortal: `${V1}/me/billing/portal`,
    billingCancel: `${V1}/me/billing/cancel`,
    billingReactivate: `${V1}/me/billing/reactivate`,
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
    analytics: (id: string) => `${V1}/cards/${id}/analytics`,
    ownership: (id: string) => `${V1}/cards/${id}/ownership`,
    listings: (id: string) => `${V1}/cards/${id}/listings`,
    nearbyListings: (id: string) => `${V1}/cards/${id}/nearby-listings`,
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
  watchlist: {
    list: `${V1}/watchlist`,
    add: `${V1}/watchlist`,
    item: (cardId: string) => `${V1}/watchlist/${cardId}`,
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
    fxRates: `${V1}/market/fx/rates`,
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
    market: (id: string) => `${V1}/sealed/${id}/market`,
  },
  sealedHoldings: {
    mine: `${V1}/sealed-holdings`,
    create: `${V1}/sealed-holdings`,
    item: (id: string) => `${V1}/sealed-holdings/${id}`,
  },
} as const;
