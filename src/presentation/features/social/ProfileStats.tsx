/**
 * ProfileStats — the numbers under a collector's name.
 *
 * Three figures, inline, no container. The previous pass put them in a
 * bordered rounded box with the likes/views pair as two outlined chips
 * floating underneath, and the result read as a form control with stray
 * buttons attached rather than as someone's profile. Instagram, Robinhood and
 * every profile worth copying draw these as bare numbers in open space: the
 * value is the loud thing, the label is a whisper, and nothing is boxed.
 *
 * Likes and views fold into ONE quiet line beneath instead of competing as
 * chips. They're the secondary pair — interesting, not structural — and on a
 * 375pt phone five equally-weighted figures across meant none of them
 * registered.
 *
 * Views are shown only to the profile's owner. A public "1,204 people looked
 * at this" invites comparison over a number you can't influence, and tells
 * everyone who visits that they were counted.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Heart } from "lucide-react-native";
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
      <View style={styles.row}>
        <Stat value={cardCount} label={pluralize(cardCount, "card")} />
        <Stat
          value={followerCount}
          label={pluralize(followerCount, "follower")}
          onPress={onPressFollowers}
        />
        <Stat value={followingCount} label="following" onPress={onPressFollowing} />
      </View>

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
              {formatStat(viewCount)} {pluralize(viewCount, "view")}
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

function Stat({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress?: () => void;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={`${value} ${label}`}
      style={styles.stat}
    >
      <Text style={[styles.statValue, { color: p.ink.default }]}>
        {formatStat(value)}
      </Text>
      <Text style={[styles.statLabel, { color: p.ink.dim }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, alignItems: "center" },
  row: { flexDirection: "row", alignSelf: "stretch" },
  stat: { flex: 1, alignItems: "center", gap: 1 },
  statValue: {
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.6,
    // Tabular so the three columns don't shift width as counts tick over.
    fontVariant: ["tabular-nums"],
  },
  statLabel: { fontSize: 11.5 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
});
