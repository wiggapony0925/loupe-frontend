import { QueryClient } from "@tanstack/react-query";
import { invalidateHoldingCaches } from "../invalidateHoldings";
import { queryKeys } from "../queryKeys";

/**
 * Guards the single source of truth for "what to refresh when a holding
 * changes". The add/scan/delete paths all funnel through this helper, so a
 * dropped key here silently leaves a screen stale (the bug this replaced:
 * Analytics + the home feed weren't refreshing after add/remove).
 */
describe("invalidateHoldingCaches", () => {
  it("invalidates every holding-derived cache", () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, "invalidateQueries").mockReturnValue(Promise.resolve());

    invalidateHoldingCaches(qc);

    const invalidated = spy.mock.calls.map((call) =>
      JSON.stringify((call[0] as { queryKey: unknown }).queryKey),
    );

    const expectedKeys = [
      queryKeys.me.grades(),
      queryKeys.collection.all,
      queryKeys.cards.sparklines(),
      queryKeys.portfolio.all,
      queryKeys.sets.progress(),
      queryKeys.home.all, // Command Center top movers + recent scans
      queryKeys.analytics.all, // Analytics stats / movers / allocation
    ];

    for (const key of expectedKeys) {
      expect(invalidated).toContain(JSON.stringify(key));
    }
  });
});
