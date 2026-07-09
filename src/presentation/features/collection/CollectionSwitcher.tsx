/**
 * `CollectionSwitcher` — the compact "which portfolio am I viewing?" control.
 *
 *     Viewing  All  ⌄            (whole vault)
 *     Viewing  Umbreon Set  ⌄  ✕ (a specific collection — ✕ clears back to All)
 *
 * A small self-aligned pill used on the command center (above Today), the
 * vault, and analytics. Tapping opens {@link PortfolioPickerSheet}; picking a
 * collection sets the active id in the store, which re-scopes that surface
 * (the backend does the scoping — the client just passes `collection_id`).
 * When a specific collection is active a ✕ appears to clear back to "All".
 */

import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, X } from "lucide-react-native";
import {
  useCollectionsOverview,
  type CollectionSummary,
} from "@/application/queries/collection/useCollectionsOverview";
import { useActiveCollection } from "@/application/stores/activeCollectionStore";
import { PortfolioPickerSheet } from "@/presentation/components/PortfolioPickerSheet";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export function CollectionSwitcher() {
  const p = useThemedPalette();
  const [open, setOpen] = useState(false);
  const { collectionId, setCollectionId } = useActiveCollection();
  const { data } = useCollectionsOverview();
  const rows: CollectionSummary[] = data ?? [];

  const active =
    rows.find((r) => (r.id ?? null) === (collectionId ?? null)) ??
    rows.find((r) => r.is_all) ??
    null;
  const isAll = !collectionId || (active?.is_all ?? true);
  const name = isAll ? "All" : (active?.name ?? "All");

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Viewing ${name}. Tap to switch portfolio.`}
        hitSlop={8}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: isAll ? p.line.default : withAlpha(p.accent.mint, 0.4),
          backgroundColor: isAll ? p.bg.elevated : withAlpha(p.accent.mint, 0.12),
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ color: p.ink.dim, fontSize: 13, fontWeight: "600" }}>Viewing</Text>
        <Text
          numberOfLines={1}
          style={{
            color: isAll ? p.ink.default : p.accent.mint,
            fontSize: 13,
            fontWeight: "700",
            maxWidth: 200,
          }}
        >
          {name}
        </Text>
        <ChevronDown size={15} color={isAll ? p.ink.muted : p.accent.mint} strokeWidth={2.4} />
      </Pressable>

      {!isAll ? (
        <Pressable
          onPress={() => setCollectionId(null)}
          accessibilityRole="button"
          accessibilityLabel="Show all cards"
          hitSlop={8}
          style={({ pressed }) => ({
            height: 28,
            width: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <X size={14} color={p.ink.muted} strokeWidth={2.4} />
        </Pressable>
      ) : null}

      <PortfolioPickerSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}
