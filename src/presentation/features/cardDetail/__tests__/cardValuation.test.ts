/**
 * Loupe Value panel — the rules that decide what it shows.
 *
 * The valuation endpoint is public and every field on it is optional: a card
 * can come back with a fair value and no signals, signals and no fair value,
 * or nothing usable at all. The panel has to degrade cleanly through all of
 * those rather than render an empty frame or a "$NaN".
 */
import type { CardValuationWire } from "@/infrastructure/http";
import {
  confidenceLabel,
  usableSignals,
  hasFairValue,
} from "../cardValuationRules";

const money = (amount: number) => ({ amount, currency: "USD" });

function wire(over: Partial<CardValuationWire> = {}): CardValuationWire {
  return {
    card_id: "pokemontcg:swsh7-215",
    fair_value: money(2351.87),
    confidence: 3,
    signals: {
      sold_comps: money(2250),
      listings: money(2492.05),
      catalog: money(2396.28),
    },
    sales_volume: null,
    grades: null,
    ...over,
  };
}

describe("confidenceLabel", () => {
  it.each([
    [5, "Very high confidence"],
    [4, "High confidence"],
    [3, "Moderate confidence"],
    [2, "Low confidence"],
    [1, "Thin data"],
  ])("maps %i to a phrase a human can act on", (score, expected) => {
    expect(confidenceLabel(score)).toBe(expected);
  });

  it("returns null when the backend omits confidence", () => {
    expect(confidenceLabel(null)).toBeNull();
    expect(confidenceLabel(undefined)).toBeNull();
  });

  it("clamps a score above the documented range", () => {
    expect(confidenceLabel(9)).toBe("Very high confidence");
  });

  it("treats 0 and negatives as the weakest bucket, not as missing", () => {
    expect(confidenceLabel(0)).toBe("Thin data");
    expect(confidenceLabel(-2)).toBe("Thin data");
  });
});

describe("hasFairValue", () => {
  it("is true for a real price", () => {
    expect(hasFairValue(wire())).toBe(true);
  });

  it("is false when the service could not price the card", () => {
    expect(hasFairValue(wire({ fair_value: null }))).toBe(false);
    expect(hasFairValue(undefined)).toBe(false);
  });

  it("rejects non-finite amounts rather than rendering NaN", () => {
    expect(hasFairValue(wire({ fair_value: money(NaN) }))).toBe(false);
    expect(hasFairValue(wire({ fair_value: money(Infinity) }))).toBe(false);
  });

  it("accepts a genuine zero — free is a price, not a missing value", () => {
    expect(hasFairValue(wire({ fair_value: money(0) }))).toBe(true);
  });
});

describe("usableSignals", () => {
  it("returns all three when the card is fully covered", () => {
    expect(usableSignals(wire()).map((s) => s.key)).toEqual([
      "sold_comps",
      "listings",
      "catalog",
    ]);
  });

  it("drops signals the backend had no data for", () => {
    const rows = usableSignals(
      wire({
        signals: {
          sold_comps: null,
          listings: money(10),
          catalog: null,
        },
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.key).toBe("listings");
    expect(rows[0]!.amount).toBe(10);
  });

  it("returns nothing when there are no signals at all", () => {
    expect(usableSignals(wire({ signals: null }))).toEqual([]);
    expect(usableSignals(undefined)).toEqual([]);
  });

  it("filters non-finite signal amounts", () => {
    const rows = usableSignals(
      wire({
        signals: {
          sold_comps: money(NaN),
          listings: money(Infinity),
          catalog: money(5),
        },
      }),
    );
    expect(rows.map((r) => r.key)).toEqual(["catalog"]);
  });

  it("keeps a stable order regardless of payload key order", () => {
    // Sold comps first is deliberate: what something ACTUALLY sold for
    // outranks what someone is asking for it.
    const rows = usableSignals(
      wire({
        signals: {
          catalog: money(3),
          listings: money(2),
          sold_comps: money(1),
        },
      }),
    );
    expect(rows.map((r) => r.key)).toEqual([
      "sold_comps",
      "listings",
      "catalog",
    ]);
  });
});
