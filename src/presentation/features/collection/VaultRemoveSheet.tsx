/**
 * VaultRemoveSheet — choose how to remove selected holdings.
 *
 * Built on the shared BottomSheet + SheetChoice primitives so it matches
 * ExternalBrowserSheet / Organize. When viewing a named collection the user
 * can drop membership only (cards stay in All) or delete from the vault.
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
    ? `Cards removed from a collection stay in All. Deleting from the portfolio removes them everywhere.`
    : `Permanently removes ${noun} from your vault. The catalog card stays searchable.`;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      closeDisabled={busy}
      eyebrow="Remove"
      title={`${count} ${noun}`}
      subtitle={subtitle}
      subtitleLines={3}
      maxHeight="78%"
    >
      <View style={{ gap: spacing.lg, flex: 1 }}>
        <SheetChoiceGroup>
          {inCollection ? (
            <SheetChoiceRow
              icon={FolderMinus}
              accent={p.accent.mint}
              title={`Remove from ${collectionName}`}
              subtitle="Keeps them in your main portfolio (All)."
              selected={picked === "collection"}
              onPress={() => setPicked("collection")}
              isLast={false}
            />
          ) : null}
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

        <View style={{ flex: 1 }} />

        <View style={{ gap: spacing.sm }}>
          <SheetPrimaryButton
            label={
              picked === "collection"
                ? `Remove from ${collectionName}`
                : "Remove from portfolio"
            }
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
