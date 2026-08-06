/**
 * ProfileStats — the numbers under a collector's name, in the app's
 * settings-page layout language.
 *
 * Two earlier passes both got this wrong in opposite directions: first a
 * bordered rounded box with the likes/views pair as outlined chips floating
 * beneath (a form control with buttons stuck on), then bare inline numbers in
 * open space (nothing tying them to any other surface in the app).
 *
 * The Settings page already solved this. It heads itself with a row of
 * bordered figure cards — value loud, label a wide-tracked whisper — and that
 * is now a shared primitive (`StatTile`/`StatRow` in GroupedList), so this
 * screen *is* that language instead of imitating it.
 *
 * Likes and views stay a single quiet line below rather than becoming two more
 * tiles. Five equal cards across a 375pt phone means none of them registers,
 * and these two are the secondary pair — interesting, not structural.
 *
 * Views are shown only to the owner. A public "1,204 people looked at this"
 * invites comparison over a number you can't influence, and tells everyone who
 * visits that they were counted.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Heart } from "lucide-react-native";
import { StatRow, StatTile } from "@/presentation/components/GroupedList";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { formatStat, pluralize } from "./socialLabels";

export interface ProfileStatsProps {
  cardCount: number;
  followerCount: number;
  followingCount: number;
  likeCount: number;
  viewCount: number;
  viewerHasLiked: boolean;
  isSelf: boolean;
  onPressFollowers?: () => void;
  onPressFollowing?: () => void;
  onToggleLike?: () => void;
}

export function ProfileStats({
  cardCount,
  followerCount,
  followingCount,
  likeCount,
  viewCount,
  viewerHasLiked,
  isSelf,
  onPressFollowers,
  onPressFollowing,
  onToggleLike,
}: ProfileStatsProps) {
  const p = useThemedPalette();

  return (
    <View style={styles.wrap}>
      <StatRow>
        <StatTile
          label={pluralize(cardCount, "card")}
          value={formatStat(cardCount)}
        />
        <StatTile
          label={pluralize(followerCount, "follower")}
          value={formatStat(followerCount)}
          onPress={onPressFollowers}
        />
        <StatTile
          label="following"
          value={formatStat(followingCount)}
          onPress={onPressFollowing}
        />
      </StatRow>

      {/* One line, not two chips. On your own profile it's a readout; on
          someone else's the heart is the control that produces the number,
          so only that half is pressable. */}
      <View style={styles.meta}>
        <Pressable
          onPress={isSelf ? undefined : onToggleLike}
          disabled={isSelf}
          accessibilityRole={isSelf ? "text" : "button"}
          accessibilityLabel={
            isSelf
              ? `${likeCount} ${pluralize(likeCount, "like")}`
              : viewerHasLiked
                ? "Remove your like"
                : "Like this collection"
          }
          hitSlop={8}
          style={styles.metaItem}
        >
          <Heart
            size={12}
            color={viewerHasLiked ? p.accent.rose : p.ink.dim}
            fill={viewerHasLiked ? p.accent.rose : "transparent"}
            strokeWidth={2.2}
          />
          <Text
            style={[
              styles.metaText,
              { color: viewerHasLiked ? p.accent.rose : p.ink.dim },
            ]}
          >
            {formatStat(likeCount)} {pluralize(likeCount, "like")}
          </Text>
        </Pressable>

        {isSelf ? (
          <>
            <Text style={[styles.metaText, { color: p.ink.dim }]}>·</Text>
            <Text style={[styles.metaText, { color: p.ink.dim }]}>
              {/* "1 profile views" was live on the Settings profile card —
                  the count and the noun have to agree. */}
              {formatStat(viewCount)} {pluralize(viewCount, "view")}
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
});
