/**
 * Deterministic fallback walks — **not authoritative data**.
 *
 * Used only for visual continuity when a chart has no real history yet
 * (e.g. a brand-new card with no comps, or a `TopMovers` placeholder).
 *
 * RULES for callers:
 * 1. Never render a numeric `+x.xx%` delta chip from a fallback walk —
 *    the value is fabricated, the chip would lie to the user.
 * 2. The line color may still derive from the walk's direction; that's
 *    a visual hint, not a claim about market truth.
 * 3. Prefer real data from `useCardSparklines` / `usePortfolioHistory`
 *    whenever it's available, regardless of how flat it looks.
 */

/**
 * Tiny non-cryptographic PRNG seeded by a string. FNV-1a → LCG.
 * Returns floats in `[0, 1)`. Same `seedKey` ⇒ same sequence forever.
 */
function makeSeededRand(seedKey: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    h ^= seedKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let seed = (h >>> 0) || 1;
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

/**
 * Deterministic price walk anchored to `anchor` as the final value.
 *
 * - Output length is `length` (default 24).
 * - Output is always at least 2 values long; passing `length < 2` is clamped.
 * - First value sits in `[0.85, 0.95] * anchor`.
 * - Each step drifts by `±~3.5%`.
 * - Floor: `anchor * 0.5` (no negative prices).
 * - **Last value is exactly `anchor`** so the visible right-edge price
 *   matches whatever "current value" UI displays beside it.
 */
export function seededWalk(
  seedKey: string,
  anchor: number,
  length = 24,
): number[] {
  const len = Math.max(2, Math.floor(length));
  const rand = makeSeededRand(seedKey);
  const out: number[] = new Array(len);
  let price = anchor * (0.85 + rand() * 0.1);
  out[0] = price;
  for (let i = 1; i < len; i++) {
    const drift = 1 + (rand() - 0.45) * 0.07;
    price = Math.max(anchor * 0.5, price * drift);
    out[i] = price;
  }
  out[len - 1] = anchor;
  return out;
}
