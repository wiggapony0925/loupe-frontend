import {
  PORTFOLIO_TIMEFRAMES,
  PRICE_HISTORY_TIMEFRAMES,
  isPortfolioTimeframe,
  isPriceHistoryTimeframe,
  labelForPortfolioTimeframe,
} from "../timeframes";

describe("PORTFOLIO_TIMEFRAMES (contract with backend)", () => {
  it("exposes the exact ordered vocabulary the backend accepts", () => {
    // Mirrors loupe-backend/app/services/portfolio_service.py _RANGE_BUCKETS.
    expect([...PORTFOLIO_TIMEFRAMES]).toEqual([
      "1D",
      "1W",
      "1M",
      "3M",
      "YTD",
      "1Y",
      "ALL",
    ]);
  });

  it("uses uppercase tokens (1Y, not 1y) — backend distinguishes them from card-price tokens", () => {
    for (const tf of PORTFOLIO_TIMEFRAMES) {
      expect(tf).toBe(tf.toUpperCase());
    }
  });
});

describe("PRICE_HISTORY_TIMEFRAMES (contract with backend)", () => {
  it("exposes the exact ordered vocabulary the backend accepts", () => {
    // Mirrors loupe-backend/app/services/card_search_service.py get_price_history.
    expect([...PRICE_HISTORY_TIMEFRAMES]).toEqual([
      "7d",
      "30d",
      "90d",
      "180d",
      "1y",
    ]);
  });

  it("uses lowercase tokens (1y, not 1Y) — backend distinguishes them from portfolio tokens", () => {
    for (const tf of PRICE_HISTORY_TIMEFRAMES) {
      expect(tf).toBe(tf.toLowerCase());
    }
  });
});

describe("isPortfolioTimeframe", () => {
  it("narrows valid tokens", () => {
    for (const tf of PORTFOLIO_TIMEFRAMES) {
      expect(isPortfolioTimeframe(tf)).toBe(true);
    }
  });
  it("rejects bogus tokens including price-history shapes", () => {
    expect(isPortfolioTimeframe("BOGUS")).toBe(false);
    expect(isPortfolioTimeframe("")).toBe(false);
    expect(isPortfolioTimeframe("1y")).toBe(false); // case matters
    expect(isPortfolioTimeframe("30d")).toBe(false);
  });
});

describe("isPriceHistoryTimeframe", () => {
  it("narrows valid tokens", () => {
    for (const tf of PRICE_HISTORY_TIMEFRAMES) {
      expect(isPriceHistoryTimeframe(tf)).toBe(true);
    }
  });
  it("rejects bogus tokens including portfolio shapes", () => {
    expect(isPriceHistoryTimeframe("BOGUS")).toBe(false);
    expect(isPriceHistoryTimeframe("1Y")).toBe(false); // case matters
    expect(isPriceHistoryTimeframe("ALL")).toBe(false);
  });
});

describe("labelForPortfolioTimeframe", () => {
  it("returns a non-empty label for every supported timeframe", () => {
    for (const tf of PORTFOLIO_TIMEFRAMES) {
      const label = labelForPortfolioTimeframe(tf);
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
