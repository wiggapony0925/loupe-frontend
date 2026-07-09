/**
 * Home-feed repository — single call for the Command tab's server-rendered
 * rails (top movers + recent scans). Replaces the previous client-side
 * fan-out (`useMyGrades` × N `useCard` × N `useCardMarket`) with one
 * authenticated round-trip against `GET /v1/home/feed`.
 */
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import {
  HomeFeedSchema,
  type HomeFeedValidated,
  type RecentScanRowValidated,
  type TopMoverRowValidated,
} from "@/infrastructure/http/schemas";

export type TopMoverRow = TopMoverRowValidated;
export type RecentScanRow = RecentScanRowValidated;
export type HomeFeed = HomeFeedValidated;

export interface HomeFeedParams {
  topMovers?: number;
  recentScans?: number;
  /** Scope both rails to the active collection (omit for the whole vault). */
  collectionId?: string | null;
}

export async function fetchHomeFeed(params: HomeFeedParams = {}): Promise<HomeFeed> {
  const qs = new URLSearchParams();
  if (params.topMovers != null) qs.set("topMovers", String(params.topMovers));
  if (params.recentScans != null) qs.set("recentScans", String(params.recentScans));
  if (params.collectionId) qs.set("collection_id", params.collectionId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<HomeFeed>(`${ENDPOINTS.home.feed}${suffix}`, {
    schema: HomeFeedSchema,
  });
}
