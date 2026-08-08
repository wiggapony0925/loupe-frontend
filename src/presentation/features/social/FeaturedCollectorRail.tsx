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
            {/* Their best card large, the next two stacked beside it. Three
                equal thumbnails made every tile read as a filmstrip and left
                the art too small to recognise — which is the only reason to
                look at a collector you don't know. */}
            <View style={styles.art}>
              <Image
                source={{ uri: art[0] }}
                style={styles.artHero}
                contentFit="cover"
                transition={160}
                recyclingKey={`${u.user_id}-0`}
                accessibilityIgnoresInvertColors
              />
              <View style={styles.artStack}>
                {[1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.artSmall,
                      { backgroundColor: withAlpha(p.ink.default, 0.06) },
                    ]}
                  >
                    {art[i] ? (
                      <Image
                        source={{ uri: art[i] }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={160}
                        recyclingKey={`${u.user_id}-${i}`}
                        accessibilityIgnoresInvertColors
                      />
                    ) : null}
                  </View>
                ))}
              </View>
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

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onToggleFollow({ handle: u.username, following: engaged });
                }}
                disabled={pending}
                accessibilityRole="button"
                accessibilityLabel={`${followLabel(u.relationship)} @${u.username}`}
                hitSlop={8}
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
            </View>
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
    width: 232,
    gap: 11,
    borderWidth: 1,
    borderRadius: 18,
    padding: 11,
  },
  // One card at trading-card ratio, two stacked beside it.
  art: { flexDirection: "row", gap: 5, height: 132 },
  artHero: { flex: 1.6, borderRadius: 9, overflow: "hidden" },
  artStack: { flex: 1, gap: 5 },
  artSmall: { flex: 1, borderRadius: 7, overflow: "hidden" },
  identity: { flexDirection: "row", alignItems: "center", gap: 9 },
  who: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2 },
  meta: { fontSize: 11.5 },
  // A quiet outline that sits INSIDE the identity row — the full-width mint
  // slab was the loudest thing on the page and buried the cards it sat under.
  pill: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    height: 32,
  },
  pillText: { fontSize: 12.5, fontWeight: "800" },
});
