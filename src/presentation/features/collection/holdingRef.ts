/**
 * A short, stable reference for one copy in the vault.
 *
 * Three Pikachus look identical in every list, so "which one am I editing"
 * had no answer — the only real identifier is a UUID nobody can hold in their
 * head. This derives a short number from that UUID so a copy can be named out
 * loud ("#4172"), matched against a row you saw a minute ago, and quoted in a
 * support message.
 *
 * Properties that matter:
 *  • Stable — same holding, same ref, forever. It's a pure function of the id,
 *    so nothing needs storing and the backend needs no new column.
 *  • Local — derived client-side, so it works offline and for a holding
 *    created seconds ago.
 *  • Not an index. A positional "copy 2 of 3" renumbers itself the moment you
 *    sell one, which is worse than no identifier at all.
 *
 * It is deliberately NOT globally unique: 4 digits over one person's vault is
 * plenty to disambiguate their handful of copies, and short enough to read.
 */

const REF_SPACE = 10_000;

/**
 * FNV-1a. Chosen because it's tiny, dependency-free and well distributed over
 * short hex strings — a naive char-sum clusters badly on UUIDs, which share
 * most of their alphabet.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // >>> 0 keeps it an unsigned 32-bit int; the multiply is the FNV prime.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/** `"#4172"` — the display form. Empty string when there's no id yet. */
export function holdingRef(holdingId: string | null | undefined): string {
  const id = (holdingId ?? "").trim();
  if (!id) return "";
  return `#${fnv1a(id) % REF_SPACE}`;
}

/**
 * `"#4172 · 2 of 3"` when the user owns several copies of the same card.
 *
 * The ordinal is context, never identity: it tells you where this copy sits in
 * the list you're looking at right now, while the ref is what actually names
 * it. Single copies get the ref alone — "1 of 1" is noise.
 */
export function holdingRefWithPosition(
  holdingId: string | null | undefined,
  index: number,
  total: number,
): string {
  const ref = holdingRef(holdingId);
  if (!ref) return "";
  if (total <= 1) return ref;
  return `${ref} · ${index + 1} of ${total}`;
}
