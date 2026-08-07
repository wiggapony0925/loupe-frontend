/**
 * CollectionGrid — a collector's cards, rendered as YOUR VAULT renders them.
 *
 * Not a bespoke social grid: the social payload is mapped onto the vault's
 * `CollectionCard` domain shape and handed to the vault's OWN components —
 * `CardThumbnail` in grid mode, `CardSparkRow` in rows mode — laid out with
 * the vault's column math. Looking at a profile should feel like looking at
 * a vault, and if the vault tile changes, this changes with it.
 *
 * Controls are profile-SCOPED on purpose. The vault's FilterSheet writes to
 * the global vault filter store; reusing it here would silently rewrite the
 * viewer's own vault filters just because they opened someone's profile.
 */
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { LayoutGrid, List, Search, X } from "lucide-react-native";
import type { SocialCollectionItemWire } from "@/infrastructure/http";
import type { CollectionCard } from "@/domain/collection/types";
import { CardSparkRow } from "@/presentation/cards";
import { CardThumbnail } from "@/presentation/features/collection/CardThumbnail";
import {
  chunkRows,
  vaultGridColumns,
} from "@/presentation/features/collection/vaultLayout";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

type SortKey = "recent" | "value" | "grade" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "value", label: "Value" },
  { key: "grade", label: "Grade" },
  { key: "name", label: "A–Z" },
];

const PAGE_PADDING = 20;

/** Social payload → the vault's card shape, so vault components can render it. */
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
  ownerLabel = "this collection",
  interlude,
}: {
  items: readonly SocialCollectionItemWire[];
  ownerLabel?: string;
  /**
   * Rendered between the filter rail and the results — the collector's
   * shelves (portfolios, top sets) live INSIDE this section rather than
   * stacked above it, so the page has one "their collection" region.
   *
   * Hidden the moment a search or set filter is active: once you're
   * drilling for a card, a carousel between you and the results is in the
   * way, and the shelves describe the WHOLE collection, not the subset on
   * screen.
   */
  interlude?: React.ReactNode;
}) {
  const p = useThemedPalette();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"grid" | "rows">("grid");
  const [sort, setSort] = useState<SortKey>("recent");
  const [set, setSet] = useState<string | null>(null);

  // Sets present in THIS collection — the filter that actually matters on
  // a profile ("what do they have from Evolving Skies?").
  const sets = useMemo(() => {
    const seen = new Map<string, number>();
    for (const i of items) {
      const name = i.card_set_name;
      if (name) seen.set(name, (seen.get(name) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [items]);

  const cards = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = items.filter((i) => {
      if (set && i.card_set_name !== set) return false;
      if (!needle) return true;
      return (
        (i.card_name ?? "").toLowerCase().includes(needle) ||
        (i.card_set_name ?? "").toLowerCase().includes(needle) ||
        (i.card_number ?? "").toLowerCase().includes(needle)
      );
    });
    const mapped = filtered.map(toCollectionCard);
    // Newest first by default — a collection reads as a timeline.
    mapped.sort((a, b) => {
      if (sort === "value") return b.estimatedValueUsd - a.estimatedValueUsd;
      if (sort === "grade") return b.grade - a.grade;
      if (sort === "name") return a.title.localeCompare(b.title);
      return new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime();
    });
    return mapped;
  }, [items, q, set, sort]);

  const columns = vaultGridColumns(width);
  const rows = useMemo(() => chunkRows(cards, columns), [cards, columns]);
  // The row trend travels next to the domain shape, not inside it:
  // CollectionCard is the vault's type and the vault sources its sparklines
  // from a separate endpoint, so widening it here would put a field on the
  // vault that the vault doesn't fill.
  const trend = useMemo(
    () =>
      new Map(
        items.map((i) => [
          i.id,
          {
            spark: i.spark_points?.length ? i.spark_points : null,
            deltaPct: i.spark_delta_pct ?? null,
          },
        ]),
      ),
    [items],
  );

  const filtering = q.trim().length > 0 || set != null;

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {/* Search + view toggle on one line. */}
      <View style={styles.controlRow}>
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
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setMode((m) => (m === "grid" ? "rows" : "grid"));
          }}
          accessibilityRole="button"
          accessibilityLabel={
            mode === "grid" ? "Switch to list view" : "Switch to grid view"
          }
          style={[
            styles.toggle,
            { borderColor: p.line.default, backgroundColor: p.bg.elevated },
          ]}
        >
          {mode === "grid" ? (
            <List size={17} color={p.ink.default} strokeWidth={2.2} />
          ) : (
            <LayoutGrid size={17} color={p.ink.default} strokeWidth={2.2} />
          )}
        </Pressable>
      </View>

      {/* Sort + set filters — one edge-to-edge chip rail (house rule). */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.chips}
      >
        {SORTS.map((s) => (
          <Chip
            key={s.key}
            label={s.label}
            active={sort === s.key}
            onPress={() => setSort(s.key)}
          />
        ))}
        {sets.length > 1 ? (
          <View style={[styles.divider, { backgroundColor: p.line.default }]} />
        ) : null}
        {sets.length > 1
          ? sets.map((name) => (
              <Chip
                key={name}
                label={name}
                active={set === name}
                onPress={() => setSet((cur) => (cur === name ? null : name))}
              />
            ))
          : null}
      </ScrollView>

      {interlude && !filtering ? (
        <View style={styles.interlude}>{interlude}</View>
      ) : null}

      {filtering ? (
        <Text style={[styles.count, { color: p.ink.dim }]}>
          {cards.length} {cards.length === 1 ? "card" : "cards"}
        </Text>
      ) : null}

      {cards.length === 0 ? (
        <Text style={[styles.empty, { color: p.ink.dim }]}>
          Nothing here matches those filters.
        </Text>
      ) : mode === "grid" ? (
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
      ) : (
        // Rows mode = the vault's own card row, verbatim.
        <View>
          {cards.map((card) => (
            <CardSparkRow
              key={card.id}
              thumbUri={card.thumbnailUri || undefined}
              recyclingKey={card.id}
              title={card.title}
              badge={
                card.grade > 0
                  ? {
                      label:
                        card.grade % 1 === 0
                          ? String(card.grade)
                          : card.grade.toFixed(1),
                      tint: p.accent.mint,
                    }
                  : null
              }
              meta={String(card.set) || null}
              spark={trend.get(card.id)?.spark ?? null}
              deltaPct={trend.get(card.id)?.deltaPct ?? null}
              priceUsd={card.estimatedValueUsd || null}
              priceLabel="Value"
              onPress={() => router.push(routes.card(card.cardId))}
              accessibilityLabel={`${card.title}, open card page`}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        active
          ? { backgroundColor: p.accent.mint }
          : { backgroundColor: withAlpha(p.ink.default, 0.07) },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.chipText, { color: active ? "#06140d" : p.ink.muted }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  // Breathing room around the nested shelves so they read as their own
  // band inside the section rather than another row of chips.
  interlude: { gap: 18, marginTop: 4, marginBottom: 2 },
  controlRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 14, paddingVertical: 10 },
  toggle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bleed: { marginHorizontal: -PAGE_PADDING },
  chips: { paddingHorizontal: PAGE_PADDING, gap: 7, alignItems: "center" },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 30,
    maxWidth: 170,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 12.5, fontWeight: "700" },
  divider: { width: 1, height: 18, marginHorizontal: 3 },
  count: { fontSize: 11.5 },
  empty: { fontSize: 13, paddingVertical: 18, textAlign: "center" },
  grid: { gap: 12 },
  row: { flexDirection: "row", gap: 12 },
  cell: { flex: 1 },
});
