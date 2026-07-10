/**
 * Mutations for the user's graded-card collection.
 *
 * - `useCreateGrade` — manually add a card to the vault (the non-scan
 *   entry path: search → card detail → "Add to collection"). Accepts
 *   either a resolved local `card_id` or a composite `upstream_id`
 *   like `"pokemontcg:base1-4"` and lets the backend materialize the
 *   local card row on the fly.
 * - `useUpdateGrade` — edit a holding from the same form: grade, house,
 *   cost basis, notes, estimated value.
 * - `useDeleteGrade` — soft-delete a holding.
 *
 * All three invalidate the live `/me/grades`, portfolio, and per-card
 * caches so the rest of the app reflects the change immediately.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { GradedCard, GradeHouse, RawCondition } from "@/infrastructure/http";
import { invalidateHoldingCaches } from "../invalidateHoldings";

export interface CreateGradeInput {
  /** Resolved local catalog UUID. Mutually exclusive with `upstreamId`. */
  cardId?: string | null;
  /** Composite upstream id like `"pokemontcg:base1-4"`. */
  upstreamId?: string | null;
  /** Numeric grade in [0, 10]. Ignored when `house === "loupe"` (backend forces 0). */
  grade: number;
  house: GradeHouse;
  /** Raw-card condition. Required when `house === "loupe"`; ignored for slabs. */
  condition?: RawCondition | null;
  /** What the user paid (USD). Optional — null means "no cost recorded". */
  purchasePriceUsd?: number | null;
  /** Acquisition date as `YYYY-MM-DD`. */
  purchaseDate?: string | null;
  /** Current market estimate (USD). Optional. */
  estimatedValueUsd?: number | null;
  notes?: string | null;
  /** User organization tags for this holding. */
  tags?: string[];
  /**
   * Optional portfolio to categorize into after create. ``null`` / omitted
   * = vault "All" only (no collection membership). Backend still owns the
   * membership write via ``POST …/items/bulk``.
   */
  collectionId?: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toCreateBody(input: CreateGradeInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    grade: input.grade,
    house: input.house,
  };
  // Route the id by SHAPE, not by which prop the caller used: the backend
  // requires `card_id` to be a local UUID and rejects composite catalog ids
  // ("pokemontcg:base1-4") with a 422 — those must go as `upstream_id`,
  // which the server materializes into a local card. Every screen passes
  // the id it has; this chokepoint sends it in the right field.
  if (input.cardId) {
    if (UUID_RE.test(input.cardId)) body.card_id = input.cardId;
    else body.upstream_id = input.cardId;
  }
  if (input.upstreamId) body.upstream_id = input.upstreamId;
  if (input.condition != null) body.condition = input.condition;
  if (input.purchasePriceUsd != null)
    body.purchase_price_usd = input.purchasePriceUsd;
  if (input.purchaseDate) body.purchase_date = input.purchaseDate;
  if (input.estimatedValueUsd != null)
    body.estimated_value_usd = input.estimatedValueUsd;
  if (input.notes != null && input.notes !== "") body.notes = input.notes;
  if (input.tags && input.tags.length > 0) body.tags = input.tags;
  return body;
}

export function useCreateGrade() {
  const qc = useQueryClient();
  return useMutation<GradedCard, Error, CreateGradeInput>({
    mutationFn: async (input) => {
      // RAW holdings: client mirrors backend normalization so the payload
      // is honest even before the server rewrites it.
      const isRaw = input.house === "loupe";
      const body = toCreateBody({
        ...input,
        grade: isRaw ? 0 : input.grade,
        condition: isRaw ? (input.condition ?? "nm") : null,
      });
      const created = await apiFetch<GradedCard>(ENDPOINTS.grades.mine, {
        method: "POST",
        json: body,
      });
      // Optional portfolio membership — one bulk call, O(1) round-trips.
      if (input.collectionId && created?.id) {
        await apiFetch(ENDPOINTS.collections.itemsBulk(input.collectionId), {
          method: "POST",
          json: { graded_card_ids: [created.id] },
        });
      }
      return created;
    },
    onSuccess: () => {
      invalidateHoldingCaches(qc);
      qc.invalidateQueries({ queryKey: ["collection", "overview"] });
    },
  });
}

export interface UpdateGradeInput {
  id: string;
  grade?: number;
  house?: GradeHouse;
  condition?: RawCondition | null;
  purchasePriceUsd?: number | null;
  purchaseDate?: string | null;
  estimatedValueUsd?: number | null;
  notes?: string | null;
  /** Full replacement set of tags. `[]` clears them. */
  tags?: string[];
}

function toUpdateBody(input: UpdateGradeInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.grade !== undefined) body.grade = input.grade;
  if (input.house !== undefined) body.house = input.house;
  if (input.condition !== undefined) body.condition = input.condition;
  if (input.purchasePriceUsd !== undefined)
    body.purchase_price_usd = input.purchasePriceUsd;
  if (input.purchaseDate !== undefined) body.purchase_date = input.purchaseDate;
  if (input.estimatedValueUsd !== undefined)
    body.estimated_value_usd = input.estimatedValueUsd;
  if (input.notes !== undefined) body.notes = input.notes;
  if (input.tags !== undefined) body.tags = input.tags;
  return body;
}

export function useUpdateGrade() {
  const qc = useQueryClient();
  return useMutation<GradedCard, Error, UpdateGradeInput>({
    mutationFn: ({ id, ...rest }) =>
      apiFetch<GradedCard>(ENDPOINTS.grades.item(id), {
        method: "PATCH",
        json: toUpdateBody({ id, ...rest }),
      }),
    onSuccess: () => invalidateHoldingCaches(qc),
  });
}

export function useDeleteGrade() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiFetch<void>(ENDPOINTS.grades.item(id), {
        method: "DELETE",
      }),
    onSuccess: () => invalidateHoldingCaches(qc),
  });
}
