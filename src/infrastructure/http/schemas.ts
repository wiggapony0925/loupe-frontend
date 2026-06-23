/**
 * Runtime validation schemas for API responses (zod).
 *
 * The wire types under `./wire/*` are compile-time contracts mirroring
 * the FastAPI/Pydantic models. These schemas are the runtime counterpart
 * — they catch silent contract drift (renamed field, wrong nullability,
 * unexpected null) at the network boundary rather than at the point of
 * use, where the failure mode is usually a cryptic crash inside a
 * formatter or chart library.
 *
 * Pass any of these to `apiFetch`'s `schema` option to opt-in:
 *
 *   const me = await apiFetch("/v1/me", { schema: MeResponseSchema });
 *
 * On failure we capture the zod issue list to Sentry and throw an
 * `ApiError` with `code: "schema.invalid"` so the caller's normal error
 * handling kicks in. We never silently fall through with partial data.
 */
import { z } from "zod";

const decimalString = z.string(); // pydantic Decimal → JSON string
const isoDate = z.string(); // ISO 8601 / YYYY-MM-DD — loose; backend owns format

/* ─── identity ───────────────────────────────────────────────────────── */

export const MeResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  created_at: isoDate,
  is_admin: z.boolean().optional(),
});
export type MeResponseValidated = z.infer<typeof MeResponseSchema>;

/* ─── grading ────────────────────────────────────────────────────────── */

export const PortfolioSummarySchema = z.object({
  totalValueUsd: z.number(),
  cardCount: z.number(),
  avgGrade: z.number().nullable(),
  avgAccuracy: z.number().nullable(),
  totalCostUsd: z.number().nullable(),
  costBasisCardCount: z.number(),
  unrealizedPnlUsd: z.number().nullable(),
  unrealizedPnlPct: z.number().nullable(),
  // Vault-shape extras (added when backend ships server-driven Vault).
  // Optional so a frontend deployed against an older backend doesn't
  // crash the zod validator — the consumer treats missing as "compute
  // client-side" / "hide chip".
  uniqueCardCount: z.number().optional(),
  loupeGradedCount: z.number().optional(),
  availableSets: z.array(z.string()).optional(),
});

/* ─── remote app config (feature flags / min version / SDUI) ─────────── */

export const AppConfigSchema = z.object({
  minSupportedVersion: z.string(),
  forceUpdate: z.boolean(),
  // Flag map: keys we ship today are typed in the AppConfig domain
  // type; unknown keys are tolerated so the backend can roll out new
  // flags ahead of the client without breaking validation.
  flags: z.record(z.string(), z.boolean()),
  homeRails: z.array(z.string()),
});
export type AppConfigValidated = z.infer<typeof AppConfigSchema>;

/* ─── home feed (server-rendered Command-tab rails) ──────────────────── */

export const TopMoverRowSchema = z.object({
  gradeId: z.string(),
  cardId: z.string().nullable(),
  cardName: z.string().nullable(),
  cardImageUrl: z.string().nullable(),
  cardNumber: z.string().nullable().optional(),
  cardYear: z.number().nullable().optional(),
  cardTcg: z.string().nullable().optional(),
  cardSetName: z.string().nullable().optional(),
  priceUsd: z.number().nullable(),
  changePct1y: z.number().nullable(),
});
export type TopMoverRowValidated = z.infer<typeof TopMoverRowSchema>;

export const RecentScanRowSchema = z.object({
  gradeId: z.string(),
  cardId: z.string().nullable(),
  cardName: z.string().nullable(),
  cardImageUrl: z.string().nullable(),
  cardSetName: z.string().nullable(),
  grade: z.number().nullable(),
  house: z.string().nullable(),
  scannedAt: z.string().nullable(),
  estimatedValueUsd: z.number().nullable(),
});
export type RecentScanRowValidated = z.infer<typeof RecentScanRowSchema>;

export const HomeFeedSchema = z.object({
  topMovers: z.array(TopMoverRowSchema),
  recentScans: z.array(RecentScanRowSchema),
});
export type HomeFeedValidated = z.infer<typeof HomeFeedSchema>;

/* ─── analytics overview (server-side rollup for the Analytics tab) ─── */

export const AnalyticsStatsSchema = z.object({
  holdings: z.number(),
  uniqueSets: z.number(),
  avgGrade: z.number(),
  gemRatePct: z.number(),
  avgValueUsd: z.number(),
  oldestYear: z.number().nullable(),
  totalValueUsd: z.number(),
});

export const AnalyticsKpisSchema = z.object({
  totalScans: z.number(),
  avgGrade: z.number(),
  gemRatePct: z.number(),
  lastScanAt: z.string().nullable(),
  graderSplit: z.object({
    psa: z.number(),
    bgs: z.number(),
    cgc: z.number(),
  }),
});

export const AnalyticsSetIndexSchema = z.object({
  setName: z.string(),
  count: z.number(),
  totalValueUsd: z.number(),
  sharePct: z.number(),
  changePct1y: z.number().nullable(),
});

export const AnalyticsMoverRowSchema = z.object({
  gradeId: z.string(),
  cardId: z.string().nullable(),
  cardName: z.string().nullable(),
  cardImageUrl: z.string().nullable(),
  setName: z.string().nullable(),
  valueUsd: z.number(),
  changePct1y: z.number(),
});

export const AnalyticsConcentrationSchema = z.object({
  top1Pct: z.number(),
  top3Pct: z.number(),
  top5Pct: z.number(),
  top1: z.object({
    cardName: z.string().nullable(),
    valueUsd: z.number(),
  }),
});

export const AnalyticsYearBucketSchema = z.object({
  decade: z.number(),
  count: z.number(),
  valueUsd: z.number(),
});

export const AnalyticsGradeBucketSchema = z.object({
  bucket: z.string(),
  count: z.number(),
});

export const AnalyticsOverviewSchema = z.object({
  stats: AnalyticsStatsSchema,
  kpis: AnalyticsKpisSchema,
  setIndexes: z.array(AnalyticsSetIndexSchema),
  movers: z.object({
    gainers: z.array(AnalyticsMoverRowSchema),
    losers: z.array(AnalyticsMoverRowSchema),
  }),
  concentration: AnalyticsConcentrationSchema.nullable(),
  yearDistribution: z.array(AnalyticsYearBucketSchema),
  gradeDistribution: z.array(AnalyticsGradeBucketSchema),
});
export type AnalyticsOverviewValidated = z.infer<typeof AnalyticsOverviewSchema>;

export const GradedCardSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  card_id: z.string(),
  scan_job_id: z.string().nullable(),
  grade: decimalString,
  house: z.string(),
  subgrades: z.record(z.string(), z.unknown()).nullable(),
  estimated_value_usd: decimalString.nullable(),
  purchase_price_usd: decimalString.nullable().optional(),
  purchase_date: isoDate.nullable().optional(),
  fingerprint_hash: z.string().nullable(),
  notes: z.string().nullable(),
  graded_at: isoDate,
  created_at: isoDate,
  updated_at: isoDate,
  card_name: z.string().nullable(),
  card_image_url: z.string().nullable(),
  card_number: z.string().nullable(),
  card_set_name: z.string().nullable(),
  card_year: z.number().nullable(),
  card_tcg: z.string().nullable(),
});

export const GradedCardListSchema = z.array(GradedCardSchema);

/* ─── re-export the zod root for callers that build inline schemas ──── */
export { z };
