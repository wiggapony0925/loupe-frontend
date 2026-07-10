/**
 * VaultRemoveSheet — confirm removing selected holdings.
 *
 * Compact BottomSheet (no full-page dead space). In a named collection the
 * user can drop membership only or delete from the vault; in All there is
 * a single destructive confirm.
 */
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { FolderMinus, Trash2 } from "lucide-react-native";
import { BottomSheet } from "@/presentation/components/BottomSheet";
import {
  SheetChoiceGroup,
  SheetChoiceRow,
  SheetPrimaryButton,
} from "@/presentation/components/SheetChoice";
import { spacing, useThemedPalette } from "@/presentation/theme/tokens";

export type VaultRemoveScope = "collection" | "portfolio";

interface VaultRemoveSheetProps {
  visible: boolean;
  count: number;
  /** Named collection currently scoped — null when viewing All. */
  collectionName: string | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (scope: VaultRemoveScope) => void;
}

export function VaultRemoveSheet({
  visible,
  count,
  collectionName,
  busy = false,
  onClose,
  onConfirm,
}: VaultRemoveSheetProps) {
  const p = useThemedPalette();
  const inCollection = Boolean(collectionName);
  const noun = count === 1 ? "card" : "cards";
  const [picked, setPicked] = useState<VaultRemoveScope>(
    inCollection ? "collection" : "portfolio",
  );

  useEffect(() => {
    if (!visible) return;
    setPicked(inCollection ? "collection" : "portfolio");
  }, [visible, inCollection, count]);

  const subtitle = inCollection
    ? "Cards removed from a collection stay in All. Deleting from the portfolio removes them everywhere."
    : `Permanently removes ${noun} from your vault. The catalog card stays searchable.`;

  const confirmLabel =
    picked === "collection"
      ? `Remove from ${collectionName}`
      : "Remove from portfolio";

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      closeDisabled={busy}
      eyebrow="Remove"
      title={`${count} ${noun}`}
      subtitle={subtitle}
      subtitleLines={3}
      maxHeight="72%"
      compact
    >
      <View style={{ gap: spacing.lg }}>
        {inCollection ? (
          <SheetChoiceGroup>
            <SheetChoiceRow
              icon={FolderMinus}
              accent={p.accent.mint}
              title={`Remove from ${collectionName}`}
              subtitle="Keeps them in your main portfolio (All)."
              selected={picked === "collection"}
              onPress={() => setPicked("collection")}
            />
            <SheetChoiceRow
              icon={Trash2}
              accent={p.accent.rose}
              title="Remove from portfolio"
              subtitle="Deletes the holdings from your vault for good."
              selected={picked === "portfolio"}
              onPress={() => setPicked("portfolio")}
              isLast
            />
          </SheetChoiceGroup>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
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
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(214, 59, 48, 0.14)",
              }}
            >
              <Trash2 size={18} color={p.accent.rose} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text
                style={{ color: p.ink.default, fontSize: 14, fontWeight: "800" }}
              >
                Remove from portfolio
              </Text>
              <Text
                style={{ color: p.ink.muted, fontSize: 12, lineHeight: 16 }}
              >
                Deletes {noun} from your vault. Catalog entries stay searchable.
              </Text>
            </View>
          </View>
        )}

        <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
          <SheetPrimaryButton
            label={confirmLabel}
            tone={picked === "portfolio" ? "rose" : "mint"}
            loading={busy}
            onPress={() => onConfirm(picked)}
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
