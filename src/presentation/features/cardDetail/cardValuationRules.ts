/**
 * Display rules for Loupe Value, kept out of the component so they can be
 * tested directly.
 *
 * Every field on the valuation payload is optional, so each of these answers
 * one question the panel has to get right before it renders anything: is there
 * a number at all, which signals actually have data, and what does a bare
 * confidence score mean to a person.
 */
import type { CardValuationWire } from "@/infrastructure/http";

export type SignalKey = "sold_comps" | "listings" | "catalog";

export interface SignalRow {
  key: SignalKey;
  label: string;
  hint: string;
  amount: number;
}

/**
 * Fixed display order — sold comps first on purpose. What a card ACTUALLY
 * sold for outranks what someone is asking for it, and the payload's key
 * order is not something to depend on.
 */
export const SIGNALS: readonly { key: SignalKey; label: string; hint: string }[] = [
  { key: "sold_comps", label: "Sold comps", hint: "What copies actually sold for" },
  { key: "listings", label: "Live asks", hint: "What sellers are asking now" },
  { key: "catalog", label: "Catalog", hint: "The reference catalog price" },
] as const;

/** 1–5 from the backend → words. A bare "3" tells the user nothing. */
export function confidenceLabel(c: number | null | undefined): string | null {
  if (c == null || !Number.isFinite(c)) return null;
  if (c >= 5) return "Very high confidence";
  if (c === 4) return "High confidence";
  if (c === 3) return "Moderate confidence";
  if (c === 2) return "Low confidence";
  // 1, 0 and anything negative are all "we barely have data" — never treat a
  // 0 as "missing", which would hide the panel instead of qualifying it.
  return "Thin data";
}

/**
 * True only when there is a real number to print. A missing fair value means
 * the service couldn't price the card and the panel should stay away entirely
 * — but a genuine 0 is a price, not an absence.
 */
export function hasFairValue(v: CardValuationWire | undefined | null): boolean {
  const amount = v?.fair_value?.amount;
  return amount != null && Number.isFinite(amount);
}

/** The signals that actually carry a usable number, in display order. */
export function usableSignals(
  v: CardValuationWire | undefined | null,
): SignalRow[] {
  const signals = v?.signals;
  if (!signals) return [];
  const out: SignalRow[] = [];
  for (const s of SIGNALS) {
    const amount = signals[s.key]?.amount;
    if (amount != null && Number.isFinite(amount)) {
      out.push({ ...s, amount });
    }
  }
  return out;
}
