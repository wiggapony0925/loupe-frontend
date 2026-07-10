import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { invalidateHoldingCaches } from "../invalidateHoldings";

interface CreateCollectionPayload {
  name: string;
}

interface UpdateCollectionPayload {
  name: string;
}

interface BulkResult {
  added: number;
  removed: number;
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCollectionPayload) => {
      return apiFetch(ENDPOINTS.collections.list, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection", "overview"] });
    },
  });
}

export function useUpdateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateCollectionPayload }) => {
      return apiFetch(ENDPOINTS.collections.item(id), {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection", "overview"] });
      qc.invalidateQueries({ queryKey: ["collection", "summary"] });
    },
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(ENDPOINTS.collections.item(id), {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection", "overview"] });
      qc.invalidateQueries({ queryKey: ["collection", "summary"] });
    },
  });
}

/** Bulk-add holdings to a collection (idempotent). */
export function useBulkAddToCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      collectionId,
      gradedCardIds,
    }: {
      collectionId: string;
      gradedCardIds: string[];
    }) =>
      apiFetch<BulkResult>(ENDPOINTS.collections.itemsBulk(collectionId), {
        method: "POST",
        json: { graded_card_ids: gradedCardIds },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection", "overview"] });
      invalidateHoldingCaches(qc);
    },
  });
}

/** Bulk-remove holdings from a collection. */
export function useBulkRemoveFromCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      collectionId,
      gradedCardIds,
    }: {
      collectionId: string;
      gradedCardIds: string[];
    }) =>
      apiFetch<BulkResult>(ENDPOINTS.collections.itemsBulkRemove(collectionId), {
        method: "POST",
        json: { graded_card_ids: gradedCardIds },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection", "overview"] });
      invalidateHoldingCaches(qc);
    },
  });
}

/** Move holdings from one collection into another. */
export function useTransferBetweenCollections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      targetId,
      sourceId,
      gradedCardIds,
    }: {
      targetId: string;
      sourceId: string;
      gradedCardIds: string[];
    }) =>
      apiFetch<BulkResult>(ENDPOINTS.collections.itemsTransfer(targetId), {
        method: "POST",
        json: { source_id: sourceId, graded_card_ids: gradedCardIds },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection", "overview"] });
      invalidateHoldingCaches(qc);
    },
  });
}
