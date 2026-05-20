/**
 * Wire contract tests for `/v1/sets/progress` and `/v1/alerts`.
 *
 * Same playbook as `portfolio.contract.test.ts`: these are static
 * type-only fixtures. If a backend dev renames a field on
 * `set_progress_service.list_progress` or `app/schemas/price_alert.py`,
 * the wire type stops compiling here and the build fails before any
 * device runs a broken build.
 */

import type {
  PriceAlertCreateWire,
  PriceAlertWire,
  SetProgressWire,
} from "@/infrastructure/http";

describe("set-progress + alerts wire contract", () => {
  it("SetProgressWire matches the backend payload", () => {
    const sample: SetProgressWire = {
      setId: "set-1",
      setName: "Base Set",
      setCode: "BSE",
      tcg: "pokemon",
      imageUrl: "https://cdn.example/sets/bse.png",
      owned: 12,
      total: 102,
      percent: 11.76,
      estimatedValueUsd: 1234.56,
      missingTop: [
        {
          cardId: "card-1",
          name: "Charizard",
          number: "4",
          imageUrl: null,
        },
      ],
    };
    expect(Object.keys(sample).sort()).toEqual([
      "estimatedValueUsd",
      "imageUrl",
      "missingTop",
      "owned",
      "percent",
      "setCode",
      "setId",
      "setName",
      "tcg",
      "total",
    ]);
  });

  it("PriceAlertWire matches the backend payload", () => {
    const sample: PriceAlertWire = {
      id: "alert-1",
      user_id: "user-1",
      card_id: "card-1",
      condition: "above",
      threshold_usd: "250.00",
      note: "exit if it spikes",
      created_at: "2025-01-01T00:00:00Z",
      triggered_at: null,
      triggered_price_usd: null,
      card_name: "Charizard",
      card_image_url: "https://cdn.example/cards/charizard.png",
    };
    expect(Object.keys(sample).sort()).toEqual([
      "card_id",
      "card_image_url",
      "card_name",
      "condition",
      "created_at",
      "id",
      "note",
      "threshold_usd",
      "triggered_at",
      "triggered_price_usd",
      "user_id",
    ]);
  });

  it("PriceAlertCreateWire accepts a numeric or string threshold", () => {
    const a: PriceAlertCreateWire = {
      card_id: "card-1",
      condition: "below",
      threshold_usd: 99.95,
    };
    const b: PriceAlertCreateWire = {
      card_id: "card-1",
      condition: "above",
      threshold_usd: "250.00",
      note: null,
    };
    expect(a.condition).toBe("below");
    expect(b.condition).toBe("above");
  });
});
