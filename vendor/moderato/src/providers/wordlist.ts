/**
 * Wordlist provider — evasion-resistant exact-word matching, offline.
 *
 * Be clear-eyed about the trade: a classifier understands context
 * ("killer deal" vs "I will kill you"); a wordlist never will, and
 * moderation policy built on one alone flags real posts. What a wordlist
 * IS good for: a free, instant, offline pre-filter for the vocabulary you
 * never want regardless of context — and unlike naive implementations,
 * this one survives "f u c k", "n1gger" and "fuuuck" while leaving
 * "Scunthorpe", "class" and "assassin" alone (see normalize.ts).
 *
 * Matching is whole-token: a listed word matches a token exactly or with a
 * common inflection ("fucking", "fuckers"), never as a substring.
 */

import { normalizeTokens } from "../normalize.js";
import type {
  ModerationProvider,
  NormalizedInput,
  ProviderResult,
} from "../types.js";

export interface WordlistEntry {
  /** Category reported on a hit ("profanity", "hate", …). */
  category: string;
  words: string[];
  /** Score reported on a hit. */
  score?: number;
}

/** Inflections a listed word also matches ("fuck" → "fucking"). */
const SUFFIXES = ["s", "es", "ed", "er", "ers", "ing", "in"];

const matchesWord = (token: string, word: string): boolean => {
  if (token === word) return true;
  if (!token.startsWith(word)) return false;
  return SUFFIXES.includes(token.slice(word.length));
};

export function wordlistProvider(entries: WordlistEntry[]): ModerationProvider {
  const prepared = entries.map((entry) => ({
    ...entry,
    words: entry.words.map((word) => word.toLowerCase()),
  }));
  return {
    name: "wordlist",
    async classify(input: NormalizedInput): Promise<ProviderResult> {
      const flags: Record<string, boolean> = {};
      const scores: Record<string, number> = {};
      if (!input.text) return { flags, scores };
      const tokens = normalizeTokens(input.text);
      for (const entry of prepared) {
        const hit = tokens.some(({ exact, collapsed }) =>
          entry.words.some(
            (word) => matchesWord(exact, word) || matchesWord(collapsed, word),
          ),
        );
        if (hit) {
          flags[entry.category] = true;
          scores[entry.category] = Math.max(
            scores[entry.category] ?? 0,
            entry.score ?? 0.9,
          );
        }
      }
      return { flags, scores };
    },
  };
}

/**
 * A starter pack, not a full vocabulary: general profanity reports as
 * "profanity" (review-band by default), slurs report as "hate" with a
 * near-certain score. Extend or replace it for your community — and note
 * that under the DEFAULT policy neither category blocks; add "hate" (and
 * "profanity", if you run family-friendly) to `zeroTolerance` to refuse
 * outright:
 *
 * ```ts
 * createModerato({
 *   provider: wordlistProvider(PROFANITY_PRESET),
 *   policy: { zeroTolerance: [...DEFAULT_ZERO_TOLERANCE, "hate"] },
 * });
 * ```
 */
export const PROFANITY_PRESET: WordlistEntry[] = [
  {
    category: "profanity",
    score: 0.72,
    words: [
      "fuck",
      "motherfucker",
      "shit",
      "bullshit",
      "ass",
      "asshole",
      "bitch",
      "bastard",
      "cunt",
      "pussy",
      "dick",
      "cock",
      "twat",
      "wanker",
    ],
  },
  {
    category: "hate",
    score: 0.99,
    words: [
      "nigger",
      "nigga",
      "faggot",
      "fag",
      "kike",
      "spic",
      "chink",
      "wetback",
      "tranny",
      "retard",
    ],
  },
];
