import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";

/**
 * Invalidate every cache a holding (grade) add / edit / delete affects — the
 * single source of truth so every mutation path refreshes the SAME set and
 * nothing drifts stale.
 *
 * Previously each call site (grade mutations, the scan job, the vault
 * bulk-delete + pull-to-refresh) kept its own hand-maintained list, and they
 * had diverged: none invalidated the Analytics overview or the Command Center
 * home feed, so those screens showed stale stats / movers / value until their
 * staleTime elapsed or the app refocused.
 */
export function invalidateHoldingCaches(qc: QueryClient): void {
  const keys = [
    queryKeys.me.grades(),
    queryKeys.collection.all,
    queryKeys.cards.sparklines(),
    // `portfolio.all` is a prefix → covers history + sparklines + summary.
    queryKeys.portfolio.all,
    queryKeys.sets.progress(),
    // Newly included so a card add/remove also refreshes:
    queryKeys.home.all, // Command Center: top movers + recent scans
    queryKeys.analytics.all, // Analytics: stats, movers, allocation, grade mix
  ];
  for (const queryKey of keys) {
    void qc.invalidateQueries({ queryKey });
  }
}
