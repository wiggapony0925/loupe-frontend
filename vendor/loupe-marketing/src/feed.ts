/**
 * Feed shaping for the trending surfaces — the hero's featured stack and the
 * home rails behind it.
 *
 * Both clients hit the same per-game trending endpoints and both have to cope
 * with the same upstream flakiness, so the recovery strategy lives here rather
 * than being reinvented (and subtly mismatched) in each app.
 */

/**
 * Returns `primary` when it has anything in it, else `fallback`.
 *
 * Trending feeds go empty when an upstream times out — Pokémon and Yu-Gi-Oh
 * frequently return nothing while Magic's succeeds. Each game's `value` feed
 * is reliable, so callers pass that as the fallback.
 */
export function pickPopulated<T>(
  primary: readonly T[] | undefined,
  fallback: readonly T[] | undefined,
): readonly T[] {
  return primary && primary.length > 0 ? primary : (fallback ?? []);
}

/**
 * Round-robins several lists into one, dropping repeats by id.
 *
 * Taking the first item of every list before any list's second item is what
 * stops a rail from opening with six Magic cards when Pokémon's feed is slow —
 * the games stay visibly mixed even when the lists are wildly uneven.
 */
export function interleaveById<T>(
  lists: readonly (readonly T[])[],
  getId: (item: T) => string,
): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const item = list[i];
      if (!item) continue;
      const id = getId(item);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(item);
    }
  }
  return out;
}
