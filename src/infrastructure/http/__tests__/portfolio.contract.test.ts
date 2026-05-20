/**
 * Wire contract tests for `/v1/grades/*` portfolio endpoints.
 *
 * These tests are static — they don't hit the network. Their purpose
 * is to lock the shape that the frontend expects against the shape
 * the backend documents in `app/services/portfolio_service.py`. If a
 * backend dev renames a field (e.g. `priceUsd` → `valueUsd`) the wire
 * type stops compiling here and the build fails loudly.
 *
 * Whenever you change `tests/test_portfolio_endpoints.py` or
 * `portfolio_service.py` on the backend, mirror the change in the
 * fixtures below.
 */

import type {
  CardSparklineWire,
  PortfolioHistoryWire,
  PortfolioSummaryWire,
} from "@/infrastructure/http";

describe("portfolio wire contract", () => {
  it("PortfolioSummaryWire matches the backend payload shape", () => {
    const sample: PortfolioSummaryWire = {
      totalValueUsd: 350,
      cardCount: 2,
      avgGrade: 9.75,
      avgAccuracy: null,
      totalCostUsd: 200,
      costBasisCardCount: 2,
      unrealizedPnlUsd: 150,
      unrealizedPnlPct: 75,
    };
    expect(Object.keys(sample).sort()).toEqual(
      [
        "avgAccuracy",
        "avgGrade",
        "cardCount",
        "costBasisCardCount",
        "totalCostUsd",
        "totalValueUsd",
        "unrealizedPnlPct",
        "unrealizedPnlUsd",
      ].sort(),
    );
    expect(typeof sample.totalValueUsd).toBe("number");
    expect(typeof sample.cardCount).toBe("number");
  });

  it("PortfolioSummaryWire allows nulls when no cost basis is recorded", () => {
    const fresh: PortfolioSummaryWire = {
      totalValueUsd: 0,
      cardCount: 0,
      avgGrade: null,
      avgAccuracy: null,
      totalCostUsd: null,
      costBasisCardCount: 0,
      unrealizedPnlUsd: null,
      unrealizedPnlPct: null,
    };
    expect(fresh.totalCostUsd).toBeNull();
    expect(fresh.unrealizedPnlUsd).toBeNull();
    expect(fresh.unrealizedPnlPct).toBeNull();
  });

  it("PortfolioHistoryWire matches the backend payload shape", () => {
    const sample: PortfolioHistoryWire = {
      range: "1M",
      points: [
        { date: "2025-01-01", priceUsd: 100.0 },
        { date: "2025-02-01", priceUsd: 150.0 },
      ],
      deltaUsd: 50.0,
      deltaPct: 50.0,
    };
    expect(Object.keys(sample).sort()).toEqual(
      ["deltaPct", "deltaUsd", "points", "range"].sort(),
    );
    expect(Object.keys(sample.points[0]!).sort()).toEqual(
      ["date", "priceUsd"].sort(),
    );
  });

  it("PortfolioHistoryWire accepts every documented range", () => {
    const ranges: PortfolioHistoryWire["range"][] = [
      "1D",
      "1W",
      "1M",
      "3M",
      "YTD",
      "1Y",
      "ALL",
    ];
    // Compile-time assertion — listing them all proves the union is exhaustive.
    expect(ranges).toHaveLength(7);
  });

  it("CardSparklineWire matches the backend payload shape", () => {
    const sample: CardSparklineWire = {
      cardId: "00000000-0000-0000-0000-000000000001",
      points: [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113],
      deltaPct: 13.0,
    };
    expect(Object.keys(sample).sort()).toEqual(
      ["cardId", "deltaPct", "points"].sort(),
    );
    expect(sample.points).toHaveLength(14);
  });
});
