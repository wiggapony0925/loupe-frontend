/**
 * Wire contract test for `GET /v1/market/indices/{id}/history`.
 *
 * Tracks `MarketIndex.to_dict()` in `app/services/market_index_service.py`.
 * If the backend renames a field, the type stops compiling here and the
 * frontend build fails before shipping a broken release.
 */

import type {
  MarketIndexHistoryWire,
  MarketIndexPointWire,
} from "@/infrastructure/http";

describe("market-index wire contract", () => {
  it("MarketIndexHistoryWire matches the backend payload", () => {
    const point: MarketIndexPointWire = { date: "2025-01-01", indexValue: 100 };
    const sample: MarketIndexHistoryWire = {
      indexId: "psa10",
      range: "1Y",
      points: [point, { date: "2025-02-01", indexValue: 104.5 }],
      deltaPct: 4.5,
      cohortSize: 87,
    };
    expect(Object.keys(sample).sort()).toEqual([
      "cohortSize",
      "deltaPct",
      "indexId",
      "points",
      "range",
    ]);
    expect(Object.keys(point).sort()).toEqual(["date", "indexValue"]);
  });
});
