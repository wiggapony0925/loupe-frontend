/**
 * ProfileStats — Cards · Followers · Following, the Instagram way.
 *
 * Three flat columns beside the avatar: bold figure over a whisper label,
 * no boxes, no borders. Every social app since 2012 has trained users that
 * THIS shape next to a profile picture means "the account's numbers" — a
 * row of bordered tiles reads as dashboard furniture instead.
 *
 * Likes/views deliberately aren't here: the heart is an ACTION (it lives
 * with the buttons), and reach is a readout line the page owns.
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
      style={({ pressed }) => [styles.stat, pressed && onPress ? { opacity: 0.6 } : null]}
    >
      <Text style={[styles.value, { color: p.ink.default }]}>
        {formatStat(value)}
      </Text>
      <Text style={[styles.label, { color: p.ink.dim }]}>{label}</Text>
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
  row: { flex: 1, flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, alignItems: "center", gap: 1 },
  value: { fontSize: 17, fontWeight: "800", letterSpacing: -0.4 },
  label: { fontSize: 11.5 },
});
