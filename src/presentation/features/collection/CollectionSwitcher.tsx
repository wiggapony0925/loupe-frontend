/**
 * `CollectionSwitcher` — the compact "which portfolio am I viewing?" control.
 *
 *     Viewing  All  ⌄
 *
 * A small self-aligned pill that sits just above the "Today" hero on the
 * command center. Tapping it opens {@link PortfolioPickerSheet}; picking a
 * collection sets the active id in the store, which re-scopes the dashboard
 * (the backend does the scoping — the client just passes `collection_id`).
 */

import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import {
  useCollectionsOverview,
  type CollectionSummary,
} from "@/application/queries/collection/useCollectionsOverview";
import { useActiveCollection } from "@/application/stores/activeCollectionStore";
import { PortfolioPickerSheet } from "@/presentation/components/PortfolioPickerSheet";
import { useThemedPalette } from "@/presentation/theme/tokens";

export function CollectionSwitcher() {
  const p = useThemedPalette();
  const [open, setOpen] = useState(false);
  const { collectionId } = useActiveCollection();
  const { data } = useCollectionsOverview();
  const rows: CollectionSummary[] = data ?? [];

  const active =
    rows.find((r) => (r.id ?? null) === (collectionId ?? null)) ??
    rows.find((r) => r.is_all) ??
    null;
  const name = active?.is_all ? "All" : (active?.name ?? "All");

  return (
    <View style={{ flexDirection: "row" }}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Viewing ${name}. Tap to switch portfolio.`}
        hitSlop={8}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          alignSelf: "flex-start",
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ color: p.ink.dim, fontSize: 13, fontWeight: "600" }}>Viewing</Text>
        <Text
          numberOfLines={1}
          style={{
            color: p.ink.default,
            fontSize: 13,
            fontWeight: "700",
            maxWidth: 200,
          }}
        >
          {name}
        </Text>
        <ChevronDown size={15} color={p.ink.muted} strokeWidth={2.4} />
      </Pressable>

      <PortfolioPickerSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}
