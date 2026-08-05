/**
 * The words on the social surfaces, and the small rules behind them.
 *
 * Pure functions, so the copy decisions that are easy to get subtly wrong —
 * a pending request that reads "Follow" and so invites a second tap, a stat
 * that says "1 followers" — are testable without a device.
 */
import type { SocialRelationship } from "@/infrastructure/http";

/**
 * What the follow button says.
 *
 * "Requested" matters: on a private account a follow is an *ask*, and showing
 * "Follow" while one is outstanding makes the user tap again — which cancels
 * the request they just made.
 */
export function followLabel(rel: SocialRelationship): string {
  switch (rel) {
    case "following":
      return "Following";
    case "requested":
      return "Requested";
    case "self":
      return "You";
    default:
      return "Follow";
  }
}

/** Compact counts: 1.2K rather than 1200, which would wrap the stat row. */
export function formatStat(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return String(Math.floor(n));
  if (n < 1_000_000) {
    const k = n / 1000;
    // 9.9K, then 10K — one decimal only while it buys precision.
    return `${k < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.floor(k)}K`;
  }
  const m = n / 1_000_000;
  return `${m < 10 ? m.toFixed(1).replace(/\.0$/, "") : Math.floor(m)}M`;
}

/** "1 follower" / "2 followers" — plural agreement for stat captions. */
export function pluralize(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/**
 * Why a collection isn't on screen.
 *
 * A private account you don't follow still shows its header, so the empty
 * space below it needs to say which of the two situations this is —
 * otherwise "nothing here" reads as "this person owns nothing".
 */
export function collectionGateReason(args: {
  isPrivate: boolean;
  relationship: SocialRelationship;
  cardCount: number;
}): { title: string; body: string } | null {
  const { isPrivate, relationship, cardCount } = args;
  if (isPrivate && relationship !== "self" && relationship !== "following") {
    return {
      title: "This vault is private",
      body:
        relationship === "requested"
          ? "Your follow request is waiting to be accepted."
          : "Follow this collector to see what they own.",
    };
  }
  if (cardCount === 0) {
    return {
      title: relationship === "self" ? "Your vault is empty" : "Nothing here yet",
      body:
        relationship === "self"
          ? "Scan a card to start your collection."
          : "This collector hasn't added any cards yet.",
    };
  }
  return null;
}

/**
 * Handle rules, mirrored from `SocialProfileUpsert` on the backend.
 *
 * Validated on the client purely so the user finds out before a round trip;
 * the server remains the authority and still rejects anything invalid.
 */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export function usernameError(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return "Pick a username";
  if (v.length < 3) return "At least 3 characters";
  if (v.length > 30) return "At most 30 characters";
  if (!USERNAME_PATTERN.test(v)) return "Letters, numbers and _ only";
  return null;
}
