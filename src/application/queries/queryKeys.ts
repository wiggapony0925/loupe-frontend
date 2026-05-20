/**
 * React-Query key factory.
 *
 * Single source of truth for every query key in the app. Use these
 * instead of inlining tuple literals — guarantees consistent shape,
 * makes bulk invalidation trivial (`queryKeys.cards.all`), and lets
 * cache surgery tooling refactor keys safely.
 *
 * Pattern: each domain exposes `.all` (the prefix tuple used for
 * `invalidateQueries({ queryKey: queryKeys.cards.all })`) plus
 * specific builders that extend it.
 */
import type { TcgKey } from "@/infrastructure/http";

type TcgOrAll = TcgKey | "all";

export const queryKeys = {
  system: {
    all: ["system"] as const,
    health: () => ["system", "health"] as const,
    providersStatus: () => ["providers", "status"] as const,
  },
  me: {
    all: ["me"] as const,
    profile: () => ["me"] as const,
    grades: () => ["me", "grades"] as const,
  },
  portfolio: {
    all: ["portfolio"] as const,
    summary: () => ["portfolio", "summary"] as const,
    history: (timeframe: string) => ["portfolio", "history", timeframe] as const,
    sparklines: () => ["portfolio", "sparklines"] as const,
  },
  cards: {
    all: ["cards"] as const,
    item: (id: string) => ["cards", "item", id] as const,
    search: (tcg: TcgOrAll, q: string, limit: number) =>
      ["cards", "search", tcg, q, limit] as const,
    trending: (tcg: TcgOrAll, limit: number) =>
      ["cards", "trending", tcg, limit] as const,
    market: (id: string) => ["cards", "market", id] as const,
    listings: (id: string, limit: number) =>
      ["cards", "listings", id, limit] as const,
    comps: (
      id: string,
      days: number,
      grade?: number | null,
      house?: string | null,
      limit?: number | null,
    ) =>
      [
        "cards",
        "comps",
        id,
        days,
        grade ?? null,
        house ?? null,
        limit ?? null,
      ] as const,
    priceHistory: (
      id: string,
      range: string,
      house: string,
      grade?: string | number | null,
    ) => ["card-prices", id, range, house, grade ?? null] as const,
  },
  sets: {
    all: ["sets"] as const,
    list: (tcg: TcgOrAll) => ["sets", tcg] as const,
    progress: () => ["sets", "progress"] as const,
  },
  scans: {
    all: ["scans"] as const,
    mine: () => ["scans", "mine"] as const,
  },
  scanners: {
    all: ["scanners"] as const,
    list: () => ["scanners"] as const,
  },
  collection: {
    all: ["collection"] as const,
    list: () => ["collection"] as const,
  },
  alerts: {
    all: ["alerts"] as const,
    list: (pending: boolean) => ["alerts", "list", pending] as const,
  },
  marketIndex: {
    all: ["market-index"] as const,
    history: (indexId: string, range: string) =>
      ["market-index", indexId, range] as const,
  },
} as const;
