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
    apple: `${V1}/auth/apple`,
    google: `${V1}/auth/google`,
    refresh: `${V1}/auth/refresh`,
    logout: `${V1}/auth/logout`,
  },
  me: {
    root: `${V1}/me`,
    settings: `${V1}/me/settings`,
    grades: `${V1}/me/grades`,
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
    item: (id: string) => `${V1}/cards/${id}`,
    prices: (id: string) => `${V1}/cards/${id}/prices`,
  },
  sets: {
    list: `${V1}/sets`,
  },
  grades: {
    mine: `${V1}/me/grades`,
    item: (id: string) => `${V1}/grades/${id}`,
  },
  collections: {
    list: `${V1}/collections`,
    item: (id: string) => `${V1}/collections/${id}`,
  },
  ws: {
    scans: "/ws/scans",
  },
} as const;
