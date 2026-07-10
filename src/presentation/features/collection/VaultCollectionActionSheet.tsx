/**
 * VaultCollectionActionSheet — multi-select organize flow.
 *
 * Add / remove / transfer holdings across collections via the shared
 * BottomSheet chrome + SheetChoice rows (same language as Remove).
 */
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { ArrowRightLeft, FolderKanban, FolderMinus, FolderPlus } from "lucide-react-native";
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

const ACTION_OPTIONS = [
  { key: "add" as const, label: "Add to", Icon: FolderPlus },
  { key: "remove" as const, label: "Remove", Icon: FolderMinus },
  { key: "transfer" as const, label: "Transfer", Icon: ArrowRightLeft },
] as const;

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

  const listLabel =
    action === "transfer" ? "Move into" : "Choose collection";

  const primaryLabel =
    action === "add"
      ? targetId
        ? `Add to ${destinations.find((c) => c.id === targetId)?.name ?? "collection"}`
        : "Add to collection"
      : action === "remove"
        ? "Remove from collection"
        : targetId
          ? `Move to ${destinations.find((c) => c.id === targetId)?.name ?? "collection"}`
          : "Transfer";

  const isActionEnabled = (key: Action) => {
    if (key === "add") return true;
    if (key === "remove") return canRemove;
    return canTransfer;
  };

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
      compact
    >
      <View style={{ gap: spacing.md }}>
        {/* Segmented action picker */}
        <View
          style={{
            flexDirection: "row",
            padding: 4,
            gap: 4,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: withAlpha(p.ink.default, 0.04),
          }}
        >
          {ACTION_OPTIONS.map((opt) => {
            const active = action === opt.key;
            const enabled = isActionEnabled(opt.key);
            return (
              <Pressable
                key={opt.key}
                disabled={!enabled || busy}
                onPress={() => {
                  setAction(opt.key);
                  setTargetId(null);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active, disabled: !enabled }}
                style={{ flex: 1 }}
              >
                {({ pressed }) => (
                  <View
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: active ? 1 : 0,
                      borderColor: active ? withAlpha(p.accent.mint, 0.35) : "transparent",
                      backgroundColor: active
                        ? p.bg.base
                        : pressed && enabled
                          ? withAlpha(p.ink.default, 0.05)
                          : "transparent",
                      opacity: enabled ? 1 : 0.35,
                      shadowColor: "#000",
                      shadowOpacity: active ? 0.06 : 0,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 2 },
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
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {action === "remove" ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.md,
              padding: spacing.lg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: p.line.default,
              backgroundColor: p.bg.elevated,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(p.accent.mint, 0.14),
              }}
            >
              <FolderMinus size={16} color={p.accent.mint} strokeWidth={2.4} />
            </View>
            <Text style={{ flex: 1, color: p.ink.muted, fontSize: 13, lineHeight: 19 }}>
              Remove these {noun} from{" "}
              <Text style={{ color: p.ink.default, fontWeight: "700" }}>
                {activeName ?? "the current collection"}
              </Text>
              . They stay in your main portfolio (All).
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ flexGrow: 0, maxHeight: 300 }}
            contentContainerStyle={{ gap: 0 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {destinations.length === 0 ? (
              <View
                style={{
                  padding: spacing.lg,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: p.line.default,
                  backgroundColor: p.bg.elevated,
                }}
              >
                <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "700" }}>
                  No collections yet
                </Text>
                <Text
                  style={{
                    color: p.ink.muted,
                    fontSize: 13,
                    lineHeight: 18,
                    marginTop: 4,
                  }}
                >
                  Create one from the portfolio switcher at the top of your vault.
                </Text>
              </View>
            ) : (
              <SheetChoiceGroup label={listLabel}>
                {destinations.map((c, i) => (
                  <SheetChoiceRow
                    key={c.id!}
                    icon={FolderKanban}
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

        <View style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
          <SheetPrimaryButton
            label={primaryLabel}
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
          >
            {({ pressed }) => (
              <View
                style={{
                  alignItems: "center",
                  paddingVertical: 12,
                  opacity: busy ? 0.4 : pressed ? 0.7 : 1,
                }}
              >
                <Text style={{ color: p.ink.muted, fontSize: 14, fontWeight: "600" }}>
                  Cancel
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
