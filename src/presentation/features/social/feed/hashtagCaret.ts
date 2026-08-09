/**
 * Caret arithmetic for `#` autocomplete. Pure — no React, no network.
 *
 * Kept apart from the component so it can be tested as plain functions.
 * This is where every autocomplete breaks (suggesting when the caret has
 * moved on, completing without a trailing space so the next word gets
 * swallowed into the tag), and that logic deserves to be exercised without
 * dragging a React Native renderer along with it.
 */

/**
 * The `#word` the caret is sitting in, or null.
 *
 * Returns `""` — not null — the instant a bare `#` is typed. That
 * distinction is the feature: an empty fragment means "offer trending",
 * which is exactly when a suggestion is most useful.
 */
export function activeHashtag(text: string, caret: number): string | null {
  const before = text.slice(0, caret);
  const hash = before.lastIndexOf("#");
  if (hash === -1) return null;
  const fragment = before.slice(hash + 1);
  // A space, newline or punctuation ends the tag — the caret has moved past it.
  if (/[^A-Za-z0-9_]/.test(fragment)) return null;
  return fragment;
}

/** Replace the `#word` under the caret with `#tag `, returning the new text. */
export function completeHashtag(
  text: string,
  caret: number,
  tag: string,
): { text: string; caret: number } {
  const before = text.slice(0, caret);
  const hash = before.lastIndexOf("#");
  if (hash === -1) return { text, caret };
  // The trailing space is not cosmetic: without it the next word typed
  // becomes part of the tag.
  const next = `${text.slice(0, hash)}#${tag} ${text.slice(caret)}`;
  return { text: next, caret: hash + tag.length + 2 };
}
