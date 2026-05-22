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
});

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
