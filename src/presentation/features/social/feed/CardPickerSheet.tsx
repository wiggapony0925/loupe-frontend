/**
 * CardPickerSheet — attach a card from your vault to a post.
 *
 * This is the thing a general-purpose photo app structurally cannot do. On
 * Instagram a picture of a Charizard is a picture; here it can BE the
 * Charizard — the post carries the catalog id, so every reader gets a chip
 * that opens the card page with its real price, set and number, and the
 * poster doesn't have to type any of it.
 *
 * The list is the user's OWN vault, not the whole catalog. "Show off what
 * you have" is the verb; a global card search here would mostly be used to
 * post about cards people don't own, which is a different (and less
 * interesting) product.
 */
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Search, X } from "lucide-react-native";
import type { GradedCard } from "@/infrastructure/http";
import { useMyGrades } from "@/application/queries/collection/useMyGrades";
import { BottomSheet } from "@/presentation/components/BottomSheet";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** What the composer needs to render the attached chip before publishing. */
export interface PickedCard {
  cardId: string;
  name: string | null;
  imageUrl: string | null;
  setName: string | null;
  number: string | null;
}

export function CardPickerSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (card: PickedCard) => void;
}) {
  const p = useThemedPalette();
  const [q, setQ] = useState("");
  const grades = useMyGrades<GradedCard[]>();

  const rows = useMemo(() => {
    const all = grades.data ?? [];
    // One row per CARD, not per holding: someone with four copies of the
    // same Umbreon should see it once, or the picker is a list of duplicates.
    const seen = new Map<string, PickedCard>();
    for (const row of all) {
      if (!row.card_id || seen.has(row.card_id)) continue;
      seen.set(row.card_id, {
        cardId: row.card_id,
        name: row.card_name,
        imageUrl: row.card_image_url,
        setName: row.card_set_name,
        number: row.card_number,
      });
    }
    const needle = q.trim().toLowerCase();
    const list = [...seen.values()];
    if (!needle) return list;
    return list.filter((card) =>
      `${card.name ?? ""} ${card.setName ?? ""} ${card.number ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [grades.data, q]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Attach a card"
      subtitle="From your vault — readers get its live price."
      overlay
      minHeight="70%"
      maxHeight="90%"
      flush
    >
      <View style={styles.searchWrap}>
        <View
          style={[styles.search, { borderColor: p.line.default, backgroundColor: p.bg.elevated }]}
        >
          <Search size={15} color={p.ink.dim} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search your cards"
            placeholderTextColor={p.ink.dim}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { color: p.ink.default }]}
            accessibilityLabel="Search your vault"
          />
          {q.length > 0 ? (
            <Pressable
              onPress={() => setQ("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={14} color={p.ink.dim} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.cardId}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              onPick(item);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Attach ${item.name ?? "this card"}`}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: pressed ? withAlpha(p.ink.default, 0.05) : undefined },
            ]}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.art}
                contentFit="cover"
                transition={100}
              />
            ) : (
              <View style={[styles.art, { backgroundColor: p.bg.sunken }]} />
            )}
            <View style={styles.text}>
              <Text numberOfLines={1} style={[styles.name, { color: p.ink.default }]}>
                {item.name ?? "Card"}
              </Text>
              <Text numberOfLines={1} style={[styles.meta, { color: p.ink.dim }]}>
                {[item.setName, item.number && `#${item.number}`].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          grades.isLoading ? (
            <View style={styles.state}>
              <ActivityIndicator color={p.ink.dim} />
            </View>
          ) : (
            <View style={styles.state}>
              <Text style={[styles.emptyTitle, { color: p.ink.default }]}>
                {q ? "No cards match" : "Your vault is empty"}
              </Text>
              <Text style={[styles.emptyBody, { color: p.ink.dim }]}>
                {q
                  ? "Try a different name or set."
                  : "Scan or add a card and you can show it off here."}
              </Text>
            </View>
          )
        }
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: 20, paddingBottom: 10 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
  },
  searchInput: { flex: 1, fontSize: 14.5, paddingVertical: 10 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 12,
  },
  art: { width: 40, height: 56, borderRadius: 6 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 14.5, fontWeight: "700", letterSpacing: -0.2 },
  meta: { fontSize: 12 },
  state: { paddingVertical: 40, alignItems: "center", gap: 5 },
  emptyTitle: { fontSize: 15, fontWeight: "700" },
  emptyBody: { fontSize: 13, textAlign: "center" },
});
