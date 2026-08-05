/**
 * ProfileStats — the row of numbers under a collector's name.
 *
 * Five figures compete for one line on a phone, so they're ranked rather than
 * shown flat: cards / followers / following are the social spine and are
 * always tappable-looking; likes and views are the vanity pair and sit
 * quieter beneath. Giving all five equal weight made the row read as a
 * dashboard and none of it registered.
 *
 * Views are only ever shown to the profile's owner. A public "1,204 people
 * looked at this" invites comparison between collectors over a number they
 * can't influence, and it quietly tells everyone who visits that they were
 * counted.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Eye, Heart } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
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
      <View style={[styles.spine, { borderColor: p.line.default }]}>
        <Stat value={cardCount} label={pluralize(cardCount, "card")} />
        <Divider />
        <Stat
          value={followerCount}
          label={pluralize(followerCount, "follower")}
          onPress={onPressFollowers}
        />
        <Divider />
        <Stat value={followingCount} label="following" onPress={onPressFollowing} />
      </View>

      <View style={styles.vanity}>
        {/* On someone else's profile the heart is the control that produces
            this number, so it's a button. On your own it's just a readout —
            you can't like yourself. */}
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
          hitSlop={6}
          style={[
            styles.chip,
            {
              borderColor: viewerHasLiked ? "transparent" : p.line.default,
              backgroundColor: viewerHasLiked
                ? withAlpha(p.accent.rose, 0.16)
                : "transparent",
            },
          ]}
        >
          <Heart
            size={13}
            color={viewerHasLiked ? p.accent.rose : p.ink.dim}
            fill={viewerHasLiked ? p.accent.rose : "transparent"}
            strokeWidth={2.2}
          />
          <Text
            style={[
              styles.chipText,
              { color: viewerHasLiked ? p.accent.rose : p.ink.muted },
            ]}
          >
            {formatStat(likeCount)}
          </Text>
        </Pressable>

        {isSelf ? (
          <View style={[styles.chip, { borderColor: p.line.default }]}>
            <Eye size={13} color={p.ink.dim} strokeWidth={2.2} />
            <Text style={[styles.chipText, { color: p.ink.muted }]}>
              {formatStat(viewCount)} {pluralize(viewCount, "view")}
            </Text>
          </View>
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

function Divider() {
  const p = useThemedPalette();
  return <View style={[styles.divider, { backgroundColor: p.line.default }]} />;
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  spine: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 17, fontWeight: "800", letterSpacing: -0.4 },
  statLabel: { fontSize: 11 },
  divider: { width: 1, alignSelf: "stretch", marginVertical: 4 },
  vanity: { flexDirection: "row", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
});
