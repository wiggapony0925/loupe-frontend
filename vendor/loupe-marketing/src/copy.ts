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

