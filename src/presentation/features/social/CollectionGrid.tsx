/**
 * CollectionGrid — a collector's cards, rendered as YOUR VAULT renders
 * cards.
 *
 * This is deliberately not a bespoke social grid: it maps the social
 * payload onto the same `CollectionCard` domain shape the vault uses and
 * hands each one to `CardThumbnail`, the vault's own grid tile. Looking at
 * someone's profile should feel exactly like looking at a vault — same
 * art treatment, same grade pill, same value footer, same column math.
 *
 * A search field sits above it: their collection is often hundreds of
 * cards, and "do they have Umbreon?" is the question people actually
 * arrive with. Filtering is client-side over the loaded page — instant,
 * no round trip.
 */
import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Pressable } from "react-native";
import { Search, X } from "lucide-react-native";
import type { SocialCollectionItemWire } from "@/infrastructure/http";
import type { CollectionCard } from "@/domain/collection/types";
import { CardThumbnail } from "@/presentation/features/collection/CardThumbnail";
import {
  chunkRows,
  vaultGridColumns,
} from "@/presentation/features/collection/vaultLayout";
import { useThemedPalette } from "@/presentation/theme/tokens";


/** Social payload → the vault's card shape, so the vault tile can render it. */
function toCollectionCard(item: SocialCollectionItemWire): CollectionCard {
  const grade = Number(item.grade);
  return {
    id: item.id,
    cardId: item.card_id,
    title: item.card_name ?? "Unknown card",
    // Same boundary widening the vault's repository does: the union is a
    // UI-facing enum, the backend returns arbitrary set names.
    set: (item.card_set_name ?? "Unknown set") as CollectionCard["set"],
    year: 0,
    grade: Number.isFinite(grade) ? grade : 0,
    house: item.house ?? "loupe",
    condition: (item.condition ?? null) as CollectionCard["condition"],
    estimatedValueUsd:
      item.estimated_value_usd != null ? Number(item.estimated_value_usd) : 0,
    thumbnailUri: item.card_image_url ?? "",
    scannedAt: item.graded_at,
    tags: [],
  };
}

export function CollectionGrid({
  items,
  /** Whose cards — only used for the search field's placeholder. */
  ownerLabel = "this collection",
}: {
  items: readonly SocialCollectionItemWire[];
  ownerLabel?: string;
}) {
  const p = useThemedPalette();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState("");

  const columns = vaultGridColumns(width);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? items.filter(
          (i) =>
            (i.card_name ?? "").toLowerCase().includes(needle) ||
            (i.card_set_name ?? "").toLowerCase().includes(needle) ||
            (i.card_number ?? "").toLowerCase().includes(needle),
        )
      : items;
    return chunkRows(filtered.map(toCollectionCard), columns);
  }, [items, q, columns]);

  const total = rows.reduce((n, r) => n + r.length, 0);

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {/* Search their vault — the question people actually arrive with. */}
      <View
        style={[
          styles.search,
          { borderColor: p.line.default, backgroundColor: p.bg.elevated },
        ]}
      >
        <Search size={15} color={p.ink.dim} strokeWidth={2.4} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={`Search ${ownerLabel}`}
          placeholderTextColor={p.ink.dim}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.input, { color: p.ink.default }]}
          accessibilityLabel="Search this collection"
        />
        {q.length > 0 ? (
          <Pressable
            onPress={() => setQ("")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={15} color={p.ink.dim} />
          </Pressable>
        ) : null}
      </View>

      {q.trim() && total === 0 ? (
        <Text style={[styles.empty, { color: p.ink.dim }]}>
          Nothing here matches “{q.trim()}”.
        </Text>
      ) : (
        <>
          {q.trim() ? (
            <Text style={[styles.count, { color: p.ink.dim }]}>
              {total} {total === 1 ? "match" : "matches"}
            </Text>
          ) : null}
          {/* Rows are chunked by the vault's own column math, so the grid
              geometry matches the vault at every screen size. */}
          <View style={styles.grid}>
            {rows.map((row, i) => (
              <View key={i} style={styles.row}>
                {row.map((card) => (
                  <View key={card.id} style={styles.cell}>
                    <CardThumbnail card={card} />
                  </View>
                ))}
                {/* Pad the last row so a lone card doesn't stretch. */}
                {row.length < columns
                  ? Array.from({ length: columns - row.length }).map((_, k) => (
                      <View key={`pad${k}`} style={styles.cell} />
                    ))
                  : null}
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 14, paddingVertical: 10 },
  count: { fontSize: 11.5 },
  empty: { fontSize: 13, paddingVertical: 18, textAlign: "center" },
  grid: { gap: 12 },
  row: { flexDirection: "row", gap: 12 },
  cell: { flex: 1 },
});
