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
import { StickyNote } from "lucide-react-native";
import { useCardOwnership } from "@/application/queries/collection/useCardOwnership";
import { routes } from "@/shared/routes";
import { useThemedPalette } from "@/presentation/theme/tokens";

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
      style={[styles.card, { borderLeftColor: p.line.default }]}
    >
      <StickyNote size={12} color={p.ink.dim} strokeWidth={2} style={styles.icon} />
      <View style={styles.copy}>
        <Text style={[styles.body, { color: p.ink.muted }]}>{note}</Text>
        {noted.total > 1 ? (
          <Text style={[styles.meta, { color: p.ink.dim }]}>
            1 of {noted.total} notes
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * A margin note, not a banner.
 *
 * The first pass framed this as an amber alert card, which read as a warning —
 * the loudest thing on a screen full of live market data, for what is really
 * just something you jotted down. A hairline rule and quiet text sit it beside
 * the content the way a margin annotation does: present, findable, and not
 * competing with the price.
 */
const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    borderLeftWidth: 2,
    paddingLeft: 10,
    paddingVertical: 2,
  },
  icon: { marginTop: 2 },
  copy: { flex: 1, gap: 2 },
  body: { fontSize: 13, lineHeight: 18, fontStyle: "italic" },
  meta: { fontSize: 10.5 },
});
