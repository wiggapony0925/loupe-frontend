/**
 * useHoldingActions — organize / remove holdings, from anywhere.
 *
 * The vault grew these actions first, behind a long-press, and they were wired
 * directly into that screen: the sheets, the delete fan-out, the
 * remove-from-collection vs delete-everywhere decision, and the cache
 * invalidation all lived in `app/(tabs)/vault.tsx`. Any other surface that
 * wanted the same actions — card detail being the obvious one — had to
 * reimplement them, which is how two screens end up removing cards in two
 * subtly different ways.
 *
 * So it lives here instead. The hook owns the state, the mutations and the
 * sheet chrome; the caller renders `sheets` somewhere in its tree and calls
 * `organize(ids)` / `remove(ids)`. Both sheets are already generic over a list
 * of holding ids, so nothing about them needed to change.
 *
 * Scope matters and is not the caller's problem: when the user is inside a
 * named collection, "remove" asks whether they mean *drop from this
 * collection* or *delete from the vault entirely*, and only the latter issues
 * DELETEs. Getting that wrong silently destroys cards, which is precisely why
 * it should exist once.
 */
import React, { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { deleteGradedCard } from "@/infrastructure/repositories/forensicRepository";
import { invalidateHoldingCaches } from "@/application/queries/invalidateHoldings";
import { useBulkRemoveFromCollection } from "@/application/queries/collection/useCollectionMutations";
import { useActiveCollection } from "@/application/stores/activeCollectionStore";
import { useCollectionsOverview } from "@/application/queries/collection/useCollectionsOverview";
import { VaultCollectionActionSheet } from "./VaultCollectionActionSheet";
import { VaultRemoveSheet, type VaultRemoveScope } from "./VaultRemoveSheet";

export interface HoldingActions {
  /** Open the add / remove / transfer-between-collections sheet. */
  organize: (holdingIds: string[]) => void;
  /** Open the remove sheet (collection-only vs delete, scoped correctly). */
  remove: (holdingIds: string[]) => void;
  /** True while a destructive action is in flight — disable your buttons. */
  busy: boolean;
  /** Render this once, anywhere in the caller's tree. */
  sheets: React.ReactNode;
}

export function useHoldingActions(options?: {
  /** Called after a successful remove — e.g. clear a selection, or pop back. */
  onRemoved?: () => void;
  /** Mirror `busy` outward (the vault drives its island navbar off this). */
  onBusyChange?: (busy: boolean) => void;
}): HoldingActions {
  const qc = useQueryClient();
  const { collectionId: activeCollectionId } = useActiveCollection();
  const { data: portfolios } = useCollectionsOverview();
  // The remove sheet needs the NAME to offer "remove from <collection>" vs
  // "delete everywhere" — resolving it here is what lets any caller get the
  // correctly-scoped prompt without knowing collections exist.
  const activeCollectionName = useMemo(() => {
    if (!activeCollectionId) return null;
    return portfolios?.find((c) => c.id === activeCollectionId)?.name ?? null;
  }, [activeCollectionId, portfolios]);
  const bulkRemove = useBulkRemoveFromCollection();

  const [organizeIds, setOrganizeIds] = useState<string[] | null>(null);
  const [removeIds, setRemoveIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  // No batch DELETE endpoint yet, so fan out. `allSettled` so one 404 doesn't
  // strand the rest of the selection half-removed.
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map(deleteGradedCard));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) throw new Error(`${failed} card(s) could not be removed.`);
    },
    onSettled: () => invalidateHoldingCaches(qc),
  });

  const organize = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    Haptics.selectionAsync().catch(() => {});
    setOrganizeIds(ids);
  }, []);

  const remove = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    Haptics.selectionAsync().catch(() => {});
    setRemoveIds(ids);
  }, []);

  const confirmRemove = useCallback(
    async (scope: VaultRemoveScope) => {
      if (!removeIds || removeIds.length === 0) return;
      setBusy(true);
      options?.onBusyChange?.(true);
      try {
        if (scope === "collection") {
          if (!activeCollectionId) {
            throw new Error(
              "Switch into a collection to remove membership only.",
            );
          }
          await bulkRemove.mutateAsync({
            collectionId: activeCollectionId,
            gradedCardIds: removeIds,
          });
        } else {
          await deleteMutation.mutateAsync(removeIds);
        }
        setRemoveIds(null);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        options?.onRemoved?.();
      } catch (err) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
        // Surfaced, never swallowed: a partial fan-out failure means some
        // cards are still there and the user needs to know which action to
        // retry.
        Alert.alert(
          "Couldn't remove cards",
          String((err as Error)?.message ?? err),
        );
      } finally {
        setBusy(false);
        options?.onBusyChange?.(false);
      }
    },
    [removeIds, activeCollectionId, bulkRemove, deleteMutation, options],
  );

  const sheets = (
    <>
      <VaultCollectionActionSheet
        visible={organizeIds !== null}
        gradedCardIds={organizeIds ?? []}
        onClose={() => setOrganizeIds(null)}
        onDone={() => setOrganizeIds(null)}
      />
      <VaultRemoveSheet
        visible={removeIds !== null}
        count={removeIds?.length ?? 0}
        collectionName={activeCollectionName}
        busy={busy}
        onClose={() => setRemoveIds(null)}
        onConfirm={confirmRemove}
      />
    </>
  );

  return { organize, remove, busy, sheets };
}
