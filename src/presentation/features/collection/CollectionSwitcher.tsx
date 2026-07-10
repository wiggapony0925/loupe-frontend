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
  const tint = isAll ? p.accent.mint : p.accent.blue;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Viewing ${name}. Tap to switch portfolio.`}
        hitSlop={8}
        className="flex-row items-center gap-1.5 rounded-full border px-2.5 py-1.5"
        style={({ pressed }) => ({
          opacity: pressed ? 0.75 : 1,
          borderColor: withAlpha(tint, 0.45),
          backgroundColor: withAlpha(tint, 0.12),
        })}
      >
        <Layers size={11} color={tint} strokeWidth={2.6} />
        <Text
          numberOfLines={1}
          style={{
            color: tint,
            fontSize: 11,
            fontWeight: "800",
            letterSpacing: 0.6,
            maxWidth: 100,
          }}
        >
          {name.toUpperCase()}
        </Text>
        <ChevronDown size={11} color={tint} strokeWidth={2.6} />
      </Pressable>

      <PortfolioPickerSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
