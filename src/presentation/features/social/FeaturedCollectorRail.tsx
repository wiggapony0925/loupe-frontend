/**
 * FeaturedCollectorRail — the App-Store-Shop moment of the Community page.
 *
 *   ┌──────────────────┐
 *   │ ▨  ▨  ▨          │ ← their three best cards
 *   │ ⬤ Name           │ ← face overlapping the art
 *   │ @handle · 124    │
 *   │ [   Follow   ]   │
 *   └──────────────────┘
 *
 * Edge-to-edge rail (house standing rule: every swipe surface bleeds past
 * the page gutter).
 *
 * The CARDS are the point. This was a face, a handle and a Follow button —
 * on an app about trading cards, a directory that never showed a single card
 * gave you no reason to tap anyone. Now the collection leads and the person
 * identifies it, which is also the order collectors think in. Art comes from
 * the server's peek (their most valuable cards); collectors with no art fall
 * back to the face alone rather than an empty frame.
 *
 * Cards never vanish on follow (the mutation patches caches), so tapping
 * Follow flips the pill in place — the rail stays stable under the thumb.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import type { SocialUserCardWire } from "@/infrastructure/http";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { followLabel } from "@/presentation/features/social/socialLabels";
import { useThemedPalette } from "@/presentation/theme/tokens";

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
  // A card that IS art has nothing to show for a collector with none, and
  // "No cards yet" in a frame only advertises the emptiness. They still
  // appear in the rows below, where a face and a handle are the point.
  //
  // (This fix was lost once already: the rail was deleted and later restored
  // from the commit BEFORE the deletion, which predated the fix.)
  const showable = users.filter((u) => (u.preview_image_urls?.length ?? 0) > 0);
  if (showable.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Bleed to the screen edges, keep the first/last card on the gutter.
      style={styles.bleed}
      contentContainerStyle={styles.rail}
    >
      {showable.map((u) => {
        const engaged =
          u.relationship === "following" || u.relationship === "requested";
        const art = u.preview_image_urls ?? [];
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
            {/* Their collection, first. */}
            <View style={[styles.art, { backgroundColor: p.bg.sunken }]}>
              {art.length > 0 ? (
                art.map((uri: string, i: number) => (
                  <Image
                    key={`${u.user_id}-${i}`}
                    source={{ uri }}
                    style={styles.artCard}
                    contentFit="cover"
                    transition={160}
                    recyclingKey={`${u.user_id}-${i}`}
                    accessibilityIgnoresInvertColors
                  />
                ))
              ) : null}
            </View>

            <View style={styles.identity}>
              <SocialAvatar
                handle={u.username}
                name={u.display_name}
                url={u.avatar_url}
                size={44}
                isPro={u.is_pro}
              />
              <View style={styles.who}>
                <Text
                  numberOfLines={1}
                  style={[styles.name, { color: p.ink.default }]}
                >
                  {u.display_name?.trim() || `@${u.username}`}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.meta, { color: p.ink.dim }]}
                >
                  {[
                    u.display_name?.trim() ? `@${u.username}` : null,
                    u.card_count > 0
                      ? `${u.card_count.toLocaleString()} ${u.card_count === 1 ? "card" : "cards"}`
                      : null,
                    u.location,
                  ]
                    .filter(Boolean)
                    .join(" · ") || " "}
                </Text>
              </View>
            </View>

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
                  : { backgroundColor: p.accent.mint },
                pending ? { opacity: 0.5 } : null,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: engaged ? p.ink.muted : "#06140d" },
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
    width: 208,
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  // The art strip: three cards at trading-card ratio, side by side.
  art: {
    flexDirection: "row",
    gap: 6,
    height: 92,
    borderRadius: 12,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  artCard: { flex: 1, height: "100%", borderRadius: 6 },
  artEmpty: { fontSize: 11.5, fontWeight: "600" },
  identity: { flexDirection: "row", alignItems: "center", gap: 9 },
  who: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontSize: 13.5, fontWeight: "700", letterSpacing: -0.2 },
  meta: { fontSize: 11.5 },
  pill: {
    borderRadius: 999,
    alignItems: "center",
    paddingVertical: 8,
  },
  pillText: { fontSize: 12.5, fontWeight: "800" },
});
