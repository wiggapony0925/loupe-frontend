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
import { queryKeys } from "../queryKeys";

export interface CreateGradeInput {
  /** Resolved local catalog UUID. Mutually exclusive with `upstreamId`. */
  cardId?: string | null;
  /** Composite upstream id like `"pokemontcg:base1-4"`. */
  upstreamId?: string | null;
  /** Numeric grade in [0, 10]. */
  grade: number;
  house: GradeHouse;
  /** Raw-card condition. Only meaningful when `house === "loupe"`. */
  condition?: RawCondition | null;
  /** What the user paid (USD). Optional — null means "no cost recorded". */
  purchasePriceUsd?: number | null;
  /** Acquisition date as `YYYY-MM-DD`. */
  purchaseDate?: string | null;
  /** Current market estimate (USD). Optional. */
  estimatedValueUsd?: number | null;
  notes?: string | null;
}

function toCreateBody(input: CreateGradeInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    grade: input.grade,
    house: input.house,
  };
  if (input.cardId) body.card_id = input.cardId;
  if (input.upstreamId) body.upstream_id = input.upstreamId;
  if (input.condition != null) body.condition = input.condition;
  if (input.purchasePriceUsd != null)
    body.purchase_price_usd = input.purchasePriceUsd;
  if (input.purchaseDate) body.purchase_date = input.purchaseDate;
  if (input.estimatedValueUsd != null)
    body.estimated_value_usd = input.estimatedValueUsd;
  if (input.notes != null && input.notes !== "") body.notes = input.notes;
  return body;
}

function invalidateGradeCaches(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: queryKeys.me.grades() });
  void qc.invalidateQueries({ queryKey: queryKeys.collection.all });
  void qc.invalidateQueries({ queryKey: queryKeys.cards.sparklines() });
  void qc.invalidateQueries({ queryKey: queryKeys.portfolio.all });
  void qc.invalidateQueries({ queryKey: queryKeys.sets.progress() });
}

export function useCreateGrade() {
  const qc = useQueryClient();
  return useMutation<GradedCard, Error, CreateGradeInput>({
    mutationFn: (input) =>
      apiFetch<GradedCard>(ENDPOINTS.grades.mine, {
        method: "POST",
        json: toCreateBody(input),
      }),
    onSuccess: () => invalidateGradeCaches(qc),
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
    onSuccess: () => invalidateGradeCaches(qc),
  });
}

export function useDeleteGrade() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiFetch<void>(ENDPOINTS.grades.item(id), {
        method: "DELETE",
      }),
    onSuccess: () => invalidateGradeCaches(qc),
  });
}
