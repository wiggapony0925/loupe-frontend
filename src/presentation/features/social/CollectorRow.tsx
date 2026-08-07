/**
 * CollectorRow — the one row used for every list of people.
 *
 * Search results, suggestions, followers, following, and pending requests all
 * render this, the same way every list of *cards* in the app renders
 * `CardSparkRow`. One row means the follow button behaves identically
 * wherever you meet it, and a spacing fix lands everywhere at once.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Lock } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { SocialRelationship, SocialUserCardWire } from "@/infrastructure/http";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { SocialAvatar } from "./SocialAvatar";
import { followLabel } from "./socialLabels";

export interface CollectorRowProps {
  user: SocialUserCardWire;
  onPress: () => void;
  /** Omitted for your own row, and for lists where following is not the point. */
  onToggleFollow?: (next: { handle: string; following: boolean }) => void;
  pending?: boolean;
  /** Replaces the follow button entirely (e.g. "Remove" on my followers list,
   *  the "×2 copies" chip on card-owner lists). */
  trailing?: React.ReactNode;
}

export function CollectorRow({
  user,
  onPress,
  onToggleFollow,
  pending = false,
  trailing,
}: CollectorRowProps) {
  const p = useThemedPalette();
  const rel: SocialRelationship = user.relationship;
  const showFollow = !!onToggleFollow && rel !== "self";
  const isFollowing = rel === "following";
  const isRequested = rel === "requested";

  const handleFollow = () => {
    Haptics.selectionAsync().catch(() => {});
    onToggleFollow?.({
      handle: user.username,
      // "requested" is an outstanding ask; tapping it cancels, same as
      // unfollowing does — both are DELETE on the follow edge.
      following: isFollowing || isRequested,
    });
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open @${user.username}`}
      style={styles.row}
    >
      <SocialAvatar
        handle={user.username}
        name={user.display_name}
        url={user.avatar_url}
        isPro={user.is_pro}
      />
      <View style={styles.ident}>
        <View style={styles.nameLine}>
          <Text
            numberOfLines={1}
            style={[styles.name, { color: p.ink.default }]}
          >
            {user.display_name?.trim() || `@${user.username}`}
          </Text>
          {user.is_admin ? (
            <View
              style={[
                styles.adminTag,
                { backgroundColor: withAlpha(p.accent.mint, 0.16) },
              ]}
            >
              <Text style={[styles.adminTagText, { color: p.accent.mint }]}>
                ADMIN
              </Text>
            </View>
          ) : null}
          {user.is_private ? (
            <Lock size={11} color={p.ink.dim} strokeWidth={2.4} />
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.meta, { color: p.ink.dim }]}>
          {/* Collection size sits in the meta line: on a card app, "124
              cards" is the most useful thing to know about a stranger, and
              it was the one thing this row never said. */}
          {[
            user.display_name?.trim() ? `@${user.username}` : null,
            user.card_count > 0
              ? `${user.card_count.toLocaleString()} ${user.card_count === 1 ? "card" : "cards"}`
              : null,
            user.location,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>

      {trailing ? (
        trailing
      ) : showFollow ? (
        // Fixed-width pill: rows must line up down a list no matter whether
        // the label is Follow / Following / Requested or how long the name
        // beside it runs — ragged trailing buttons read as broken.
        <Pressable
          onPress={handleFollow}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel={`${followLabel(rel)} @${user.username}`}
          hitSlop={6}
          style={[
            styles.follow,
            isFollowing || isRequested
              ? { borderColor: p.line.default, backgroundColor: "transparent" }
              : {
                  borderColor: "transparent",
                  backgroundColor: withAlpha(p.accent.mint, 0.16),
                },
            pending ? { opacity: 0.5 } : null,
          ]}
        >
          <Text
            style={[
              styles.followText,
              {
                color:
                  isFollowing || isRequested ? p.ink.muted : p.accent.mint,
              },
            ]}
          >
            {followLabel(rel)}
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Staff marker. Mint like the Pro ring, but a TAG not a ring — a badge
  // reading ADMIN has to be unmistakable, not decoded from a colour.
  adminTag: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  adminTagText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  ident: { flex: 1, gap: 2 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { fontSize: 14.5, fontWeight: "600", flexShrink: 1 },
  meta: { fontSize: 12 },
  follow: {
    width: 96,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  followText: { fontSize: 12.5, fontWeight: "700" },
});
