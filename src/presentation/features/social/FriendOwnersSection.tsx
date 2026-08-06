/**
 * FriendOwnersSection — "2 of your friends own this card" on card detail.
 *
 * Self-contained: fetches collectors the viewer FOLLOWS who own this card
 * and renders NOTHING when there are none (or signed out), so the card page
 * reads exactly as before for everyone else. Tapping opens the shared
 * CollectorListSheet; tapping a friend goes to their profile.
 *
 * Privacy: following already grants collection visibility server-side, so
 * this surfaces nothing the viewer couldn't already open by hand.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ChevronRight, Users } from "lucide-react-native";
import { useFriendOwners } from "@/application/queries/social/useSocial";
import { CollectorListSheet } from "@/presentation/features/social/CollectorListSheet";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { radius, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export function FriendOwnersSection({ cardRef }: { cardRef: string }) {
  const p = useThemedPalette();
  const owners = useFriendOwners(cardRef);
  const [open, setOpen] = useState(false);

  const rows = owners.data ?? [];
  if (rows.length === 0) return null;

  const label =
    rows.length === 1
      ? `@${rows[0]!.username} owns this card`
      : `${rows.length} of your friends own this card`;

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}. See who.`}
        style={({ pressed }) => [
          styles.strip,
          {
            borderColor: p.line.default,
            backgroundColor: pressed
              ? withAlpha(p.accent.mint, 0.08)
              : p.bg.elevated,
          },
        ]}
      >
        {/* Overlapping avatar cluster, Instagram style. */}
        <View style={styles.cluster}>
          {rows.slice(0, 3).map((owner, i) => (
            <View
              key={owner.user_id}
              style={[
                styles.clusterItem,
                { marginLeft: i === 0 ? 0 : -10, borderColor: p.bg.elevated },
              ]}
            >
              <SocialAvatar
                handle={owner.username}
                name={owner.display_name}
                url={owner.avatar_url}
                size={28}
              />
            </View>
          ))}
          {rows.length <= 1 ? (
            <View
              style={[
                styles.clusterItem,
                styles.clusterIcon,
                {
                  marginLeft: rows.length === 0 ? 0 : -10,
                  borderColor: p.bg.elevated,
                  backgroundColor: withAlpha(p.accent.mint, 0.16),
                },
              ]}
            >
              <Users size={13} color={p.accent.mint} strokeWidth={2.5} />
            </View>
          ) : null}
        </View>

        <Text numberOfLines={1} style={[styles.label, { color: p.ink.default }]}>
          {label}
        </Text>
        <ChevronRight size={16} color={p.ink.dim} />
      </Pressable>

      <CollectorListSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Who owns this card"
        rows={rows}
        loading={owners.isLoading}
        emptyText="None of the collectors you follow own this card yet."
        noteFor={(u) => {
          const copies = rows.find((r) => r.user_id === u.user_id)?.copies ?? 1;
          return copies > 1 ? `owns ${copies} copies` : null;
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cluster: { flexDirection: "row", alignItems: "center" },
  clusterItem: {
    borderWidth: 2,
    borderRadius: 16,
    overflow: "hidden",
  },
  clusterIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1, fontSize: 13, fontWeight: "700" },
});
