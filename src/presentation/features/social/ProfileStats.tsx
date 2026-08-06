/**
 * ProfileStats — Cards · Followers · Following, the Instagram way.
 *
 * Three flat columns beside the avatar: bold figure over a whisper label,
 * no boxes, no borders. Every social app since 2012 has trained users that
 * THIS shape next to a profile picture means "the account's numbers".
 *
 * Structure lives on plain Views with STATIC StyleSheet refs — the columns
 * once collapsed into "1245 4 / cardsfollowersfollowing" on device, so the
 * layout is deliberately belt-and-suspenders: the row stretches, each
 * column is flexBasis-0/grow-1, and distribution doesn't depend on any
 * dynamic style resolving.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { formatStat, pluralize } from "./socialLabels";

export interface ProfileStatsProps {
  cardCount: number;
  followerCount: number;
  followingCount: number;
  onPressFollowers?: () => void;
  onPressFollowing?: () => void;
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
      <Text style={[styles.value, { color: p.ink.default }]}>
        {formatStat(value)}
      </Text>
      <Text numberOfLines={1} style={[styles.label, { color: p.ink.dim }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ProfileStats({
  cardCount,
  followerCount,
  followingCount,
  onPressFollowers,
  onPressFollowing,
}: ProfileStatsProps) {
  return (
    <View style={styles.row}>
      <Stat value={cardCount} label={pluralize(cardCount, "card")} />
      <Stat
        value={followerCount}
        label={pluralize(followerCount, "follower")}
        onPress={onPressFollowers}
      />
      <Stat value={followingCount} label="following" onPress={onPressFollowing} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stat: {
    flexGrow: 1,
    flexBasis: 0,
    alignItems: "center",
    gap: 1,
    paddingHorizontal: 2,
  },
  value: { fontSize: 17, fontWeight: "800", letterSpacing: -0.4 },
  label: { fontSize: 11.5 },
});
