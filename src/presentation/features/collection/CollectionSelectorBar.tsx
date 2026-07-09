/**
 * `CollectionSelectorBar` — the command-center "which portfolio am I viewing?"
 * control. The mobile sibling of the web dashboard's portfolio dropdown.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ (◆)  Umbreon Master Set                    ⌄  │
 *   │      VIEWING · 18 cards · $12,340             │
 *   └──────────────────────────────────────────────┘
 *
 * Shows the active collection (defaulting to the synthetic **All**) and opens
 * {@link PortfolioPickerSheet} on tap. Selecting a collection sets the active
 * id in the store, which re-scopes the dashboard/analytics/history because the
 * backend does the scoping and every query just passes `collection_id`.
 */

import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, Layers } from "lucide-react-native";
import {
  useCollectionsOverview,
  type CollectionSummary,
} from "@/application/queries/collection/useCollectionsOverview";
import { useActiveCollection } from "@/application/stores/activeCollectionStore";
import { PortfolioPickerSheet } from "@/presentation/components/PortfolioPickerSheet";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

function money(usd: number): string {
  return `$${Math.round(usd).toLocaleString()}`;
}

export function CollectionSelectorBar() {
  const p = useThemedPalette();
  const [open, setOpen] = useState(false);
  const { collectionId } = useActiveCollection();
  const { data } = useCollectionsOverview();
  const rows: CollectionSummary[] = data ?? [];

  // Resolve the active row: explicit id → the "All" synthetic → first.
  const active =
    rows.find((r) => (r.id ?? null) === (collectionId ?? null)) ??
    rows.find((r) => r.is_all) ??
    rows[0] ??
    null;

  const tint = active?.is_all ? p.accent.mint : (active?.color ?? p.accent.blue);
  const name = active?.name ?? "All cards";
  const count = active?.card_count ?? 0;
  const value = active?.total_value_usd ?? 0;
  const multiple = rows.length > 1;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Viewing ${name}. ${count} cards. Tap to switch portfolio.`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(tint, 0.16),
          }}
        >
          <Layers size={18} color={tint} strokeWidth={2.4} />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              color: p.ink.default,
              fontSize: 16,
              fontWeight: "800",
              letterSpacing: -0.3,
            }}
          >
            {name}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: p.ink.dim,
              fontSize: 11,
              fontWeight: "600",
              letterSpacing: 0.6,
              marginTop: 2,
            }}
          >
            VIEWING · {count} {count === 1 ? "card" : "cards"} · {money(value)}
          </Text>
        </View>

        {/* Only hint "switchable" when there's more than the All view. */}
        {multiple ? (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: p.bg.sunken,
            }}
          >
            <ChevronDown size={16} color={p.ink.muted} strokeWidth={2.4} />
          </View>
        ) : (
          <ChevronDown size={16} color={p.ink.dim} strokeWidth={2.2} />
        )}
      </Pressable>

      <PortfolioPickerSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
