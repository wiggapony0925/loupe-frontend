/**
 * CardNoteCard — your own note about this card, at the top of the page.
 *
 * The note lives on the holding, so it used to surface only deep in the
 * ownership section (and before that, only inside the edit form). But a note
 * is the most personal thing on the screen — "bought at Worlds", "regrade
 * this one" — and the moment it matters is the moment you open the card, not
 * after scrolling past the chart, the market signals and the population
 * report.
 *
 * So it sits directly under the action row. Tapping opens that holding's
 * editor. Renders nothing when there's no note, so a card you haven't
 * annotated costs no vertical space.
 */
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, StickyNote } from "lucide-react-native";
import { useCardOwnership } from "@/application/queries/collection/useCardOwnership";
import { routes } from "@/shared/routes";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export function CardNoteCard({ cardId }: { cardId: string | null }) {
  const p = useThemedPalette();
  const { data } = useCardOwnership(cardId);

  // First copy carrying a note. Multiple annotated copies are rare; when it
  // happens the count tells you to look, rather than stacking notes up here
  // and burying the page again.
  const noted = useMemo(() => {
    const holdings = data?.holdings ?? [];
    const withNotes = holdings.filter((h) => (h.notes ?? "").trim().length > 0);
    return { first: withNotes[0] ?? null, total: withNotes.length };
  }, [data?.holdings]);

  if (!noted.first) return null;
  const note = (noted.first.notes ?? "").trim();

  return (
    <Pressable
      onPress={() => router.push(routes.gradeEdit(noted.first!.holding_id))}
      accessibilityRole="button"
      accessibilityLabel="Your note on this card. Opens the holding."
      style={[
        styles.card,
        {
          borderColor: withAlpha(p.accent.amber, 0.35),
          backgroundColor: withAlpha(p.accent.amber, 0.07),
        },
      ]}
    >
      <StickyNote
        size={14}
        color={p.accent.amber}
        strokeWidth={2.25}
        style={styles.icon}
      />
      <View style={styles.copy}>
        <Text style={[styles.label, { color: p.accent.amber }]}>
          YOUR NOTE
          {noted.total > 1 ? ` · 1 of ${noted.total}` : ""}
        </Text>
        <Text style={[styles.body, { color: p.ink.default }]}>{note}</Text>
      </View>
      <ChevronRight size={14} color={p.ink.dim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  icon: { marginTop: 1 },
  copy: { flex: 1, gap: 3 },
  label: { fontSize: 9.5, fontWeight: "800", letterSpacing: 1.4 },
  body: { fontSize: 13, lineHeight: 18 },
});
