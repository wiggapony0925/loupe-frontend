/**
 * The words on Loupe's front door.
 *
 * loupe-web's `MarketingLanding` and the Expo app's `(auth)/welcome` screen
 * both render these, so a pitch change lands on the site and in the app at
 * once instead of drifting into two half-updated versions.
 */

/** Hero copy — the headline block above the fold on both clients. */
export const HERO = {
  eyebrow: "Loupe · Forensic Card Intelligence",
  /** Two lines; clients join or stack them as their layout needs. */
  headline: ["Your cards are an asset.", "Trade them like one."] as const,
  /**
   * The same words, pre-broken for phone widths.
   *
   * At hero size the first sentence can't fit one line on a ~390pt screen, and
   * letting it wrap on its own strands "asset." alone. These breaks are chosen
   * rather than inherited.
   */
  headlineNarrow: [
    "Your cards",
    "are an asset.",
    "Trade them like one.",
  ] as const,
  sub: "Track every card like a position. Real-time prices, grade-aware valuations, and a vault that tracks your collection like a portfolio — on the web and in your pocket.",
  /** For phone widths, where the full sub runs to six lines above the fold. */
  subShort:
    "Real-time prices, grade-aware valuations, and a vault that tracks your collection like a portfolio.",
  disclaimer: "Live market data. No mock numbers — ever.",
  ctaPrimary: "Browse cards",
  ctaSecondary: "Get started — free",
} as const;

/**
 * The product's three promises. `icon` is a key, not a component — the web
 * maps it to `lucide-react` and the app to `lucide-react-native`.
 */
export const FEATURES = [
  {
    icon: "scan",
    title: "Scan & identify",
    desc: "Point your camera — we ID the card and its live price.",
  },
  {
    icon: "trending",
    title: "Track your vault",
    desc: "Every card valued like a position in your portfolio.",
  },
  {
    icon: "grade",
    title: "Grade before you slab",
    desc: "Estimate centering, edges & surface in seconds.",
  },
] as const;

export type MarketingFeature = (typeof FEATURES)[number];

/**
 * The dead end.
 *
 * A 404 is the one screen a user reaches by accident, so the words have to do
 * the work the layout can't: say plainly that nothing is broken on their end,
 * and offer the two places worth going. Shared so the site and the app own up
 * to a bad link in the same voice — a stale push notification and a stale
 * bookmark should not read as two different products.
 *
 * `ctaBrowse` is deliberately generic ("the market", not "/cards") because the
 * destination differs per client: the web has a catalog route, the app has a
 * Search tab.
 */
export const NOT_FOUND = {
  code: "404",
  title: "This page got away from us",
  message:
    "The page you're looking for doesn't exist or may have moved. Let's get you back on track.",
  ctaHome: "Back home",
  ctaBrowse: "Browse the market",
  /** Shown instead of `ctaHome` when there's no session to go home to. */
  ctaSignedOut: "Go to sign in",
} as const;

