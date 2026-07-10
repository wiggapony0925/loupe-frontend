/**
 * VaultCollectionActionSheet — multi-select organize flow.
 *
 * Add / remove / transfer holdings across collections via the shared
 * BottomSheet chrome + SheetChoice rows (same language as Remove).
 */
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { ArrowRightLeft, FolderMinus, FolderPlus } from "lucide-react-native";
import { BottomSheet } from "@/presentation/components/BottomSheet";
import {
  SheetChoiceGroup,
  SheetChoiceRow,
  SheetPrimaryButton,
} from "@/presentation/components/SheetChoice";
import {
  useCollectionsOverview,
  type CollectionSummary,
} from "@/application/queries/collection/useCollectionsOverview";
import {
  useBulkAddToCollection,
  useBulkRemoveFromCollection,
  useTransferBetweenCollections,
} from "@/application/queries/collection/useCollectionMutations";
import { useActiveCollection } from "@/application/stores/activeCollectionStore";
import { spacing, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

type Action = "add" | "remove" | "transfer";

interface VaultCollectionActionSheetProps {
  visible: boolean;
  gradedCardIds: string[];
  onClose: () => void;
  onDone: () => void;
}

export function VaultCollectionActionSheet({
  visible,
  gradedCardIds,
  onClose,
  onDone,
}: VaultCollectionActionSheetProps) {
  const p = useThemedPalette();
  const { data: portfolios } = useCollectionsOverview();
  const { collectionId: activeId } = useActiveCollection();
  const bulkAdd = useBulkAddToCollection();
  const bulkRemove = useBulkRemoveFromCollection();
  const transfer = useTransferBetweenCollections();

  const [action, setAction] = useState<Action>("add");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const custom: CollectionSummary[] = useMemo(
    () => (portfolios ?? []).filter((r) => r.id && !r.is_all),
    [portfolios],
  );

  const activeName =
    custom.find((c) => c.id === activeId)?.name ?? (activeId ? "this collection" : null);

  const canRemove = Boolean(activeId);
  const canTransfer = Boolean(activeId) && custom.length > 1;

  useEffect(() => {
    if (!visible) return;
    setAction("add");
    setTargetId(null);
    setBusy(false);
  }, [visible, gradedCardIds.length]);

  const run = async () => {
    if (gradedCardIds.length === 0) return;
    setBusy(true);
    try {
      if (action === "add") {
        if (!targetId) throw new Error("Pick a collection.");
        await bulkAdd.mutateAsync({
          collectionId: targetId,
          gradedCardIds,
        });
      } else if (action === "remove") {
        if (!activeId) throw new Error("Switch into a collection first.");
        await bulkRemove.mutateAsync({
          collectionId: activeId,
          gradedCardIds,
        });
      } else if (action === "transfer") {
        if (!activeId || !targetId) throw new Error("Pick a destination.");
        await transfer.mutateAsync({
          targetId,
          sourceId: activeId,
          gradedCardIds,
        });
      }
      onDone();
      onClose();
    } catch (e) {
      Alert.alert(
        "Couldn't update collections",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  };

  const noun = gradedCardIds.length === 1 ? "card" : "cards";
  const destinations = custom.filter((c) =>
    action === "transfer" ? c.id !== activeId : true,
  );
  const canSubmit =
    !busy &&
    gradedCardIds.length > 0 &&
    (action === "remove" || Boolean(targetId));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      closeDisabled={busy}
      eyebrow="Organize"
      title={`${gradedCardIds.length} ${noun}`}
      subtitle="Sort into collections without leaving your vault."
      subtitleLines={2}
      maxHeight="88%"
    >
      <View style={{ gap: spacing.md, flex: 1 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(
            [
              { key: "add" as const, label: "Add to", Icon: FolderPlus, enabled: true },
              {
                key: "remove" as const,
                label: "Remove",
                Icon: FolderMinus,
                enabled: canRemove,
              },
              {
                key: "transfer" as const,
                label: "Transfer",
                Icon: ArrowRightLeft,
                enabled: canTransfer,
              },
            ] as const
          ).map((opt) => {
            const active = action === opt.key;
            return (
              <Pressable
                key={opt.key}
                disabled={!opt.enabled || busy}
                onPress={() => {
                  setAction(opt.key);
                  setTargetId(null);
                }}
                style={{
                  flex: 1,
                  alignItems: "center",
                  gap: 4,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: active ? withAlpha(p.accent.mint, 0.5) : p.line.default,
                  backgroundColor: active
                    ? withAlpha(p.accent.mint, 0.12)
                    : p.bg.elevated,
                  opacity: opt.enabled ? 1 : 0.35,
                }}
              >
                <opt.Icon
                  size={16}
                  color={active ? p.accent.mint : p.ink.muted}
                  strokeWidth={2.4}
                />
                <Text
                  style={{
                    color: active ? p.accent.mint : p.ink.muted,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {action === "remove" ? (
          <View
            style={{
              padding: spacing.lg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: p.line.default,
              backgroundColor: p.bg.elevated,
            }}
          >
            <Text style={{ color: p.ink.muted, fontSize: 13, lineHeight: 19 }}>
              Remove these {noun} from{" "}
              <Text style={{ color: p.ink.default, fontWeight: "700" }}>
                {activeName ?? "the current collection"}
              </Text>
              . They stay in your main portfolio (All).
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ flexGrow: 0, maxHeight: 320 }}
            contentContainerStyle={{ gap: 0 }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={{
                marginBottom: spacing.sm,
                color: p.ink.dim,
                fontSize: 10,
                fontWeight: "800",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {action === "transfer" ? "Move into" : "Add to"}
            </Text>
            {destinations.length === 0 ? (
              <Text style={{ color: p.ink.muted, fontSize: 13, lineHeight: 18 }}>
                Create a collection from the portfolio switcher first.
              </Text>
            ) : (
              <SheetChoiceGroup>
                {destinations.map((c, i) => (
                  <SheetChoiceRow
                    key={c.id!}
                    icon={FolderPlus}
                    accent={p.accent.mint}
                    title={c.name}
                    subtitle={`${c.card_count} ${c.card_count === 1 ? "card" : "cards"}`}
                    selected={targetId === c.id}
                    onPress={() => setTargetId(c.id)}
                    isLast={i === destinations.length - 1}
                  />
                ))}
              </SheetChoiceGroup>
            )}
          </ScrollView>
        )}

        <View style={{ flex: 1 }} />

        <View style={{ gap: spacing.sm }}>
          <SheetPrimaryButton
            label={
              action === "add"
                ? "Add to collection"
                : action === "remove"
                  ? "Remove from collection"
                  : "Transfer"
            }
            loading={busy}
            disabled={!canSubmit}
            onPress={() => void run()}
          />
          <Pressable
            onPress={busy ? undefined : onClose}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            hitSlop={8}
            style={({ pressed }) => ({
              alignItems: "center",
              paddingVertical: 12,
              opacity: busy ? 0.4 : pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: p.ink.muted, fontSize: 14, fontWeight: "600" }}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
