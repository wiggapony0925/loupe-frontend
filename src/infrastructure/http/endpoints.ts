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
    /** Deep, TRUE-paginated catalog search (`?q&tcg&page&page_size&sort`).
     *  Unlike `/cards/search` (a capped top-N typeahead), this walks the
     *  provider's own pagination so every printing of a popular name is
     *  reachable — Pikachu 177, Charizard 400+ — with a real `total`. */
    search: `${V1}/public/search`,
    /** AI "describe it" search (`?q&limit`) — Loupe Pro; auth required.
     *  402 (code=ai_search_pro) → open the paywall. */
    searchAi: `${V1}/cards/search/ai`,
    /** Backend-owned discovery carousels (`?game=<tcg>`) — the curated shelf
     *  pool (upgraded to AI when configured) that BOTH web and mobile render,
     *  so the marketplace carousels stay in sync. Public, no auth. */
    carousels: `${V1}/public/carousels`,
    /** Carousels ALREADY resolved into cards server-side (`?game=<tcg>`) — the
     *  recipe pool run against the shelf/catalog, empty rails dropped. Both
     *  clients render this identically (no client-side filtering). */
    carouselsResolved: `${V1}/public/carousels/resolved`,
    /** One carousel EXPANDED (`?id&game&page&page_size`) — the same recipe
     *  lens run over the deep pool with true pagination. Backs the search
     *  page's "view more" rail-filter tag. `game=all` only for `trending`. */
    carouselRail: `${V1}/public/carousels/rail`,
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
    /** Full owned/missing checklist for one set — backs the set-progress sheet. */
    checklist: (setId: string) => `${V1}/sets/${encodeURIComponent(setId)}/checklist`,
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
    overview: `${V1}/collections/overview`,
    item: (id: string) => `${V1}/collections/${id}`,
    items: (id: string) => `${V1}/collections/${id}/items`,
    itemsBulk: (id: string) => `${V1}/collections/${id}/items/bulk`,
    itemsBulkRemove: (id: string) => `${V1}/collections/${id}/items/bulk-remove`,
    itemsTransfer: (id: string) => `${V1}/collections/${id}/items/transfer`,
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
    indexHistory: (indexId: string) => `${V1}/market/indices/${indexId}/history`,
  },
  ws: {
    scans: "/ws/scans",
    /** Live `price.tick` frames for the cards the user owns. */
    prices: "/ws/prices",
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
