/**
 * TanStack Query hooks, grouped by domain (mirrors backend service layout).
 *
 * Domain folders: catalog, market, collection, scans, alerts, reports,
 * analytics, auth, ops. Prefer importing from the domain path directly:
 *
 *   import { useCard } from "@/application/queries/catalog/useCard";
 *
 * This barrel exists so legacy `from "@/application/queries"` callers keep
 * working while migration is in flight.
 */

// catalog
export { useCardSearch } from "./catalog/useCardSearch";
export { useTrendingCards } from "./catalog/useTrendingCards";
export { useCard } from "./catalog/useCard";
export { useCardPriceHistory } from "./catalog/useCardPriceHistory";
export type { PriceHistoryRange } from "./catalog/useCardPriceHistory";
export { useSets } from "./catalog/useSets";
export { useCardMarket } from "./catalog/useCardMarket";
export { useCardListings } from "./catalog/useCardListings";
export type { UseCardListingsOptions } from "./catalog/useCardListings";
export { useCardComps } from "./catalog/useCardComps";
export type { UseCardCompsOptions } from "./catalog/useCardComps";
export { useCardSparklines } from "./catalog/useCardSparklines";
export type {
  UseCardSparklinesOptions,
  UseCardSparklinesResult,
} from "./catalog/useCardSparklines";
export { useSetProgress } from "./catalog/useSetProgress";

// market
export { useTopMovers } from "./market/useTopMovers";
export type { TopMoverRow, UseTopMoversResult } from "./market/useTopMovers";
export { usePortfolioHistory } from "./market/usePortfolioHistory";
export type { UsePortfolioHistoryOptions } from "./market/usePortfolioHistory";
export { useMarketIndex } from "./market/useMarketIndex";
export type { UseMarketIndexOptions } from "./market/useMarketIndex";

// collection
export { useMyGrades } from "./collection/useMyGrades";
export {
  useCreateGrade,
  useUpdateGrade,
  useDeleteGrade,
} from "./collection/useGradeMutations";
export type {
  CreateGradeInput,
  UpdateGradeInput,
} from "./collection/useGradeMutations";

// scans
export { useMyScans } from "./scans/useMyScans";
export { useScanners } from "./scans/useScanners";
export { useScanProgress } from "./scans/useScanProgress";

// alerts
export {
  useCreatePriceAlert,
  useDeletePriceAlert,
  usePriceAlerts,
} from "./alerts/usePriceAlerts";

// reports
export {
  fetchReportDownloadUrl,
  useGenerateReport,
  useReports,
  useUpcomingReports,
} from "./reports/useReports";

// analytics
export { useAnalyticsOverview } from "./analytics/useAnalyticsOverview";
export { useHomeFeed } from "./analytics/useHomeFeed";

// auth
export { useMe } from "./auth/useMe";

// ops
export { useApiHealth } from "./ops/useApiHealth";
export { useProvidersStatus } from "./ops/useProvidersStatus";
