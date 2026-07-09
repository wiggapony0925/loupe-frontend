/**
 * `CollectionSwitcher` — the compact "which portfolio am I viewing?" tag.
 *
 *     ◈ All ⌄               (whole vault)
 *     ◈ Umbreon Set ⌄  ✕    (a specific collection — ✕ clears back to All)
 *
 * One small mint pill, sat above the headline value on the command center /
 * analytics chart and at the top of the vault. Tapping opens
 * {@link PortfolioPickerSheet}; the active id lives in the (backend-synced)
 * store and re-scopes every value surface — the backend does the scoping, the
 * client just passes `collection_id`. The name is always the app's mint accent
 * so the current scope reads at a glance.
 */

import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, Layers, X } from "lucide-react-native";
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
  const mint = p.accent.mint;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Viewing ${name}. Tap to switch portfolio.`}
        hitSlop={8}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 6,
          paddingHorizontal: 11,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: withAlpha(mint, isAll ? 0.32 : 0.5),
          backgroundColor: withAlpha(mint, isAll ? 0.1 : 0.16),
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Layers size={12} color={mint} strokeWidth={2.4} />
        <Text
          numberOfLines={1}
          style={{ color: mint, fontSize: 12.5, fontWeight: "800", maxWidth: 200 }}
        >
          {name}
        </Text>
        <ChevronDown size={12} color={mint} strokeWidth={2.6} />
      </Pressable>

      {!isAll ? (
        <Pressable
          onPress={() => setCollectionId(null)}
          accessibilityRole="button"
          accessibilityLabel="Show all cards"
          hitSlop={8}
          style={({ pressed }) => ({
            height: 26,
            width: 26,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <X size={13} color={p.ink.muted} strokeWidth={2.4} />
        </Pressable>
      ) : null}

      <PortfolioPickerSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}
