/**
 * FeaturedCollectorRail — the App-Store-Shop moment of the Community page.
 *
 * Suggested collectors as an edge-to-edge horizontal rail of cards (house
 * standing rule: every swipe surface bleeds past the page gutter), each a
 * round face first — avatar with the PRO mint ring, name, handle, and a
 * state-aware follow pill. Faces sell a social surface the way card art
 * sells a shelf; a vertical list of the same people reads as admin.
 *
 * Cards never vanish on follow (the mutation patches caches), so tapping
 * Follow flips the pill in place — the rail stays stable under the thumb.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";
import type { SocialUserCardWire } from "@/infrastructure/http";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { followLabel } from "@/presentation/features/social/socialLabels";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const PAGE_PADDING = 20;

export function FeaturedCollectorRail({
  users,
  onOpen,
  onToggleFollow,
  pending = false,
}: {
  users: readonly SocialUserCardWire[];
  onOpen: (handle: string) => void;
  onToggleFollow: (next: { handle: string; following: boolean }) => void;
  pending?: boolean;
}) {
  const p = useThemedPalette();
  if (users.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Bleed to the screen edges, keep the first/last card on the gutter.
      style={styles.bleed}
      contentContainerStyle={styles.rail}
    >
      {users.map((u) => {
        const engaged =
          u.relationship === "following" || u.relationship === "requested";
        return (
          <Pressable
            key={u.user_id}
            onPress={() => onOpen(u.username)}
            accessibilityRole="button"
            accessibilityLabel={`Open @${u.username}`}
            style={({ pressed }) => [
              styles.card,
              {
                borderColor: p.line.default,
                backgroundColor: p.bg.elevated,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <SocialAvatar
              handle={u.username}
              name={u.display_name}
              url={u.avatar_url}
              size={62}
              isPro={u.is_pro}
            />
            <Text
              numberOfLines={1}
              style={[styles.name, { color: p.ink.default }]}
            >
              {u.display_name?.trim() || `@${u.username}`}
            </Text>
            <Text numberOfLines={1} style={[styles.meta, { color: p.ink.dim }]}>
              {u.display_name?.trim() ? `@${u.username}` : (u.location ?? " ")}
            </Text>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onToggleFollow({ handle: u.username, following: engaged });
              }}
              disabled={pending}
              accessibilityRole="button"
              accessibilityLabel={`${followLabel(u.relationship)} @${u.username}`}
              hitSlop={6}
              style={[
                styles.pill,
                engaged
                  ? { borderWidth: 1, borderColor: p.line.default }
                  : { backgroundColor: withAlpha(p.accent.mint, 0.16) },
                pending ? { opacity: 0.5 } : null,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: engaged ? p.ink.muted : p.accent.mint },
                ]}
              >
                {followLabel(u.relationship)}
              </Text>
            </Pressable>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -PAGE_PADDING },
  rail: {
    paddingHorizontal: PAGE_PADDING,
    paddingVertical: 2,
    gap: 10,
  },
  card: {
    width: 148,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  name: { fontSize: 13.5, fontWeight: "700", letterSpacing: -0.2, marginTop: 2 },
  meta: { fontSize: 11.5 },
  pill: {
    marginTop: 6,
    borderRadius: 999,
    width: 96,
    alignItems: "center",
    paddingVertical: 6,
  },
  pillText: { fontSize: 12.5, fontWeight: "800" },
});
