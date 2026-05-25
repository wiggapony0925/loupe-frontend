/**
 * Analytics-overview repository — single round-trip for the entire
 * Analytics tab. Replaces the previous client-side aggregation over
 * `/v1/collection` + per-card sparkline fetches.
 */
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import {
  AnalyticsOverviewSchema,
  type AnalyticsOverviewValidated,
} from "@/infrastructure/http/schemas";

export type AnalyticsOverview = AnalyticsOverviewValidated;
export type AnalyticsStats = AnalyticsOverview["stats"];
export type AnalyticsKpis = AnalyticsOverview["kpis"];
export type AnalyticsSetIndex = AnalyticsOverview["setIndexes"][number];
export type AnalyticsMoverRow = AnalyticsOverview["movers"]["gainers"][number];
export type AnalyticsYearBucket = AnalyticsOverview["yearDistribution"][number];
export type AnalyticsGradeBucket = AnalyticsOverview["gradeDistribution"][number];

export async function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  return apiFetch<AnalyticsOverview>(ENDPOINTS.analytics.overview, {
    schema: AnalyticsOverviewSchema,
  });
}
