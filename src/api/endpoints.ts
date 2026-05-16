/**
 * Single source of truth for loupe-backend HTTP paths.
 * Mirrors routes defined in github.com/wiggapony0925/loupe-backend.
 */

export const ENDPOINTS = {
  auth: {
    apple: "/auth/apple",
    google: "/auth/google",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
  },
  me: {
    root: "/me",
    settings: "/me/settings",
  },
  scanners: {
    list: "/scanners",
    item: (id: string) => `/scanners/${id}`,
    heartbeat: (id: string) => `/scanners/${id}/heartbeat`,
  },
  scans: {
    list: "/scans",
    item: (id: string) => `/scans/${id}`,
    complete: (id: string) => `/scans/${id}/complete`,
  },
  cards: {
    search: "/cards/search",
    item: (id: string) => `/cards/${id}`,
    prices: (id: string) => `/cards/${id}/prices`,
  },
  sets: {
    list: "/sets",
  },
  grades: {
    mine: "/me/grades",
    item: (id: string) => `/grades/${id}`,
  },
  collections: {
    list: "/collections",
    item: (id: string) => `/collections/${id}`,
  },
  ws: {
    scans: "/ws/scans",
  },
} as const;
