/**
 * Typed route builders for expo-router.
 *
 * Centralizes every navigation target so:
 *   • IDs are URL-encoded consistently (no more `router.push(`/card/${id}`)`
 *     drifting from `router.push(`/card/${encodeURIComponent(id)}`)`).
 *   • Path renames flow through a single edit instead of a repo-wide
 *     text replace.
 *   • Query params are validated at the call site via TS union types.
 *
 * Conventions:
 *   - Pure builders return a `Href`-compatible string.
 *   - Callers wrap with `router.push(routes.card(id))`. We deliberately
 *     do NOT wrap `router.push` itself so call sites keep working with
 *     `router.replace`, `router.back`, `Link`, etc.
 */

export type ScanPhoneMode = "quick" | "studio";

const enc = (s: string): string => encodeURIComponent(s);

export const routes = {
  home: () => "/" as const,
  vault: () => "/vault" as const,
  analytics: () => "/analytics" as const,
  settings: () => "/settings" as const,
  notifications: () => "/notifications" as const,
  /** Deep link to the standalone price-alert list. */
  watchlist: () => "/watchlist" as const,
  card: (id: string) => `/card/${enc(id)}`,
  /** Legacy alias. Market data now lives on the unified card detail page. */
  market: (id: string) => `/card/${enc(id)}`,
  scan: (id: string) => `/scan/${enc(id)}`,
  scanPhone: (mode?: ScanPhoneMode) =>
    mode ? `/scan/phone?mode=${mode}` : "/scan/phone",
  /**
   * Live PriceCharting-style identification viewfinder. Continuous
   * OCR loop with a candidate carousel pinned to the bottom. `tcg`
   * pre-selects a TCG hint when the user launched from a filtered
   * surface (e.g. the Pokémon search facet).
   */
  scanIdentify: (tcg?: "pokemon" | "magic" | "yugioh") =>
    tcg ? `/scan/identify?tcg=${tcg}` : "/scan/identify",
  /**
   * Add a card to the user's vault without scanning.
   *
   * Pre-fills the form with a catalog card when `cardId` (resolved
   * local UUID) or `upstreamId` (composite like `"pokemontcg:base1-4"`)
   * is provided. With no params the user picks the card from inside
   * the form.
   */
  gradeNew: (params: {
    cardId?: string;
    upstreamId?: string;
    cardName?: string;
    cardImage?: string;
    cardSet?: string;
    cardYear?: number;
  } = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}=${enc(String(v))}`)
      .join("&");
    return qs ? `/grade/new?${qs}` : "/grade/new";
  },
  /** Edit an existing holding by its grade UUID. */
  gradeEdit: (id: string) => `/grade/${enc(id)}`,
  /**
   * Sealed product picker / add-to-vault screen. When a `productId`
   * is supplied the form pre-selects that catalog row so search-rail
   * tap-throughs land one step closer to saving.
   */
  sealedAdd: (productId?: string) =>
    productId ? `/sealed/add?productId=${enc(productId)}` : "/sealed/add",
  compare: (a?: string, b?: string) => {
    const params = [a && `a=${enc(a)}`, b && `b=${enc(b)}`]
      .filter(Boolean)
      .join("&");
    return params ? `/compare?${params}` : "/compare";
  },
} as const;
